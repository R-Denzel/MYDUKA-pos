# DukaPOS - Bug Fixes and Code Improvements

## Overview
This document contains all identified bugs and their recommended fixes based on whitebox and blackbox testing.

---

## 🔴 CRITICAL BUGS (P0)

### Bug #1: Scanner `hasScanned` Ref Never Resets

**File:** `src/components/ScannerView.tsx`  
**Severity:** CRITICAL  
**Status:** NOT FIXED

**Current Code (Buggy):**
```typescript
export default function ScannerView({ onClose, onAddNewProduct }: ScannerViewProps) {
  const { getProductByBarcode, addToCart } = useStore();
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScanned = useRef(false); // ❌ PROBLEM: Never resets!

  const handleLookup = (code: string) => {
    if (!code.trim()) return;
    const product = getProductByBarcode(code.trim());
    if (product) {
      addToCart({...});
      toast.success(`${product.name} added to cart`);
      stopScanner();
      onClose(); // Component unmounts but hasScanned stays true
    }
  };
```

**Why It's a Problem:**
1. User scans barcode → hasScanned becomes true
2. Component closes
3. User reopens scanner
4. Scan callback checks: `if (!hasScanned.current)` → FALSE, so callback never fires
5. User cannot scan again without restarting app

**Recommended Fix:**
```typescript
export default function ScannerView({ onClose, onAddNewProduct }: ScannerViewProps) {
  const { getProductByBarcode, addToCart } = useStore();
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScanned = useRef(false);

  useEffect(() => {
    if (!showManual) {
      hasScanned.current = false; // ✅ RESET when scanner starts
      startScanner();
    }
    return () => { 
      stopScanner(); 
      hasScanned.current = false; // ✅ RESET on cleanup
    };
  }, [showManual]);

  const handleLookup = (code: string) => {
    if (!code.trim()) return;
    const product = getProductByBarcode(code.trim());
    if (product) {
      addToCart({...});
      toast.success(`${product.name} added to cart`);
      hasScanned.current = false; // ✅ RESET here too
      stopScanner();
      onClose();
    } else {
      toast.info('Product not found — add it now');
      hasScanned.current = false; // ✅ RESET for new product flow
      stopScanner();
      onAddNewProduct(code.trim());
    }
  };
  // ... rest of component
}
```

**Test to Validate Fix:**
```typescript
it('should allow multiple scans in succession', async () => {
  // Scan product 1
  // Add to cart
  // Close scanner
  // Reopen scanner
  // Scan product 2
  // Should work without hasScanned blocking it
});
```

---

### Bug #2: Stock Deduction Logic for Variants is Broken

**File:** `src/store/useStore.ts` (lines 118-141)  
**Severity:** CRITICAL  
**Status:** NOT FIXED

**Current Code (Buggy):**
```typescript
completeSale: (paymentMethod) => {
  const { cart, products } = get();
  if (cart.length === 0) return null;

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const sale: Sale = {
    id: crypto.randomUUID(),
    items: [...cart],
    total,
    paymentMethod,
    timestamp: new Date().toISOString(),
  };

  // ❌ PROBLEM AREA: Complex variant deduction logic
  const updatedProducts = products.map((p) => {
    const cartItems = cart.filter((c) => c.productId === p.id);
    if (cartItems.length === 0) return p;

    let totalDeducted = 0;
    const updatedVariants = p.variants.map((v) => {
      const ci = cartItems.find((c) => c.variantId === v.id);
      if (ci) {
        totalDeducted += ci.qty;
        return { ...v, stock: Math.max(0, v.stock - ci.qty) };
      }
      return v;
    });

    // ❌ THIS IS WRONG: If product has variants, there should be NO non-variant items!
    const nonVariantItems = cartItems.filter((c) => !c.variantId);
    const nonVariantQty = nonVariantItems.reduce((s, c) => s + c.qty, 0);
    totalDeducted += nonVariantQty; // ❌ Counts non-variant qty but never uses consistent logic!

    return {
      ...p,
      variants: updatedVariants,
      totalStock: Math.max(0, p.totalStock - totalDeducted), // Could be wrong!
    };
  });

  set({
    sales: [...get().sales, sale],
    products: updatedProducts,
    cart: [],
  });

  return sale;
};
```

