import { describe, expect, it } from 'vitest';
import { createDatabase } from '../services/mock/seed';
import { findCandidates, findPossibleDuplicates } from './matching';
import type { Registration, SearchRequest } from './types';

const db = createDatabase(Date.parse('2026-10-20T08:00:00Z'));
const request = (reference: string): SearchRequest => {
  const found = db.requests.find((r) => r.reference === reference);
  if (!found) throw new Error(`missing ${reference}`);
  return found;
};
const registration = (reference: string): Registration => {
  const found = db.registrations.find((r) => r.reference === reference);
  if (!found) throw new Error(`missing ${reference}`);
  return found;
};

describe('findCandidates', () => {
  it('finds Marisol Reyes from a search for "Mari Ortiz" and explains why', () => {
    const results = findCandidates(request('S-1041'), db.registrations);
    expect(results.map((r) => r.registration.reference)).toEqual(['R-2210']);
    const texts = results[0].evidence.map((e) => e.text);
    expect(texts).toContain('Mari is often short for Marisol');
    expect(results[0].evidence.some((e) => e.kind === 'differs')).toBe(true);
  });

  it('returns several uncertain candidates for an ambiguous search', () => {
    const refs = findCandidates(request('S-1042'), db.registrations).map((r) => r.registration.reference);
    expect(refs).toHaveLength(3);
    expect(refs).toContain('R-3307');
    expect(refs).toContain('R-3412');
    expect(refs).toContain('R-3519');
  });

  it('never sends a score to the interface, only words', () => {
    const [first] = findCandidates(request('S-1041'), db.registrations);
    for (const item of first.evidence) {
      expect(Object.keys(item).sort()).toEqual(['kind', 'text']);
    }
  });

  it('flags records that may be one person registered twice', () => {
    const regs = findCandidates(request('S-1042'), db.registrations).map((m) => m.registration);
    const duplicates = findPossibleDuplicates(regs);
    expect(duplicates.get('R-3307')).toEqual(['R-3519']);
    expect(duplicates.get('R-3412')).toBeUndefined();
  });

  it('never includes protected, declined, unasked, or child records', () => {
    const target = registration('R-2210');
    const variants: Registration[] = [
      { ...target, safetyConcern: true },
      { ...target, consent: { ...target.consent, matching: 'declined' } },
      { ...target, consent: { ...target.consent, matching: 'unknown' } },
      { ...target, age: { kind: 'exact', years: 15 } },
    ];
    for (const variant of variants) {
      expect(findCandidates(request('S-1041'), [variant])).toHaveLength(0);
    }
  });

  it('excludes the requester’s own registration', () => {
    const own: SearchRequest = {
      ...request('S-1041'),
      sought: { ...request('S-1041').sought, name: 'Danny Ortiz' },
    };
    const refs = findCandidates(own, db.registrations).map((r) => r.registration.reference);
    expect(refs).not.toContain('R-1987');
  });

  it('routes searches for children to safeguarding with no ordinary candidates', () => {
    expect(findCandidates(request('S-1043'), db.registrations)).toHaveLength(0);
  });

  it('returns nothing rather than inventing a match', () => {
    expect(findCandidates(request('S-1099'), db.registrations)).toHaveLength(0);
  });
});
