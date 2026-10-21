import { Check, CircleDashed, Minus, type LucideIcon } from 'lucide-react';
import type { Evidence, EvidenceKind } from '../../domain/types';
import { cx } from '../../lib/cx';

const COLUMNS: { kind: EvidenceKind; title: string; Icon: LucideIcon; tone: string }[] = [
  { kind: 'agrees', title: 'Agrees', Icon: Check, tone: 'text-success' },
  { kind: 'differs', title: 'Differs', Icon: Minus, tone: 'text-warning' },
  { kind: 'missing', title: 'Not recorded', Icon: CircleDashed, tone: 'text-ink-muted' },
];

/** Why a record might be the person, in words. No score: these records can't support one. */
export function EvidenceLedger({ evidence, headingLevel = 4 }: { evidence: Evidence[]; headingLevel?: 4 | 5 }) {
  const Heading = headingLevel === 4 ? 'h4' : 'h5';
  return (
    <div className="grid gap-4 border-y border-line py-3.5 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line">
      {COLUMNS.map(({ kind, title, Icon, tone }) => {
        const items = evidence.filter((e) => e.kind === kind);
        return (
          <div key={kind} className="md:px-4 md:first:pl-0 md:last:pr-0">
            <Heading className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Icon className={cx('h-4 w-4', tone)} aria-hidden="true" />
              {title}
              <span className="font-normal tabular-nums text-ink-muted">{items.length}</span>
            </Heading>
            {items.length > 0 ? (
              <ul className="mt-1.5 space-y-1.5 text-[0.9375rem] leading-snug">
                {items.map((item) => (
                  <li key={item.text}>{item.text}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-[0.9375rem] text-ink-muted">Nothing</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
