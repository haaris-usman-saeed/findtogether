import type { ReactNode } from 'react';

/** The one thing a person with no phone leaves the desk with. Prints on its own. */
export function ReferenceSlip({ label, reference, lines, children }: { label: string; reference: string; lines: string[]; children?: ReactNode }) {
  return (
    <div className="print-slip rounded-md border border-line-strong bg-surface px-5 py-5 sm:px-6">
      <p className="hidden pb-3 text-sm font-semibold print:block">FindTogether</p>
      <p className="text-sm font-semibold text-ink-muted">{label}</p>
      <p className="mt-1 text-[2.5rem] font-semibold leading-none tracking-[0.04em] tabular-nums text-ink">{reference}</p>
      <div className="mt-3 space-y-0.5 text-sm text-ink-muted">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {children}
    </div>
  );
}
