import { useCallback, useState } from 'react';
import { useStore } from '@/store/useStore';
import { Product, ProductVariant, CATEGORIES } from '@/types/pos';
import { X, Plus, ScanBarcode, Trash2, CheckCircle2 } from 'lucide-react';
import ScannerView from '@/components/ScannerView';
import { toast } from 'sonner';
import { LockKeyhole, Barcode } from 'lucide-react';

interface AddProductFormProps {
  onClose: () => void;
  prefillBarcode?: string;
  hasPremium?: boolean;
  onOpenSettings?: () => void;
}

export default function AddProductForm({
  onClose,
  prefillBarcode,
  hasPremium = false,
  onOpenSettings = () => undefined,
}: AddProductFormProps) {
  const { addProduct } = useStore();
  const [name, setName] = useState(prefillBarcode ? `Product ${prefillBarcode.slice(-4)}` : '');
  const [barcode, setBarcode] = useState(prefillBarcode || '');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [basePrice, setBasePrice] = useState('');
  const [stock, setStock] = useState('');
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<{ name: string; price: string; stock: string }[]>([]);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'synced' | 'local' | null>(null);

  const handleBarcodeDetected = useCallback((scannedBarcode: string) => {
    setBarcode(scannedBarcode);
  }, []);

  const generateBarcode = () => {
    if (!hasPremium) {
      onOpenSettings();
      return;
    }
    const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
      : Math.random().toString(36).slice(2, 12).toUpperCase();
    setBarcode(`DK${suffix}`);
  };

  const uuid = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'id-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
  };

  const addVariant = () => {
    setVariants([...variants, { name: '', price: basePrice, stock: '' }]);
  };

  const removeVariant = (i: number) => {
    setVariants(variants.filter((_, idx) => idx !== i));
  };

  const updateVariant = (i: number, field: string, value: string) => {
    setVariants(variants.map((v, idx) => (idx === i ? { ...v, [field]: value } : v)));
  };

  const handleSubmit = async () => {
    if (!name.trim() || !basePrice || isSaving) return;
    if (hasVariants && variants.length === 0) {
      toast.error('Add at least one package or product option.');
      return;
    }
    if (hasVariants && variants.some((variant) => !variant.name.trim())) {
      toast.error('Enter a name for each package or product option.');
      return;
    }
    setIsSaving(true);

    const productVariants: ProductVariant[] = hasVariants
      ? variants.map((v) => ({
          id: uuid(),
          name: v.name,
          price: Number(v.price) || Number(basePrice),
          stock: Number(v.stock) || 0,
        }))
      : [];

    const totalStock = hasVariants
      ? productVariants.reduce((s, v) => s + v.stock, 0)
      : Number(stock) || 0;

    const product: Product = {
      id: uuid(),
      name,
      barcode: barcode || `MAN-${Date.now()}`,
      category,
      basePrice: Number(basePrice),
      hasVariants,
      variants: productVariants,
      totalStock,
      createdAt: new Date().toISOString(),
    };

    try {
      const synced = await addProduct(product);
      setSaveStatus(synced ? 'synced' : 'local');
      toast.success(
        synced
          ? `${name.trim()} saved to inventory`
          : `${name.trim()} saved on this device; cloud sync failed`,
      );
    } catch (err) {
      console.error('Failed to add product:', err);
      toast.error('Could not save product. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background lg:flex lg:items-center lg:justify-center lg:bg-foreground/45 lg:p-8 lg:backdrop-blur-sm">
      <section className="flex h-full flex-col bg-background lg:h-auto lg:max-h-[90vh] lg:w-full lg:max-w-3xl lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:shadow-modal">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 lg:px-6">
        <button onClick={onClose} className="touch-target flex items-center justify-center active-scale">
          <X className="w-6 h-6" />
        </button>
        <div className="text-center">
          <p className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-primary lg:block">Inventory</p>
          <h1 className="text-section font-semibold">Add Product</h1>
        </div>
        <button
          onClick={saveStatus ? onClose : handleSubmit}
          disabled={isSaving || (!saveStatus && (!name.trim() || !basePrice || isNaN(Number(basePrice)) || Number(basePrice) <= 0))}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-body font-semibold active-scale disabled:opacity-40"
        >
          {isSaving ? 'Saving…' : saveStatus ? 'Done' : 'Save'}
        </button>
      </header>

      {/* Form */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 lg:px-6" style={{ maxHeight: 'calc(100vh - 60px)', WebkitOverflowScrolling: 'touch' }}>
        {saveStatus && (
          <div
            role="status"
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              saveStatus === 'synced'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
            }`}
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">
                {saveStatus === 'synced' ? 'Product saved to inventory' : 'Product saved on this device'}
              </p>
              <p className="mt-1 text-sm">
                {saveStatus === 'synced'
                  ? `${name.trim()} is ready to sell.`
                  : `${name.trim()} is available here, but cloud sync failed.`}
              </p>
            </div>
          </div>
        )}
        <div>
          <label className="text-meta text-muted-foreground font-medium block mb-1">Product Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Coca-Cola 500ml"
            className="w-full bg-card border border-border rounded-lg px-4 py-3 text-body focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="text-meta text-muted-foreground font-medium block mb-1">Barcode</label>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan or enter barcode (optional)"
              className="min-w-0 flex-1 basis-40 bg-card border border-border rounded-lg px-4 py-3 text-body focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="button"
              onClick={() => setShowBarcodeScanner(true)}
              aria-label="Scan barcode"
              title="Scan barcode"
              className="touch-target flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-foreground active-scale"
            >
              <ScanBarcode className="h-5 w-5" />
              <span className="hidden text-sm font-medium sm:inline">Scan</span>
            </button>
            <button
              type="button"
              onClick={generateBarcode}
              title="Generate an internal Code 128 barcode"
              className="touch-target flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-foreground active-scale"
            >
              {hasPremium ? <Barcode className="h-5 w-5" /> : <LockKeyhole className="h-4 w-4" />}
              <span className="hidden text-sm font-medium sm:inline">Generate</span>
            </button>
          </div>
          {prefillBarcode && (
            <p className="text-success text-xs mt-1">✓ Scanned barcode: {prefillBarcode}</p>
          )}
        </div>

        <div>
          <label className="text-meta text-muted-foreground font-medium block mb-1">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-2 rounded-lg text-meta font-medium active-scale transition-colors ${
                  category === cat
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-meta text-muted-foreground font-medium block mb-1">Price (UGX) *</label>
          <input
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            placeholder="0"
            className="w-full bg-card border border-border rounded-lg px-4 py-3 text-body tabular-nums focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {!hasVariants && (
          <div>
            <label className="text-meta text-muted-foreground font-medium block mb-1">Stock Quantity</label>
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="0"
              className="w-full bg-card border border-border rounded-lg px-4 py-3 text-body tabular-nums focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        )}

        {/* Variants Toggle */}
        <div className="flex items-center justify-between py-2">
          <div className="pr-4">
            <span className="flex items-center gap-1.5 text-body font-medium">
              Sell in multiple options or packages?
              {!hasPremium && <LockKeyhole className="h-3.5 w-3.5 text-muted-foreground" />}
            </span>
            <p className="mt-1 text-xs text-muted-foreground">
              Examples: single bottle, carton of 12, 500g pack, or a dozen.
            </p>
          </div>
          <button
            type="button"
            aria-label="Toggle package options"
            aria-pressed={hasVariants}
            onClick={() => {
              if (!hasPremium) {
                onOpenSettings();
                return;
              }
              setHasVariants(!hasVariants);
            }}
            className={`w-12 h-7 rounded-full transition-colors ${
              hasVariants ? 'bg-accent' : 'bg-muted'
            } relative`}
            style={{ willChange: 'background-color' }}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-card shadow-card ${
                hasVariants ? 'left-6' : 'left-1'
              }`}
              style={{ transition: 'left 0.2s ease-out', willChange: 'left' }}
            />
          </button>
        </div>

        {hasVariants && (
          <div className="space-y-3">
            {variants.map((v, i) => (
              <div key={i} className="bg-muted rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-meta font-medium text-muted-foreground">Variant {i + 1}</span>
                  <button onClick={() => removeVariant(i)} className="touch-target flex items-center justify-center">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
                <input
                  type="text"
                  value={v.name}
                  onChange={(e) => updateVariant(i, 'name', e.target.value)}
                  placeholder="e.g. Carton of 12, 500g pack, or Blue"
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-body focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    value={v.price}
                    onChange={(e) => updateVariant(i, 'price', e.target.value)}
                    placeholder="Price"
                    className="bg-card border border-border rounded-lg px-3 py-2 text-body tabular-nums focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <input
                    type="number"
                    min="0"
                    value={v.stock}
                    onChange={(e) => updateVariant(i, 'stock', e.target.value)}
                    placeholder="Stock"
                    className="bg-card border border-border rounded-lg px-3 py-2 text-body tabular-nums focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            ))}
            <button
              onClick={addVariant}
              className="w-full border-2 border-dashed border-border rounded-lg py-3 text-body text-muted-foreground font-medium active-scale flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Variant
            </button>
          </div>
        )}
      </div>
      </section>
      {showBarcodeScanner && (
        <ScannerView
          onClose={() => setShowBarcodeScanner(false)}
          onBarcodeDetected={handleBarcodeDetected}
        />
      )}
    </div>
  );
}
