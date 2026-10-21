import { LoaderCircle, RotateCw } from 'lucide-react';
import type { ApiError } from '../../services/contracts';
import { Button } from './Button';
import { Notice } from './Notice';

export function Loading({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-10 text-ink-muted">
      <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function describe(error: ApiError, kind: 'save' | 'load', kept: boolean) {
  const keptText = kept ? ' Everything you entered is still on this screen.' : '';
  switch (error.code) {
    case 'network_unavailable':
      return kind === 'save'
        ? { title: 'No connection. Nothing was saved.', body: `Try again when the connection is back.${keptText}` }
        : { title: 'No connection', body: 'This can\u2019t load until the connection is back.' };
    case 'timeout':
      return { title: 'No response in time', body: `It may not have been saved. Trying again won\u2019t create a duplicate.${keptText}` };
    case 'server_unavailable':
      return kind === 'save'
        ? { title: 'Not saved', body: `The server didn\u2019t respond.${keptText}` }
        : { title: 'Couldn\u2019t load', body: 'The server didn\u2019t respond.' };
    case 'forbidden':
      return { title: 'Not available for your role', body: error.message };
    case 'not_found':
      return { title: 'Not found', body: error.message };
    case 'consent_required':
      return { title: 'Contact can\u2019t be authorized yet', body: error.message };
    case 'validation':
      return { title: 'Some details need fixing', body: error.message };
    default:
      return { title: 'That didn\u2019t work', body: error.message };
  }
}

/** Says exactly what happened, never claims success, and offers a retry only when retrying is safe. */
export function RequestErrorNotice({
  error,
  onRetry,
  retrying = false,
  kind = 'save',
  inputKept = false,
}: {
  error: ApiError;
  onRetry?: () => void;
  retrying?: boolean;
  kind?: 'save' | 'load';
  inputKept?: boolean;
}) {
  const copy = describe(error, kind, inputKept);
  return (
    <Notice
      tone="danger"
      role="alert"
      title={copy.title}
      action={
        error.retryable && onRetry ? (
          <Button icon={RotateCw} onClick={onRetry} loading={retrying}>
            {retrying ? 'Trying again' : 'Try again'}
          </Button>
        ) : undefined
      }
    >
      <p>{copy.body}</p>
    </Notice>
  );
}
