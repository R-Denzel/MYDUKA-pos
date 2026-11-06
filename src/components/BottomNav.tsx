import { useStore } from '@/store/useStore';
import { Home, Package, BarChart3, ShoppingCart, ScanBarcode } from 'lucide-react';

interface BottomNavProps {
  onScanClick: () => void;
}

const tabs = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'inventory', label: 'Items', icon: Package },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

export default function BottomNav({ onScanClick }: BottomNavProps) {
  const { activeTab, setActiveTab, cart } = useStore();
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  return (
    <nav
      aria-label="Main navigation"
      className="safe-bottom fixed bottom-3 left-1/2 z-30 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-border bg-card px-1 pt-1 shadow-modal lg:hidden"
    >
      <div className="flex items-end justify-around">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={`flex min-w-[4rem] flex-col items-center gap-1 rounded-xl px-3 py-2.5 text-[11px] font-semibold transition-colors active-scale ${
              activeTab === tab.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-5 w-5" strokeWidth={activeTab === tab.id ? 2.4 : 1.8} />
            <span>{tab.label}</span>
          </button>
        ))}

        <button
          onClick={onScanClick}
          aria-label="Scan a product barcode"
          className="relative -mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-modal transition hover:brightness-110 active:scale-95"
        >
          <ScanBarcode className="h-6 w-6" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('cart')}
          aria-current={activeTab === 'cart' ? 'page' : undefined}
          className={`relative flex min-w-[4rem] flex-col items-center gap-1 rounded-xl px-3 py-2.5 text-[11px] font-semibold transition-colors active-scale ${
            activeTab === 'cart' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShoppingCart className="h-5 w-5" strokeWidth={activeTab === 'cart' ? 2.4 : 1.8} />
          <span>Cart</span>
          {cartCount > 0 && (
            <span className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
