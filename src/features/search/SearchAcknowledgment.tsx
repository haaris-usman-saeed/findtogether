import { useEffect } from 'react';
import { Printer, Search } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ReferenceSlip } from '../../components/ReferenceSlip';
import { Button, LinkButton } from '../../components/ui/Button';
import { Notice } from '../../components/ui/Notice';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatClock } from '../../lib/time';
import type { SearchReceipt } from '../../services/contracts';

export function SearchAcknowledgment({
  receipt,
  soughtName,
  onStartAnother,
}: {
  receipt: SearchReceipt;
  soughtName: string;
  onStartAnother: () => void;
}) {
  const navigate = useNavigate();
  useEffect(() => {
    document.getElementById('page-title')?.focus();
  }, []);

  return (
    <>
      <PageHeader documentTitle="Search request saved" title="Search request saved" back={{ to: '/', label: 'Home' }} />
      <div className="max-w-form space-y-8">
        <ReferenceSlip
          label="Search request reference"
          reference={receipt.reference}
          lines={[`Looking for ${soughtName}`, `Saved at ${formatClock(receipt.createdAt)}`]}
        >
          <p className="mt-4 border-t border-line pt-3 text-sm text-ink">
            Bring this number to any shelter desk to check on the request.
          </p>
        </ReferenceSlip>

        {receipt.routedToSafeguarding ? (
          <Notice tone="guarded" title="Sent to the safeguarding team">
            <p>
              Searches for children are handled by a safeguarding lead. They will speak with the person asking to confirm
              the relationship before anything is shared.
            </p>
          </Notice>
        ) : (
          <section aria-labelledby="next-title">
            <h2 id="next-title" className="text-xl font-semibold">
              What happens next
            </h2>
            <ol className="mt-3 max-w-prose list-decimal space-y-2 pl-6 marker:font-semibold marker:text-ink-muted">
              <li>A reunification coordinator looks for possible matches. This can take hours or days.</li>
              <li>If someone might be the person they’re looking for, the coordinator speaks with that person privately first.</li>
              <li>Contact happens only if both people agree.</li>
            </ol>
          </section>
        )}

        <Notice tone="info" title="What to tell them">
          <p>
            “We’ll be in touch only if contact can be arranged. No news doesn’t mean anything, good or bad. For everyone’s
            safety, we can’t share anything else about a search.”
          </p>
        </Notice>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" icon={Search} onClick={onStartAnother}>
            Start another search
          </Button>
          <Button onClick={() => navigate('/status', { state: { reference: receipt.reference } })}>Check this request</Button>
          <Button icon={Printer} onClick={() => window.print()}>
            Print reference slip
          </Button>
          <LinkButton to="/" variant="quiet">
            Home
          </LinkButton>
        </div>
      </div>
    </>
  );
}
