import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { useDocumentTitle } from '../../lib/useDocumentTitle';

/** The h1 receives focus after navigation so screen reader users hear where they landed. */
export function PageHeader({
  title,
  documentTitle,
  lead,
  back,
  aside,
}: {
  title: ReactNode;
  documentTitle: string;
  lead?: ReactNode;
  back?: { to: string; label: string };
  aside?: ReactNode;
}) {
  useDocumentTitle(documentTitle);
  return (
    <div className="mb-8">
      {back && (
        <Link
          to={back.to}
          className="-ml-1 mb-3 inline-flex min-h-11 items-center gap-1.5 px-1 text-accent underline-offset-4 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 id="page-title" tabIndex={-1} className="text-2xl font-semibold tracking-[-0.015em] text-ink focus:outline-none sm:text-3xl">
            {title}
          </h1>
          {lead && <div className="mt-2 max-w-prose text-lg text-ink-muted">{lead}</div>}
        </div>
        {aside}
      </div>
    </div>
  );
}

export function SectionHeading({ id, children, count }: { id?: string; children: ReactNode; count?: number }) {
  return (
    <h2 id={id} className="flex items-baseline gap-2 text-xl font-semibold text-ink">
      {children}
      {count !== undefined && <span className="text-base font-normal tabular-nums text-ink-muted">{count}</span>}
    </h2>
  );
}
