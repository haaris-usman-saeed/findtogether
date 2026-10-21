import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { FieldError, describedBy } from './Field';

export interface ChoiceOption<V extends string> {
  value: V;
  label: string;
  description?: string;
}

interface ChoiceGroupProps<V extends string> {
  id: string;
  legend: ReactNode;
  hint?: ReactNode;
  error?: string;
  options: ChoiceOption<V>[];
  value: V | '';
  onChange: (value: V) => void;
  layout?: 'stack' | 'inline';
  /** Visually smaller legend for groups nested inside another question. */
  compact?: boolean;
}

/** Native radio buttons with large, labelled targets. */
export function ChoiceGroup<V extends string>({
  id,
  legend,
  hint,
  error,
  options,
  value,
  onChange,
  layout = 'stack',
  compact = false,
}: ChoiceGroupProps<V>) {
  return (
    <fieldset id={id} aria-describedby={describedBy(id, hint, error)} className="min-w-0">
      <legend className={cx('font-semibold text-ink', compact ? 'text-base' : 'text-lg')}>{legend}</legend>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 max-w-prose text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <div className="mt-1.5">
          <FieldError id={`${id}-error`}>{error}</FieldError>
        </div>
      )}
      <div className={cx('mt-3 gap-2', layout === 'inline' ? 'flex flex-wrap' : 'grid')}>
        {options.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={cx(
                'flex min-h-11 cursor-pointer items-start gap-3 rounded border px-3 py-2.5',
                checked ? 'border-accent bg-accent-tint' : 'border-line-strong bg-surface hover:border-ink-muted',
                error && !checked && 'border-danger-line',
              )}
            >
              <input
                type="radio"
                name={id}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
              />
              <span>
                <span className="font-medium text-ink">{option.label}</span>
                {option.description && <span className="block text-sm text-ink-muted">{option.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Checkbox({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
      />
      <span>
        <span className="text-ink">{label}</span>
        {description && <span className="block text-sm text-ink-muted">{description}</span>}
      </span>
    </label>
  );
}
