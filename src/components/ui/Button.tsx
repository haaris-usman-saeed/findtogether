import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { cx } from '../../lib/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
type Size = 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded font-semibold transition-colors motion-reduce:transition-none select-none';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-ink-muted hover:bg-sunk',
  quiet: 'text-accent underline-offset-4 hover:underline',
  danger: 'border border-danger-line bg-surface text-danger hover:bg-danger-tint',
};

const SIZE: Record<Size, string> = {
  md: 'min-h-11 px-4 text-base',
  lg: 'min-h-12 px-5 text-lg',
};

const DISABLED = 'cursor-not-allowed opacity-60 hover:no-underline';

export function buttonClass(variant: ButtonVariant = 'secondary', size: Size = 'md', disabled = false) {
  return cx(BASE, VARIANT[variant], variant === 'quiet' ? 'min-h-11 px-1' : SIZE[size], disabled && DISABLED);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: Size;
  icon?: LucideIcon;
  /** Shows a spinner and blocks repeat clicks. The label should say what is happening, like "Saving". */
  loading?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const inactive = Boolean(disabled || loading);
  return (
    <button
      type={type}
      disabled={inactive}
      aria-busy={loading || undefined}
      className={cx(buttonClass(variant, size, Boolean(disabled) && !loading), loading && 'cursor-wait', className)}
      {...rest}
    >
      {loading ? (
        <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}

export function LinkButton({
  to,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  children,
  className,
}: {
  to: string;
  variant?: ButtonVariant;
  size?: Size;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link to={to} className={cx(buttonClass(variant, size), className)}>
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </Link>
  );
}
