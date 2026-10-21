import type { AgeBand, AgeInfo } from './types';

export const AGE_BAND_RANGE: Record<AgeBand, [number, number]> = {
  under5: [0, 4],
  '5to12': [5, 12],
  '13to17': [13, 17],
  '18to29': [18, 29],
  '30to44': [30, 44],
  '45to64': [45, 64],
  '65to79': [65, 79],
  '80plus': [80, 110],
};

export const AGE_BAND_LABEL: Record<AgeBand, string> = {
  under5: 'Under 5',
  '5to12': '5 to 12',
  '13to17': '13 to 17',
  '18to29': '18 to 29',
  '30to44': '30 to 44',
  '45to64': '45 to 64',
  '65to79': '65 to 79',
  '80plus': '80 or older',
};

export function ageRange(age: AgeInfo): [number, number] | null {
  if (age.kind === 'exact') return [age.years, age.years];
  if (age.kind === 'approximate') return AGE_BAND_RANGE[age.band];
  return null;
}

/** Years between two ranges; 0 when they overlap. */
export function rangeGap(a: [number, number], b: [number, number]): number {
  return Math.max(0, Math.max(a[0], b[0]) - Math.min(a[1], b[1]));
}

/** Sentence-case label for display: "43", "About 30 to 44", "Not known". */
export function ageLabel(age: AgeInfo): string {
  if (age.kind === 'exact') return String(age.years);
  if (age.kind === 'approximate') return `About ${AGE_BAND_LABEL[age.band].toLowerCase()}`;
  return 'Not known';
}

/** Lowercase form for use inside sentences: "43", "about 30 to 44". */
export function ageInSentence(age: AgeInfo): string {
  if (age.kind === 'exact') return String(age.years);
  if (age.kind === 'approximate') return `about ${AGE_BAND_LABEL[age.band].toLowerCase()}`;
  return 'not known';
}

/** True only when the whole plausible range is under 18. Unknown age is not assumed adult or child. */
export function isMinorAge(age: AgeInfo): boolean {
  const range = ageRange(age);
  return range !== null && range[1] < 18;
}
