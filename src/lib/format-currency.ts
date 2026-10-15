export const CURRENCY_CODE = 'BDT';
export const CURRENCY_SYMBOL = '৳';

/**
 * Format any numeric amount as Bangladeshi Taka (BDT)
 * e.g., 1500.5 -> "৳1,500.50"
 */
export function formatBDT(
  amount: number | null | undefined,
  options?: { showSign?: boolean; decimals?: number }
): string {
  const decimals = options?.decimals ?? 2;
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${CURRENCY_SYMBOL}0${decimals > 0 ? '.00' : ''}`;
  }

  const isNegative = amount < 0;
  const absFormatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (options?.showSign) {
    if (amount > 0) return `+${CURRENCY_SYMBOL}${absFormatted}`;
    if (amount < 0) return `-${CURRENCY_SYMBOL}${absFormatted}`;
    return `${CURRENCY_SYMBOL}${absFormatted}`;
  }

  if (isNegative) {
    return `-${CURRENCY_SYMBOL}${absFormatted}`;
  }

  return `${CURRENCY_SYMBOL}${absFormatted}`;
}
