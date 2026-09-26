import { intlLocale, type AppLocale } from './config';

const decimalPattern = /^(-?)(\d+)(?:\.(\d+))?$/;
const currencyPattern = /^[A-Z]{3}$/;

export function formatLocaleDate(
  value: Date | string,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    calendar: 'gregory',
    ...options,
  }).format(new Date(value));
}

export function formatLocaleNumber(
  value: number | bigint,
  locale: AppLocale,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

/**
 * Formats a canonical decimal string without converting it to a JavaScript
 * floating-point value. Financial calculations remain server authoritative.
 */
export function formatLocaleMoney(
  amount: string,
  currency: string,
  locale: AppLocale,
): string {
  const match = decimalPattern.exec(amount);
  if (!match || !currencyPattern.test(currency)) return amount;

  const sign = match[1] ?? '';
  const integer = match[2];
  const fraction = match[3] ?? '';
  if (!integer) return amount;
  const fractionDigits = fraction.length;
  const numberFormatter = new Intl.NumberFormat(intlLocale(locale), {
    useGrouping: true,
    maximumFractionDigits: 0,
  });
  const groupedInteger = numberFormatter.format(BigInt(integer));
  const formatter = new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  return formatter
    .formatToParts(sign === '-' ? -0 : 0)
    .map((part) => {
      if (part.type === 'integer') return groupedInteger;
      if (part.type === 'fraction') return fraction;
      return part.value;
    })
    .join('');
}
