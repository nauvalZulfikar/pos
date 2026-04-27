import id from './messages/id.json';
import en from './messages/en.json';

export const messages = { 'id-ID': id, 'en-US': en } as const;

export type Locale = keyof typeof messages;
export const DEFAULT_LOCALE: Locale = 'id-ID';

export type MessageKey = string;

/**
 * Minimal ICU-style interpolation: replaces {name} placeholders. Real apps
 * should use `react-intl` (Vite app) or `next-intl` (Next.js app); this is
 * the fallback for non-React contexts (workers, server jobs).
 */
export function t(locale: Locale, key: MessageKey, vars: Record<string, string | number> = {}): string {
  const dict = messages[locale] ?? messages[DEFAULT_LOCALE];
  const raw = lookup(dict, key);
  if (typeof raw !== 'string') return key;
  return raw.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const v = vars[name];
    return v === undefined ? `{${name}}` : String(v);
  });
}

function lookup(dict: unknown, key: string): unknown {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}
