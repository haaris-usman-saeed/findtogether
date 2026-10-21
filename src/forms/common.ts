import { isMinorAge } from '../domain/age';
import type { AgeBand, AgeInfo, ContactChannel, ContactPreference } from '../domain/types';

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

export interface AgeDraft {
  mode: '' | 'exact' | 'approximate' | 'unknown';
  years: string;
  band: AgeBand | '';
}

export const emptyAge = (): AgeDraft => ({ mode: '', years: '', band: '' });

export function ageFromDraft(draft: AgeDraft): AgeInfo {
  if (draft.mode === 'exact' && /^\d{1,3}$/.test(draft.years.trim())) return { kind: 'exact', years: Number(draft.years.trim()) };
  if (draft.mode === 'approximate' && draft.band) return { kind: 'approximate', band: draft.band };
  return { kind: 'unknown' };
}

export function isMinorDraft(draft: AgeDraft): boolean {
  return isMinorAge(ageFromDraft(draft));
}

export function validateAge(draft: AgeDraft, required: boolean): FieldErrors<'age' | 'ageYears' | 'ageBand'> {
  if (draft.mode === '') return required ? { age: 'Choose exact, approximate, or not known' } : {};
  if (draft.mode === 'exact') {
    const value = draft.years.trim();
    if (!/^\d{1,3}$/.test(value) || Number(value) > 120) return { ageYears: 'Enter an age in years, from 0 to 120' };
  }
  if (draft.mode === 'approximate' && !draft.band) return { ageBand: 'Choose an age range' };
  return {};
}

export interface ContactDraft {
  contactChannel: ContactChannel;
  contactDetail: string;
}

export function validateContact(draft: ContactDraft): FieldErrors<'contactDetail'> {
  const detail = draft.contactDetail.trim();
  switch (draft.contactChannel) {
    case 'shelter_desk':
      return {};
    case 'phone':
      return detail.replace(/\D/g, '').length >= 7 ? {} : { contactDetail: 'Enter a phone number, or choose the shelter desk' };
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(detail) ? {} : { contactDetail: 'Enter an email address like name@example.com' };
    case 'caseworker':
      return detail ? {} : { contactDetail: 'Enter the caseworker\u2019s name or agency' };
  }
}

export function contactFromDraft(draft: ContactDraft): ContactPreference {
  return draft.contactChannel === 'shelter_desk'
    ? { channel: 'shelter_desk' }
    : { channel: draft.contactChannel, detail: draft.contactDetail.trim() };
}

/** "Mari, Marisol; Sol" becomes ["Mari", "Marisol", "Sol"]. */
export function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const optional = (value: string): string | undefined => value.trim() || undefined;
