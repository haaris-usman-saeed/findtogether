import { useState } from 'react';
import { Search, UserPlus, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { CONNECTION_META } from '../components/layout/ConnectionIndicator';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ChoiceGroup } from '../components/ui/Choice';
import { Loading, RequestErrorNotice } from '../components/ui/Feedback';
import { PageHeader, SectionHeading } from '../components/ui/PageHeader';
import { RELATIONSHIP_LABEL } from '../domain/labels';
import type { ConsentState } from '../domain/types';
import { cx } from '../lib/cx';
import { formatClock, formatRelative } from '../lib/time';
import { api } from '../services';
import type { AwaitingConsentItem, DashboardView } from '../services/contracts';
import { useAsync, useConnection, useMutation } from '../state/async';
import { useSession } from '../state/session';

const linkClass = 'inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4 hover:no-underline';

function PrimaryAction({ to, icon: Icon, title, description }: { to: string; icon: LucideIcon; title: string; description: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-[6.5rem] items-start gap-4 rounded-md bg-accent px-5 py-5 text-white transition-colors hover:bg-accent-hover motion-reduce:transition-none"
    >
      <Icon className="mt-1 h-6 w-6 shrink-0" aria-hidden="true" />
      <span>
        <span className="block text-xl font-semibold">{title}</span>
        <span className="mt-1 block text-white/90">{description}</span>
      </span>
    </Link>
  );
}

