import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  convertFromUGX,
  fetchExchangeRates,
  FALLBACK_EXCHANGE_RATES,
  formatCurrency,
} from '@/lib/currency';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('currency display conversions', () => {
  it('formats the base currency without fractional digits', () => {
    expect(formatCurrency(12500, 'UGX', FALLBACK_EXCHANGE_RATES)).toBe('UGX 12,500');
  });

  it('converts and formats amounts using the saved exchange rates', () => {
    const rates = { UGX: 1, KES: 25, USD: 3750 };

    expect(convertFromUGX(25000, 'KES', rates)).toBe(1000);
    expect(convertFromUGX(3750, 'USD', rates)).toBe(1);
    expect(formatCurrency(25000, 'KES', rates)).toBe('KES 1,000');
  });

  it('derives saved rates and update time from the live USD rate response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: 'success',
        rates: { UGX: 4000, KES: 160 },
        time_last_update_utc: 'Thu, 05 Nov 2026 00:02:31 +0000',
      }),
    }));

    await expect(fetchExchangeRates()).resolves.toEqual({
      rates: { UGX: 1, KES: 25, USD: 4000 },
      updatedAt: '2026-11-05T00:02:31.000Z',
    });
  });
});
