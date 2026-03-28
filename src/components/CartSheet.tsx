import { useStore } from '@/store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Banknote, Smartphone, CreditCard, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { PaymentMethod } from '@/types/pos';

const formatUGX = (amount?: number) => {
  const safeAmount = Number(amount || 0);
  return `UGX ${safeAmount.toLocaleString('en-UG')}`;
};

interface CartSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function CartSheet({ open, onClose }: CartSheetProps) {
  const { cart, cartTotal, updateCartQty, removeFromCart, completeSale, clearCart } = useStore();
  const [showPayment, setShowPayment] = useState(false);
  const [saleComplete, setSaleComplete] = useState(false);
  const [completedTotal, setCompletedTotal] = useState(0);

  const total = cartTotal();

  const handlePayment = (method: PaymentMethod) => {
    const sale = completeSale(method);
    if (sale) {
      setCompletedTotal(sale.total);
      setSaleComplete(true);
      setShowPayment(false);
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
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl shadow-modal max-h-[85vh] flex flex-col safe-bottom"
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
                  {formatUGX(completedTotal)}
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
                      onClick={() => handlePayment(method)}
                      className="flex items-center gap-4 bg-muted rounded-lg p-4 active-scale touch-target text-left"
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
                          {formatUGX(item.price)}
                        </p>
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
                          onClick={() => updateCartQty(item.productId, item.qty + 1, item.variantId)}
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
                    <button
                      onClick={() => setShowPayment(true)}
                      className="w-full bg-primary text-primary-foreground rounded-lg py-4 text-body font-bold active-scale touch-target"
                    >
                      Charge {formatUGX(total)}
                    </button>
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
