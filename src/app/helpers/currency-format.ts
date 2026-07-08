/**
 * Shared fiat formatting so amounts read "$2,140.20" (2026 design) instead of
 * "2140.2 USD". Single source of truth for the currency glyph prefix, thousands
 * grouping and per-currency decimals, reused by the balance heroes, the launcher
 * pillars, the token rows and the send/receive pickers.
 */

/** Common currency glyphs; codes without an entry fall back to a code suffix. */
const CURRENCY_GLYPHS: { [code: string]: string } = {
  USD: '$', AUD: '$', CAD: '$', HKD: '$', SGD: '$', NZD: '$',
  EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', KRW: '₩', INR: '₹',
  RUB: '₽', BRL: 'R$', TRY: '₺', BTC: '₿', ETH: 'Ξ'
};

/** Currencies with no minor unit, formatted without decimals. */
const ZERO_DECIMAL_CURRENCIES: { [code: string]: boolean } = { JPY: true, KRW: true };

/**
 * Crypto display currencies need more precision than fiat's 2dp, otherwise a
 * BTC-denominated balance (e.g. 0.00042) clips to zero. Codes without an entry
 * use the fiat default of 2 decimals.
 */
const CRYPTO_DECIMALS: { [code: string]: number } = { BTC: 8, ETH: 6 };

/**
 * Formats a fiat amount with its currency glyph prefix and grouped thousands,
 * e.g. formatFiatAmount(2140.2, "USD") -> "$2,140.20". Falls back to a trailing
 * currency code for currencies without a known glyph.
 */
export function formatFiatAmount(amount: number, currencyCode: string): string {
  const decimals = ZERO_DECIMAL_CURRENCIES[currencyCode] ? 0 : (CRYPTO_DECIMALS[currencyCode] ?? 2);
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  const glyph = CURRENCY_GLYPHS[currencyCode];
  return glyph ? `${glyph}${formatted}` : `${formatted} ${currencyCode}`;
}
