import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, FlaskConical, Info, ShieldCheck, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cx } from '../../lib/cx';

export type NoticeTone = 'info' | 'warning' | 'danger' | 'success' | 'guarded' | 'demo';

const TONE: Record<NoticeTone, { box: string; icon: string; Icon: LucideIcon }> = {
  info: { box: 'border-accent-line bg-accent-tint', icon: 'text-accent', Icon: Info },
  warning: { box: 'border-warning-line bg-warning-tint', icon: 'text-warning', Icon: TriangleAlert },
  danger: { box: 'border-danger-line bg-danger-tint', icon: 'text-danger', Icon: CircleAlert },
  success: { box: 'border-success-line bg-success-tint', icon: 'text-success', Icon: CircleCheck },
  guarded: { box: 'border-guarded-line bg-guarded-tint', icon: 'text-guarded', Icon: ShieldCheck },
  demo: { box: 'border-dashed border-ink-faint bg-transparent', icon: 'text-ink-muted', Icon: FlaskConical },
};

export function Notice({
  tone = 'info',
  title,
  children,
  action,
  role,
  icon,
  className,
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  role?: 'alert' | 'status';
  icon?: LucideIcon;
  className?: string;
}) {
  const style = TONE[tone];
  const Icon = icon ?? style.Icon;
  return (
    <div role={role} className={cx('flex gap-3 rounded-md border px-4 py-3.5', style.box, className)}>
      <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', style.icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {tone === 'demo' && <p className="text-sm font-semibold text-ink-muted">Demo note, not part of the product</p>}
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children && <div className={cx('space-y-2 text-ink [&_p]:max-w-prose', title ? 'mt-1' : undefined)}>{children}</div>}
        {action && <div className="mt-3 flex flex-wrap gap-3">{action}</div>}
      </div>
    </div>
  );
}
