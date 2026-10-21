import { useState } from 'react';
import { Check, CircleDashed, Lock } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ChoiceGroup, type ChoiceOption } from '../../components/ui/Choice';
import { RequestErrorNotice } from '../../components/ui/Feedback';
import { TextArea } from '../../components/ui/Field';
import { contactBlockers, emptyVerification, stepLockedReason, type VerificationStep } from '../../domain/authorization';
import { CONTACT_METHOD_LABEL, METHOD_LABEL, RELATIONSHIP_INVERSE } from '../../domain/labels';
import type { ConfirmationMethod, ContactMethod, RecordedStep } from '../../domain/types';
import { cx } from '../../lib/cx';
import { formatClock } from '../../lib/time';
import { api } from '../../services';
import type { CandidateView, CaseDetail, VerificationStepInput } from '../../services/contracts';
import { useMutation } from '../../state/async';
import { useSession } from '../../state/session';

const RESULT_OPTIONS: Record<VerificationStep, ChoiceOption<string>[]> = {
  relationship: [
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'not_confirmed', label: 'Not confirmed' },
    { value: 'unreachable', label: 'Couldn’t reach them' },
  ],
  registered_consent: [
    { value: 'agrees', label: 'Agrees to contact' },
    { value: 'declines', label: 'Declines contact' },
    { value: 'unreachable', label: 'Couldn’t reach them' },
  ],
  requester_consent: [
    { value: 'agrees', label: 'Confirms contact' },
    { value: 'declines', label: 'No longer wants contact' },
    { value: 'unreachable', label: 'Couldn’t reach them' },
  ],
};

const RESULT_TEXT: Record<string, string> = {
  confirmed: 'Confirmed',
  not_confirmed: 'Not confirmed',
  unreachable: 'Couldn’t reach them yet',
  agrees: 'Agreed',
  declines: 'Declined',
};

const METHOD_OPTIONS: ChoiceOption<ConfirmationMethod>[] = (Object.keys(METHOD_LABEL) as ConfirmationMethod[]).map((value) => ({
  value,
  label: METHOD_LABEL[value],
}));

interface Common {
  caseReference: string;
  registrationReference: string;
  onUpdate: (detail: CaseDetail) => void;
}

function StepMarker({ number, positive, locked }: { number: number; positive: boolean; locked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums',
        positive ? 'border-success bg-success text-white' : locked ? 'border-line text-ink-faint' : 'border-ink-muted text-ink',
      )}
    >
      {positive ? <Check className="h-4 w-4" /> : locked ? <Lock className="h-3.5 w-3.5" /> : number}
    </span>
  );
}

