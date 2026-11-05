import { useStore } from '@/store/useStore';
import { CURRENCIES, formatCurrency } from '@/lib/currency';
import {
  ArrowUpRight,
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  Package,
  Plus,
  ReceiptText,
  TrendingUp,
} from 'lucide-react';
import FirebaseHealth from '@/components/FirebaseHealth';

interface DashboardProps {
  onAddProduct: () => void;
  rateRefreshFailed: boolean;
  hasSavedRates: boolean;
}

export default function Dashboard({
  onAddProduct,
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

  const rateDescription = rateRefreshFailed
    ? hasSavedRates
      ? 'Live rates unavailable · using last saved rate'
      : 'Live rates unavailable · using an estimate'
    : ratesUpdatedAt
      ? `Rates updated ${new Date(ratesUpdatedAt).toLocaleString()}`
      : 'Connecting for live rates · estimated rates in use';

  return (
    <div className="space-y-7 px-4 pb-32 pt-7 sm:px-6 lg:space-y-9 lg:px-8 lg:pt-10">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Good business starts here.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A clear view of how your shop is doing today.
          </p>
        </div>
        <FirebaseHealth />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
        <div className="relative isolate overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-modal sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-20 -z-10 h-64 w-64 rounded-full border-[34px] border-primary-foreground/5" />
          <div className="pointer-events-none absolute -bottom-24 right-24 -z-10 h-48 w-48 rounded-full bg-primary-foreground/[0.06] blur-2xl" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-primary-foreground/75">
                <CircleDollarSign className="h-4 w-4" />
                Sales today
              </p>
              <button
                type="button"
                aria-label={`Sales today ${formatCurrency(total, displayCurrency, exchangeRates)}. Double tap to switch currency.`}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  const currentIndex = CURRENCIES.indexOf(displayCurrency);
                  setDisplayCurrency(CURRENCIES[(currentIndex + 1) % CURRENCIES.length]);
                }}
                className="mt-5 block select-none text-left touch-manipulation"
              >
                <span className="block text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl">
                  {formatCurrency(total, displayCurrency, exchangeRates)}
                </span>
              </button>
              <p className="mt-2 text-sm text-primary-foreground/70">
                {sales.length} transaction{sales.length === 1 ? '' : 's'} recorded today
              </p>
              <p className="mt-1 text-xs text-primary-foreground/60">
                Double tap the amount to change currency
              </p>
            </div>
            <div className="rounded-2xl bg-primary-foreground/10 p-3">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-7 flex items-center gap-2 border-t border-primary-foreground/15 pt-4 text-xs text-primary-foreground/70">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
            <span>{rateDescription}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <article className="rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Products</span>
              <span className="rounded-xl bg-accent/10 p-2 text-accent">
                <Boxes className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-4 text-3xl font-extrabold tracking-tight tabular-nums">{products.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">In your inventory</p>
          </article>
          <article className="rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Low stock</span>
              <span className={`rounded-xl p-2 ${lowStockProducts.length ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}`}>
                <AlertTriangle className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-4 text-3xl font-extrabold tracking-tight tabular-nums">{lowStockProducts.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Products below 5 units</p>
          </article>
        </div>
      </section>

      {lowStockProducts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-warning">Needs attention</p>
              <h3 className="mt-1 text-lg font-bold tracking-tight">Running low</h3>
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

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your activity</p>
              <h3 className="mt-1 text-lg font-bold tracking-tight">Recent sales</h3>
            </div>
            <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <ReceiptText className="h-5 w-5" />
            </span>
          </div>

          {sales.length ? (
            <div className="mt-5 divide-y divide-border">
              {sales.slice(-4).reverse().map((sale) => (
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
            <div className="mt-5 rounded-2xl bg-muted/70 px-4 py-6 text-center">
              <ReceiptText className="mx-auto h-7 w-7 text-muted-foreground/70" />
              <p className="mt-2 text-sm font-semibold">Your first sale is one scan away</p>
              <p className="mt-1 text-xs text-muted-foreground">Scan a product to get started.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between gap-5 rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
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
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:opacity-90 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Add a product
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </section>

    </div>
  );
}
