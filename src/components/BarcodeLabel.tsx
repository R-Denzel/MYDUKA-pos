import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, X } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '@/types/pos';

interface BarcodeLabelProps {
  product: Product;
  onClose: () => void;
}

export default function BarcodeLabel({ product, onClose }: BarcodeLabelProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!barcodeRef.current) return;
    try {
      JsBarcode(barcodeRef.current, product.barcode, {
        format: 'CODE128',
        displayValue: true,
        fontSize: 14,
        height: 56,
        margin: 8,
      });
    } catch (error) {
      console.error('Unable to render barcode label', error);
      toast.error('This barcode could not be rendered as a Code 128 label.');
    }
  }, [product.barcode]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="barcode-title" className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-modal">
        <header className="no-print mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Premium label</p>
            <h2 id="barcode-title" className="mt-1 text-lg font-bold">{product.name}</h2>
          </div>
          <button type="button" aria-label="Close barcode label" onClick={onClose} className="rounded-xl p-2 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="print-label rounded-xl border border-border bg-white p-4 text-center text-black">
          <p className="mb-1 text-sm font-bold">{product.name}</p>
          <svg ref={barcodeRef} className="mx-auto max-w-full" />
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <Printer className="h-4 w-4" />
          Print barcode label
        </button>
      </section>
    </div>
  );
}
