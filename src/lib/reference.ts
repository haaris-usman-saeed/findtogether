/** References are short so they can be read aloud and written on a wristband: R-2210, S-1041. */

export function normalizeReference(value: string): string {
  const compact = value.trim().toUpperCase().replace(/\s+/g, '');
  const match = /^([RS])-?(\d{4})$/.exec(compact);
  return match ? `${match[1]}-${match[2]}` : compact;
}

export function isReference(value: string, kind: 'R' | 'S'): boolean {
  return new RegExp(`^${kind}-\\d{4}$`).test(normalizeReference(value));
}
