import { useState, type FormEvent } from 'react';
import { Hourglass, MessageSquare } from 'lucide-react';
import { useLocation } from 'react-router';
import { Button } from '../components/ui/Button';
import { RequestErrorNotice } from '../components/ui/Feedback';
import { TextInput } from '../components/ui/Field';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { isReference, normalizeReference } from '../lib/reference';
import { api } from '../services';
import type { RequesterStatusView } from '../services/contracts';
import { useMutation } from '../state/async';
import { useSession } from '../state/session';

/**
 * Requester-facing. Shows the only two things a person searching can learn.
 * "Active" covers every reason contact isn't happening, including a person
 * who asked not to be found, so this screen can never confirm a record exists.
 */
function StatusResult({ status }: { status: RequesterStatusView }) {
  if (status.stage === 'contact_arranged') {
    return (
      <Notice tone="success" icon={MessageSquare} title="A coordinator is arranging contact">
        <p>Ask them to stay in touch with the shelter desk. The coordinator will explain the next step.</p>
      </Notice>
    );
  }
  return (
    <Notice tone="info" icon={Hourglass} title={`Request ${status.reference} is open`}>
      <p>A coordinator will get in touch the way they asked if contact can be arranged. There’s nothing else to share right now.</p>
      <p className="text-ink-muted">Tell them: no news doesn’t mean anything, good or bad.</p>
    </Notice>
  );
}

export function StatusPage() {
  const { session } = useSession();
  const location = useLocation();
  const initial = (location.state as { reference?: string } | null)?.reference ?? '';
  const [reference, setReference] = useState(initial);
  const [formatError, setFormatError] = useState<string>();
  const [result, setResult] = useState<RequesterStatusView | null>(null);
  const check = useMutation((ref: string) => api.getRequesterStatus(ref, session));

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setResult(null);
    if (!isReference(reference, 'S')) {
      setFormatError('Enter a search request reference, like S-1041');
      return;
    }
    setFormatError(undefined);
    const status = await check.run(normalizeReference(reference));
    if (status) setResult(status);
  };

  return (
    <>
      <PageHeader
        documentTitle="Check a request"
        back={{ to: '/', label: 'Home' }}
        title="Check a search request"
        lead="For the person who asked. This shows only what can be shared with them."
      />
      <form noValidate onSubmit={submit} className="max-w-form">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <TextInput
              id="status-reference"
              label="Search request reference"
              hint="It’s on their slip and starts with S."
              autoComplete="off"
              autoCapitalize="characters"
              value={reference}
              error={formatError}
              onChange={(event) => setReference(event.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" loading={check.pending}>
            {check.pending ? 'Checking' : 'Check'}
          </Button>
        </div>
      </form>

      <div aria-live="polite" className="mt-8 max-w-form">
        {result && <StatusResult status={result} />}
        {check.error && check.error.code === 'not_found' && (
          <Notice tone="warning" title="No request has that reference">
            <p>Check the number on their slip. If it’s lost, start a new search request.</p>
          </Notice>
        )}
        {check.error && check.error.code !== 'not_found' && (
          <RequestErrorNotice kind="load" error={check.error} onRetry={() => submit()} retrying={check.pending} />
        )}
      </div>
    </>
  );
}
