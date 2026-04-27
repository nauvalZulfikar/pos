import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { cn } from '../cn.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-base',
  lg: 'h-14 px-6 text-lg',
  xl: 'h-16 px-8 text-xl', // primary kasir buttons — touch-friendly
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
