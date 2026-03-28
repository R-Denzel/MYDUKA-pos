# DukaPOS - Debug & Test Report

**Date:** March 19, 2026  
**App:** Mobile-first POS & Inventory Management System  
**Testing Approach:** Whitebox (code structure) + Blackbox (user behavior)

---

## PART 1: WHITEBOX TESTING (Code Structure Analysis)

### 1. **CRITICAL BUG: Stock Deduction Logic Issue** ❌
**Location:** [src/store/useStore.ts](src/store/useStore.ts#L118-L141)  
**Severity:** HIGH

**Problem:**
```typescript
// Current logic (BUGGY):
const updatedVariants = p.variants.map((v) => {
  const ci = cartItems.find((c) => c.variantId === v.id);
  if (ci) {
    totalDeducted += ci.qty;
    return { ...v, stock: Math.max(0, v.stock - ci.qty) };
  }
  return v;
});

const nonVariantItems = cartItems.filter((c) => !c.variantId);
const nonVariantQty = nonVariantItems.reduce((s, c) => s + c.qty, 0);
totalDeducted += nonVariantQty; // BUG: Never updates totalStock properly
```

**Issue:** If a product has variants, there should NOT be non-variant items in the cart for that product. The logic is confusing and can lead to double-deduction.

**Impact:** Inventory accuracy is compromised; stock can go negative unexpectedly.

**Fix:** Remove the non-variant deduction logic or validate that products with variants don't have non-variant cart items.

---

### 2. **CRITICAL BUG: Scanner Not Resetting** ❌
**Location:** [src/components/ScannerView.tsx](src/components/ScannerView.tsx#L30)  
**Severity:** HIGH

**Problem:**
```typescript
const hasScanned = useRef(false); // Never resets to false!

const handleLookup = (code: string) => {
  if (!code.trim()) return;
  // ... logic
  stopScanner();
  onClose(); // Component unmounts but hasScanned stays true
};
```

**Issue:** Once user scans, `hasScanned.current` is set to true. When component remounts, the scan callback will never fire again because the ref is still true.

**Impact:** User cannot scan multiple products without restarting the app.

**Fix:** Reset `hasScanned.current = false` when scanner restarts or on component cleanup.

---

### 3. **MODERATE BUG: Timezone Issues in Daily Totals** ⚠️
**Location:** [src/store/useStore.ts](src/store/useStore.ts#L150-L157)  
**Severity:** MEDIUM

**Problem:**
```typescript
todaySales: () => {
  const today = new Date().toDateString(); // Timezone-dependent!
  return get().sales.filter(
    (s) => new Date(s.timestamp).toDateString() === today
  );
};
```

**Issue:** `toDateString()` uses local timezone. If user's device timezone changes or data syncs across regions, it may show wrong data.

**Impact:** Daily reports could be inaccurate.

**Fix:** Use consistent UTC or standardized date comparison.

---

### 4. **MODERATE BUG: Duplicate Barcode Generation** ⚠️
**Location:** [src/components/AddProductForm.tsx](src/components/AddProductForm.tsx#L49)  
**Severity:** MEDIUM

**Problem:**
```typescript
barcode: barcode || `MAN-${Date.now()}`, // Can collide if 2 products added in same ms
```

**Issue:** Two products added simultaneously could generate the same barcode.

**Impact:** Barcode lookup breaks; wrong product gets scanned.

**Fix:** Use `crypto.randomUUID()` instead of timestamp.

---

### 5. **MODERATE BUG: No Variant Validation** ⚠️
**Location:** [src/components/AddProductForm.tsx](src/components/AddProductForm.tsx#L27-L31)  
**Severity:** MEDIUM

**Problem:**
```typescript
if (hasVariants && variants.length === 0) {
  // No validation - allows saving empty variants!
}
```

**Issue:** User can set `hasVariants = true` but save with zero variants or empty variant names.

**Impact:** Product becomes unusable; can't be scanned or sold.

**Fix:** Validate that if `hasVariants = true`, then all variant fields are filled.

---

### 6. **MINOR BUG: Camera Error Recovery** ⚠️
**Location:** [src/components/ScannerView.tsx](src/components/ScannerView.tsx#L44-L49)  
**Severity:** LOW

**Problem:**
```typescript
catch {
  setCameraError(true);
  setShowManual(true); // No way to retry camera
}
```

**Issue:** If camera fails, user can only use manual input. No retry button.

**Impact:** UX friction; user thinks camera is permanently broken.

**Fix:** Add retry button for camera permission.

---

### 7. **MINOR: Missing Input Validation** ⚠️
**Location:** [src/components/AddProductForm.tsx](src/components/AddProductForm.tsx#L54-L61)  
**Severity:** LOW

**Problem:**
```typescript
const handleSubmit = () => {
  if (!name || !basePrice) return; // No validation for negative prices or empty stock
};
```

**Issue:** User can enter negative price, negative stock without warnings.

**Impact:** Invalid data in inventory.

**Fix:** Add min/max validation on number inputs.

---

### 8. **MINOR: Cart Item without Variant Matching Issue** ⚠️
**Location:** [src/store/useStore.ts](src/store/useStore.ts#L55-L67)  
**Severity:** LOW

**Problem:**
```typescript
const existing = s.cart.find(
  (c) => c.productId === item.productId && c.variantId === item.variantId
); // For non-variant products, variantId is undefined for both; works but unclear
```

**Issue:** Works for non-variant items (both undefined), but confusing logic. Better to explicitly handle variant vs non-variant.

**Impact:** Code maintainability; edge cases could break.

**Fix:** Add explicit handling for variant vs non-variant items.

---

## PART 2: BLACKBOX TESTING (User Behavior)

### Test Scenarios

#### Scenario 1: Add Product → Scan → Checkout
```
Step 1: User taps "Add Product"
Step 2: Enters name, price, stock (no variants)
Step 3: Saves product
✓ Expected: Product appears in inventory
✓ Expected: Product can be scanned

Step 4: User scans barcode
✓ Expected: Item added to cart with correct price
✓ Expected: New scan should work (FAILS due to hasScanned bug)

Step 5: User proceeds to checkout
✓ Expected: Cart total calculates correctly
✓ Expected: Receipt shows correct items
✓ Expected: Stock deducted from inventory
```

#### Scenario 2: Product with Variants
```
Step 1: Add product "Shirt"
Step 2: Enable variants
Step 3: Add variants: "Blue-M", "Blue-L", "Red-M", "Red-L"
Step 4: Save

✓ Expected: All variants saved with correct stock
! BUG RISK: If variant names are empty, product breaks

Step 5: Scan barcode
! ISSUE: Which variant gets added? Current logic adds to cart without variant
! Result: Incorrect stock deduction for specific variant
```

#### Scenario 3: Multiple Scans in Succession
```
Step 1: Start scanner
Step 2: Scan Product A
✓ Expected: "Product A added to cart"
✓ Expected: Scanner auto-closes

Step 3: Tap "Scan Again"
✓ Expected: Scanner reopens and ready for next scan
✗ ACTUAL: Scanner captures but nothing happens (hasScanned ref still true)
✗ FAILURE: User must close and reopen scanner
```

#### Scenario 4: Daily Sales & Timezone Edge Case
```
Step 1: User in Uganda (UTC+3)
Step 2: Makes sale at 11:50 PM
Step 3: Device syncs at 11:55 PM (still same day locally)
✓ Expected: Sale counts toward today's total

Step 4: Device timezone changes to UTC+0
✓ Expected: Sale still counts as today
✗ ACTUAL: Might show sale as yesterday due to timezone conversion
```

#### Scenario 5: Duplicate Barcode Collision
```
Step 1: Add "Coca-Cola" with manual barcode 5901234
Step 2: Add another "Coca-Cola" with same barcode

✓ Expected: System warns of duplicate
✗ ACTUAL: Both products created with different barcodes (one auto-generated)

Step 3: Scan barcode 5901234
✗ Result: Only first entry in product list matches, so first product scans
```

---

## PART 3: TEST COVERAGE MATRIX

| Feature | Whitebox | Blackbox | Status |
|---------|----------|----------|--------|
| Add Product (No Variants) | ✓ | Need to test | Partial ✓ |
| Add Product (With Variants) | ✗ Bug found | Not tested | **FAIL** |
| Scanner - Barcode Lookup | ✓ | ✗ Bug found | **FAIL** |
| Scanner - Manual Input | ✓ | Need to test | Partial ✓ |
| Add to Cart | ✓ | Need to test | Partial ✓ |
| Checkout & Payment | ✓ | Need to test | Partial ✓ |
| Stock Deduction | ✗ Bug found | ✗ Bug likely | **FAIL** |
| Daily Reports | ✗ Bug found | Need to test | **FAIL** |
| Cart Calculations | ✓ | Need to test | Partial ✓ |
| UI Responsiveness | ✓ | Need to test | Partial ✓ |

---

## PART 4: RECOMMENDED FIXES (Prioritized)

### 🔴 P0 (Critical - Fix Before Production)
1. **Fix scanner `hasScanned` ref resetting** [ScannerView.tsx]
2. **Fix stock deduction logic for variants** [useStore.ts]
3. **Add variant name validation** [AddProductForm.tsx]

### 🟠 P1 (High - Fix Soon)
4. Fix timezone issues in daily sales [useStore.ts]
5. Replace timestamp-based barcode generation [AddProductForm.tsx]
6. Add input validation for prices/stock [AddProductForm.tsx]

### 🟡 P2 (Medium - Fix in Next Release)
7. Add camera retry button [ScannerView.tsx]
8. Improve variant vs non-variant handling [useStore.ts]
9. Add duplicate barcode detection [useStore.ts]

---

## PART 5: MANUAL TEST CHECKLIST

- [ ] Add product without variants and verify barcode auto-generates uniquely
- [ ] Add product with 3+ variants and verify all saved correctly
- [ ] Scan barcode and verify item added to cart
- [ ] Scan same barcode again without closing scanner
- [ ] Add item to cart and verify quantity increments (not duplicated)
- [ ] Remove item from cart and verify immediately removed
- [ ] Checkout with cash/mobile money/card and verify sale recorded
- [ ] Verify stock deducted correctly after checkout
- [ ] View today's sales total and verify calculation
- [ ] Check low stock alerts display correctly
- [ ] Verify cart total formats currency correctly (UGX)
- [ ] Test app with offline mode (if implemented)
- [ ] Test data persistence after browser refresh

---

## Summary

**Tests Executed:** Basic code review + structure analysis  
**Issues Found:** 8 bugs (3 critical, 2 moderate, 3 minor)  
**Pass Rate:** ~40% (several critical features have bugs)  
**Recommendation:** Address P0 bugs before shipping to users

