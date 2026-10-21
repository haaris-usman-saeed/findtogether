import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Choice';
import { FieldError } from '../../components/ui/Field';
import { RequestErrorNotice } from '../../components/ui/Feedback';
import { TextArea } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';
import { SectionHeading } from '../../components/ui/PageHeader';
import { CONTACT_CHANNEL_LABEL, RELATIONSHIP_LABEL, REVIEW_REASON_LABEL } from '../../domain/labels';
import type { CaseEvent, ReviewReason } from '../../domain/types';
import { formatClock, formatRelative } from '../../lib/time';
import { api } from '../../services';
import type { CandidateView, CaseDetail, RequestView } from '../../services/contracts';
import { useMutation } from '../../state/async';
import { useSession } from '../../state/session';
import { CandidateBadge } from './CandidateBadge';

type Update = (detail: CaseDetail) => void;

export function RequestSummary({ request }: { request: RequestView }) {
  const reach =
    request.requesterContactChannel === 'shelter_desk'
      ? `Shelter desk at ${request.requesterShelterName}`
      : request.requesterContactDetail
        ? `${CONTACT_CHANNEL_LABEL[request.requesterContactChannel]}: ${request.requesterContactDetail}`
        : `${CONTACT_CHANNEL_LABEL[request.requesterContactChannel]}. Shown once contact is authorized.`;
  const rows: [string, string | undefined][] = [
    ['Name they gave', request.soughtName],
    ['Other names', request.soughtOtherNames.join(', ') || undefined],
    ['Who this person is to them', RELATIONSHIP_LABEL[request.relationship]],
    ['Age', request.soughtAge],
    ['Last known', request.lastKnown],
    ['Other details', request.details],
    [
      'Asked by',
      `${request.requesterName}${request.requesterRegistrationReference ? `, ${request.requesterRegistrationReference}` : ''}`,
    ],
    ['Staying at', request.requesterShelterName],
    ['How to reach them', reach],
    ['Submitted', `${formatClock(request.submittedAt)}, ${formatRelative(request.submittedAt)}`],
  ];
  return (
    <section aria-labelledby="request-title">
      <h2 id="request-title" className="text-xl font-semibold">
        What the person searching told us
      </h2>
      <dl className="mt-3 divide-y divide-line border-y border-line">
        {rows
          .filter((row): row is [string, string] => Boolean(row[1]))
          .map(([label, value]) => (
            <div key={label} className="py-2.5">
              <dt className="text-sm text-ink-muted">{label}</dt>
              <dd className="mt-0.5 text-ink">{value}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

export function ReviewFlagNotice({ caseDetail, onUpdate }: { caseDetail: CaseDetail; onUpdate: Update }) {
  const { session } = useSession();
  const clear = useMutation(() => api.submitReviewDecision(caseDetail.reference, { type: 'clear_review_flag' }, session));
  const flag = caseDetail.reviewFlag;
  if (!flag) return null;
  const run = async () => {
    const detail = await clear.run();
    if (detail) onUpdate(detail);
  };
  return (
    <Notice
      tone="warning"
      title="Sent for additional review"
      action={
        <Button onClick={run} loading={clear.pending}>
          {clear.pending ? 'Saving' : 'Mark review complete'}
        </Button>
      }
    >
      <ul className="list-disc space-y-0.5 pl-5">
        {flag.reasons.map((reason) => (
          <li key={reason}>{REVIEW_REASON_LABEL[reason]}</li>
        ))}
      </ul>
      <p>“{flag.note}”</p>
      <p className="text-sm text-ink-muted">
        {flag.raisedBy}, {formatClock(flag.raisedAt)}
      </p>
      {clear.error && <RequestErrorNotice error={clear.error} onRetry={run} retrying={clear.pending} />}
    </Notice>
  );
}

const REASONS = Object.keys(REVIEW_REASON_LABEL) as ReviewReason[];

export function SendForReview({ caseDetail, onUpdate }: { caseDetail: CaseDetail; onUpdate: Update }) {
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const [reasons, setReasons] = useState<ReviewReason[]>([]);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const save = useMutation(() =>
    api.submitReviewDecision(caseDetail.reference, { type: 'flag_for_review', reasons, note }, session),
  );
  const submit = async () => {
    setTried(true);
    if (reasons.length === 0 || !note.trim()) return;
    const detail = await save.run();
    if (detail) {
      setOpen(false);
      onUpdate(detail);
    }
  };
  const toggle = (reason: ReviewReason, on: boolean) =>
    setReasons((current) => (on ? [...current, reason] : current.filter((r) => r !== reason)));

  return (
    <section aria-labelledby="review-title" className="rounded-md border border-line bg-surface px-5 py-4">
      <h3 id="review-title" className="text-lg font-semibold">
        {caseDetail.candidates.filter((c) => c.review.state === 'possible').length > 1
          ? 'Can’t tell which record is right?'
          : 'Not sure this is them?'}
      </h3>
      <p className="mt-1 max-w-prose text-ink-muted">
        Send the case for additional review instead of guessing. Write down what’s missing so the next coordinator can pick
        it up.
      </p>
      {!open ? (
        <Button className="mt-4" onClick={() => setOpen(true)}>
          Send for additional review
        </Button>
      ) : (
        <div className="mt-5 space-y-6">
          <fieldset id="review-reasons" aria-describedby={tried && reasons.length === 0 ? 'review-reasons-error' : undefined}>
            <legend className="font-semibold">What’s the problem?</legend>
            {tried && reasons.length === 0 && (
              <div className="mt-1.5">
                <FieldError id="review-reasons-error">Choose at least one</FieldError>
              </div>
            )}
            <div className="mt-2">
              {REASONS.map((reason) => (
                <Checkbox
                  key={reason}
                  id={`review-reason-${reason}`}
                  label={REVIEW_REASON_LABEL[reason]}
                  checked={reasons.includes(reason)}
                  onChange={(on) => toggle(reason, on)}
                />
              ))}
            </div>
          </fieldset>
          <TextArea
            id="review-note"
            label="What would settle this?"
            hint="For example: ask the person searching for a middle name or date of birth."
            rows={3}
            value={note}
            error={tried && !note.trim() ? 'Say what would settle this' : undefined}
            onChange={(event) => setNote(event.target.value)}
          />
          {save.error && <RequestErrorNotice error={save.error} onRetry={submit} retrying={save.pending} inputKept />}
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={submit} loading={save.pending}>
              {save.pending ? 'Sending' : 'Send for review'}
            </Button>
            <Button variant="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export function SetAsideList({ candidates }: { candidates: CandidateView[] }) {
  return (
    <section aria-labelledby="aside-title">
      <SectionHeading id="aside-title" count={candidates.length}>
        Set aside
      </SectionHeading>
      <ul className="mt-3 border-t border-line">
        {candidates.map((c) => (
          <li key={c.registrationReference} className="border-b border-line py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-semibold">{c.displayName}</span>
                <span className="text-ink-muted">, {c.registrationReference}</span>
              </span>
              <CandidateBadge state={c.review.state} />
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {c.review.state === 'declined'
                ? 'Contact declined. Nothing about this record will be shared with the person searching.'
                : `Reason: ${c.review.ruledOutReason ?? 'not given'}`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CaseHistory({ history }: { history: CaseEvent[] }) {
  return (
    <section aria-labelledby="history-title">
      <SectionHeading id="history-title">Case history</SectionHeading>
      <ol className="mt-3 border-t border-line">
        {history.map((event, index) => (
          <li key={`${event.at}-${index}`} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 border-b border-line py-2.5 text-[0.9375rem]">
            <time dateTime={event.at} className="tabular-nums text-ink-muted">
              {formatClock(event.at)}
            </time>
            <span>
              {event.text}
              <span className="block text-sm text-ink-muted">{event.actor}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
