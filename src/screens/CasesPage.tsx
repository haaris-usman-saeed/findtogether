import { Link } from 'react-router';
import { StatusBadge } from '../components/ui/Badge';
import { Loading, RequestErrorNotice } from '../components/ui/Feedback';
import { PageHeader, SectionHeading } from '../components/ui/PageHeader';
import { AccessNotice } from '../features/cases/AccessNotice';
import { RELATIONSHIP_LABEL } from '../domain/labels';
import type { CaseStatus } from '../domain/types';
import { formatRelative } from '../lib/time';
import { api } from '../services';
import type { CaseSummary } from '../services/contracts';
import { useAsync } from '../state/async';
import { useSession } from '../state/session';

const GROUPS: { id: string; title: string; note?: string; statuses: CaseStatus[] }[] = [
  { id: 'action', title: 'Needs action', statuses: ['contact_authorized', 'verification_pending', 'needs_review', 'possible_match'] },
  { id: 'safeguarding', title: 'Safeguarding', note: 'Handled by the safeguarding team.', statuses: ['safeguarding'] },
  {
    id: 'searching',
    title: 'Still searching',
    note: 'No possible matches yet. New registrations are checked automatically.',
    statuses: ['open'],
  },
  { id: 'done', title: 'Contact made', statuses: ['reconnected'] },
];

function CaseRow({ c }: { c: CaseSummary }) {
  return (
    <li className="border-b border-line">
      <Link
        to={`/cases/${c.reference}`}
        className="grid min-h-14 gap-x-6 gap-y-1 py-3 hover:bg-surface sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center sm:px-2"
      >
        <span className="font-semibold tabular-nums text-ink">{c.reference}</span>
        <span className="min-w-0">
          <span className="font-semibold">{c.soughtName}</span>
          <span className="text-ink-muted">
            , {RELATIONSHIP_LABEL[c.relationship].toLowerCase()}, asked from {c.requesterShelterName}
          </span>
          <span className="block text-sm text-ink-muted">
            Updated {formatRelative(c.updatedAt)}
            {c.status !== 'safeguarding' && c.possibleMatchCount > 0
              ? `. ${c.possibleMatchCount} possible ${c.possibleMatchCount === 1 ? 'match' : 'matches'}`
              : ''}
          </span>
        </span>
        <span>
          <StatusBadge status={c.status} />
        </span>
      </Link>
    </li>
  );
}

export function CasesPage() {
  const { session } = useSession();
  const cases = useAsync(() => api.listCases(session), [session.role]);

  if (cases.error?.code === 'forbidden') {
    return (
      <>
        <PageHeader documentTitle="Cases" back={{ to: '/', label: 'Home' }} title="Cases" />
        <AccessNotice />
      </>
    );
  }

  return (
    <>
      <PageHeader
        documentTitle="Cases"
        back={{ to: '/', label: 'Home' }}
        title="Cases"
        lead="Every family search request, with what each one needs next."
      />
      {cases.error && <RequestErrorNotice kind="load" error={cases.error} onRetry={cases.reload} retrying={cases.loading} />}
      {!cases.data && !cases.error && <Loading label="Loading cases" />}
      {cases.data && (
        <div className="space-y-12">
          {GROUPS.map((group) => {
            const items = cases.data!.filter((c) => group.statuses.includes(c.status));
            if (items.length === 0 && group.id !== 'action') return null;
            return (
              <section key={group.id} aria-labelledby={`group-${group.id}`}>
                <SectionHeading id={`group-${group.id}`} count={items.length}>
                  {group.title}
                </SectionHeading>
                {group.note && <p className="mt-1 text-ink-muted">{group.note}</p>}
                {items.length === 0 ? (
                  <p className="mt-3">Nothing needs action right now.</p>
                ) : (
                  <ul className="mt-3 border-t border-line">
                    {items.map((c) => (
                      <CaseRow key={c.reference} c={c} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
