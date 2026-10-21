import { useState } from 'react';
import { Check, CircleDashed, Minus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { RequestErrorNotice } from '../../components/ui/Feedback';
import { TextArea } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';
import { CONSENT_LABEL, CONTACT_METHOD_LABEL } from '../../domain/labels';
import type { ConsentDecisions, ConsentState, ContactChannel, ContactPreference } from '../../domain/types';
import { cx } from '../../lib/cx';
import { formatRelative } from '../../lib/time';
import { api } from '../../services';
import type { CandidateView, CaseDetail } from '../../services/contracts';
import { useMutation } from '../../state/async';
import { useSession } from '../../state/session';
import { CandidateBadge } from './CandidateBadge';
import { EvidenceLedger } from './EvidenceLedger';
import { VerificationPanel } from './VerificationPanel';

type Update = (detail: CaseDetail) => void;

const CONSENT_ICON: Record<ConsentState, { Icon: typeof Check; tone: string }> = {
  granted: { Icon: Check, tone: 'text-success' },
  declined: { Icon: Minus, tone: 'text-danger' },
  unknown: { Icon: CircleDashed, tone: 'text-ink-muted' },
};

function ConsentLine({ consent }: { consent: ConsentDecisions }) {
  const items = [
    { key: 'matching', state: consent.matching, text: CONSENT_LABEL.matching[consent.matching] },
    { key: 'contact', state: consent.contact, text: CONSENT_LABEL.contact[consent.contact] },
  ];
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="What they’ve agreed to">
      {items.map(({ key, state, text }) => {
        const { Icon, tone } = CONSENT_ICON[state];
        return (
          <li key={key} className="flex items-center gap-1.5">
            <Icon className={cx('h-4 w-4', tone)} aria-hidden="true" />
            {text}
          </li>
        );
      })}
    </ul>
  );
}

export function contactText(contact: ContactPreference | { channel: ContactChannel; detail?: string } | undefined, shelterName: string): string {
  if (!contact) return 'Not released';
  switch (contact.channel) {
    case 'shelter_desk':
      return `Shelter desk at ${shelterName}`;
    case 'phone':
      return `Phone ${contact.detail ?? ''}`.trim();
    case 'email':
      return `Email ${contact.detail ?? ''}`.trim();
    case 'caseworker':
      return `Caseworker: ${contact.detail ?? ''}`;
  }
}

