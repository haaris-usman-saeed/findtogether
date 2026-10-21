import { useEffect } from 'react';
import { Printer, Search, UserPlus } from 'lucide-react';
import { ReferenceSlip } from '../../components/ReferenceSlip';
import { Button, LinkButton } from '../../components/ui/Button';
import { Notice } from '../../components/ui/Notice';
import { PageHeader } from '../../components/ui/PageHeader';
import type { RegistrationDraft } from '../../forms/registrationForm';
import { formatClock } from '../../lib/time';
import type { RegistrationReceipt } from '../../services/contracts';

function searchability(receipt: RegistrationReceipt, submitted: RegistrationDraft): string {
  if (receipt.discoverable) return 'Their record can now be checked against family searches. A coordinator will ask them again before any contact.';
  if (submitted.safety === 'concern') return 'Their record is hidden. It won’t appear in any search, and anyone asking gets the same answer as if no record exists.';
  if (submitted.matching === 'declined') return 'Their record won’t appear in family searches, as they asked.';
  return 'Their record won’t be searched until someone records their answer about family search. It will appear on the home screen until then.';
}

export function RegistrationConfirmation({
  receipt,
  submitted,
  onRegisterAnother,
  onStartSearch,
}: {
  receipt: RegistrationReceipt;
  submitted: RegistrationDraft;
  onRegisterAnother: () => void;
  onStartSearch: () => void;
}) {
  useEffect(() => {
    document.getElementById('page-title')?.focus();
  }, []);

  const name = submitted.nameWithheld ? 'Name not given' : submitted.preferredName.trim();

  return (
    <>
      <PageHeader documentTitle="Registration saved" title="Registration saved" back={{ to: '/', label: 'Home' }} />
      <div className="max-w-form space-y-6">
        <ReferenceSlip
          label="Registration reference"
          reference={receipt.reference}
          lines={[`${name}, ${receipt.shelterName}`, `Saved at ${formatClock(receipt.createdAt)}`]}
        >
          <p className="mt-4 border-t border-line pt-3 text-sm text-ink">
            Give them this number. Any shelter desk can use it to find this record.
          </p>
        </ReferenceSlip>

        <Notice tone="info" title="Saved, not verified">
          <p>The record exists. Nobody has checked who this person is.</p>
        </Notice>

        {receipt.routedToSafeguarding ? (
          <Notice tone="guarded" title="Sent to the safeguarding lead">
            <p>Children’s records never appear in ordinary family searches. The safeguarding team handles any contact.</p>
          </Notice>
        ) : (
          <p className="max-w-prose">{searchability(receipt, submitted)}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button variant="primary" icon={UserPlus} onClick={onRegisterAnother}>
            Register someone else
          </Button>
          <Button icon={Search} onClick={onStartSearch}>
            Start a search for them
          </Button>
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
