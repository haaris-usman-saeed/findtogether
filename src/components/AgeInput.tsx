import { AGE_BAND_LABEL } from '../domain/age';
import { AGE_BANDS } from '../domain/types';
import type { AgeDraft, FieldErrors } from '../forms/common';
import { ChoiceGroup } from './ui/Choice';
import { TextInput } from './ui/Field';

/** Exact, approximate, or not known. Approximate uses ranges, because "about 70" is what people actually know. */
export function AgeInput({
  idPrefix,
  legend,
  hint,
  value,
  onChange,
  errors,
}: {
  idPrefix: string;
  legend: string;
  hint?: string;
  value: AgeDraft;
  onChange: (value: AgeDraft) => void;
  errors: FieldErrors<'age' | 'ageYears' | 'ageBand'>;
}) {
  const set = (patch: Partial<AgeDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-5">
      <ChoiceGroup
        id={`${idPrefix}-age`}
        legend={legend}
        hint={hint}
        error={errors.age}
        layout="inline"
        value={value.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'exact', label: 'Exact age' },
          { value: 'approximate', label: 'Approximate' },
          { value: 'unknown', label: 'Not known' },
        ]}
      />
      {value.mode === 'exact' && (
        <TextInput
          id={`${idPrefix}-ageYears`}
          label="Age in years"
          inputMode="numeric"
          autoComplete="off"
          width="short"
          value={value.years}
          error={errors.ageYears}
          onChange={(event) => set({ years: event.target.value })}
        />
      )}
      {value.mode === 'approximate' && (
        <ChoiceGroup
          compact
          id={`${idPrefix}-ageBand`}
          legend="Age range"
          layout="inline"
          error={errors.ageBand}
          value={value.band}
          onChange={(band) => set({ band })}
          options={AGE_BANDS.map((band) => ({ value: band, label: AGE_BAND_LABEL[band] }))}
        />
      )}
    </div>
  );
}
