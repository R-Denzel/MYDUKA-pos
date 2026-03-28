import { useStore } from '@/store/useStore';
import { Home, Package, BarChart3, ShoppingCart } from 'lucide-react';

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
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border safe-bottom">
      <div className="flex items-end justify-around px-2 pt-1 pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center py-2 px-3 touch-target active-scale ${
              activeTab === tab.id ? 'text-accent' : 'text-muted-foreground'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[11px] font-medium mt-0.5">{tab.label}</span>
          </button>
        ))}

        {/* Center Scan Button */}
        <button
          onClick={onScanClick}
          className="relative -mt-5 bg-accent text-accent-foreground rounded-full w-14 h-14 flex items-center justify-center shadow-modal active-scale"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V5a2 2 0 012-2h2" />
            <path d="M17 3h2a2 2 0 012 2v2" />
            <path d="M21 17v2a2 2 0 01-2 2h-2" />
            <path d="M7 21H5a2 2 0 01-2-2v-2" />
            <line x1="7" y1="12" x2="17" y2="12" />
          </svg>
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>

        {/* Cart Tab */}
        <button
          onClick={() => setActiveTab('cart')}
          className={`flex flex-col items-center py-2 px-3 touch-target active-scale relative ${
            activeTab === 'cart' ? 'text-accent' : 'text-muted-foreground'
          }`}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-0.5">Cart</span>
          {cartCount > 0 && (
            <span className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
