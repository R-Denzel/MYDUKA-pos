export const CURRENCIES = ['UGX', 'KES', 'USD'] as const;

export type Currency = (typeof CURRENCIES)[number];
export type ExchangeRates = Record<Currency, number>;

export const FALLBACK_EXCHANGE_RATES: ExchangeRates = {
  UGX: 1,
  KES: 28.5,
  USD: 3800,
};

const LOCALES: Record<Currency, string> = {
  UGX: 'en-UG',
  KES: 'en-KE',
  USD: 'en-US',
};

export function convertFromUGX(
  amount: number,
  currency: Currency,
  rates: ExchangeRates,
): number {
  return amount / rates[currency];
}

export function formatCurrency(
  amountInUGX: number,
  currency: Currency,
  rates: ExchangeRates,
): string {
  const amount = convertFromUGX(amountInUGX, currency, rates);
  return `${currency} ${amount.toLocaleString(LOCALES[currency], {
    maximumFractionDigits: currency === 'UGX' ? 0 : 2,
    minimumFractionDigits: 0,
  })}`;
}

export async function fetchExchangeRates(): Promise<{
  rates: ExchangeRates;
  updatedAt: string;
}> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Exchange-rate service returned HTTP ${response.status}`);
    }

    const data: unknown = await response.json();
    if (
      typeof data !== 'object' ||
      data === null ||
      !('result' in data) ||
      data.result !== 'success' ||
      !('rates' in data) ||
      typeof data.rates !== 'object' ||
      data.rates === null ||
      !('UGX' in data.rates) ||
      !('KES' in data.rates) ||
      !('time_last_update_utc' in data) ||
      typeof data.time_last_update_utc !== 'string'
    ) {
      throw new Error('Exchange-rate service returned an invalid response');
    }

    const ugxPerUsd = data.rates.UGX;
    const kesPerUsd = data.rates.KES;
    const updatedAtMs = Date.parse(data.time_last_update_utc);
    if (
      typeof ugxPerUsd !== 'number' ||
      !Number.isFinite(ugxPerUsd) ||
      ugxPerUsd <= 0 ||
      typeof kesPerUsd !== 'number' ||
      !Number.isFinite(kesPerUsd) ||
      kesPerUsd <= 0 ||
      Number.isNaN(updatedAtMs)
    ) {
      throw new Error('Exchange-rate service returned invalid currency rates');
    }

    return {
      rates: {
        UGX: 1,
        KES: ugxPerUsd / kesPerUsd,
        USD: ugxPerUsd,
      },
      updatedAt: new Date(updatedAtMs).toISOString(),
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}
