/**
 * Format helpers wrapping Intl. AGENTS.md §16.2.
 */

const JAKARTA_TZ = 'Asia/Jakarta';

export function formatCurrency(sen: bigint, locale: string = 'id-ID'): string {
  const negative = sen < BigInt(0);
  const abs = negative ? -sen : sen;
  const whole = Number(abs / BigInt(100));
  const cents = Number(abs % BigInt(100));
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: cents === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(whole + cents / 100);
  return negative ? `-${formatted}` : formatted;
}

export function formatNumber(n: number, locale: string = 'id-ID'): string {
  return new Intl.NumberFormat(locale).format(n);
}

export function formatDate(d: Date | string, locale: string = 'id-ID'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, {
    timeZone: JAKARTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatDateTime(d: Date | string, locale: string = 'id-ID'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, {
    timeZone: JAKARTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatTime(d: Date | string, locale: string = 'id-ID'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, {
    timeZone: JAKARTA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatRelative(d: Date | string, locale: string = 'id-ID'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const diffSec = (date.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
}
