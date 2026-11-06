import { useStore } from '@/store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Banknote, Smartphone, CreditCard, CheckCircle2, LockKeyhole } from 'lucide-react';
import { useRef, useState } from 'react';
import { PaymentMethod } from '@/types/pos';
import { formatCurrency } from '@/lib/currency';
import { calculateSaleTotals, getBillableItems } from '@/lib/pricing';
import { auth } from '@/lib/firebase';
import { toast } from 'sonner';

interface CartSheetProps {
  open: boolean;
  onClose: () => void;
  hasPremium?: boolean;
  onOpenSettings?: () => void;
}

const pendingSaleStorageKey = 'myduka.pendingSaleOperation';

function getPendingSaleOperationId() {
  try {
    const storedId = window.sessionStorage.getItem(pendingSaleStorageKey);
    if (storedId) return storedId;
    const operationId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `sale-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(pendingSaleStorageKey, operationId);
    return operationId;
  } catch {
    throw new Error('Checkout could not save its retry reference. Allow session storage and retry.');
  }
}

function clearPendingSaleOperation() {
  try {
    window.sessionStorage.removeItem(pendingSaleStorageKey);
  } catch (error) {
    console.warn('Could not clear the completed checkout retry reference', error);
  }
}

export default function CartSheet({
  open,
  onClose,
  hasPremium = false,
  onOpenSettings = () => undefined,
}: CartSheetProps) {
  const {
    cart,
    products,
    cartTotal,
    updateCartQty,
    removeFromCart,
    completeSale,
    clearCart,
    displayCurrency,
    exchangeRates,
    updateCartDiscount,
    vatEnabled,
    vatRate,
    vatInclusive,
  } = useStore();
  const [showPayment, setShowPayment] = useState(false);
  const [saleComplete, setSaleComplete] = useState(false);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const saleOperationIdRef = useRef<string | null>(null);

  const total = cartTotal(hasPremium);
  const totals = calculateSaleTotals(getBillableItems(cart, hasPremium), {
    enabled: hasPremium && vatEnabled,
    rate: vatRate,
    inclusive: vatInclusive,
  });
  const stockIssue = cart.find((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    const variant = item.variantId
      ? product?.variants.find((candidate) => candidate.id === item.variantId)
      : undefined;
    const available = item.variantId ? variant?.stock : product?.totalStock;
    const requested = cart
      .filter((candidate) =>
        candidate.productId === item.productId && candidate.variantId === item.variantId,
      )
      .reduce((quantity, candidate) => quantity + candidate.qty, 0);
    return !product || (product.hasVariants && !item.variantId) ||
      available === undefined || requested > available;
  });
  const stockIssueProduct = stockIssue && products.find((product) => product.id === stockIssue.productId);
  const stockIssueVariant = stockIssue?.variantId
    ? stockIssueProduct?.variants.find((variant) => variant.id === stockIssue.variantId)
    : undefined;
  const stockIssueAvailable = stockIssue?.variantId
    ? stockIssueVariant?.stock
    : stockIssueProduct?.totalStock;
  const stockIssueRequested = stockIssue
    ? cart
      .filter((item) => item.productId === stockIssue.productId && item.variantId === stockIssue.variantId)
      .reduce((quantity, item) => quantity + item.qty, 0)
    : 0;
  const stockIssueMessage = stockIssue
    ? !stockIssueProduct
      ? `${stockIssue.name} is no longer in inventory.`
      : `Insufficient stock for ${stockIssue.name}${stockIssue.variantName ? ` (${stockIssue.variantName})` : ''}: ${stockIssueAvailable ?? 0} available, ${stockIssueRequested} in cart.`
    : '';

  const handlePayment = async (method: PaymentMethod) => {
    if (paymentInProgress) return;
    setPaymentInProgress(true);
    try {
      const operationId = saleOperationIdRef.current ??= getPendingSaleOperationId();
      const sale = await completeSale(
        method,
        auth.currentUser?.uid,
        hasPremium,
        operationId,
      );
      if (sale) {
        saleOperationIdRef.current = null;
        clearPendingSaleOperation();
        setCompletedTotal(sale.total);
        setSaleComplete(true);
        setShowPayment(false);
      } else {
        saleOperationIdRef.current = null;
        clearPendingSaleOperation();
      }
    } catch (error) {
      console.error('Sale checkout failed', error);
      toast.error(error instanceof Error ? error.message : 'Sale could not be completed. Please try again.');
    } finally {
      setPaymentInProgress(false);
    }
  };

  const handleNewSale = () => {
    setSaleComplete(false);
    setCompletedTotal(0);
    onClose();
  };

  const handleClose = () => {
    if (saleComplete) {
      setSaleComplete(false);
      setCompletedTotal(0);
    }
    setShowPayment(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-foreground/30"
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="safe-bottom fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-h-[85vh] w-full max-w-2xl flex-col rounded-t-3xl border border-border bg-card shadow-modal md:bottom-4 md:rounded-3xl"
          >
            {/* Handle */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {saleComplete ? (
              /* Sale Complete State */
              <div className="flex flex-col items-center justify-center py-12 px-6">
                <CheckCircle2 className="w-16 h-16 text-primary mb-4" />
                <h2 className="text-section font-bold mb-1">Sale Complete</h2>
                <p className="text-total font-bold tabular-nums text-primary mb-6">
                  {formatCurrency(completedTotal, displayCurrency, exchangeRates)}
                </p>
                <button
                  onClick={handleNewSale}
                  className="w-full bg-accent text-accent-foreground rounded-lg py-4 text-body font-bold active-scale touch-target"
                >
                  New Sale
                </button>
              </div>
            ) : showPayment ? (
              /* Payment Method */
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-section font-semibold">Payment Method</h2>
                  <button onClick={() => setShowPayment(false)} className="touch-target flex items-center justify-center active-scale">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { method: 'cash' as PaymentMethod, label: 'Cash', icon: Banknote },
                    { method: 'mobile_money' as PaymentMethod, label: 'Mobile Money', icon: Smartphone },
                    { method: 'card' as PaymentMethod, label: 'Card', icon: CreditCard },
                  ].map(({ method, label, icon: Icon }) => (
                    <button
                      key={method}
                      onClick={() => void handlePayment(method)}
                      disabled={paymentInProgress}
                      className="flex items-center gap-4 bg-muted rounded-lg p-4 active-scale touch-target text-left disabled:opacity-50"
                    >
                      <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-accent" />
                      </div>
                      <span className="text-body font-semibold">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Cart Items */
              <>
                <div className="flex items-center justify-between px-4 pb-2">
                  <h2 className="text-section font-semibold">
                    Cart ({cart.length})
                  </h2>
                  <button onClick={handleClose} className="touch-target flex items-center justify-center active-scale">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 space-y-2">
                  {cart.map((item) => (
                    <motion.div
                      key={`${item.productId}-${item.variantId}`}
                      layout
                      className="bg-muted rounded-lg p-3 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-body font-medium truncate">{item.name}</p>
                        {item.variantName && (
                          <p className="text-meta text-muted-foreground">{item.variantName}</p>
                        )}
                        <p className="text-meta font-semibold tabular-nums mt-0.5">
                          {formatCurrency(item.price, displayCurrency, exchangeRates)}
                        </p>
                        <div className="no-print mt-2 flex flex-wrap items-center gap-2">
                          {hasPremium ? (
                            <>
                              <select
                                aria-label={`Discount type for ${item.name}`}
                                value={item.discountType || 'percentage'}
                                onChange={(event) => updateCartDiscount(
                                  item.productId,
                                  item.variantId,
                                  event.target.value as 'percentage' | 'fixed',
                                  item.discountValue || 0,
                                )}
                                className="rounded-lg border border-border bg-card px-2 py-1 text-xs"
                              >
                                <option value="percentage">% off</option>
                                <option value="fixed">UGX off</option>
                              </select>
                              <input
                                aria-label={`Discount amount for ${item.name}`}
                                type="number"
                                min="0"
                                max={item.discountType === 'percentage' ? 100 : item.price}
                                step="0.01"
                                value={item.discountValue || ''}
                                onChange={(event) => updateCartDiscount(
                                  item.productId,
                                  item.variantId,
                                  item.discountType || 'percentage',
                                  Number(event.target.value),
                                )}
                                placeholder="Discount"
                                className="w-24 rounded-lg border border-border bg-card px-2 py-1 text-xs"
                              />
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={onOpenSettings}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"
                            >
                              <LockKeyhole className="h-3 w-3" />
                              Premium discount
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            item.qty <= 1
                              ? removeFromCart(item.productId, item.variantId)
                              : updateCartQty(item.productId, item.qty - 1, item.variantId)
                          }
                          className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center active-scale"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center text-body font-bold tabular-nums">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => {
                            if (!updateCartQty(item.productId, item.qty + 1, item.variantId)) {
                              toast.error(`No more stock available for ${item.name}`);
                            }
                          }}
                          className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center active-scale"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  {cart.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-body text-muted-foreground">Cart is empty</p>
                      <p className="text-meta text-muted-foreground mt-1">Scan or search items to add</p>
                    </div>
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="px-4 pt-3 pb-2 border-t border-border">
                  {stockIssue && (
                    <p role="alert" className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                      {stockIssueMessage} Remove it or adjust the quantity before checkout.
                    </p>
                  )}
                  <div className="mb-3 space-y-1 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal after discounts</span>
                        <span>{formatCurrency(totals.subtotal, displayCurrency, exchangeRates)}</span>
                      </div>
                      {totals.discountTotal > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Item discounts</span>
                          <span>-{formatCurrency(totals.discountTotal, displayCurrency, exchangeRates)}</span>
                        </div>
                      )}
                      {hasPremium && vatEnabled && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>VAT ({vatRate}%{vatInclusive ? ', included' : ''})</span>
                          <span>{formatCurrency(totals.vatAmount, displayCurrency, exchangeRates)}</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setShowPayment(true)}
                      disabled={Boolean(stockIssue)}
                      className="w-full bg-primary text-primary-foreground rounded-lg py-4 text-body font-bold active-scale touch-target disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Charge {formatCurrency(total, displayCurrency, exchangeRates)}
                    </button>
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      Approximate display conversion · recorded in UGX
                    </p>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
