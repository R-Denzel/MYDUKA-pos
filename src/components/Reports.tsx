import { useStore } from '@/store/useStore';
import { useMemo } from 'react';
import { TrendingUp, Award, Package } from 'lucide-react';

const formatUGX = (amount: number) => `UGX ${amount.toLocaleString('en-UG')}`;

export default function Reports() {
  const { sales, products } = useStore();

  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

    const todaySales = sales.filter((s) => new Date(s.timestamp).toDateString() === today);
    const weekSales = sales.filter((s) => new Date(s.timestamp) >= weekAgo);
    const monthSales = sales.filter((s) => new Date(s.timestamp) >= monthAgo);

    // Top sellers
    const itemCounts: Record<string, { name: string; qty: number; revenue: number }> = {};
    sales.forEach((s) =>
      s.items.forEach((item) => {
        if (!itemCounts[item.productId]) {
          itemCounts[item.productId] = { name: item.name, qty: 0, revenue: 0 };
        }
        itemCounts[item.productId].qty += item.qty;
        itemCounts[item.productId].revenue += item.price * item.qty;
      })
    );
    const topSellers = Object.values(itemCounts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      today: { count: todaySales.length, total: todaySales.reduce((s, x) => s + x.total, 0) },
      week: { count: weekSales.length, total: weekSales.reduce((s, x) => s + x.total, 0) },
      month: { count: monthSales.length, total: monthSales.reduce((s, x) => s + x.total, 0) },
      topSellers,
      totalProducts: products.length,
      lowStock: products.filter((p) => p.totalStock < 5).length,
    };
  }, [sales, products]);

  return (
    <div className="px-4 pt-4 pb-32 space-y-4">
      <h1 className="text-section font-bold">Reports</h1>

      {/* Period Stats */}
      <div className="space-y-2">
        {[
          { label: 'Today', ...stats.today },
          { label: 'This Week', ...stats.week },
          { label: 'This Month', ...stats.month },
        ].map((period) => (
          <div
            key={period.label}
            className="bg-card rounded-lg p-4 shadow-card border border-border flex items-center justify-between"
          >
            <div>
              <p className="text-meta text-muted-foreground font-medium">{period.label}</p>
              <p className="text-section font-bold tabular-nums">{formatUGX(period.total)}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-primary">
                <TrendingUp className="w-4 h-4" />
                <span className="text-body font-bold tabular-nums">{period.count}</span>
              </div>
              <p className="text-meta text-muted-foreground">sales</p>
            </div>
          </div>
        ))}
      </div>

      {/* Top Sellers */}
      {stats.topSellers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-accent" />
            <h2 className="text-section font-semibold">Top Sellers</h2>
          </div>
          {stats.topSellers.map((item, i) => {
            const maxQty = stats.topSellers[0]?.qty || 1;
            return (
              <div key={i} className="bg-card rounded-lg p-3 shadow-card border border-border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-body font-medium truncate flex-1">{item.name}</p>
                  <p className="text-meta font-bold tabular-nums text-primary ml-2">
                    {item.qty} sold
                  </p>
                </div>
                {/* Simple progress bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${(item.qty / maxQty) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inventory Summary */}
      <div className="space-y-2">
        <h2 className="text-section font-semibold">Inventory Summary</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-lg p-4 shadow-card border border-border">
            <Package className="w-5 h-5 text-accent mb-1" />
            <p className="text-total font-bold tabular-nums">{stats.totalProducts}</p>
            <p className="text-meta text-muted-foreground">Products</p>
          </div>
          <div className="bg-card rounded-lg p-4 shadow-card border border-border">
            <Package className="w-5 h-5 text-destructive mb-1" />
            <p className="text-total font-bold tabular-nums">{stats.lowStock}</p>
            <p className="text-meta text-muted-foreground">Low Stock</p>
          </div>
        </div>
      </div>

      {sales.length === 0 && (
        <div className="text-center py-8">
          <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-body font-medium">No sales yet</p>
          <p className="text-meta text-muted-foreground mt-1">
            Start selling to see your reports here
          </p>
        </div>
      )}
    </div>
  );
}
