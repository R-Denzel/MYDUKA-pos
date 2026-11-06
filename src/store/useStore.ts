import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  orderBy,
  limit,
  getDoc,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product, CartItem, Sale, PaymentMethod } from '@/types/pos';
import { ExchangeRates, FALLBACK_EXCHANGE_RATES, Currency } from '@/lib/currency';
import { calculateSaleTotals, getBillableItems } from '@/lib/pricing';

let localPremiumDemoEnabled = false;
const localRestockOperations = new Map<string, {
  productId: string;
  quantity: number;
  variantId?: string;
}>();

class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientStockError';
  }
}

export function setLocalPremiumDemoEnabled(enabled: boolean) {
  localPremiumDemoEnabled = enabled;
}

function makeOperationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function consumeSoldCartItems(cart: CartItem[], soldItems: CartItem[]) {
  const remaining = new Map<string, number>();
  for (const item of soldItems) {
    const key = `${item.productId}:${item.variantId ?? ''}`;
    remaining.set(key, (remaining.get(key) ?? 0) + item.qty);
  }

  return cart.flatMap((item) => {
    const key = `${item.productId}:${item.variantId ?? ''}`;
    const consumed = Math.min(item.qty, remaining.get(key) ?? 0);
    if (consumed === 0) return [item];
    remaining.set(key, (remaining.get(key) ?? 0) - consumed);
    const quantityLeft = item.qty - consumed;
    return quantityLeft > 0 ? [{ ...item, qty: quantityLeft }] : [];
  });
}

function saleMatchesOperation(existing: Sale, attempted: Sale) {
  const fingerprint = (sale: Sale) => JSON.stringify({
    paymentMethod: sale.paymentMethod,
    items: sale.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId ?? null,
      qty: item.qty,
      price: item.price,
      discountType: item.discountType ?? null,
      discountValue: item.discountValue ?? null,
    })),
    total: sale.total,
  });
  return fingerprint(existing) === fingerprint(attempted);
}

interface POSStore {
  loadProductsFromFirestore: () => Promise<void>;
  loadSalesFromFirestore: () => Promise<void>;
  // Products
  products: Product[];
  addProduct: (product: Product) => Promise<boolean>;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  restockProduct: (
    productId: string,
    quantity: number,
    operationId: string,
    variantId?: string,
  ) => Promise<Product>;
  getProductByBarcode: (barcode: string) => Product | undefined;

  // Cart
  cart: CartItem[];
  addToCart: (item: CartItem) => boolean;
  removeFromCart: (productId: string, variantId?: string) => void;
  updateCartQty: (productId: string, qty: number, variantId?: string) => boolean;
  clearCart: () => void;
  cartTotal: (hasPremium?: boolean) => number;

  // Sales
  sales: Sale[];
  completeSale: (
    paymentMethod: PaymentMethod,
    ownerUid?: string,
    hasPremium?: boolean,
    operationId?: string,
  ) => Promise<Sale | null>;
  todaySales: () => Sale[];
  todayTotal: () => number;

  // UI
  activeTab: string;
  setActiveTab: (tab: string) => void;
  displayCurrency: Currency;
  setDisplayCurrency: (currency: Currency) => void;
  exchangeRates: ExchangeRates;
  ratesUpdatedAt: string | null;
  setExchangeRates: (rates: ExchangeRates, updatedAt: string) => void;
  vatEnabled: boolean;
  vatRate: number;
  vatInclusive: boolean;
  vatCountry: 'Uganda' | 'Kenya' | 'Custom';
  setVatSettings: (settings: {
    enabled: boolean;
    rate: number;
    inclusive: boolean;
    country: 'Uganda' | 'Kenya' | 'Custom';
  }) => void;
  updateCartDiscount: (
    productId: string,
    variantId: string | undefined,
    discountType: 'percentage' | 'fixed',
    discountValue: number,
  ) => void;
  notificationOwnerUid: string | null;
  setNotificationOwnerUid: (uid: string | null) => void;
}

