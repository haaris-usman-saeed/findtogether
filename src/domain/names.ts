/**
 * Name comparison for imperfect records: nicknames, spelling differences,
 * missing accents, and initials. Deliberately simple and explainable.
 */

const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'sr', 'jr', 'senor', 'senora']);

export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nameTokens(value: string | undefined): string[] {
  if (!value) return [];
  return normalizeName(value)
    .split(' ')
    .filter((token) => token.length > 0 && !TITLES.has(token));
}

/** Small illustrative table. A production system would use a maintained, multilingual source. */
const NICKNAME_GROUPS: string[][] = [
  ['marisol', 'mari', 'sol', 'marisa'],
  ['jose', 'joe', 'pepe', 'chepe'],
  ['joseph', 'joe', 'joey'],
  ['robert', 'rob', 'robbie', 'bob', 'bobby'],
  ['william', 'will', 'bill', 'billy', 'willie'],
  ['elizabeth', 'liz', 'lizzie', 'beth', 'betty', 'eliza'],
  ['margaret', 'maggie', 'meg', 'peggy'],
  ['daniel', 'dan', 'danny'],
  ['katherine', 'kate', 'katie', 'kathy', 'kat'],
  ['michael', 'mike', 'mikey'],
  ['anthony', 'tony'],
  ['francisco', 'paco', 'pancho', 'frank'],
  ['guadalupe', 'lupe', 'lupita'],
  ['alejandro', 'alex', 'alejo'],
  ['richard', 'rick', 'ricky', 'rich'],
  ['thomas', 'tom', 'tommy'],
  ['christopher', 'chris'],
  ['patricia', 'pat', 'patty', 'trish'],
];

const GROUPS_BY_NAME = new Map<string, Set<number>>();
NICKNAME_GROUPS.forEach((group, index) => {
  for (const name of group) {
    const set = GROUPS_BY_NAME.get(name) ?? new Set<number>();
    set.add(index);
    GROUPS_BY_NAME.set(name, set);
  }
});

export function areNicknames(a: string, b: string): boolean {
  const groupsA = GROUPS_BY_NAME.get(a);
  const groupsB = GROUPS_BY_NAME.get(b);
  if (!groupsA || !groupsB) return false;
  for (const group of groupsA) if (groupsB.has(group)) return true;
  return false;
}

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - window);
    const end = Math.min(b.length - 1, i + window);
    for (let j = start; j <= end; j++) {
      if (!bMatched[j] && a[i] === b[j]) {
        aMatched[i] = true;
        bMatched[j] = true;
        matches++;
        break;
      }
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

export type NameRelation = 'same' | 'nickname' | 'spelling' | 'initial' | 'none';

export const RELATION_RANK: Record<NameRelation, number> = { same: 4, nickname: 3, spelling: 2, initial: 1, none: 0 };

export function relateTokens(a: string, b: string): NameRelation {
  if (a === b) return 'same';
  if (a.length === 1 || b.length === 1) return a[0] === b[0] ? 'initial' : 'none';
  if (areNicknames(a, b)) return 'nickname';
  if (a.length >= 3 && b.length >= 3 && jaroWinkler(a, b) >= 0.88) return 'spelling';
  return 'none';
}

export function capitalize(token: string): string {
  return token.length === 0 ? token : token[0].toUpperCase() + token.slice(1);
}
