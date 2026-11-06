import { useStore } from '@/store/useStore';
import { useMemo } from 'react';
import { TrendingUp, Award, Package, Download, LockKeyhole } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { jsPDF } from 'jspdf';

interface ReportsProps {
  hasPremium: boolean;
  onOpenSettings: () => void;
}

export default function Reports({ hasPremium, onOpenSettings }: ReportsProps) {
  const { sales, products, displayCurrency, exchangeRates } = useStore();

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

  const downloadReport = () => {
    if (!hasPremium) return;

    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text('DukaPOS Sales Report', 16, 20);
    pdf.setFontSize(10);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 16, 28);
    pdf.text(`Today: UGX ${stats.today.total.toLocaleString('en-UG')}`, 16, 39);
    pdf.text(`This week: UGX ${stats.week.total.toLocaleString('en-UG')}`, 16, 46);
    pdf.text(`This month: UGX ${stats.month.total.toLocaleString('en-UG')}`, 16, 53);

    let y = 66;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Date', 16, y);
    pdf.text('Payment', 67, y);
    pdf.text('Discount (UGX)', 113, y);
    pdf.text('VAT (UGX)', 153, y);
    pdf.text('Total (UGX)', 190, y, { align: 'right' });
    pdf.setFont('helvetica', 'normal');

    for (const sale of [...sales].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
      y += 7;
      if (y > 275) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(new Date(sale.timestamp).toLocaleDateString(), 16, y);
      pdf.text(sale.paymentMethod.replace('_', ' '), 67, y);
      pdf.text((sale.discountTotal || 0).toLocaleString('en-UG'), 113, y);
      pdf.text((sale.vatAmount || 0).toLocaleString('en-UG'), 153, y);
      pdf.text(sale.total.toLocaleString('en-UG'), 190, y, { align: 'right' });
    }

    pdf.save('dukapos-sales-report.pdf');
  };

  return (
    <div className="space-y-7 px-4 pb-32 pt-7 sm:px-6 lg:px-0 lg:pb-10 lg:pt-7">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Business insights</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sales performance and inventory health.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Totals are shown using {displayCurrency} at the saved exchange rate. Recorded values remain in UGX.
        </p>
      </div>

      <button
        type="button"
        onClick={hasPremium ? downloadReport : onOpenSettings}
        className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold ${
          hasPremium
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-card text-muted-foreground'
        }`}
      >
        {hasPremium ? <Download className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
        {hasPremium ? 'Download PDF report' : 'Premium · PDF reports'}
      </button>

      {/* Period Stats */}
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { label: 'Today', ...stats.today },
          { label: 'This Week', ...stats.week },
          { label: 'This Month', ...stats.month },
        ].map((period) => (
          <div
            key={period.label}
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-5 shadow-card"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{period.label}</p>
              <p className="mt-2 text-xl font-extrabold tracking-tight tabular-nums">
                {formatCurrency(period.total, displayCurrency, exchangeRates)}
              </p>
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
              <div key={`${item.name}-${i}`} className="rounded-2xl border border-border bg-card p-4 shadow-card">
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
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <Package className="w-5 h-5 text-accent mb-1" />
            <p className="text-total font-bold tabular-nums">{stats.totalProducts}</p>
            <p className="text-meta text-muted-foreground">Products</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <Package className="w-5 h-5 text-destructive mb-1" />
            <p className="text-total font-bold tabular-nums">{stats.lowStock}</p>
            <p className="text-meta text-muted-foreground">Low Stock</p>
          </div>
        </div>
      </div>

      {sales.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <TrendingUp className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-semibold">Your sales story starts here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Start selling to see your reports here
          </p>
        </div>
      )}
    </div>
  );
}
