/**
 * Possible-match search. Produces plain-language evidence instead of a score.
 *
 * A numeric "strength" exists only to order candidates and drop very weak
 * ones. It is never sent to the interface: a number would read as confidence,
 * and these records cannot support that.
 */
import { ageInSentence, ageRange, rangeGap } from './age';
import { RELATION_RANK, capitalize, nameTokens, normalizeName, relateTokens, type NameRelation } from './names';
import { isDiscoverable, requiresSafeguarding } from './privacy';
import type { Evidence, EvidenceKind, Registration, SearchRequest } from './types';

export interface MatchResult {
  registration: Registration;
  evidence: Evidence[];
  strength: number;
}

const MIN_STRENGTH = 2.5;

const STOPWORDS = new Set([
  'the', 'and', 'near', 'by', 'at', 'of', 'in', 'on', 'to', 'from', 'with', 'was', 'were', 'last', 'seen',
  'his', 'her', 'their', 'my', 'our', 'street', 'road', 'avenue', 'ave', 'lane', 'drive', 'area', 'district',
  'side', 'apartments', 'uses', 'has', 'wears', 'had',
]);

function keywords(text: string | undefined): string[] {
  if (!text) return [];
  return [...new Set(normalizeName(text).split(' '))].filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

interface Pair {
  relation: NameRelation;
  a: string;
  b: string;
}

function bestPair(as: string[], bs: string[], allowInitial: boolean): Pair {
  let best: Pair = { relation: 'none', a: '', b: '' };
  for (const a of as) {
    for (const b of bs) {
      const relation = relateTokens(a, b);
      if (relation === 'initial' && !allowInitial) continue;
      if (RELATION_RANK[relation] > RELATION_RANK[best.relation]) best = { relation, a, b };
    }
  }
  return best;
}

function splitNames(names: (string | undefined)[]): { given: string[]; family: string[] } {
  const given = new Set<string>();
  const family = new Set<string>();
  for (const name of names) {
    const tokens = nameTokens(name);
    if (tokens.length === 0) continue;
    given.add(tokens[0]);
    tokens.slice(1).forEach((t) => family.add(t));
  }
  return { given: [...given], family: [...family] };
}

function registrationNames(r: Registration): (string | undefined)[] {
  return [r.names.preferred, r.names.full, ...r.names.others];
}

export function evaluateCandidate(request: SearchRequest, registration: Registration): MatchResult | null {
  const { sought, requester } = request;
  const s = splitNames([sought.name, ...sought.otherNames]);
  const r = splitNames(registrationNames(registration));
  if (s.given.length === 0 || r.given.length === 0) return null;

  const evidence: Evidence[] = [];
  const add = (kind: EvidenceKind, text: string) => evidence.push({ kind, text });
  let strength = 0;

  // First names
  const given = bestPair(s.given, r.given, true);
  switch (given.relation) {
    case 'none':
      return null;
    case 'same':
      add('agrees', `Same first name: ${capitalize(given.b)}`);
      strength += 3;
      break;
    case 'nickname': {
      const [short, long] = given.a.length <= given.b.length ? [given.a, given.b] : [given.b, given.a];
      add('agrees', `${capitalize(short)} is often short for ${capitalize(long)}`);
      strength += 2.5;
      break;
    }
    case 'spelling':
      add('differs', `First name spelled differently: ${capitalize(given.a)} and ${capitalize(given.b)}`);
      strength += 2;
      break;
    case 'initial':
      add(
        'missing',
        given.b.length === 1
          ? `First name recorded only as an initial: ${given.b.toUpperCase()}.`
          : `The person searching gave only an initial: ${given.a.toUpperCase()}.`,
      );
      strength += 1;
      break;
  }

  // Family names
  if (s.family.length > 0) {
    if (r.family.length === 0) {
      add('missing', 'No family name on record');
    } else {
      const family = bestPair(s.family, r.family, false);
      const preferredFamily = nameTokens(registration.names.preferred).slice(1);
      if (family.relation === 'same') {
        strength += 2;
        if (preferredFamily.length === 0 || preferredFamily.includes(family.b)) {
          add('agrees', `Same family name: ${capitalize(family.b)}`);
        } else {
          add('agrees', `${capitalize(family.b)} appears in the full name on record`);
          add('differs', `Registered under the name ${registration.names.preferred}`);
        }
      } else if (family.relation === 'spelling' || family.relation === 'nickname') {
        add('differs', `Family name spelled differently: ${capitalize(family.a)} and ${capitalize(family.b)}`);
        strength += 1;
      } else {
        if (given.relation === 'initial') return null;
        add('differs', `Different family name on record: ${r.family.map(capitalize).join(' ')}`);
        strength -= 1;
      }
    }
  }

  // Age
  const soughtRange = ageRange(sought.age);
  const recordRange = ageRange(registration.age);
  if (soughtRange) {
    if (!recordRange) {
      add('missing', 'No age on record');
    } else {
      const gap = rangeGap(soughtRange, recordRange);
      const detail = `recorded as ${ageInSentence(registration.age)}, expected ${ageInSentence(sought.age)}`;
      if (gap === 0) {
        add('agrees', `Age fits: ${detail}`);
        strength += 1;
      } else if (gap <= 5) {
        add('differs', `Ages are a few years apart: ${detail}`);
        strength -= 1;
      } else if (gap <= 10) {
        add('differs', `Ages are far apart: ${detail}`);
        strength -= 2;
      } else {
        return null;
      }
    }
  }

  // Last known area
  const soughtArea = keywords(sought.lastKnown);
  if (soughtArea.length > 0) {
    const recordArea = keywords(registration.lastKnownArea);
    if (recordArea.length === 0) {
      add('missing', 'No last known area on record');
    } else if (soughtArea.some((t) => recordArea.includes(t))) {
      add('agrees', `Last known area overlaps: on record as \u201C${registration.lastKnownArea}\u201D`);
      strength += 1;
    } else {
      add('differs', `Different last known area: on record as \u201C${registration.lastKnownArea}\u201D`);
      strength -= 0.5;
    }
  }

  // Descriptions
  const recordDetails = keywords(registration.recognizableDetails);
  const shared = keywords(sought.details).filter((t) => recordDetails.includes(t));
  if (shared.length > 0) {
    add('agrees', `Both descriptions mention ${shared.map((t) => `\u201C${t}\u201D`).join(', ')}`);
    strength += Math.min(2, shared.length);
  }

  // The record's own family notes name the person searching
  const requesterGiven = nameTokens(requester.name)[0];
  if (requesterGiven) {
    const hit = nameTokens(registration.familyNotes).find((t) => {
      const relation = relateTokens(requesterGiven, t);
      return relation === 'same' || relation === 'nickname';
    });
    if (hit) {
      add('agrees', `Family notes on record mention ${capitalize(hit)}, which fits the person searching (${requester.name})`);
      strength += 2;
    }
  }

  if (strength < MIN_STRENGTH) return null;
  return { registration, evidence, strength };
}

/** Candidates for a request. Never includes records that are not discoverable. */
export function findCandidates(request: SearchRequest, registrations: Registration[]): MatchResult[] {
  if (requiresSafeguarding(request)) return [];
  return registrations
    .filter(isDiscoverable)
    .filter((r) => r.reference !== request.requester.registrationReference)
    .map((r) => evaluateCandidate(request, r))
    .filter((m): m is MatchResult => m !== null)
    .sort((a, b) => b.strength - a.strength || a.registration.createdAt.localeCompare(b.registration.createdAt));
}

function likelySamePerson(a: Registration, b: Registration): boolean {
  const an = splitNames(registrationNames(a));
  const bn = splitNames(registrationNames(b));
  const given = bestPair(an.given, bn.given, true).relation;
  if (given !== 'same' && given !== 'nickname' && given !== 'initial') return false;
  if (bestPair(an.family, bn.family, false).relation !== 'same') return false;
  const ar = ageRange(a.age);
  const br = ageRange(b.age);
  return !ar || !br || rangeGap(ar, br) === 0;
}

/** Pairs of records that may describe one person registered twice. Keyed by reference. */
export function findPossibleDuplicates(registrations: Registration[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const link = (from: string, to: string) => result.set(from, [...(result.get(from) ?? []), to]);
  for (let i = 0; i < registrations.length; i++) {
    for (let j = i + 1; j < registrations.length; j++) {
      const a = registrations[i];
      const b = registrations[j];
      if (likelySamePerson(a, b)) {
        link(a.reference, b.reference);
        link(b.reference, a.reference);
      }
    }
  }
  return result;
}
