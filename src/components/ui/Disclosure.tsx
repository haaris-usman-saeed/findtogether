import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cx } from '../../lib/cx';

/** Progressive disclosure for optional sections. Content unmounts when closed; values live in the draft. */
export function Disclosure({
  id,
  label,
  summary,
  forceOpen = false,
  children,
}: {
  id: string;
  label: string;
  /** Shown beside the label while closed, for example "2 added". */
  summary?: string;
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(forceOpen);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  return (
    <div className="border-t border-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-12 w-full items-center gap-2 py-3 text-left font-semibold text-accent hover:underline"
      >
        <ChevronRight
          className={cx('h-5 w-5 shrink-0 transition-transform motion-reduce:transition-none', open && 'rotate-90')}
          aria-hidden="true"
        />
        <span>{label}</span>
        {!open && summary && <span className="ml-auto pl-3 text-sm font-normal text-ink-muted">{summary}</span>}
      </button>
      {open && (
        <div id={`${id}-panel`} className="space-y-6 pb-7 pl-7">
          {children}
        </div>
      )}
    </div>
  );
}
