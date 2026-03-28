import { useStore } from '@/store/useStore';
import { TrendingUp, AlertTriangle, Package } from 'lucide-react';
import FirebaseHealth from '@/components/FirebaseHealth';

const formatUGX = (amount: number) =>
  `UGX ${amount.toLocaleString('en-UG')}`;

export default function Dashboard() {
  const { todayTotal, todaySales, products } = useStore();
  const total = todayTotal();
  const salesCount = todaySales().length;
  const lowStockProducts = products.filter((p) => p.totalStock < 5);

  return (
    <div className="px-4 pt-4 pb-32 space-y-4">
      <FirebaseHealth />
      {/* Daily Total */}
      <div className="bg-primary rounded-lg p-5 shadow-card">
        <p className="text-primary-foreground/70 text-meta font-medium">
          Today's Sales
        </p>
        <p className="text-primary-foreground text-total font-bold tabular-nums mt-1">
          {formatUGX(total)}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <TrendingUp className="w-4 h-4 text-primary-foreground/70" />
          <span className="text-primary-foreground/70 text-meta">
            {salesCount} sale{salesCount !== 1 ? 's' : ''} today
          </span>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h2 className="text-section font-semibold">Running Low</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {lowStockProducts.slice(0, 6).map((product) => (
              <div
                key={product.id}
                className="flex-shrink-0 w-36 bg-card rounded-lg p-3 shadow-card border border-border"
              >
                <p className="text-body font-medium truncate">
                  {product.name}
                </p>
                <p className="text-meta text-destructive font-semibold mt-1">
                  {product.totalStock} left
                </p>
                <p className="text-meta text-muted-foreground truncate">
                  {product.category}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-lg p-4 shadow-card border border-border">
          <Package className="w-5 h-5 text-accent mb-2" />
          <p className="text-total font-bold tabular-nums">{products.length}</p>
          <p className="text-meta text-muted-foreground">Total Products</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card border border-border">
          <AlertTriangle className="w-5 h-5 text-destructive mb-2" />
          <p className="text-total font-bold tabular-nums">
            {lowStockProducts.length}
          </p>
          <p className="text-meta text-muted-foreground">Low Stock Items</p>
        </div>
      </div>

      {/* Recent Sales */}
      {todaySales().length > 0 && (
        <div className="space-y-2">
          <h2 className="text-section font-semibold">Recent Sales</h2>
          <div className="space-y-2">
            {todaySales()
              .slice(-5)
              .reverse()
              .map((sale) => (
                <div
                  key={sale.id}
                  className="bg-card rounded-lg p-3 shadow-card border border-border flex items-center justify-between"
                >
                  <div>
                    <p className="text-body font-medium">
                      {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-meta text-muted-foreground capitalize">
                      {sale.paymentMethod.replace('_', ' ')} •{' '}
                      {new Date(sale.timestamp).toLocaleTimeString('en-UG', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <p className="text-body font-bold tabular-nums text-primary">
                    {formatUGX(sale.total)}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {products.length === 0 && (
        <div className="text-center py-8">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-body font-medium">No products yet</p>
          <p className="text-meta text-muted-foreground mt-1">
            Go to Inventory to add your first product
          </p>
        </div>
      )}
    </div>
  );
}
