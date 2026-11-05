import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Store, Sun } from 'lucide-react';
import { useStore } from '@/store/useStore';
import Dashboard from '@/components/Dashboard';
import InventoryList from '@/components/InventoryList';
import Reports from '@/components/Reports';
import BottomNav from '@/components/BottomNav';
import CartSheet from '@/components/CartSheet';
import ScannerView from '@/components/ScannerView';
import AddProductForm from '@/components/AddProductForm';
import { CURRENCIES, fetchExchangeRates } from '@/lib/currency';

export default function Index() {
  const {
    activeTab,
    setActiveTab,
    loadProductsFromFirestore,
    loadSalesFromFirestore,
    displayCurrency,
    setDisplayCurrency,
    setExchangeRates,
    ratesUpdatedAt,
  } = useStore();
  const [showScanner, setShowScanner] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [prefillBarcode, setPrefillBarcode] = useState('');
  const [themeMounted, setThemeMounted] = useState(false);
  const [rateRefreshFailed, setRateRefreshFailed] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  useEffect(() => {
    loadProductsFromFirestore();
    loadSalesFromFirestore();
  }, [loadProductsFromFirestore, loadSalesFromFirestore]);

  useEffect(() => {
    let active = true;
    let refreshing = false;

    const refreshRates = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const snapshot = await fetchExchangeRates();
        if (active) {
          setExchangeRates(snapshot.rates, snapshot.updatedAt);
          setRateRefreshFailed(false);
        }
      } catch (error) {
        console.warn('Unable to refresh exchange rates; retaining saved rates.', error);
        if (active) setRateRefreshFailed(true);
      } finally {
        refreshing = false;
      }
    };

    void refreshRates();
    const intervalId = window.setInterval(() => void refreshRates(), 6 * 60 * 60 * 1000);
    window.addEventListener('online', refreshRates);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('online', refreshRates);
    };
  }, [setExchangeRates]);

  useEffect(() => {
    if (activeTab === 'cart') {
      setActiveTab('home');
      setCartOpen(true);
    }
  }, [activeTab, setActiveTab]);

  const handleScanClick = () => setShowScanner(true);

  const handleAddNewProduct = (barcode: string) => {
    setPrefillBarcode(barcode);
    setShowScanner(false);
    setShowAddProduct(true);
  };

  const handleCloseAddProduct = () => {
    setShowAddProduct(false);
    setPrefillBarcode('');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 px-4 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-card">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold tracking-tight">Duka<span className="text-primary">POS</span></h1>
              <p className="hidden text-xs text-muted-foreground sm:block">Your business, in good hands.</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div
              role="group"
              aria-label="Choose display currency"
              title="Amounts are recorded in UGX. Currency conversions are for display."
              className="flex rounded-xl border border-border bg-card p-1 shadow-card"
            >
              {CURRENCIES.map((currency) => (
                <button
                  key={currency}
                  type="button"
                  aria-pressed={displayCurrency === currency}
                  onClick={() => setDisplayCurrency(currency)}
                  className={`min-h-9 rounded-lg px-2 text-[11px] font-bold transition-colors sm:px-2.5 sm:text-xs ${
                    displayCurrency === currency
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {currency}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={themeMounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : 'Change color theme'}
              title={themeMounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : 'Change color theme'}
              className="touch-target flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground shadow-card transition-colors hover:text-foreground"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="hidden text-xs font-semibold sm:inline">
                {themeMounted ? (isDark ? 'Light mode' : 'Dark mode') : 'Theme'}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl">
        {activeTab === 'home' && (
          <Dashboard
            onAddProduct={() => setShowAddProduct(true)}
            rateRefreshFailed={rateRefreshFailed}
            hasSavedRates={Boolean(ratesUpdatedAt)}
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryList onAddProduct={() => setShowAddProduct(true)} />
        )}
        {activeTab === 'reports' && <Reports />}
      </main>

      <BottomNav onScanClick={handleScanClick} />

      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />

      {showScanner && (
        <ScannerView
          onClose={() => setShowScanner(false)}
          onAddNewProduct={handleAddNewProduct}
        />
      )}

      {showAddProduct && (
        <AddProductForm
          onClose={handleCloseAddProduct}
          prefillBarcode={prefillBarcode}
        />
      )}
    </div>
  );
}