**Why It's a Problem:**
1. If a product has variants, cart items for that product MUST have variantId set
2. The code tries to handle BOTH variant AND non-variant items for products with variants
3. This creates double-deduction: counts non-variant qty but doesn't properly deduct from variant stock
4. Stock goes negative or becomes inaccurate

**Example Scenario:**
```
Product: "Shirt" with hasVariants=true
Variants: ["Blue-M" (stock: 5), "Red-M" (stock: 5)]

Cart:
- { productId: 'shirt', variantId: 'blue-m', qty: 2 }
- { productId: 'shirt', variantId: 'red-m', qty: 1 }

After sale:
totalDeducted = 2 + 1 = 3
totalStock reduced by 3 ✓ (correct so far)
Blue-M stock reduced by 2 ✓
Red-M stock reduced by 1 ✓

BUT: Code also tries to find nonVariantItems for product "shirt"
If none exist, still counts them as 0, then:
totalStock = totalStock - (2 + 1 + 0) = correct by chance

However, if logic changes or cart item structure differs, this breaks!
```

**Recommended Fix:**
```typescript
completeSale: (paymentMethod) => {
  const { cart, products } = get();
  if (cart.length === 0) return null;

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const sale: Sale = {
    id: crypto.randomUUID(),
    items: [...cart],
    total,
    paymentMethod,
    timestamp: new Date().toISOString(),
  };

  // ✅ FIXED: Clearer logic for variant vs non-variant
  const updatedProducts = products.map((p) => {
    const cartItemsForProduct = cart.filter((c) => c.productId === p.id);
    if (cartItemsForProduct.length === 0) return p; // No changes for this product

    if (p.hasVariants) {
      // ✅ Handle variant products: each cart item must have variantId
      const updatedVariants = p.variants.map((variant) => {
        const cartQty = cartItemsForProduct
          .filter((c) => c.variantId === variant.id)
          .reduce((sum, c) => sum + c.qty, 0);
        
        return {
          ...variant,
          stock: Math.max(0, variant.stock - cartQty),
        };
      });

      const totalDeducted = updatedVariants.reduce(
        (sum, v) => sum + (p.variants.find(ov => ov.id === v.id)?.stock || 0) - v.stock,
        0
      );

      return {
        ...p,
        variants: updatedVariants,
        totalStock: Math.max(0, p.totalStock - totalDeducted),
      };
    } else {
      // ✅ Handle non-variant products: all cart items for this product deduct from totalStock
      const totalQty = cartItemsForProduct.reduce((sum, c) => sum + c.qty, 0);
      return {
        ...p,
        totalStock: Math.max(0, p.totalStock - totalQty),
        variants: [],
      };
    }
  });

  set({
    sales: [...get().sales, sale],
    products: updatedProducts,
    cart: [],
  });

  return sale;
};
```

---

### Bug #3: No Variant Validation in AddProductForm

**File:** `src/components/AddProductForm.tsx` (lines 54-61)  
**Severity:** CRITICAL  
**Status:** NOT FIXED

**Current Code (Buggy):**
```typescript
const handleSubmit = () => {
  if (!name || !basePrice) return; // ❌ Allows empty variants!

  const productVariants: ProductVariant[] = hasVariants
    ? variants.map((v) => ({
        id: crypto.randomUUID(),
        name: v.name, // ❌ Could be empty string!
        price: Number(v.price) || Number(basePrice),
        stock: Number(v.stock) || 0,
      }))
    : [];

  // If hasVariants=true but variants=[], this creates a product with no variants
  // But hasVariants flag is still true, breaking the sale logic
};
```

**Recommended Fix:**
```typescript
const handleSubmit = () => {
  // ✅ Validate required fields
  if (!name || !basePrice) {
    toast.error('Product name and price are required');
    return;
  }

  // ✅ Validate variants if enabled
  if (hasVariants) {
    if (variants.length === 0) {
      toast.error('Add at least one variant');
      return;
    }

    // Validate each variant
    for (const v of variants) {
      if (!v.name.trim()) {
        toast.error('All variants must have a name');
        return;
      }
      if (!v.price || Number(v.price) <= 0) {
        toast.error('All variants must have a price > 0');
        return;
      }
      if (!v.stock || Number(v.stock) < 0) {
        toast.error('Variant stock cannot be negative');
        return;
      }
    }
  } else {
    // Non-variant product must have stock
    if (!stock || Number(stock) < 0) {
      toast.error('Stock must be >= 0');
      return;
    }
  }

  const productVariants: ProductVariant[] = hasVariants
    ? variants.map((v) => ({
        id: crypto.randomUUID(),
        name: v.name,
        price: Number(v.price),
        stock: Number(v.stock),
      }))
    : [];

  const totalStock = hasVariants
    ? productVariants.reduce((s, v) => s + v.stock, 0)
    : Number(stock) || 0;

  const product: Product = {
    id: crypto.randomUUID(),
    name,
    barcode: barcode || `MAN-${crypto.randomUUID().substring(0, 8)}`, // ✅ Better unique ID
    category,
    basePrice: Number(basePrice),
    hasVariants,
    variants: productVariants,
    totalStock,
    createdAt: new Date().toISOString(),
  };

  addProduct(product);
  toast.success('Product added successfully');
  onClose();
};
```

