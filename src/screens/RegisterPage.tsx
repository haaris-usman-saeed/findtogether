import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { AgeInput } from '../components/AgeInput';
import { ContactInput } from '../components/ContactInput';
import { Button } from '../components/ui/Button';
import { Checkbox, ChoiceGroup } from '../components/ui/Choice';
import { Disclosure } from '../components/ui/Disclosure';
import { ErrorSummary } from '../components/ui/ErrorSummary';
import { RequestErrorNotice } from '../components/ui/Feedback';
import { Select, TextArea, TextInput } from '../components/ui/Field';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { RegistrationConfirmation } from '../features/registration/RegistrationConfirmation';
import { CONTACT_CHANNEL_LABEL } from '../domain/labels';
import { isMinorDraft, splitList, type FieldErrors } from '../forms/common';
import {
  REGISTRATION_FIELD_ORDER,
  emptyRegistrationDraft,
  toRegistrationInput,
  validateRegistration,
  type RegistrationDraft,
  type RegistrationField,
} from '../forms/registrationForm';
import { emptySearchDraft, type SearchDraft } from '../forms/searchForm';
import { api } from '../services';
import type { RegistrationReceipt } from '../services/contracts';
import { useMutation } from '../state/async';
import { useDraft, useDraftStore } from '../state/drafts';
import { useSession } from '../state/session';
import { useShelters } from '../state/shelters';

const fieldId = (field: RegistrationField) => `reg-${field}`;

