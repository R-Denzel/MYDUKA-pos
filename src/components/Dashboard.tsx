import { useStore } from '@/store/useStore';
import { CURRENCIES, formatCurrency } from '@/lib/currency';
import {
  AlertTriangle,
  Banknote,
  Boxes,
  ChartNoAxesCombined,
  CircleDollarSign,
  CreditCard,
  Package,
  Plus,
  ReceiptText,
  ScanBarcode,
  Smartphone,
  TrendingUp,
} from 'lucide-react';

interface DashboardProps {
  onAddProduct: () => void;
  onStartSale: () => void;
  onOpenReports: () => void;
  rateRefreshFailed: boolean;
  hasSavedRates: boolean;
}

export default function Dashboard({
  onAddProduct,
  onStartSale,
  onOpenReports,
  rateRefreshFailed,
  hasSavedRates,
}: DashboardProps) {
  const {
    todayTotal,
    todaySales,
    products,
    displayCurrency,
    setDisplayCurrency,
    exchangeRates,
    ratesUpdatedAt,
  } = useStore();
  const total = todayTotal();
  const sales = todaySales();
  const lowStockProducts = products.filter((product) => product.totalStock < 5);
  const cashCollected = sales
    .filter((sale) => sale.paymentMethod === 'cash')
    .reduce((sum, sale) => sum + sale.total, 0);
  const averageSale = sales.length ? total / sales.length : 0;
  const tenderTypes = [
    { method: 'cash', label: 'Cash', icon: Banknote, color: 'bg-emerald-500' },
    { method: 'mobile_money', label: 'Mobile Money', icon: Smartphone, color: 'bg-blue-500' },
    { method: 'card', label: 'Card', icon: CreditCard, color: 'bg-violet-500' },
  ] as const;
  const tenderStats = tenderTypes.map((tender) => {
    const amount = sales
      .filter((sale) => sale.paymentMethod === tender.method)
      .reduce((sum, sale) => sum + sale.total, 0);
    return {
      ...tender,
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0,
    };
  });

  const rateDescription = rateRefreshFailed
    ? hasSavedRates
      ? 'Live rates unavailable · using last saved rate'
      : 'Live rates unavailable · using an estimate'
    : ratesUpdatedAt
      ? `Rates updated ${new Date(ratesUpdatedAt).toLocaleString()}`
      : 'Estimated exchange rates in use';

  return (
    <div className="space-y-6 px-4 pb-32 pt-6 sm:px-6 lg:space-y-7 lg:px-0 lg:pb-10 lg:pt-7">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Today at a glance</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Shop overview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sales, stock, and checkout activity in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onOpenReports}
            className="hidden min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold shadow-card transition hover:bg-muted sm:inline-flex"
          >
            <ChartNoAxesCombined className="h-4 w-4" />
            Shift summary
          </button>
          <button
            type="button"
            onClick={onStartSale}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-card transition hover:brightness-105 sm:flex-none"
          >
            <ScanBarcode className="h-4 w-4" />
            New sale
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <article className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <CircleDollarSign className="h-4 w-4 text-primary" />
                Today’s gross sales
              </p>
              <button
                type="button"
                aria-label={`Sales today ${formatCurrency(total, displayCurrency, exchangeRates)}. Double tap to switch currency.`}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  const currentIndex = CURRENCIES.indexOf(displayCurrency);
                  setDisplayCurrency(CURRENCIES[(currentIndex + 1) % CURRENCIES.length]);
                }}
                className="mt-3 block select-none text-left touch-manipulation"
              >
                <span className="block text-3xl font-extrabold tracking-tight text-foreground tabular-nums sm:text-4xl">
                  {formatCurrency(total, displayCurrency, exchangeRates)}
                </span>
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                {sales.length} completed order{sales.length === 1 ? '' : 's'} · Double-tap amount to change currency
              </p>
            </div>
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
            <span>{rateDescription}</span>
            <span className="ml-auto">Base currency: UGX</span>
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold">Tender mix</h3>
              <p className="mt-1 text-xs text-muted-foreground">{sales.length} checkouts today</p>
            </div>
            <span className="rounded-xl bg-primary/10 p-2 text-primary">
              <ReceiptText className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-muted">
            {tenderStats.map((tender) => (
              <span key={tender.method} className={tender.color} style={{ width: `${tender.percent}%` }} />
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {tenderStats.map(({ method, label, icon: Icon, amount, percent, color }) => (
              <div key={method} className="flex items-center gap-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-xs font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">{total ? `${Math.round(percent)}%` : '—'}</span>
                <span className="w-24 text-right text-xs font-bold tabular-nums">
                  {formatCurrency(amount, displayCurrency, exchangeRates)}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Completed orders', value: String(sales.length), detail: 'Today', icon: ReceiptText, color: 'text-blue-600 bg-blue-500/10' },
          { label: 'Average basket', value: formatCurrency(averageSale, displayCurrency, exchangeRates), detail: 'Per completed sale', icon: TrendingUp, color: 'text-emerald-700 bg-emerald-500/10' },
          { label: 'Cash collected', value: formatCurrency(cashCollected, displayCurrency, exchangeRates), detail: 'Cash payments today', icon: CircleDollarSign, color: 'text-violet-700 bg-violet-500/10' },
          { label: 'Active products', value: String(products.length), detail: `${lowStockProducts.length} low on stock`, icon: Boxes, color: lowStockProducts.length ? 'text-amber-700 bg-amber-500/10' : 'text-emerald-700 bg-emerald-500/10' },
        ].map(({ label, value, detail, icon: Icon, color }) => (
          <article key={label} className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">{label}</span>
              <span className={`rounded-lg p-2 ${color}`}><Icon className="h-4 w-4" /></span>
            </div>
            <p className="mt-4 truncate text-xl font-extrabold tracking-tight tabular-nums sm:text-2xl">{value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
          </article>
        ))}
      </section>

      {lowStockProducts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-warning">Needs attention</p>
              <h3 className="mt-1 text-lg font-bold tracking-tight">Restock watchlist</h3>
            </div>
            <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
              {lowStockProducts.length} item{lowStockProducts.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lowStockProducts.slice(0, 6).map((product) => (
              <article
                key={product.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{product.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{product.category}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs font-bold text-destructive">
                  {product.totalStock} left
                </span>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your activity</p>
              <h3 className="mt-1 text-lg font-bold tracking-tight">Recent transactions</h3>
            </div>
            <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <ReceiptText className="h-5 w-5" />
            </span>
          </div>

          {sales.length ? (
            <div className="mt-5 divide-y divide-border">
              {sales.slice(-5).reverse().map((sale) => (
                <div key={sale.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <ReceiptText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {sale.items.length} item{sale.items.length === 1 ? '' : 's'}
                      </p>
                      <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                        {sale.paymentMethod.replace('_', ' ')} ·{' '}
                        {new Date(sale.timestamp).toLocaleTimeString('en-UG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums">
                    {formatCurrency(sale.total, displayCurrency, exchangeRates)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-muted/70 px-4 py-7 text-center">
              <ReceiptText className="mx-auto h-7 w-7 text-muted-foreground/70" />
              <p className="mt-2 text-sm font-semibold">Your first sale is one scan away</p>
              <p className="mt-1 text-xs text-muted-foreground">Scan a product to get started.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between gap-5 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-bold tracking-tight">
              {products.length ? 'Keep your stock up to date' : 'Build your inventory'}
            </h3>
            <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
              Add products with a barcode so checkout stays quick and your stock stays accurate.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddProduct}
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:brightness-105"
          >
            <Plus className="h-4 w-4" />
            Add a product
          </button>
          {lowStockProducts.length > 0 && (
            <p className="flex items-center gap-2 border-t border-border pt-4 text-xs text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {lowStockProducts.length} product{lowStockProducts.length === 1 ? '' : 's'} need restocking
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
