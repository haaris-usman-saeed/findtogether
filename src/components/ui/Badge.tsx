import type { ReactNode } from 'react';
import { CircleCheck, CircleHelp, Clock, Hourglass, Lock, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import { CASE_STATUS, type Tone } from '../../domain/status';
import type { CaseStatus } from '../../domain/types';
import { cx } from '../../lib/cx';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'border-line-strong bg-sunk text-ink',
  accent: 'border-accent-line bg-accent-tint text-accent',
  warning: 'border-warning-line bg-warning-tint text-warning',
  success: 'border-success-line bg-success-tint text-success',
  guarded: 'border-guarded-line bg-guarded-tint text-guarded',
};

const STATUS_ICON: Record<CaseStatus, LucideIcon> = {
  open: Hourglass,
  possible_match: Users,
  needs_review: CircleHelp,
  verification_pending: Clock,
  contact_authorized: ShieldCheck,
  reconnected: CircleCheck,
  safeguarding: Lock,
};

export function Badge({ tone, icon: Icon, children }: { tone: Tone; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 text-sm font-semibold',
        TONE_CLASS[tone],
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: CaseStatus }) {
  const meta = CASE_STATUS[status];
  return (
    <Badge tone={meta.tone} icon={STATUS_ICON[status]}>
      {meta.label}
    </Badge>
  );
}
