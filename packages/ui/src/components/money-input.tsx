import type { ChangeEvent } from 'react';
import { useCallback } from 'react';
import { cn } from '../cn.js';

export type MoneyInputProps = {
  /** Value in sen (bigint). */
  value: bigint;
  onChange: (next: bigint) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
};

export function MoneyInput({
  value,
  onChange,
  className,
  placeholder,
  disabled,
  autoFocus,
  ariaLabel,
}: MoneyInputProps) {
  const display = displayValue(value);
  const handle = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const cleaned = e.target.value.replace(/[^\d]/g, '');
      const sen = cleaned ? BigInt(cleaned) * BigInt(100) : BigInt(0);
      onChange(sen);
    },
    [onChange],
  );

  return (
    <div className={cn('relative inline-flex w-full items-center', className)}>
      <span className="pointer-events-none absolute left-3 text-slate-500">Rp</span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={display}
        onChange={handle}
        className={cn(
          'w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3',
          'text-right text-lg font-mono tabular-nums',
          'focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500',
          'disabled:bg-slate-100',
        )}
      />
    </div>
  );
}

function displayValue(sen: bigint): string {
  const negative = sen < BigInt(0);
  const abs = negative ? -sen : sen;
  const whole = abs / BigInt(100);
  const s = whole.toString();
  // Insert thousand separators (Indonesian: .)
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out.push('.');
    out.push(s[i]!);
  }
  return (negative ? '-' : '') + out.join('');
}