function ReviewQueue({ queue }: { queue: DashboardView['reviewQueue'] }) {
  return (
    <section aria-labelledby="queue-title">
      <SectionHeading id="queue-title" count={queue.count}>
        Waiting for a coordinator
      </SectionHeading>
      {queue.count === 0 ? (
        <p className="mt-3 text-ink-muted">No cases need a coordinator right now.</p>
      ) : queue.cases ? (
        <>
          <ul className="mt-3 border-t border-line">
            {queue.cases.map((c) => (
              <li key={c.reference} className="border-b border-line">
                <Link
                  to={`/cases/${c.reference}`}
                  className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 hover:bg-surface"
                >
                  <span>
                    <span className="font-semibold text-ink">{c.soughtName}</span>
                    <span className="text-ink-muted">
                      , {RELATIONSHIP_LABEL[c.relationship].toLowerCase()}, {c.reference}
                    </span>
                  </span>
                  <StatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/cases" className={cx(linkClass, 'mt-2')}>
            All cases
          </Link>
        </>
      ) : (
        <div className="mt-3 space-y-2">
          <p>
            {queue.count === 1 ? '1 case is' : `${queue.count} cases are`} waiting for a reunification coordinator.
          </p>
          <p className="text-ink-muted">
            Only coordinators can open cases. If someone asks how their search is going, use{' '}
            <Link to="/status" className="font-medium text-accent underline underline-offset-4">
              Check a request
            </Link>
            .
          </p>
        </div>
      )}
    </section>
  );
}

function ConsentFollowUp({ item, onDone, onCancel }: { item: AwaitingConsentItem; onDone: () => void; onCancel: () => void }) {
  const { session } = useSession();
  const [matching, setMatching] = useState<ConsentState | ''>('');
  const [contact, setContact] = useState<ConsentState | ''>('');
  const [showErrors, setShowErrors] = useState(false);
  const save = useMutation(() =>
    api
      .recordConsent(item.reference, { matching: matching || 'unknown', contact: contact || 'unknown' }, session)
      .then(() => true as const),
  );

  const submit = async () => {
    setShowErrors(true);
    if (!matching || !contact) return;
    if (await save.run()) onDone();
  };

  return (
    <div className="mt-3 space-y-6 rounded-md border border-line bg-surface p-4 sm:p-5">
      <ChoiceGroup
        id={`consent-${item.reference}-matching`}
        compact
        legend={`Can we check whether family is looking for ${item.name}?`}
        hint="If they don’t want someone to find them, choose No."
        error={showErrors && !matching ? 'Choose their answer' : undefined}
        value={matching}
        onChange={setMatching}
        layout="inline"
        options={[
          { value: 'granted', label: 'Yes' },
          { value: 'declined', label: 'No' },
        ]}
      />
      <ChoiceGroup
        id={`consent-${item.reference}-contact`}
        compact
        legend="If family is found, may a coordinator arrange contact?"
        error={showErrors && !contact ? 'Choose their answer' : undefined}
        value={contact}
        onChange={setContact}
        layout="inline"
        options={[
          { value: 'granted', label: 'Yes' },
          { value: 'declined', label: 'No' },
          { value: 'unknown', label: 'They’ll decide when asked' },
        ]}
      />
      {save.error && <RequestErrorNotice error={save.error} onRetry={submit} retrying={save.pending} inputKept />}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={submit} loading={save.pending}>
          {save.pending ? 'Saving' : 'Save answer'}
        </Button>
        <Button variant="quiet" onClick={onCancel} disabled={save.pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function AwaitingConsent({ items, onRecorded }: { items: AwaitingConsentItem[]; onRecorded: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section aria-labelledby="consent-title">
      <SectionHeading id="consent-title" count={items.length}>
        Waiting for an answer
      </SectionHeading>
      <p className="mt-1 max-w-prose text-ink-muted">
        Not yet asked about family search. They won’t appear in any search until they say yes.
      </p>
      {items.length === 0 ? (
        <p className="mt-3">Everyone at this shelter has been asked.</p>
      ) : (
        <ul className="mt-3 border-t border-line">
          {items.map((item) => (
            <li key={item.reference} className="border-b border-line py-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <span>
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-ink-muted">
                    , {item.reference}, registered {formatRelative(item.registeredAt)}
                  </span>
                </span>
                {open !== item.reference && (
                  <Button variant="secondary" onClick={() => setOpen(item.reference)}>
                    Record answer
                  </Button>
                )}
              </div>
              {open === item.reference && (
                <ConsentFollowUp
                  item={item}
                  onCancel={() => setOpen(null)}
                  onDone={() => {
                    setOpen(null);
                    onRecorded();
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DashboardPage() {
  const { session } = useSession();
  const health = useConnection();
  const dashboard = useAsync(() => api.getDashboard(session), [session.role, session.shelterId]);
  const data = dashboard.data;
  const isCoordinator = session.role === 'coordinator';
  const connectionMeta = CONNECTION_META[health];

  return (
    <>
      <PageHeader documentTitle="Home" title="What do you need to do?" lead={`${session.shelterName} shelter desk`} />

      <div className="grid gap-3 sm:grid-cols-2">
        <PrimaryAction
          to="/register"
          icon={UserPlus}
          title="Register someone"
          description="Record a person staying here. No ID or phone needed."
        />
        <PrimaryAction
          to="/search"
          icon={Search}
          title="Find a family member"
          description="Record who someone is looking for. A nickname is enough."
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6">
        <Link to="/status" className={linkClass}>
          Check on a search request
        </Link>
        {isCoordinator && (
          <Link to="/cases" className={linkClass}>
            Review cases
          </Link>
        )}
      </div>

      {!data && dashboard.error && (
        <div className="mt-10">
          <RequestErrorNotice kind="load" error={dashboard.error} onRetry={dashboard.reload} retrying={dashboard.loading} />
        </div>
      )}
      {!data && !dashboard.error && <Loading label="Loading this shelter’s work" />}

      {data && (
        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div className="space-y-12">
            <ReviewQueue queue={data.reviewQueue} />
            <AwaitingConsent items={data.awaitingConsent} onRecorded={dashboard.reload} />
          </div>
          <div className="space-y-12">
            <section aria-labelledby="connection-title">
              <SectionHeading id="connection-title">Connection</SectionHeading>
              <p className="mt-3 flex items-start gap-2">
                <connectionMeta.Icon className={cx('mt-1 h-4 w-4 shrink-0', connectionMeta.tone)} aria-hidden="true" />
                <span>
                  <span className="font-semibold">{connectionMeta.label}.</span> {connectionMeta.detail}
                </span>
              </p>
            </section>
            <section aria-labelledby="activity-title">
              <SectionHeading id="activity-title">Recent activity</SectionHeading>
              {!isCoordinator && <p className="mt-1 text-sm text-ink-muted">Case progress is visible to coordinators only.</p>}
              <ol className="mt-3 border-t border-line">
                {data.activity.map((item, index) => (
                  <li key={`${item.at}-${index}`} className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3 border-b border-line py-2.5">
                    <time dateTime={item.at} className="tabular-nums text-ink-muted">
                      {formatClock(item.at)}
                    </time>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      )}
      {data && dashboard.error && (
        <div className="mt-8">
          <RequestErrorNotice kind="load" error={dashboard.error} onRetry={dashboard.reload} retrying={dashboard.loading} />
        </div>
      )}
    </>
  );
}
