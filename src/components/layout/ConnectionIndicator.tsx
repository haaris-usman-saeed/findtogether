import { Wifi, WifiOff, type LucideIcon } from 'lucide-react';
import { cx } from '../../lib/cx';
import type { ConnectionHealth } from '../../services/connection';
import { useConnection } from '../../state/async';

export const CONNECTION_META: Record<ConnectionHealth, { label: string; detail: string; Icon: LucideIcon; tone: string }> = {
  online: { label: 'Connected', detail: 'Changes save right away.', Icon: Wifi, tone: 'text-success' },
  slow: {
    label: 'Slow connection',
    detail: 'Saving may take longer. Wait for the confirmation before moving on.',
    Icon: Wifi,
    tone: 'text-warning',
  },
  unstable: {
    label: 'Connection problems',
    detail: 'The last request failed. Check for a confirmation after each save.',
    Icon: WifiOff,
    tone: 'text-warning',
  },
  offline: {
    label: 'Offline',
    detail: 'Nothing can be saved until the connection returns. This app doesn\u2019t work offline.',
    Icon: WifiOff,
    tone: 'text-danger',
  },
};

export function ConnectionIndicator() {
  const health = useConnection();
  const meta = CONNECTION_META[health];
  return (
    <span role="status" className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-ink">
      <meta.Icon className={cx('h-4 w-4', meta.tone)} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