export const useStore = create<POSStore>()(
  persist(
    (set, get) => ({
      products: [],
      cart: [],
      sales: [],
      activeTab: 'home',
      displayCurrency: 'UGX',
      exchangeRates: FALLBACK_EXCHANGE_RATES,
      ratesUpdatedAt: null,
      vatEnabled: false,
      vatRate: 18,
      vatInclusive: false,
      vatCountry: 'Uganda',
      notificationOwnerUid: null,

      addProduct: async (product) => {
        set((s) => ({ products: [...s.products, product] }));
        if (localPremiumDemoEnabled) return true;
        try {
          await setDoc(doc(db, 'products', product.id), product);
          return true;
        } catch (err) {
          console.warn('Failed to persist product to Firebase', err);
          return false;
        }
      },

      updateProduct: async (id, updates) => {
        set((s) => ({
          products: s.products.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
        if (localPremiumDemoEnabled) return;
        try {
          const productRef = doc(db, 'products', id);
          const existing = await getDoc(productRef);
          if (existing.exists()) {
            await setDoc(productRef, { ...existing.data(), ...updates });
          }
        } catch (err) {
          console.warn('Failed to update product in Firebase', err);
        }
      },

      restockProduct: async (productId, quantity, operationId, variantId) => {
        if (!Number.isSafeInteger(quantity) || quantity <= 0 || !operationId.trim()) {
          throw new Error('Enter a valid restock quantity and retry.');
        }

        const applyRestock = (product: Product) => {
          if (variantId) {
            let foundVariant = false;
            const variants = product.variants.map((variant) => {
              if (variant.id !== variantId) return variant;
              foundVariant = true;
              return { ...variant, stock: variant.stock + quantity };
            });
            if (!foundVariant) throw new Error('The selected product option no longer exists.');
            return {
              ...product,
              variants,
              totalStock: variants.reduce((total, variant) => total + variant.stock, 0),
            };
          }
          if (product.hasVariants) {
            throw new Error('Choose a product option before restocking.');
          }
          return { ...product, totalStock: product.totalStock + quantity };
        };

        if (localPremiumDemoEnabled) {
          const current = get().products.find((product) => product.id === productId);
          if (!current) throw new Error('Product is no longer in inventory.');
          const previousOperation = localRestockOperations.get(operationId);
          if (previousOperation) {
            if (
              previousOperation.productId !== productId ||
              previousOperation.quantity !== quantity ||
              previousOperation.variantId !== variantId
            ) {
              throw new Error('This restock request id was already used. Start a new request.');
            }
            return current;
          }
          const updated = applyRestock(current);
          localRestockOperations.set(operationId, { productId, quantity, variantId });
          set((state) => ({
            products: state.products.map((product) =>
              product.id === productId ? updated : product,
            ),
          }));
          return updated;
        }

        const productRef = doc(db, 'products', productId);
        const operationRef = doc(db, 'restockOperations', operationId);
        const updated = await runTransaction(db, async (transaction) => {
          const operationSnapshot = await transaction.get(operationRef);
          const productSnapshot = await transaction.get(productRef);
          if (!productSnapshot.exists()) throw new Error('Product is no longer in inventory.');
          const current = productSnapshot.data() as Product;

          if (operationSnapshot.exists()) {
            const operation = operationSnapshot.data();
            if (
              operation.productId !== productId ||
              operation.quantity !== quantity ||
              (operation.variantId || undefined) !== variantId
            ) {
              throw new Error('This restock request id was already used. Start a new request.');
            }
            return current;
          }

          const next = applyRestock(current);
          transaction.set(productRef, next);
          transaction.set(operationRef, {
            productId,
            ...(variantId ? { variantId } : {}),
            quantity,
            appliedAt: new Date().toISOString(),
          });
          return next;
        });

        set((state) => ({
          products: state.products.map((product) =>
            product.id === productId ? updated : product,
          ),
        }));
        return updated;
      },

      getProductByBarcode: (barcode) =>
        get().products.find((p) => p.barcode === barcode),

      addToCart: (item) => {
        const { products, cart } = get();
        const product = products.find((candidate) => candidate.id === item.productId);
        const variant = item.variantId
          ? product?.variants.find((candidate) => candidate.id === item.variantId)
          : undefined;
        const stock = item.variantId ? variant?.stock : product?.totalStock;
        if (
          !product ||
          (product.hasVariants && !item.variantId) ||
          stock === undefined ||
          !Number.isSafeInteger(item.qty) ||
          item.qty <= 0
        ) {
          return false;
        }

        const existingItems = cart.filter(
          (candidate) =>
            candidate.productId === item.productId && candidate.variantId === item.variantId,
        );
        const firstExistingIndex = cart.findIndex(
          (candidate) =>
            candidate.productId === item.productId && candidate.variantId === item.variantId,
        );
        const requestedQty = item.qty + existingItems.reduce((total, existing) => total + existing.qty, 0);
        if (requestedQty > stock) return false;

        set((state) => ({
          cart: existingItems.length
            ? state.cart.flatMap((candidate, index) => {
                if (
                  candidate.productId !== item.productId ||
                  candidate.variantId !== item.variantId
                ) return [candidate];
                return index === firstExistingIndex
                  ? [{ ...candidate, qty: requestedQty }]
                  : [];
              })
            : [...state.cart, item],
        }));
        return true;
      },

      removeFromCart: (productId, variantId) =>
        set((s) => ({
          cart: s.cart.filter(
            (c) => !(c.productId === productId && c.variantId === variantId)
          ),
        })),

      updateCartQty: (productId, qty, variantId) => {
        const { products, cart } = get();
        if (!Number.isSafeInteger(qty)) return false;
        if (qty <= 0) {
          set((state) => ({
            cart: state.cart.filter(
              (item) => !(item.productId === productId && item.variantId === variantId),
            ),
          }));
          return true;
        }

        const product = products.find((candidate) => candidate.id === productId);
        const variant = variantId
          ? product?.variants.find((candidate) => candidate.id === variantId)
          : undefined;
        const stock = variantId ? variant?.stock : product?.totalStock;
        if (!product || (product.hasVariants && !variantId) || stock === undefined || qty > stock) {
          return false;
        }

        const existing = cart.find(
          (item) => item.productId === productId && item.variantId === variantId,
        );
        if (!existing) return false;
        const firstExistingIndex = cart.findIndex(
          (item) => item.productId === productId && item.variantId === variantId,
        );
        set((state) => ({
          cart: state.cart.flatMap((item, index) => {
            if (item.productId !== productId || item.variantId !== variantId) return [item];
            return index === firstExistingIndex ? [{ ...item, qty }] : [];
          }),
        }));
        return true;
      },

      updateCartDiscount: (productId, variantId, discountType, discountValue) =>
        set((s) => ({
          cart: s.cart.map((item) =>
            item.productId === productId && item.variantId === variantId
              ? { ...item, discountType, discountValue: Math.max(0, discountValue) }
              : item,
          ),
        })),

      clearCart: () => set({ cart: [] }),

      cartTotal: (hasPremium = false) =>
        calculateSaleTotals(getBillableItems(get().cart, hasPremium), {
          enabled: hasPremium && get().vatEnabled,
          rate: get().vatRate,
          inclusive: get().vatInclusive,
        }).total,

      loadProductsFromFirestore: async () => {
        if (localPremiumDemoEnabled) return;
        try {
          const snapshot = await getDocs(collection(db, 'products'));
          const products: Product[] = snapshot.docs.map((doc) => doc.data() as Product);
          set({ products });
        } catch (err) {
          console.warn('Failed to load products from Firebase', err);
        }
      },

      loadSalesFromFirestore: async () => {
        if (localPremiumDemoEnabled) return;
        try {
          const snapshot = await getDocs(
            query(collection(db, 'sales'), orderBy('timestamp', 'desc'), limit(200))
          );
          const sales: Sale[] = snapshot.docs.map((doc) => doc.data() as Sale);
          set({ sales });
        } catch (err) {
          console.warn('Failed to load sales from Firebase', err);
        }
      },

      completeSale: async (
        paymentMethod,
        ownerUid,
        hasPremium = false,
        operationId = makeOperationId(),
      ) => {
        const { cart } = get();
        if (cart.length === 0) return null;

        const saleItems = getBillableItems(cart, hasPremium);
        const vatEnabled = hasPremium && get().vatEnabled;
        const { subtotal, discountTotal, vatAmount, total } = calculateSaleTotals(saleItems, {
          enabled: vatEnabled,
          rate: get().vatRate,
          inclusive: get().vatInclusive,
        });
        const sale: Sale = {
          id: operationId,
          items: saleItems,
          total,
          subtotal,
          discountTotal,
          vatAmount,
          vatRate: vatEnabled ? get().vatRate : 0,
          vatInclusive: vatEnabled && get().vatInclusive,
          ...(vatEnabled ? { vatCountry: get().vatCountry } : {}),
          ...((get().notificationOwnerUid || ownerUid)
            ? { ownerUid: get().notificationOwnerUid || ownerUid }
            : {}),
          paymentMethod,
          timestamp: new Date().toISOString(),
        };
        const quantitiesByProduct = new Map<string, Map<string, number>>();
        for (const item of saleItems) {
          if (!Number.isSafeInteger(item.qty) || item.qty <= 0) {
            throw new Error(`Enter a valid quantity for ${item.name}.`);
          }
          const variants = quantitiesByProduct.get(item.productId) ?? new Map<string, number>();
          const variantKey = item.variantId ?? '';
          variants.set(variantKey, (variants.get(variantKey) ?? 0) + item.qty);
          quantitiesByProduct.set(item.productId, variants);
        }

        const applySaleToProducts = (currentProducts: Product[]) => {
          const byId = new Map(currentProducts.map((product) => [product.id, product]));
          const updated = new Map<string, Product>();
          for (const [productId, quantities] of quantitiesByProduct) {
            const product = byId.get(productId);
            if (!product) {
              throw new InsufficientStockError('A product in this sale is no longer in inventory.');
            }
            for (const [variantId, quantity] of quantities) {
              if (variantId && quantity > 0 && !product.variants.some((variant) => variant.id === variantId)) {
                throw new InsufficientStockError(`${product.name} option is no longer in inventory.`);
              }
            }
            let totalDeducted = 0;
            const variants = product.variants.map((variant) => {
              const quantity = quantities.get(variant.id) ?? 0;
              if (!quantity) return variant;
              if (quantity > variant.stock) {
                throw new InsufficientStockError(
                  `Insufficient stock for ${product.name} (${variant.name}). ${variant.stock} available.`,
                );
              }
              totalDeducted += quantity;
              return { ...variant, stock: variant.stock - quantity };
            });
            const nonVariantQuantity = quantities.get('') ?? 0;
            if (product.hasVariants && nonVariantQuantity > 0) {
              throw new InsufficientStockError(`Choose an option for ${product.name}.`);
            }
            if (nonVariantQuantity > product.totalStock) {
              throw new InsufficientStockError(
                `Insufficient stock for ${product.name}. ${product.totalStock} available.`,
              );
            }
            totalDeducted += nonVariantQuantity;
            updated.set(productId, {
              ...product,
              variants,
              totalStock: product.hasVariants
                ? variants.reduce((total, variant) => total + variant.stock, 0)
                : product.totalStock - totalDeducted,
            });
          }
          return updated;
        };

        if (localPremiumDemoEnabled) {
          const existingSale = get().sales.find((existing) => existing.id === sale.id);
          if (existingSale) {
            if (!saleMatchesOperation(existingSale, sale)) {
              throw new Error('This checkout request was already used for a different sale.');
            }
            set((state) => ({
              cart: consumeSoldCartItems(state.cart, existingSale.items),
            }));
            return existingSale;
          }
          const updatedProducts = applySaleToProducts(get().products);
          set((state) => ({
            sales: state.sales.some((existing) => existing.id === sale.id)
              ? state.sales
              : [...state.sales, sale],
            products: state.products.map((product) =>
              updatedProducts.get(product.id) ?? product,
            ),
            cart: consumeSoldCartItems(state.cart, saleItems),
          }));
          return sale;
        }

        const productSnapshots = new Map<string, Product>();
        try {
          const committed = await runTransaction(db, async (transaction) => {
            const saleRef = doc(db, 'sales', operationId);
            const existingSaleSnapshot = await transaction.get(saleRef);
            const productEntries = await Promise.all(
              [...quantitiesByProduct.keys()].map(async (productId) => ({
                productId,
                ref: doc(db, 'products', productId),
                snapshot: await transaction.get(doc(db, 'products', productId)),
              })),
            );
            const currentProducts: Product[] = [];
            for (const { productId, snapshot } of productEntries) {
              if (!snapshot.exists()) {
                throw new InsufficientStockError('A product in this sale is no longer in inventory.');
              }
              const current = snapshot.data() as Product;
              productSnapshots.set(productId, current);
              currentProducts.push(current);
            }

            if (existingSaleSnapshot.exists()) {
              const existingSale = existingSaleSnapshot.data() as Sale;
              if (!saleMatchesOperation(existingSale, sale)) {
                throw new Error('This checkout request was already used for a different sale.');
              }
              return { sale: existingSale, updatedProducts: currentProducts };
            }

            const updatedProducts = applySaleToProducts(currentProducts);
            for (const { productId, ref } of productEntries) {
              transaction.set(ref, updatedProducts.get(productId)!);
            }
            transaction.set(saleRef, sale);
            return { sale, updatedProducts: [...updatedProducts.values()] };
          });

          set((state) => ({
            sales: state.sales.some((existing) => existing.id === committed.sale.id)
              ? state.sales
              : [...state.sales, committed.sale],
            products: state.products.map((product) =>
              committed.updatedProducts.find((updated) => updated.id === product.id) ?? product,
            ),
            cart: consumeSoldCartItems(state.cart, committed.sale.items),
          }));
          return committed.sale;
        } catch (error) {
          if (error instanceof InsufficientStockError && productSnapshots.size > 0) {
            set((state) => ({
              products: state.products.map((product) =>
                productSnapshots.get(product.id) ?? product,
              ),
            }));
          }
          throw error;
        }
      },

      todaySales: () => {
        const today = new Date().toDateString();
        return get().sales.filter(
          (s) => new Date(s.timestamp).toDateString() === today
        );
      },

      todayTotal: () => {
        const today = new Date().toDateString();
        return get()
          .sales.filter((s) => new Date(s.timestamp).toDateString() === today)
          .reduce((sum, s) => sum + s.total, 0);
      },

      setActiveTab: (tab) => set({ activeTab: tab }),
      setDisplayCurrency: (currency) => set({ displayCurrency: currency }),
      setExchangeRates: (exchangeRates, ratesUpdatedAt) =>
        set({ exchangeRates, ratesUpdatedAt }),
      setVatSettings: ({ enabled, rate, inclusive, country }) =>
        set({
          vatEnabled: enabled,
          vatRate: Math.max(0, Math.min(100, rate)),
          vatInclusive: inclusive,
          vatCountry: country,
        }),
      setNotificationOwnerUid: (notificationOwnerUid) =>
        set({ notificationOwnerUid }),
    }),
    {
      name: 'duka-pos-storage',
    }
  )
);
