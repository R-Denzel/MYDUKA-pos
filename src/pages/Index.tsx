import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import Dashboard from '@/components/Dashboard';
import InventoryList from '@/components/InventoryList';
import Reports from '@/components/Reports';
import BottomNav from '@/components/BottomNav';
import CartSheet from '@/components/CartSheet';
import ScannerView from '@/components/ScannerView';
import AddProductForm from '@/components/AddProductForm';

export default function Index() {
  const { activeTab, setActiveTab, loadProductsFromFirestore, loadSalesFromFirestore } = useStore();
  const [showScanner, setShowScanner] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [prefillBarcode, setPrefillBarcode] = useState('');

  useEffect(() => {
    loadProductsFromFirestore();
    loadSalesFromFirestore();
  }, [loadProductsFromFirestore, loadSalesFromFirestore]);

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

  // Open cart sheet when cart tab is selected
  if (activeTab === 'cart') {
    setActiveTab('home');
    setCartOpen(true);
  }

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card border-b border-border px-4 py-3">
        <h1 className="text-section font-bold">DukaPOS</h1>
        <p className="text-meta text-muted-foreground">Quick Sales & Inventory</p>
      </div>

      {/* Pages */}
      {activeTab === 'home' && <Dashboard />}
      {activeTab === 'inventory' && (
        <InventoryList onAddProduct={() => setShowAddProduct(true)} />
      )}
      {activeTab === 'reports' && <Reports />}

      {/* Bottom Navigation */}
      <BottomNav onScanClick={handleScanClick} />

      {/* Cart Sheet */}
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Scanner */}
      {showScanner && (
        <ScannerView
          onClose={() => setShowScanner(false)}
          onAddNewProduct={handleAddNewProduct}
        />
      )}

      {/* Add Product Form */}
      {showAddProduct && (
        <AddProductForm
          onClose={handleCloseAddProduct}
          prefillBarcode={prefillBarcode}
        />
      )}
    </div>
  );
}
