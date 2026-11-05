import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Search, Plus, Package, ScanBarcode } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

function getStockColor(stock: number) {
  if (stock < 5) return 'text-destructive';
  if (stock < 10) return 'text-warning';
  return 'text-muted-foreground';
}

interface InventoryListProps {
  onAddProduct: () => void;
}

export default function InventoryList({ onAddProduct }: InventoryListProps) {
  const { products, displayCurrency, exchangeRates } = useStore();
  const [search, setSearch] = useState('');

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pb-32">
      <div className="mx-auto flex max-w-6xl items-end justify-between gap-4 px-4 pb-4 pt-7 sm:px-6 lg:px-8 lg:pt-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Your catalogue</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Inventory</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} product{products.length === 1 ? '' : 's'} in your shop
          </p>
        </div>
        <button
          type="button"
          onClick={onAddProduct}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:opacity-90 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add product</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      <div className="sticky top-[4.5rem] z-10 border-y border-border/70 bg-background/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm shadow-card placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-3 px-4 pt-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8">
        {filtered.map((product) => (
          <div
            key={product.id}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-modal"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                <Package className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold">{product.name}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="truncate text-xs text-muted-foreground">{product.category}</span>
                <span className="h-1 w-1 shrink-0 rounded-full bg-border" />
                <span className={`shrink-0 text-xs font-semibold ${getStockColor(product.totalStock)}`}>
                  {product.totalStock} in stock
                </span>
              </div>
            </div>
            <p className="shrink-0 text-sm font-bold tabular-nums">
              {formatCurrency(product.basePrice, displayCurrency, exchangeRates)}
            </p>
          </div>
        ))}

        {filtered.length === 0 && products.length > 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border bg-card/60 px-4 py-12 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground/70" />
            <p className="mt-3 text-sm font-semibold">No products found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different name, category, or barcode.</p>
          </div>
        )}

        {products.length === 0 && (
          <div className="col-span-full rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center shadow-card">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ScanBarcode className="h-7 w-7" />
            </div>
            <p className="mt-4 text-lg font-bold">Your shelves start here</p>
            <p className="mx-auto mb-5 mt-1 max-w-sm text-sm text-muted-foreground">
              Add your first product. You can scan its barcode or enter the details yourself.
            </p>
            <button
              onClick={onAddProduct}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:opacity-90 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Add your first product
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
