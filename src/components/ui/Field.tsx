import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { ChevronDown, CircleAlert } from 'lucide-react';
import { cx } from '../../lib/cx';

export function describedBy(id: string, hint?: ReactNode, error?: string): string | undefined {
  return [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm font-semibold text-danger">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

interface ShellProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}

export function FieldShell({ id, label, hint, error, optional, children }: ShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-semibold text-ink">
        {label}
        {optional && <span className="font-normal text-ink-muted"> (optional)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="max-w-prose text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
      {children}
    </div>
  );
}

export function controlClass(error?: string) {
  return cx(
    'block min-h-11 rounded bg-surface text-base text-ink placeholder:text-ink-faint',
    error ? 'border-2 border-danger px-[11px] py-[9px]' : 'border border-line-strong px-3 py-2.5 hover:border-ink-muted',
  );
}

const WIDTH = { full: 'w-full', medium: 'w-full sm:max-w-sm', short: 'w-28' } as const;

type FieldProps = { id: string; label: ReactNode; hint?: ReactNode; error?: string; optional?: boolean };

export function TextInput({
  id,
  label,
  hint,
  error,
  optional,
  width = 'full',
  className,
  ...rest
}: FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & { width?: keyof typeof WIDTH }) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <input
        id={id}
        aria-describedby={describedBy(id, hint, error)}
        aria-invalid={error ? true : undefined}
        className={cx(controlClass(error), WIDTH[width], className)}
        {...rest}
      />
    </FieldShell>
  );
}

export function TextArea({
  id,
  label,
  hint,
  error,
  optional,
  rows = 3,
  ...rest
}: FieldProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        id={id}
        rows={rows}
        aria-describedby={describedBy(id, hint, error)}
        aria-invalid={error ? true : undefined}
        className={cx(controlClass(error), 'w-full resize-y leading-relaxed')}
        {...rest}
      />
    </FieldShell>
  );
}

export function Select({
  id,
  label,
  hint,
  error,
  optional,
  children,
  ...rest
}: FieldProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <div className="relative w-full sm:max-w-sm">
        <select
          id={id}
          aria-describedby={describedBy(id, hint, error)}
          aria-invalid={error ? true : undefined}
          className={cx(controlClass(error), 'w-full appearance-none pr-10')}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
      </div>
    </FieldShell>
  );
}
