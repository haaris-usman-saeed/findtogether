import { useState, type FormEvent } from 'react';
import { AgeInput } from '../components/AgeInput';
import { ContactInput } from '../components/ContactInput';
import { Button } from '../components/ui/Button';
import { Disclosure } from '../components/ui/Disclosure';
import { ErrorSummary } from '../components/ui/ErrorSummary';
import { RequestErrorNotice } from '../components/ui/Feedback';
import { Select, TextArea, TextInput } from '../components/ui/Field';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchAcknowledgment } from '../features/search/SearchAcknowledgment';
import { RELATIONSHIP_LABEL } from '../domain/labels';
import { RELATIONSHIPS } from '../domain/types';
import { isMinorDraft, splitList, type FieldErrors } from '../forms/common';
import {
  SEARCH_FIELD_ORDER,
  emptySearchDraft,
  toSearchInput,
  validateSearch,
  type SearchDraft,
  type SearchField,
} from '../forms/searchForm';
import { api } from '../services';
import type { SearchReceipt } from '../services/contracts';
import { useMutation } from '../state/async';
import { useDraft } from '../state/drafts';
import { useSession } from '../state/session';
import { useShelters } from '../state/shelters';

const fieldId = (field: SearchField) => `search-${field}`;

export function SearchPage() {
  const { session } = useSession();
  const shelters = useShelters();
  const { value: draft, setValue: setDraft, reset, discard } = useDraft('search', () => emptySearchDraft(session.shelterId));
  const [attempted, setAttempted] = useState(false);
  const [summaryKey, setSummaryKey] = useState(0);
  const [done, setDone] = useState<{ receipt: SearchReceipt; soughtName: string } | null>(null);
  const save = useMutation((d: SearchDraft) => api.createSearchRequest(toSearchInput(d), session));

  const serverErrors = (save.error?.code === 'validation' ? save.error.fieldErrors : undefined) as FieldErrors<SearchField> | undefined;
  const errors: FieldErrors<SearchField> = { ...(attempted ? validateSearch(draft) : {}), ...serverErrors };
  const hasErrors = Object.keys(errors).length > 0;
  const childSearch =
    isMinorDraft(draft.age) ||
    ((draft.relationship === 'child' || draft.relationship === 'grandchild') && (draft.age.mode === '' || draft.age.mode === 'unknown'));

  const set = <K extends keyof SearchDraft>(key: K, value: SearchDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setAttempted(true);
    if (Object.keys(validateSearch(draft)).length > 0) {
      setSummaryKey((k) => k + 1);
      return;
    }
    const receipt = await save.run(draft);
    if (receipt) {
      discard();
      setDone({ receipt, soughtName: draft.soughtName.trim() });
    }
  };

  if (done) {
    return (
      <SearchAcknowledgment
        receipt={done.receipt}
        soughtName={done.soughtName}
        onStartAnother={() => {
          reset();
          setAttempted(false);
          save.clearError();
          setDone(null);
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        documentTitle="Find a family member"
        back={{ to: '/', label: 'Home' }}
        title="Find a family member"
        lead="Incomplete information is fine. A nickname and a rough age are enough to start."
      />

      <form noValidate onSubmit={submit} className="max-w-form">
        {attempted && hasErrors && summaryKey > 0 && (
          <ErrorSummary key={summaryKey} errors={errors} order={SEARCH_FIELD_ORDER} idFor={fieldId} />
        )}

        <section aria-labelledby="search-sought-title" className="space-y-8">
          <h2 id="search-sought-title" className="text-xl font-semibold">
            Who are they looking for?
          </h2>
          <div>
            <TextInput
              id={fieldId('soughtName')}
              label="Name or nickname"
              hint="Any name the person might use. Spelling doesn’t need to be right."
              autoComplete="off"
              spellCheck={false}
              value={draft.soughtName}
              error={errors.soughtName}
              onChange={(event) => set('soughtName', event.target.value)}
            />
            <div className="mt-2 border-b border-line">
              <Disclosure
                id="search-names"
                label="Add other names or spellings"
                summary={splitList(draft.soughtOtherNames).length ? `${splitList(draft.soughtOtherNames).length} added` : undefined}
              >
                <TextInput
                  id="search-soughtOtherNames"
                  optional
                  label="Other names or spellings"
                  hint="Separate with commas, like: José, Pepe"
                  autoComplete="off"
                  value={draft.soughtOtherNames}
                  onChange={(event) => set('soughtOtherNames', event.target.value)}
                />
              </Disclosure>
            </div>
          </div>

          <Select
            id={fieldId('relationship')}
            label="Who is this person to them?"
            value={draft.relationship}
            error={errors.relationship}
            onChange={(event) => set('relationship', event.target.value as SearchDraft['relationship'])}
          >
            <option value="">Choose one</option>
            {RELATIONSHIPS.map((relationship) => (
              <option key={relationship} value={relationship}>
                {RELATIONSHIP_LABEL[relationship]}
              </option>
            ))}
          </Select>

          <AgeInput
            idPrefix="search"
            legend="Their age"
            hint="Skip this if they don’t know."
            value={draft.age}
            errors={errors}
            onChange={(age) => set('age', age)}
          />

          {childSearch && (
            <Notice tone="guarded" title="Searches for children go to the safeguarding team">
              <p>
                A safeguarding lead will speak with the person asking to confirm the relationship before anything is shared.
                Saying they’re the parent isn’t enough on its own.
              </p>
            </Notice>
          )}

          <TextArea
            id="search-lastKnown"
            optional
            label="Last known place or circumstances"
            hint="General area only, like “Bayview, near the harbor” or “on the evacuation bus from Pine Street.”"
            value={draft.lastKnown}
            onChange={(event) => set('lastKnown', event.target.value)}
          />
          <TextArea
            id="search-details"
            optional
            rows={2}
            label="Anything that would help recognize them"
            hint="Clothing, a walker, a pet. Avoid medical, immigration, or legal details."
            value={draft.details}
            onChange={(event) => set('details', event.target.value)}
          />
        </section>

        <section aria-labelledby="search-requester-title" className="mt-12 space-y-8 border-t border-line pt-10">
          <h2 id="search-requester-title" className="text-xl font-semibold">
            Who is asking?
          </h2>
          <TextInput
            id={fieldId('requesterName')}
            label="Their name"
            autoComplete="off"
            value={draft.requesterName}
            error={errors.requesterName}
            onChange={(event) => set('requesterName', event.target.value)}
          />
          <Select
            id={fieldId('requesterShelterId')}
            disabled={session.role === 'volunteer'}
            hint={session.role === 'volunteer' ? 'Your assigned shelter. To try another location, use Demo shelter at the top before entering details. Coordinators can choose any shelter here.' : undefined}
            label="Where they’re staying"
            value={draft.requesterShelterId}
            error={errors.requesterShelterId}
            onChange={(event) => set('requesterShelterId', event.target.value)}
          >
            {shelters.map((shelter) => (
              <option key={shelter.id} value={shelter.id}>
                {shelter.name}
              </option>
            ))}
          </Select>
          <TextInput
            id={fieldId('requesterRegistrationRef')}
            optional
            label="Their registration reference"
            hint="If they’ve been registered, like R-2210."
            width="medium"
            autoComplete="off"
            autoCapitalize="characters"
            value={draft.requesterRegistrationRef}
            error={errors.requesterRegistrationRef}
            onChange={(event) => set('requesterRegistrationRef', event.target.value)}
          />
          <ContactInput
            idPrefix="search"
            legend="How should a coordinator reach them?"
            channel={draft.contactChannel}
            detail={draft.contactDetail}
            error={errors.contactDetail}
            onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          />
        </section>

        <div className="mt-10 space-y-5">
          {save.error && save.error.code !== 'validation' && (
            <RequestErrorNotice error={save.error} onRetry={() => submit()} retrying={save.pending} inputKept />
          )}
          <Button type="submit" variant="primary" size="lg" loading={save.pending}>
            {save.pending ? 'Saving search request' : 'Save search request'}
          </Button>
        </div>
      </form>
    </>
  );
}
