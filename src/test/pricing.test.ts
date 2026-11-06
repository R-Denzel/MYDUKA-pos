import { describe, expect, it } from 'vitest';
import { calculateSaleTotals, getItemDiscount } from '@/lib/pricing';

describe('checkout pricing', () => {
  const cartItem = {
    productId: 'juice',
    name: 'Juice carton',
    price: 12000,
    qty: 2,
  };

  it('calculates percentage discounts per item and caps discounts at the price', () => {
    expect(getItemDiscount({
      ...cartItem,
      discountType: 'percentage',
      discountValue: 10,
    })).toBe(2400);
    expect(getItemDiscount({
      ...cartItem,
      discountType: 'fixed',
      discountValue: 20000,
    })).toBe(24000);
  });

  it('adds configurable VAT to the discounted subtotal', () => {
    expect(calculateSaleTotals([{
      ...cartItem,
      discountType: 'fixed',
      discountValue: 1000,
    }], { enabled: true, rate: 18, inclusive: false })).toEqual({
      subtotal: 22000,
      discountTotal: 2000,
      vatAmount: 3960,
      total: 25960,
    });
  });

  it('extracts VAT from a VAT-inclusive price without adding it twice', () => {
    const totals = calculateSaleTotals([cartItem], {
      enabled: true,
      rate: 18,
      inclusive: true,
    });
    expect(totals.subtotal).toBe(24000);
    expect(totals.discountTotal).toBe(0);
    expect(totals.vatAmount).toBeCloseTo(3661.016949152542);
    expect(totals.total).toBe(24000);
  });
});