function RuleOutForm({ caseReference, candidate, onUpdate, onCancel }: { caseReference: string; candidate: CandidateView; onUpdate: Update; onCancel: () => void }) {
  const { session } = useSession();
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const save = useMutation(() =>
    api.submitReviewDecision(caseReference, { type: 'rule_out', registrationReference: candidate.registrationReference, reason }, session),
  );
  const submit = async () => {
    setTried(true);
    if (!reason.trim()) return;
    const detail = await save.run();
    if (detail) onUpdate(detail);
  };
  return (
    <div className="space-y-4">
      <TextArea
        id={`${candidate.registrationReference}-ruleout`}
        label="Why isn’t this the person?"
        hint="Other coordinators will see this in the case history."
        rows={2}
        value={reason}
        error={tried && !reason.trim() ? 'Give a reason' : undefined}
        onChange={(event) => setReason(event.target.value)}
      />
      {save.error && <RequestErrorNotice error={save.error} onRetry={submit} retrying={save.pending} inputKept />}
      <div className="flex flex-wrap gap-3">
        <Button variant="danger" onClick={submit} loading={save.pending}>
          {save.pending ? 'Ruling out' : 'Rule out record'}
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function PossibleActions({ caseDetail, candidate, blockedBy, onUpdate }: { caseDetail: CaseDetail; candidate: CandidateView; blockedBy?: string; onUpdate: Update }) {
  const { session } = useSession();
  const [ruling, setRuling] = useState(false);
  const begin = useMutation(() =>
    api.submitReviewDecision(caseDetail.reference, { type: 'begin_verification', registrationReference: candidate.registrationReference }, session),
  );
  const start = async () => {
    const detail = await begin.run();
    if (detail) onUpdate(detail);
  };

  if (ruling) {
    return <RuleOutForm caseReference={caseDetail.reference} candidate={candidate} onUpdate={onUpdate} onCancel={() => setRuling(false)} />;
  }
  return (
    <div className="space-y-3">
      {blockedBy && <p className="text-sm text-ink-muted">Finish with {blockedBy} before verifying this record.</p>}
      {begin.error && <RequestErrorNotice error={begin.error} onRetry={start} retrying={begin.pending} />}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" disabled={Boolean(blockedBy)} loading={begin.pending} onClick={start}>
          {begin.pending ? 'Starting' : 'Begin verification'}
        </Button>
        <Button onClick={() => setRuling(true)}>Rule out</Button>
      </div>
    </div>
  );
}

function AuthorizedPanel({ caseDetail, candidate, onUpdate }: { caseDetail: CaseDetail; candidate: CandidateView; onUpdate: Update }) {
  const { session } = useSession();
  const method = candidate.review.contactMethod;
  const save = useMutation(() =>
    api.submitReviewDecision(caseDetail.reference, { type: 'record_contact_made', registrationReference: candidate.registrationReference }, session),
  );
  const record = async () => {
    const detail = await save.run();
    if (detail) onUpdate(detail);
  };
  const { request } = caseDetail;
  return (
    <div className="space-y-4">
      <Notice tone="success" title={method ? `Contact authorized: ${CONTACT_METHOD_LABEL[method].label.toLowerCase()}` : 'Contact authorized'}>
        <p>{method ? `${CONTACT_METHOD_LABEL[method].description} ` : ''}Contact details are now released to coordinators.</p>
      </Notice>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-ink-muted">Reach {candidate.displayName}</dt>
          <dd className="font-medium">{contactText(candidate.contact, candidate.shelterName)}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Reach {request.requesterName}</dt>
          <dd className="font-medium">
            {contactText({ channel: request.requesterContactChannel, detail: request.requesterContactDetail }, request.requesterShelterName)}
          </dd>
        </div>
      </dl>
      {save.error && <RequestErrorNotice error={save.error} onRetry={record} retrying={save.pending} />}
      <Button variant="primary" onClick={record} loading={save.pending}>
        {save.pending ? 'Recording' : 'Record that contact happened'}
      </Button>
    </div>
  );
}

export function CandidateCard({
  caseDetail,
  candidate,
  blockedBy,
  onUpdate,
}: {
  caseDetail: CaseDetail;
  candidate: CandidateView;
  /** Reference of another record already in verification, if any. */
  blockedBy?: string;
  onUpdate: Update;
}) {
  const [rulingOut, setRulingOut] = useState(false);
  const c = candidate;
  const state = c.review.state;
  const headingId = `candidate-${c.registrationReference}`;
  const facts: [string, string][] = [
    ['Reference', c.registrationReference],
    ['Age', c.age],
    ['Shelter', c.shelterName],
    ['Registered', formatRelative(c.registeredAt)],
  ];

  return (
    <article
      aria-labelledby={headingId}
      className={cx('rounded-md border bg-surface', state === 'verifying' ? 'border-accent ring-1 ring-accent' : 'border-line-strong')}
    >
      <div className="px-5 pb-5 pt-4">
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3 id={headingId} className="text-lg font-semibold text-ink">
              {c.displayName}
            </h3>
            {c.fullName && c.fullName !== c.displayName && <p className="text-ink-muted">Full name on record: {c.fullName}</p>}
            {c.otherNames.length > 0 && <p className="text-ink-muted">Also known as: {c.otherNames.join(', ')}</p>}
          </div>
          <CandidateBadge state={state} />
        </header>

        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-sm text-ink-muted">{label}</dt>
              <dd className="font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <ConsentLine consent={c.consent} />

        <div className="mt-4">
          <EvidenceLedger evidence={c.evidence} />
        </div>

        {(c.recognizableDetails || c.familyNotes) && (
          <dl className="mt-3 space-y-1.5 text-[0.9375rem]">
            {c.recognizableDetails && (
              <div>
                <dt className="inline text-ink-muted">Description on record: </dt>
                <dd className="inline">{c.recognizableDetails}</dd>
              </div>
            )}
            {c.familyNotes && (
              <div>
                <dt className="inline text-ink-muted">Family notes on record: </dt>
                <dd className="inline">{c.familyNotes}</dd>
              </div>
            )}
          </dl>
        )}

        {c.possibleDuplicateOf.length > 0 && (
          <Notice tone="warning" className="mt-4" title="May be registered twice">
            <p>
              Similar to {c.possibleDuplicateOf.join(' and ')}. These could be one person registered at two shelters. Settle
              this before contacting anyone.
            </p>
          </Notice>
        )}
      </div>

      <div className="rounded-b-md border-t border-line bg-canvas px-5 py-4">
        {state === 'possible' && <PossibleActions caseDetail={caseDetail} candidate={c} blockedBy={blockedBy} onUpdate={onUpdate} />}
        {state === 'verifying' && (
          <div className="space-y-4">
            <VerificationPanel caseDetail={caseDetail} candidate={c} onUpdate={onUpdate} />
            {rulingOut ? (
              <RuleOutForm caseReference={caseDetail.reference} candidate={c} onUpdate={onUpdate} onCancel={() => setRulingOut(false)} />
            ) : (
              <Button variant="quiet" onClick={() => setRulingOut(true)}>
                Rule out this record
              </Button>
            )}
          </div>
        )}
        {state === 'authorized' && <AuthorizedPanel caseDetail={caseDetail} candidate={c} onUpdate={onUpdate} />}
        {state === 'reconnected' && (
          <Notice tone="success" title="Contact made">
            <p>Recorded in the case history. No further action is needed on this record.</p>
          </Notice>
        )}
      </div>
    </article>
  );
}
