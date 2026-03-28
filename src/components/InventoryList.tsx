import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Search, Plus, Package } from 'lucide-react';

const formatUGX = (amount: number) => `UGX ${amount.toLocaleString('en-UG')}`;

function getStockColor(stock: number) {
  if (stock < 5) return 'text-destructive';
  if (stock < 10) return 'text-warning';
  return 'text-muted-foreground';
}

interface InventoryListProps {
  onAddProduct: () => void;
}

export default function InventoryList({ onAddProduct }: InventoryListProps) {
  const { products } = useStore();
  const [search, setSearch] = useState('');

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pb-32">
      {/* Sticky Search */}
      <div className="sticky top-0 z-10 bg-background px-4 py-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-3 text-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      {/* Product List */}
      <div className="px-4 pt-3 space-y-2">
        {filtered.map((product) => (
          <div
            key={product.id}
            className="bg-card rounded-lg p-3 shadow-card border border-border flex items-center gap-3"
            style={{ minHeight: '64px' }}
          >
            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover rounded-md"
                />
              ) : (
                <Package className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body font-medium truncate">{product.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-meta font-semibold ${getStockColor(product.totalStock)}`}>
                  {product.totalStock} in stock
                </span>
                <span className="text-meta text-muted-foreground">
                  • {product.category}
                </span>
              </div>
            </div>
            <p className="text-body font-bold tabular-nums flex-shrink-0">
              {formatUGX(product.basePrice)}
            </p>
          </div>
        ))}

        {filtered.length === 0 && products.length > 0 && (
          <div className="text-center py-8">
            <p className="text-body text-muted-foreground">No products match your search</p>
          </div>
        )}

        {products.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-body font-medium">No products yet</p>
            <p className="text-meta text-muted-foreground mt-1 mb-4">
              Add your first product to get started
            </p>
            <button
              onClick={onAddProduct}
              className="bg-accent text-accent-foreground rounded-lg px-6 py-3 text-body font-semibold active-scale touch-target"
            >
              <Plus className="w-4 h-4 inline mr-1" />
              Add Product
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
