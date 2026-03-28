import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Product, ProductVariant, CATEGORIES } from '@/types/pos';
import { X, Plus, Trash2 } from 'lucide-react';

interface AddProductFormProps {
  onClose: () => void;
  prefillBarcode?: string;
}

export default function AddProductForm({ onClose, prefillBarcode }: AddProductFormProps) {
  const { addProduct } = useStore();
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState(prefillBarcode || '');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [basePrice, setBasePrice] = useState('');
  const [stock, setStock] = useState('');
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<{ name: string; price: string; stock: string }[]>([]);

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

  const handleSubmit = () => {
    if (!name || !basePrice) return;

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

    addProduct(product);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onClose} className="touch-target flex items-center justify-center active-scale">
          <X className="w-6 h-6" />
        </button>
        <h1 className="text-section font-semibold">Add Product</h1>
        <button
          onClick={handleSubmit}
          disabled={!name || !basePrice}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-body font-semibold active-scale disabled:opacity-40"
        >
          Save
        </button>
      </div>

      {/* Form */}
      <div className="px-4 py-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 60px)' }}>
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
          <input
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Scan or enter barcode (optional)"
            className="w-full bg-card border border-border rounded-lg px-4 py-3 text-body focus:outline-none focus:ring-2 focus:ring-accent"
          />
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
          <span className="text-body font-medium">Has Variants (size, color)?</span>
          <button
            onClick={() => setHasVariants(!hasVariants)}
            className={`w-12 h-7 rounded-full transition-colors ${
              hasVariants ? 'bg-accent' : 'bg-muted'
            } relative`}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-card shadow-card transition-transform ${
                hasVariants ? 'left-6' : 'left-1'
              }`}
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
                  placeholder="e.g. Medium / Blue"
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-body focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={v.price}
                    onChange={(e) => updateVariant(i, 'price', e.target.value)}
                    placeholder="Price"
                    className="bg-card border border-border rounded-lg px-3 py-2 text-body tabular-nums focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <input
                    type="number"
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
    </div>
  );
}
