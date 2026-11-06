import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  BarChart3,
  ChevronRight,
  Home,
  Moon,
  Package,
  ScanBarcode,
  Settings2,
  ShoppingCart,
  Store,
  Sun,
} from 'lucide-react';
import { getIdTokenResult, onAuthStateChanged, type User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { setLocalPremiumDemoEnabled, useStore } from '@/store/useStore';
import Dashboard from '@/components/Dashboard';
import InventoryList from '@/components/InventoryList';
import Reports from '@/components/Reports';
import BottomNav from '@/components/BottomNav';
import CartSheet from '@/components/CartSheet';
import ScannerView from '@/components/ScannerView';
import AddProductForm from '@/components/AddProductForm';
import OwnerSettings from '@/components/OwnerSettings';
import AdminDashboard from '@/components/AdminDashboard';
import { CURRENCIES, fetchExchangeRates } from '@/lib/currency';
import { auth, functions } from '@/lib/firebase';

export default function Index() {
  const {
    activeTab,
    setActiveTab,
    loadProductsFromFirestore,
    loadSalesFromFirestore,
    displayCurrency,
    setDisplayCurrency,
    setExchangeRates,
    setNotificationOwnerUid,
    ratesUpdatedAt,
  } = useStore();
  const [showScanner, setShowScanner] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [prefillBarcode, setPrefillBarcode] = useState('');
  const [themeMounted, setThemeMounted] = useState(false);
  const [rateRefreshFailed, setRateRefreshFailed] = useState(false);
  const [ownerSettingsOpen, setOwnerSettingsOpen] = useState(false);
  const [adminDashboardOpen, setAdminDashboardOpen] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [owner, setOwner] = useState<User | null>(null);
  const [hasPremium, setHasPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const demoModeAvailable = import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const premiumActive = hasPremium || isDemoMode;

  const toggleDemoMode = () => {
    const enabled = !isDemoMode;
    setLocalPremiumDemoEnabled(enabled);
    setIsDemoMode(enabled);
    if (enabled) {
      setNotificationOwnerUid(null);
    }
  };

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  useEffect(() => {
    loadProductsFromFirestore();
    loadSalesFromFirestore();
  }, [loadProductsFromFirestore, loadSalesFromFirestore]);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setOwner(currentUser);
      setHasPremium(false);
      setIsAdmin(false);
      setNotificationOwnerUid(null);
      if (currentUser) {
        setLocalPremiumDemoEnabled(false);
        setIsDemoMode(false);
      }
      if (!currentUser) return;

      void getIdTokenResult(currentUser).then((token) => {
        if (active && auth.currentUser?.uid === currentUser.uid) {
          setHasPremium(token.claims.premium === true);
        }
      }).catch((error: unknown) => {
        console.error('Unable to verify Premium access', error);
      });

      const checkAdminAccess = httpsCallable<void, { isAdmin: boolean }>(
        functions,
        'checkAdminAccess',
      );
      void checkAdminAccess().then(({ data }) => {
        if (active && auth.currentUser?.uid === currentUser.uid) {
          setIsAdmin(data.isAdmin);
        }
      }).catch((error: unknown) => {
        console.warn('Administrator access could not be verified.', error);
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [setNotificationOwnerUid]);

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

  const sections = [
    { id: 'home', label: 'Shop overview', icon: Home },
    { id: 'inventory', label: 'Inventory & stock', icon: Package },
    { id: 'reports', label: 'Reports & insights', icon: BarChart3 },
    { id: 'cart', label: 'Current sale', icon: ShoppingCart },
  ];
  const activeSection = sections.find((section) => section.id === activeTab)?.label || 'Shop overview';
  const activeMobileSection = {
    home: 'Home',
    inventory: 'Items',
    reports: 'Reports',
    cart: 'Cart',
  }[activeTab] || 'Home';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[#0F172A] px-4 py-6 text-slate-100 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-extrabold tracking-tight">MyDuka POS</p>
            <p className="text-xs text-slate-400">East Africa retail</p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Register</p>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Local checkout
            </div>
            <span className="text-xs text-slate-400">UGX</span>
          </div>
        </div>

        <nav aria-label="Desktop navigation" className="mt-8 space-y-1">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</p>
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              aria-current={activeTab === id ? 'page' : undefined}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition ${
                activeTab === id
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/20'
                  : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
              {activeTab === id && <ChevronRight className="ml-auto h-4 w-4 opacity-80" />}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={handleScanClick}
          className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-500"
        >
          <ScanBarcode className="h-5 w-5" />
          New sale · Scan
        </button>

        <div className="mt-auto border-t border-white/10 pt-4">
          {isDemoMode && (
            <div className="mb-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-[10px] font-bold tracking-wide text-emerald-300">
              LOCAL PREMIUM DEMO
            </div>
          )}
          <button
            type="button"
            onClick={() => setOwnerSettingsOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.07]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white">
              {owner?.email?.slice(0, 1).toUpperCase() || 'D'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{owner?.email || 'Local register'}</span>
              <span className="block text-xs text-slate-400">{hasPremium ? 'Premium account' : 'Basic plan'}</span>
            </span>
            <Settings2 className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-border bg-card px-4 lg:ml-64 lg:px-7">
        <div className="mx-auto flex h-[4.5rem] max-w-[1400px] items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-card lg:hidden">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold tracking-tight lg:text-lg">
                <span className="lg:hidden">{activeMobileSection}</span>
                <span className="hidden lg:inline">{activeSection}</span>
              </h1>
              <p className="hidden text-xs text-muted-foreground sm:block lg:hidden">Your business, in good hands.</p>
              <p className="hidden text-xs text-muted-foreground lg:block">{new Date().toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isDemoMode && (
              <span className="hidden rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary sm:inline">
                PREMIUM DEMO
              </span>
            )}
            <div
              role="group"
              aria-label="Choose display currency"
              title="Amounts are recorded in UGX. Currency conversions are for display."
              className="flex rounded-xl border border-border bg-background p-1"
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
              onClick={() => setOwnerSettingsOpen(true)}
              aria-label="Owner account and settings"
              title="Owner account and settings"
              className="touch-target flex items-center justify-center rounded-xl border border-border bg-background px-3 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            >
              <Settings2 className="h-4 w-4" />
            </button>
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

      <main className="mx-auto max-w-[1400px] lg:ml-64 lg:px-7">
        {activeTab === 'home' && (
          <Dashboard
            onAddProduct={() => setShowAddProduct(true)}
            onStartSale={handleScanClick}
            onOpenReports={() => setActiveTab('reports')}
            rateRefreshFailed={rateRefreshFailed}
            hasSavedRates={Boolean(ratesUpdatedAt)}
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryList
            onAddProduct={() => setShowAddProduct(true)}
            hasPremium={premiumActive}
            onOpenSettings={() => setOwnerSettingsOpen(true)}
          />
        )}
        {activeTab === 'reports' && <Reports hasPremium={premiumActive} onOpenSettings={() => setOwnerSettingsOpen(true)} />}
      </main>

      <BottomNav onScanClick={handleScanClick} />

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        hasPremium={premiumActive}
        onOpenSettings={() => setOwnerSettingsOpen(true)}
      />

      {ownerSettingsOpen && (
        <OwnerSettings
          user={owner}
          hasPremium={premiumActive}
          isAdmin={isAdmin}
          demoModeAvailable={demoModeAvailable}
          isDemoMode={isDemoMode}
          onClose={() => setOwnerSettingsOpen(false)}
          onOpenAdmin={() => setAdminDashboardOpen(true)}
          onToggleDemoMode={toggleDemoMode}
        />
      )}

      {adminDashboardOpen && (
        <AdminDashboard
          onClose={() => setAdminDashboardOpen(false)}
          onPremiumChanged={setHasPremium}
        />
      )}

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
          hasPremium={premiumActive}
          onOpenSettings={() => setOwnerSettingsOpen(true)}
        />
      )}
    </div>
  );
}
