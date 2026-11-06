import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  addDoc,
  query,
  orderBy,
  limit,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product, CartItem, Sale, PaymentMethod } from '@/types/pos';
import { ExchangeRates, FALLBACK_EXCHANGE_RATES, Currency } from '@/lib/currency';
import { calculateSaleTotals, getBillableItems } from '@/lib/pricing';

let localPremiumDemoEnabled = false;

export function setLocalPremiumDemoEnabled(enabled: boolean) {
  localPremiumDemoEnabled = enabled;
}

interface POSStore {
  loadProductsFromFirestore: () => Promise<void>;
  loadSalesFromFirestore: () => Promise<void>;
  // Products
  products: Product[];
  addProduct: (product: Product) => Promise<boolean>;
  updateProduct: (id: string, updates: Partial<Product>) => void;
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
          !Number.isFinite(item.qty) ||
          item.qty <= 0
        ) {
          return false;
        }

        const existing = cart.find(
          (candidate) =>
            candidate.productId === item.productId && candidate.variantId === item.variantId,
        );
        const requestedQty = item.qty + (existing?.qty ?? 0);
        if (requestedQty > stock) return false;

        set((state) => ({
          cart: existing
            ? state.cart.map((candidate) =>
                candidate.productId === item.productId &&
                candidate.variantId === item.variantId
                  ? { ...candidate, qty: requestedQty }
                  : candidate,
              )
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
        if (!Number.isFinite(qty)) return false;
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

        set((state) => ({
          cart: state.cart.map((item) =>
            item.productId === productId && item.variantId === variantId
              ? { ...item, qty }
              : item,
          ),
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

      completeSale: async (paymentMethod, ownerUid, hasPremium = false) => {
        const { cart, products } = get();
        if (cart.length === 0) return null;

        const quantities = new Map<string, number>();
        for (const item of cart) {
          const product = products.find((candidate) => candidate.id === item.productId);
          const variant = item.variantId
            ? product?.variants.find((candidate) => candidate.id === item.variantId)
            : undefined;
          const stock = item.variantId ? variant?.stock : product?.totalStock;
          if (!product || (product.hasVariants && !item.variantId) || stock === undefined) {
            throw new Error(`${item.name} is no longer available in inventory.`);
          }

          const key = `${item.productId}:${item.variantId ?? ''}`;
          const quantity = (quantities.get(key) ?? 0) + item.qty;
          quantities.set(key, quantity);
          if (!Number.isFinite(item.qty) || item.qty <= 0 || quantity > stock) {
            const label = item.variantName
              ? `${item.name} (${item.variantName})`
              : item.name;
            throw new Error(`Insufficient stock for ${label}. ${stock} available.`);
          }
        }

        const saleItems = getBillableItems(cart, hasPremium);
        const vatEnabled = hasPremium && get().vatEnabled;
        const { subtotal, discountTotal, vatAmount, total } = calculateSaleTotals(saleItems, {
          enabled: vatEnabled,
          rate: get().vatRate,
          inclusive: get().vatInclusive,
        });

        const getUuid = () => {
          if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
          }
          return 'id-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
        };

        const sale: Sale = {
          id: getUuid(),
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

        // Decrement stock
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

          const nonVariantItems = cartItems.filter((c) => !c.variantId);
          const nonVariantQty = nonVariantItems.reduce((s, c) => s + c.qty, 0);
          totalDeducted += nonVariantQty;

          return {
            ...p,
            variants: updatedVariants,
            totalStock: Math.max(0, p.totalStock - totalDeducted),
          };
        });

        set({
          sales: [...get().sales, sale],
          products: updatedProducts,
          cart: [],
        });

        if (!localPremiumDemoEnabled) {
          void Promise.all([
            addDoc(collection(db, 'sales'), sale),
            ...updatedProducts.map((product) =>
              setDoc(doc(db, 'products', product.id), product)
            ),
          ]).catch((err) => {
            console.warn('Failed to persist sale to Firebase', err);
          });
        }

        return sale;
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