export function RegisterPage() {
  const { session } = useSession();
  const shelters = useShelters();
  const drafts = useDraftStore();
  const navigate = useNavigate();
  const { value: draft, setValue: setDraft, reset, discard } = useDraft('registration', () =>
    emptyRegistrationDraft(session.shelterId),
  );
  const [attempted, setAttempted] = useState(false);
  const [summaryKey, setSummaryKey] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [done, setDone] = useState<{ receipt: RegistrationReceipt; submitted: RegistrationDraft } | null>(null);
  const save = useMutation((d: RegistrationDraft) => api.createRegistration(toRegistrationInput(d), session));

  const serverErrors = (save.error?.code === 'validation' ? save.error.fieldErrors : undefined) as FieldErrors<RegistrationField> | undefined;
  const errors: FieldErrors<RegistrationField> = { ...(attempted ? validateRegistration(draft) : {}), ...serverErrors };
  const hasErrors = Object.keys(errors).length > 0;
  const minor = isMinorDraft(draft.age);

  const set = <K extends keyof RegistrationDraft>(key: K, value: RegistrationDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setAttempted(true);
    if (Object.keys(validateRegistration(draft)).length > 0) {
      setSummaryKey((k) => k + 1);
      return;
    }
    const receipt = await save.run(draft);
    if (receipt) {
      discard();
      setDone({ receipt, submitted: draft });
    }
  };

  const startOver = () => {
    reset();
    setAttempted(false);
    setConfirmClear(false);
    save.clearError();
  };

  if (done) {
    return (
      <RegistrationConfirmation
        receipt={done.receipt}
        submitted={done.submitted}
        onRegisterAnother={() => {
          startOver();
          setDone(null);
        }}
        onStartSearch={() => {
          const current = drafts.get<SearchDraft>('search') ?? emptySearchDraft(session.shelterId);
          drafts.replace('search', {
            ...current,
            requesterName: done.submitted.nameWithheld ? current.requesterName : done.submitted.preferredName.trim(),
            requesterShelterId: done.submitted.shelterId,
            requesterRegistrationRef: done.receipt.reference,
          });
          navigate('/search');
        }}
      />
    );
  }

  const otherNameCount = splitList(draft.otherNames).length + (draft.fullName.trim() ? 1 : 0);

  return (
    <>
      <PageHeader
        documentTitle="Register someone"
        back={{ to: '/', label: 'Home' }}
        title="Register someone"
        lead="A name and a guess at their age are enough. Everything else is optional."
      />

      <form noValidate onSubmit={submit} className="max-w-form">
        {attempted && hasErrors && summaryKey > 0 && (
          <ErrorSummary key={summaryKey} errors={errors} order={REGISTRATION_FIELD_ORDER} idFor={fieldId} />
        )}

        <section aria-labelledby="reg-who-title" className="space-y-8">
          <h2 id="reg-who-title" className="text-xl font-semibold">
            Who they are
          </h2>

          <div className="space-y-1">
            {!draft.nameWithheld && (
              <TextInput
                id={fieldId('preferredName')}
                label="Name they go by"
                hint="A nickname or alias is fine. Spell it the way they say it."
                autoComplete="off"
                autoCapitalize="words"
                spellCheck={false}
                value={draft.preferredName}
                error={errors.preferredName}
                onChange={(event) => set('preferredName', event.target.value)}
              />
            )}
            <Checkbox
              id="reg-nameWithheld"
              label="They can’t or won’t give a name"
              checked={draft.nameWithheld}
              onChange={(checked) => set('nameWithheld', checked)}
            />
          </div>

          {draft.nameWithheld && (
            <TextArea
              id={fieldId('recognizableDetails')}
              label="Describe them"
              hint="What staff need to find this record again, like clothing or who they arrived with."
              value={draft.recognizableDetails}
              error={errors.recognizableDetails}
              onChange={(event) => set('recognizableDetails', event.target.value)}
            />
          )}

          {!draft.nameWithheld && (
            <div className="-mt-2 border-b border-line">
              <Disclosure id="reg-names" label="Add full name or other names" summary={otherNameCount ? `${otherNameCount} added` : undefined}>
                <TextInput
                  id="reg-fullName"
                  optional
                  label="Full name"
                  hint="Only if they want to share it."
                  autoComplete="off"
                  value={draft.fullName}
                  onChange={(event) => set('fullName', event.target.value)}
                />
                <TextInput
                  id="reg-otherNames"
                  optional
                  label="Other names or spellings family might use"
                  hint="Separate with commas, like: Mari, Marisol"
                  autoComplete="off"
                  value={draft.otherNames}
                  onChange={(event) => set('otherNames', event.target.value)}
                />
              </Disclosure>
            </div>
          )}

          <AgeInput idPrefix="reg" legend="Age" hint="A guess is fine." value={draft.age} errors={errors} onChange={(age) => set('age', age)} />

          {minor && (
            <>
              <Notice tone="guarded" title="This is a child">
                <p>
                  Children’s records go to the safeguarding lead and never appear in ordinary family searches. Contact is
                  arranged only after the safeguarding team confirms who has parental responsibility.
                </p>
              </Notice>
              <TextInput
                id="reg-accompanyingAdult"
                optional
                label="Adult with them"
                hint="Name and how they say they’re related. Recorded as stated, not verified."
                autoComplete="off"
                value={draft.accompanyingAdult}
                onChange={(event) => set('accompanyingAdult', event.target.value)}
              />
            </>
          )}

          <Select
            id={fieldId('shelterId')}
            disabled={session.role === 'volunteer'}
            hint={session.role === 'volunteer' ? 'Your assigned shelter. To try another location, use Demo shelter at the top before entering details. Coordinators can choose any shelter here.' : undefined}
            label="Shelter they’re staying at"
            value={draft.shelterId}
            error={errors.shelterId}
            onChange={(event) => set('shelterId', event.target.value)}
          >
            {shelters.map((shelter) => (
              <option key={shelter.id} value={shelter.id}>
                {shelter.name}
              </option>
            ))}
          </Select>
        </section>

        <section aria-labelledby="reg-consent-title" className="mt-12 space-y-8 border-t border-line pt-10">
          <div>
            <h2 id="reg-consent-title" className="text-xl font-semibold">
              Family search and contact
            </h2>
            <p className="mt-1 max-w-prose text-ink-muted">Ask them directly, away from other people. Record what they say.</p>
          </div>

          <ChoiceGroup
            id={fieldId('safety')}
            legend="Is there anyone they don’t want to be found by?"
            error={errors.safety}
            value={draft.safety}
            onChange={(value) => set('safety', value)}
            options={[
              { value: 'none', label: 'No' },
              { value: 'concern', label: 'Yes, or they’d rather not say', description: 'Their record will be hidden from every search.' },
            ]}
          />

          {draft.safety === 'concern' && (
            <Notice tone="guarded" title="Their record will be hidden">
              <p>
                It won’t appear in any search, including the matches coordinators review. Anyone asking about them gets the
                same answer as if no record exists.
              </p>
            </Notice>
          )}

          {draft.safety === 'none' && !minor && (
            <>
              <ChoiceGroup
                id={fieldId('matching')}
                legend="Can we check whether family is looking for them?"
                error={errors.matching}
                value={draft.matching}
                onChange={(value) => set('matching', value)}
                options={[
                  { value: 'granted', label: 'Yes' },
                  { value: 'declined', label: 'No' },
                  { value: 'unknown', label: 'Couldn’t ask yet', description: 'Their record won’t be searched until someone asks.' },
                ]}
              />
              <ChoiceGroup
                id={fieldId('contact')}
                legend="If family is found, may a coordinator arrange contact?"
                hint="A coordinator always checks with them again before any contact."
                error={errors.contact}
                value={draft.contact}
                onChange={(value) => set('contact', value)}
                options={[
                  { value: 'granted', label: 'Yes' },
                  { value: 'declined', label: 'No' },
                  { value: 'unknown', label: 'They’ll decide when asked' },
                ]}
              />
            </>
          )}

          {draft.safety === 'none' && minor && (
            <p className="max-w-prose text-ink-muted">The safeguarding team asks about family search and contact for children.</p>
          )}
        </section>

        <section aria-labelledby="reg-optional-title" className="mt-12 border-t border-line pt-10">
          <h2 id="reg-optional-title" className="text-xl font-semibold">
            Optional details
          </h2>
          <p className="mt-1 max-w-prose text-ink-muted">Add these now or skip them. Don’t record medical, immigration, or legal details.</p>
          <div className="mt-4 border-b border-line">
            <Disclosure
              id="reg-recognize"
              label="Details family might recognize"
              summary={draft.lastKnownArea.trim() || (!draft.nameWithheld && draft.recognizableDetails.trim()) ? 'Added' : undefined}
            >
              <TextInput
                id="reg-lastKnownArea"
                optional
                label="Where they lived or were last seen before the evacuation"
                hint="General area only, like a neighborhood or street."
                autoComplete="off"
                value={draft.lastKnownArea}
                onChange={(event) => set('lastKnownArea', event.target.value)}
              />
              {!draft.nameWithheld && (
                <TextArea
                  id="reg-recognizableDetails"
                  optional
                  label="Description"
                  hint="Clothing, a pet, who they arrived with."
                  value={draft.recognizableDetails}
                  onChange={(event) => set('recognizableDetails', event.target.value)}
                />
              )}
            </Disclosure>
            <Disclosure id="reg-family" label="Family information" summary={draft.familyNotes.trim() ? 'Added' : undefined}>
              <TextArea
                id="reg-familyNotes"
                optional
                label="Family they’re with or looking for"
                hint="Names and relationships, like: looking for her brother Danny."
                value={draft.familyNotes}
                onChange={(event) => set('familyNotes', event.target.value)}
              />
            </Disclosure>
            <Disclosure
              id="reg-reach"
              label="How a coordinator can reach them"
              summary={CONTACT_CHANNEL_LABEL[draft.contactChannel]}
              forceOpen={Boolean(errors.contactDetail)}
            >
              <ContactInput
                idPrefix="reg"
                legend="Contact preference"
                channel={draft.contactChannel}
                detail={draft.contactDetail}
                error={errors.contactDetail}
                onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
              />
            </Disclosure>
          </div>
        </section>

        <div className="mt-10 space-y-5">
          {save.error && save.error.code !== 'validation' && (
            <RequestErrorNotice error={save.error} onRetry={() => submit()} retrying={save.pending} inputKept />
          )}
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" variant="primary" size="lg" loading={save.pending}>
              {save.pending ? 'Saving registration' : 'Save registration'}
            </Button>
            {confirmClear ? (
              <span className="flex flex-wrap items-center gap-3" role="group" aria-label="Clear the form?">
                <span className="text-ink-muted">Clear everything?</span>
                <Button variant="danger" onClick={startOver}>
                  Yes, clear
                </Button>
                <Button variant="quiet" onClick={() => setConfirmClear(false)}>
                  Keep editing
                </Button>
              </span>
            ) : (
              <Button variant="quiet" onClick={() => setConfirmClear(true)} disabled={save.pending}>
                Clear form
              </Button>
            )}
          </div>
        </div>
      </form>
    </>
  );
}
