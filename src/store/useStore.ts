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

interface POSStore {
  loadProductsFromFirestore: () => Promise<void>;
  loadSalesFromFirestore: () => Promise<void>;
  // Products
  products: Product[];
  addProduct: (product: Product) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  getProductByBarcode: (barcode: string) => Product | undefined;

  // Cart
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  updateCartQty: (productId: string, qty: number, variantId?: string) => void;
  clearCart: () => void;
  cartTotal: () => number;

  // Sales
  sales: Sale[];
  completeSale: (paymentMethod: PaymentMethod) => Sale | null;
  todaySales: () => Sale[];
  todayTotal: () => number;

  // UI
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const useStore = create<POSStore>()(
  persist(
    (set, get) => ({
      products: [],
      cart: [],
      sales: [],
      activeTab: 'home',

      addProduct: async (product) => {
        set((s) => ({ products: [...s.products, product] }));
        try {
          await setDoc(doc(db, 'products', product.id), product);
        } catch (err) {
          console.warn('Failed to persist product to Firebase', err);
        }
      },

      updateProduct: async (id, updates) => {
        set((s) => ({
          products: s.products.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
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

      addToCart: (item) =>
        set((s) => {
          const existing = s.cart.find(
            (c) => c.productId === item.productId && c.variantId === item.variantId
          );
          if (existing) {
            return {
              cart: s.cart.map((c) =>
                c.productId === item.productId && c.variantId === item.variantId
                  ? { ...c, qty: c.qty + 1 }
                  : c
              ),
            };
          }
          return { cart: [...s.cart, item] };
        }),

      removeFromCart: (productId, variantId) =>
        set((s) => ({
          cart: s.cart.filter(
            (c) => !(c.productId === productId && c.variantId === variantId)
          ),
        })),

      updateCartQty: (productId, qty, variantId) =>
        set((s) => ({
          cart:
            qty <= 0
              ? s.cart.filter(
                  (c) => !(c.productId === productId && c.variantId === variantId)
                )
              : s.cart.map((c) =>
                  c.productId === productId && c.variantId === variantId
                    ? { ...c, qty }
                    : c
                ),
        })),

      clearCart: () => set({ cart: [] }),

      cartTotal: () =>
        get().cart.reduce((sum, item) => sum + item.price * item.qty, 0),

      loadProductsFromFirestore: async () => {
        try {
          const snapshot = await getDocs(collection(db, 'products'));
          const products: Product[] = snapshot.docs.map((doc) => doc.data() as Product);
          set({ products });
        } catch (err) {
          console.warn('Failed to load products from Firebase', err);
        }
      },

      loadSalesFromFirestore: async () => {
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

      completeSale: async (paymentMethod) => {
        const { cart, products } = get();
        if (cart.length === 0) return null;

        const total = cart.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 0), 0);

        const getUuid = () => {
          if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
          }
          return 'id-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
        };

        const sale: Sale = {
          id: getUuid(),
          items: [...cart],
          total,
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

        try {
          await addDoc(collection(db, 'sales'), sale);
          // update products in firestore
          await Promise.all(
            updatedProducts.map((product) =>
              setDoc(doc(db, 'products', product.id), product)
            )
          );
        } catch (err) {
          console.warn('Failed to persist sale to Firebase', err);
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
    }),
    {
      name: 'duka-pos-storage',
    }
  )
);
