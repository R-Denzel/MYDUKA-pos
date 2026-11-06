import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CartSheet from '@/components/CartSheet';
import { useStore } from '@/store/useStore';

type StoreReturnType = ReturnType<typeof useStore>;
type UseStoreMock = { mockReturnValue: (value: Partial<StoreReturnType>) => void };

// Mock zustand store
vi.mock('@/store/useStore');

const createMockStore = (overrides: Partial<StoreReturnType> = {}) => {
  const cart = overrides.cart ?? [];
  return ({
  cart,
  products: overrides.products ?? cart.map((item) => ({
    id: item.productId,
    name: item.name,
    barcode: '',
    category: 'Other',
    basePrice: item.price,
    hasVariants: false,
    variants: [],
    totalStock: 10,
    createdAt: new Date().toISOString(),
  })),
  cartTotal: () => 0,
  updateCartQty: vi.fn(),
  removeFromCart: vi.fn(),
  completeSale: vi.fn(),
  clearCart: vi.fn(),
  displayCurrency: 'UGX' as const,
  exchangeRates: { UGX: 1, KES: 28.5, USD: 3800 },
  updateCartDiscount: vi.fn(),
  vatEnabled: false,
  vatRate: 18,
  vatInclusive: false,
  ...overrides,
  });
};

describe('CartSheet Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render cart sheet when open', () => {
    const mockUseStore = useStore as unknown as UseStoreMock;
    mockUseStore.mockReturnValue(createMockStore());

    render(React.createElement(CartSheet, { open: true, onClose: vi.fn() }));
    
    expect(screen.getByText('Cart (0)')).toBeInTheDocument();
    expect(screen.getByText('Cart is empty')).toBeInTheDocument();
  });

  it('should not render cart sheet when closed', () => {
    const mockUseStore = useStore as unknown as UseStoreMock;
    mockUseStore.mockReturnValue(createMockStore());

    render(React.createElement(CartSheet, { open: false, onClose: vi.fn() }));
    
    // Should not show payment button when closed
    const paymentButton = screen.queryByText(/Payment Method|Cash|Mobile Money/i);
    expect(paymentButton).not.toBeInTheDocument();
  });

  it('should calculate and display cart total correctly', () => {
    const mockUseStore = useStore as unknown as UseStoreMock;
    mockUseStore.mockReturnValue(createMockStore({
      cart: [
        { productId: '1', name: 'Item 1', price: 5000, qty: 2 },
        { productId: '2', name: 'Item 2', price: 3000, qty: 1 },
      ],
      cartTotal: () => 13000,
    }));

    render(React.createElement(CartSheet, { open: true, onClose: vi.fn() }));
    
    // Total should be displayed (formatting may vary)
    expect(screen.getByRole('button', { name: /Charge UGX 13,000/i })).toBeInTheDocument();
  });

  it('blocks checkout when a cart item no longer has stock', () => {
    const mockUseStore = useStore as unknown as UseStoreMock;
    mockUseStore.mockReturnValue(createMockStore({
      cart: [{ productId: '1', name: 'Item 1', price: 5000, qty: 1 }],
      cartTotal: () => 5000,
      products: [{
        id: '1',
        name: 'Item 1',
        barcode: 'ITEM1',
        category: 'Food',
        basePrice: 5000,
        hasVariants: false,
        variants: [],
        totalStock: 0,
        createdAt: new Date().toISOString(),
      }],
    }));

    render(React.createElement(CartSheet, { open: true, onClose: vi.fn() }));

    expect(screen.getByRole('alert')).toHaveTextContent('Insufficient stock for Item 1: 0 available, 1 in cart');
    expect(screen.getByRole('button', { name: /Charge/ })).toBeDisabled();
  });

  it('BUG REPORT: should handle empty cart gracefully', () => {
    const mockUseStore = useStore as unknown as UseStoreMock;
    mockUseStore.mockReturnValue(createMockStore({
      completeSale: () => null,
    }));

    render(React.createElement(CartSheet, { open: true, onClose: vi.fn() }));
    
    // Should not allow checkout with empty cart
    expect(screen.queryByRole('button', { name: /Charge/ })).not.toBeInTheDocument();
    expect(screen.getByText('Cart is empty')).toBeInTheDocument();
  });
});

describe('CartSheet - Payment Methods', () => {
  it('should support cash payment', async () => {
    const mockcompleteSale = vi.fn(() => ({
      id: '1',
      items: [],
      total: 5000,
      paymentMethod: 'cash',
      timestamp: new Date().toISOString(),
    }));

    const mockUseStore = useStore as unknown as UseStoreMock;
    mockUseStore.mockReturnValue(createMockStore({
      cart: [{ productId: '1', name: 'Item', price: 5000, qty: 1 }],
      cartTotal: () => 5000,
      completeSale: mockcompleteSale,
    }));

    render(React.createElement(CartSheet, { open: true, onClose: vi.fn() }));
    fireEvent.click(screen.getByRole('button', { name: /Charge UGX 5,000/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cash' }));

    await waitFor(() => expect(mockcompleteSale).toHaveBeenCalledWith('cash', undefined, false, expect.any(String)));
  });

  it('should support mobile money payment', async () => {
    const mockcompleteSale = vi.fn(() => ({
      id: '1',
      items: [],
      total: 5000,
      paymentMethod: 'mobile_money',
      timestamp: new Date().toISOString(),
    }));

    const mockUseStore = useStore as unknown as UseStoreMock;
    mockUseStore.mockReturnValue(createMockStore({
      cart: [{ productId: '1', name: 'Item', price: 5000, qty: 1 }],
      cartTotal: () => 5000,
      completeSale: mockcompleteSale,
    }));

    render(React.createElement(CartSheet, { open: true, onClose: vi.fn() }));
    fireEvent.click(screen.getByRole('button', { name: /Charge UGX 5,000/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Mobile Money' }));

    await waitFor(() => expect(mockcompleteSale).toHaveBeenCalledWith('mobile_money', undefined, false, expect.any(String)));
  });
});
