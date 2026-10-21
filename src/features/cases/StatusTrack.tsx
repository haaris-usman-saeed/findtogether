import { Check } from 'lucide-react';
import type { CaseStatus } from '../../domain/types';
import { cx } from '../../lib/cx';

const STEPS = ['Possible match', 'Verification pending', 'Contact authorized', 'Contact made'];
const POSITION: Partial<Record<CaseStatus, number>> = {
  possible_match: 0,
  needs_review: 0,
  verification_pending: 1,
  contact_authorized: 2,
  reconnected: 3,
};

export function StatusTrack({ status }: { status: CaseStatus }) {
  const current = POSITION[status];
  if (current === undefined) return null;
  return (
    <ol aria-label="Case progress" className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 sm:gap-x-0">
      {STEPS.map((label, index) => {
        const complete = index < current || (index === current && status === 'reconnected');
        const isCurrent = index === current && !complete;
        const flagged = isCurrent && status === 'needs_review';
        return (
          <li
            key={label}
            aria-current={isCurrent ? 'step' : undefined}
            className={cx(
              'border-t-[3px] pt-2 text-sm sm:pr-4',
              complete && 'border-success text-ink',
              isCurrent && (flagged ? 'border-warning' : 'border-accent'),
              isCurrent && 'font-semibold text-ink',
              !complete && !isCurrent && 'border-line text-ink-muted',
            )}
          >
            <span className="flex items-center gap-1.5">
              {complete ? (
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
              ) : (
                <span className="tabular-nums" aria-hidden="true">
                  {index + 1}
                </span>
              )}
              {label}
              {complete && <span className="sr-only">, done</span>}
            </span>
            {flagged && <span className="mt-0.5 block font-normal text-warning">Needs additional review</span>}
          </li>
        );
      })}
    </ol>
  );
}
