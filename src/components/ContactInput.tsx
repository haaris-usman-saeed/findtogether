import type { ContactChannel } from '../domain/types';
import { ChoiceGroup } from './ui/Choice';
import { TextInput } from './ui/Field';

const DETAIL_LABEL: Record<Exclude<ContactChannel, 'shelter_desk'>, string> = {
  phone: 'Phone number',
  email: 'Email address',
  caseworker: 'Caseworker name or agency',
};

export function ContactInput({
  idPrefix,
  legend,
  hint,
  channel,
  detail,
  error,
  onChange,
}: {
  idPrefix: string;
  legend: string;
  hint?: string;
  channel: ContactChannel;
  detail: string;
  error?: string;
  onChange: (patch: { contactChannel?: ContactChannel; contactDetail?: string }) => void;
}) {
  return (
    <div className="space-y-5">
      <ChoiceGroup
        id={`${idPrefix}-contactChannel`}
        legend={legend}
        hint={hint}
        compact
        value={channel}
        onChange={(value) => onChange({ contactChannel: value })}
        options={[
          { value: 'shelter_desk', label: 'Through the shelter desk', description: 'No phone needed. A coordinator leaves word at the desk.' },
          { value: 'phone', label: 'Phone' },
          { value: 'email', label: 'Email' },
          { value: 'caseworker', label: 'Through a caseworker' },
        ]}
      />
      {channel !== 'shelter_desk' && (
        <TextInput
          id={`${idPrefix}-contactDetail`}
          label={DETAIL_LABEL[channel]}
          width="medium"
          inputMode={channel === 'phone' ? 'tel' : channel === 'email' ? 'email' : undefined}
          autoComplete="off"
          value={detail}
          error={error}
          onChange={(event) => onChange({ contactDetail: event.target.value })}
        />
      )}
    </div>
  );
}