---

## 🟠 MODERATE BUGS (P1)

### Bug #4: Timezone Issues in Daily Sales Calculation

**File:** `src/store/useStore.ts` (lines 150-157)  
**Severity:** MODERATE  
**Status:** NOT FIXED

**Current Code (Buggy):**
```typescript
todaySales: () => {
  const today = new Date().toDateString(); // ❌ Timezone-dependent!
  // e.g., "Wed Mar 19 2026" in local timezone
  
  return get().sales.filter(
    (s) => new Date(s.timestamp).toDateString() === today
    // ❌ If timestamp is in ISO (UTC), might convert to different date in some timezones
  );
};
```

**Recommended Fix:**
```typescript
todaySales: () => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  return get().sales.filter((s) => {
    const saleDate = new Date(s.timestamp);
    return saleDate >= todayStart && saleDate < tomorrowStart;
  });
};
```

---

### Bug #5: Duplicate Barcode Generation

**File:** `src/components/AddProductForm.tsx` (line 49)  
**Severity:** MODERATE  
**Status:** NOT FIXED

**Current Code (Buggy):**
```typescript
barcode: barcode || `MAN-${Date.now()}`, // ❌ Can collide if added in same ms!
```

**Recommended Fix:**
```typescript
barcode: barcode || `MAN-${crypto.randomUUID().substring(0, 12).toUpperCase()}`,
```

---

## 🟡 MINOR BUGS (P2)

### Bug #6: No Camera Retry After Error

**File:** `src/components/ScannerView.tsx` (lines 44-49)  
**Suggested Improvement:**

```typescript
// Current
catch {
  setCameraError(true);
  setShowManual(true);
}

// Improved
catch (error) {
  console.error('Camera error:', error);
  setCameraError(true);
  setShowManual(true);
  toast.info('Camera access denied. Using manual input.');
}

// Add retry button in UI
{cameraError && (
  <button
    onClick={() => {
      setCameraError(false);
      setShowManual(false);
    }}
    className="text-sm text-accent hover:underline"
  >
    Retry Camera
  </button>
)}
```

---

### Bug #7: Insufficient Input Validation

**File:** `src/components/AddProductForm.tsx`  
**Suggested Improvements:**

```typescript
// Add to input fields
<input
  type="number"
  min="0"
  step="any"
  value={basePrice}
  onChange={(e) => {
    const val = Number(e.target.value);
    if (val >= 0) setBasePrice(e.target.value);
  }}
/>
```

---

## Summary Table

| Bug ID | File | Issue | Severity | Fix Status |
|--------|------|-------|----------|-----------|
| #1 | ScannerView.tsx | hasScanned ref never resets | 🔴 P0 | TODO |
| #2 | useStore.ts | Stock deduction logic broken | 🔴 P0 | TODO |
| #3 | AddProductForm.tsx | No variant validation | 🔴 P0 | TODO |
| #4 | useStore.ts | Timezone issues | 🟠 P1 | TODO |
| #5 | AddProductForm.tsx | Duplicate barcodes | 🟠 P1 | TODO |
| #6 | ScannerView.tsx | No camera retry | 🟡 P2 | Suggested |
| #7 | AddProductForm.tsx | Missing input validation | 🟡 P2 | Suggested |

---

## Implementation Priority

1. ✅ **Week 1:** Fix bugs #1, #2, #3 (Critical - blocks core functionality)
2. ✅ **Week 2:** Fix bugs #4, #5 (High - data integrity issues)
3. ✅ **Week 3:** Implement #6, #7 (Nice-to-have improvements)

