import { useState } from 'react';
import { CheckCircle2, PackagePlus, ScanBarcode, X } from 'lucide-react';
import { toast } from 'sonner';
import ScannerView from '@/components/ScannerView';
import { useStore } from '@/store/useStore';
import type { Product } from '@/types/pos';

interface RestockDialogProps {
  product: Product;
  onClose: () => void;
}

function createOperationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `restock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getPendingOperationId(productId: string, quantity: number, variantId?: string) {
  const storageKey = `myduka.pendingRestock:${JSON.stringify([productId, variantId ?? null, quantity])}`;
  try {
    const storedId = window.sessionStorage.getItem(storageKey);
    if (storedId) return { id: storedId, storageKey };
    const id = createOperationId();
    window.sessionStorage.setItem(storageKey, id);
    return { id, storageKey };
  } catch {
    throw new Error('Restock could not save its retry reference. Allow session storage and retry.');
  }
}

function clearPendingOperation(storageKey: string) {
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch (error) {
    console.warn('Could not clear the completed restock retry reference', error);
  }
}

export default function RestockDialog({ product, onClose }: RestockDialogProps) {
  const { products, restockProduct } = useStore();
  const currentProduct = products.find((item) => item.id === product.id) ?? product;
  const [isScanning, setIsScanning] = useState(true);
  const [verifiedBarcode, setVerifiedBarcode] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [variantId, setVariantId] = useState(currentProduct.variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState('1');
  const [isRestocking, setIsRestocking] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<{
    id: string;
    quantity: number;
    variantId?: string;
  } | null>(null);

  const selectedVariant = currentProduct.variants.find((variant) => variant.id === variantId);
  const availableStock = currentProduct.hasVariants
    ? selectedVariant?.stock ?? 0
    : currentProduct.totalStock;
  const parsedQuantity = Number(quantity);

  const handleBarcodeDetected = (barcode: string) => {
    const matches = barcode.trim() === currentProduct.barcode.trim();
    setScannedBarcode(barcode.trim());
    setVerifiedBarcode(matches);
    if (!matches) {
      toast.error('That barcode belongs to a different or unknown product. No stock was changed.');
    }
    return matches;
  };

  const handleRestock = async () => {
    if (!verifiedBarcode || !Number.isSafeInteger(parsedQuantity) || parsedQuantity <= 0) return;
    if (currentProduct.hasVariants && !selectedVariant) return;

    const targetVariantId = currentProduct.hasVariants ? variantId : undefined;
    setIsRestocking(true);
    try {
      const request = getPendingOperationId(currentProduct.id, parsedQuantity, targetVariantId);
      const operation = pendingOperation &&
        pendingOperation.quantity === parsedQuantity &&
        pendingOperation.variantId === targetVariantId
        ? pendingOperation
        : { id: request.id, quantity: parsedQuantity, variantId: targetVariantId };
      setPendingOperation(operation);
      const updatedProduct = await restockProduct(
        currentProduct.id,
        operation.quantity,
        operation.id,
        operation.variantId,
      );
      const updatedVariant = operation.variantId
        ? updatedProduct.variants.find((variant) => variant.id === operation.variantId)
        : undefined;
      const updatedStock = updatedVariant?.stock ?? updatedProduct.totalStock;
      toast.success(`${updatedProduct.name} restocked · ${updatedStock} available`);
      clearPendingOperation(request.storageKey);
      onClose();
    } catch (error) {
      console.error('Restock could not be completed', error);
      toast.error(error instanceof Error ? error.message : 'Stock could not be restocked. Please retry.');
    } finally {
      setIsRestocking(false);
    }
  };

  if (isScanning) {
    return (
      <ScannerView
        onClose={() => setIsScanning(false)}
        onBarcodeDetected={handleBarcodeDetected}
        barcodePrompt={`Scan the existing barcode for ${currentProduct.name}`}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="restock-title"
        className="w-full max-w-md rounded-3xl border border-border bg-card p-5 text-foreground shadow-modal"
      >
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <PackagePlus className="h-5 w-5" />
            </span>
            <div>
              <h2 id="restock-title" className="text-lg font-bold">Restock {currentProduct.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Scan and verify the existing product barcode before adding stock.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close restock" className="touch-target rounded-xl p-2 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="mt-5 space-y-4">
          {verifiedBarcode ? (
            <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>Barcode verified. Stock will be added to this product, not a new one.</span>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/50 p-3">
              <p className="text-sm font-semibold">Barcode not verified</p>
              {scannedBarcode && (
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  Scanned: {scannedBarcode}
                </p>
              )}
              <button
                type="button"
                onClick={() => setIsScanning(true)}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold"
              >
                <ScanBarcode className="h-4 w-4" />
                Scan product barcode
              </button>
            </div>
          )}

          {currentProduct.hasVariants && (
            <label className="block text-sm font-semibold">
              Package or option
              <select
                value={variantId}
                onChange={(event) => {
                  setVariantId(event.target.value);
                  setPendingOperation(null);
                }}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 font-normal"
              >
                {currentProduct.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name} · {variant.stock} currently available
                  </option>
                ))}
              </select>
            </label>
          )}

          <p className="text-sm text-muted-foreground">
            Current stock: <span className="font-bold text-foreground">{availableStock}</span>
          </p>
          <label className="block text-sm font-semibold">
            Quantity received
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) => {
                setQuantity(event.target.value);
                setPendingOperation(null);
              }}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 font-normal"
            />
          </label>

          <button
            type="button"
            onClick={() => void handleRestock()}
            disabled={
              !verifiedBarcode ||
              !Number.isSafeInteger(parsedQuantity) ||
              parsedQuantity <= 0 ||
              (currentProduct.hasVariants && !selectedVariant) ||
              isRestocking
            }
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PackagePlus className="h-4 w-4" />
            {isRestocking ? 'Updating stock…' : `Add ${Number.isSafeInteger(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : ''} to stock`}
          </button>
        </div>
      </section>
    </div>
  );
}