function StepItem({
  number,
  title,
  guidance,
  step,
  recorded,
  lockedReason,
  caseReference,
  registrationReference,
  onUpdate,
}: Common & {
  number: number;
  title: string;
  guidance: string;
  step: VerificationStep;
  recorded: RecordedStep<string>;
  lockedReason: string | null;
}) {
  const { session } = useSession();
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState('');
  const [method, setMethod] = useState<ConfirmationMethod | ''>('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const save = useMutation((input: VerificationStepInput) =>
    api.recordVerificationStep(caseReference, registrationReference, input, session),
  );

  const done = recorded.result !== 'pending';
  const positive = recorded.result === 'confirmed' || recorded.result === 'agrees';
  const showForm = !lockedReason && (!done || editing);
  const idBase = `${registrationReference}-${step}`;

  const submit = async () => {
    setTried(true);
    if (!result || !method) return;
    const detail = await save.run({ step, result, method, note } as VerificationStepInput);
    if (detail) {
      setEditing(false);
      setResult('');
      setMethod('');
      setNote('');
      setTried(false);
      onUpdate(detail);
    }
  };

  return (
    <li
      className={cx(
        'flex gap-3 rounded border bg-surface p-4',
        lockedReason ? 'border-line' : positive && !editing ? 'border-success-line' : 'border-line-strong',
      )}
    >
      <StepMarker number={number} positive={positive && !editing} locked={Boolean(lockedReason)} />
      <div className="min-w-0 flex-1">
        <p className={cx('font-semibold', lockedReason ? 'text-ink-muted' : 'text-ink')}>{title}</p>
        {lockedReason && <p className="mt-0.5 text-sm text-ink-muted">{lockedReason}</p>}

        {done && !editing && !lockedReason && (
          <div className="mt-1 space-y-1">
            <p>
              <span className="font-semibold">{RESULT_TEXT[recorded.result]}</span>
              <span className="text-ink-muted">
                {recorded.method ? `, ${METHOD_LABEL[recorded.method].toLowerCase()}` : ''}
                {recorded.recordedBy ? `, recorded by ${recorded.recordedBy}` : ''}
                {recorded.recordedAt ? ` at ${formatClock(recorded.recordedAt)}` : ''}
              </span>
            </p>
            {recorded.note && <p className="text-sm text-ink-muted">Note: {recorded.note}</p>}
            {recorded.result === 'not_confirmed' && (
              <p className="text-sm text-warning">If this isn’t them, rule out the record below.</p>
            )}
            <Button variant="quiet" onClick={() => setEditing(true)}>
              {recorded.result === 'unreachable' ? 'Record another attempt' : 'Change'}
            </Button>
          </div>
        )}

        {showForm && (
          <div className="mt-1 space-y-5">
            <p className="max-w-prose text-sm text-ink-muted">{guidance}</p>
            <ChoiceGroup
              id={`${idBase}-result`}
              compact
              legend="Outcome"
              layout="inline"
              value={result}
              onChange={setResult}
              options={RESULT_OPTIONS[step]}
              error={tried && !result ? 'Choose an outcome' : undefined}
            />
            <ChoiceGroup
              id={`${idBase}-method`}
              compact
              legend="How you spoke with them"
              layout="inline"
              value={method}
              onChange={setMethod}
              options={METHOD_OPTIONS}
              error={tried && !method ? 'Choose how you reached them' : undefined}
            />
            <TextArea id={`${idBase}-note`} optional rows={2} label="Note" value={note} onChange={(event) => setNote(event.target.value)} />
            {save.error && <RequestErrorNotice error={save.error} onRetry={submit} retrying={save.pending} inputKept />}
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" onClick={submit} loading={save.pending}>
                {save.pending ? 'Recording' : 'Record outcome'}
              </Button>
              {editing && (
                <Button variant="quiet" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function AuthorizeStep({
  number,
  blockers,
  caseReference,
  registrationReference,
  onUpdate,
}: Common & { number: number; blockers: string[] }) {
  const { session } = useSession();
  const [method, setMethod] = useState<ContactMethod | ''>('');
  const [tried, setTried] = useState(false);
  const save = useMutation((m: ContactMethod) => api.requestContactCoordination(caseReference, registrationReference, m, session));
  const blocked = blockers.length > 0;
  const blockersId = `${registrationReference}-blockers`;

  const submit = async () => {
    if (blocked) return;
    setTried(true);
    if (!method) return;
    const detail = await save.run(method);
    if (detail) onUpdate(detail);
  };

  return (
    <li className="flex gap-3 rounded border border-line-strong bg-surface p-4">
      <StepMarker number={number} positive={false} locked={blocked} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">Authorize contact coordination</p>
        {blocked ? (
          <div id={blockersId} className="mt-1">
            <p className="text-sm text-ink-muted">Available once these are recorded:</p>
            <ul className="mt-1.5 space-y-1">
              {blockers.map((blocker) => (
                <li key={blocker} className="flex items-start gap-2 text-sm">
                  <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  {blocker}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            <ChoiceGroup
              id={`${registrationReference}-contact-method`}
              compact
              legend="How will contact happen?"
              value={method}
              onChange={setMethod}
              error={tried && !method ? 'Choose how contact will happen' : undefined}
              options={(Object.keys(CONTACT_METHOD_LABEL) as ContactMethod[]).map((value) => ({
                value,
                label: CONTACT_METHOD_LABEL[value].label,
                description: CONTACT_METHOD_LABEL[value].description,
              }))}
            />
            <p className="max-w-prose text-sm text-ink-muted">This records that both people agreed. It doesn’t prove who they are.</p>
          </div>
        )}
        {save.error && (
          <div className="mt-4">
            <RequestErrorNotice error={save.error} onRetry={submit} retrying={save.pending} inputKept />
          </div>
        )}
        <div className="mt-4">
          <Button
            variant="primary"
            aria-disabled={blocked || undefined}
            aria-describedby={blocked ? blockersId : undefined}
            className={blocked ? 'cursor-not-allowed opacity-60 hover:bg-accent' : undefined}
            onClick={submit}
            loading={save.pending}
          >
            {save.pending ? 'Authorizing' : 'Authorize contact coordination'}
          </Button>
        </div>
      </div>
    </li>
  );
}

function StopVerification({ caseReference, registrationReference, onUpdate }: Common) {
  const { session } = useSession();
  const [confirming, setConfirming] = useState(false);
  const save = useMutation(() =>
    api.submitReviewDecision(caseReference, { type: 'stop_verification', registrationReference }, session),
  );
  if (!confirming) {
    return (
      <Button variant="quiet" onClick={() => setConfirming(true)}>
        Stop verification
      </Button>
    );
  }
  return (
    <div role="group" aria-label="Stop verification?" className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-muted">Clear the recorded steps?</span>
      <Button
        variant="danger"
        loading={save.pending}
        onClick={async () => {
          const detail = await save.run();
          if (detail) onUpdate(detail);
        }}
      >
        Stop
      </Button>
      <Button variant="quiet" onClick={() => setConfirming(false)}>
        Keep going
      </Button>
      {save.error && <p className="w-full text-sm font-semibold text-danger">{save.error.message}</p>}
    </div>
  );
}

export function VerificationPanel({
  caseDetail,
  candidate,
  onUpdate,
}: {
  caseDetail: CaseDetail;
  candidate: CandidateView;
  onUpdate: (detail: CaseDetail) => void;
}) {
  const verification = candidate.review.verification ?? emptyVerification();
  // Candidates the server sends are discoverable adults by construction, hence the fixed flags.
  const blockers = contactBlockers({
    safeguarding: caseDetail.safeguarding,
    registration: { safetyConcern: false, isMinor: false, consent: candidate.consent },
    review: candidate.review,
  });
  const common: Common = { caseReference: caseDetail.reference, registrationReference: candidate.registrationReference, onUpdate };
  const name = candidate.displayName;
  const headingId = `verify-${candidate.registrationReference}`;

  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id={headingId} className="text-lg font-semibold">
          Verification
        </h4>
        <StopVerification {...common} />
      </div>
      <p className="max-w-prose text-sm text-ink-muted">
        Record what happened in each conversation. Nothing is shared with either person until every step is done.
      </p>
      <ol className="mt-4 space-y-3">
        <StepItem
          {...common}
          number={1}
          step="relationship"
          title="Confirm the relationship"
          guidance={`Speak with ${name} privately. Ask whether they’re looking for ${RELATIONSHIP_INVERSE[caseDetail.request.relationship]}. Don’t say who is asking yet.`}
          recorded={verification.relationship}
          lockedReason={null}
        />
        <StepItem
          {...common}
          number={2}
          step="registered_consent"
          title={`Ask ${name} about contact`}
          guidance="Explain that someone may be looking for them. They can say no, and the person searching won’t be told why."
          recorded={verification.registeredConsent}
          lockedReason={stepLockedReason('registered_consent', verification)}
        />
        <StepItem
          {...common}
          number={3}
          step="requester_consent"
          title={`Confirm with ${caseDetail.request.requesterName}`}
          guidance="Check they still want contact and agree with how it will happen."
          recorded={verification.requesterConsent}
          lockedReason={stepLockedReason('requester_consent', verification)}
        />
        <AuthorizeStep {...common} number={4} blockers={blockers} />
      </ol>
    </section>
  );
}
