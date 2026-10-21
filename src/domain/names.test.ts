import { describe, expect, it } from 'vitest';
import { jaroWinkler, nameTokens, relateTokens } from './names';

describe('name comparison', () => {
  it('ignores accents, punctuation, and titles', () => {
    expect(nameTokens('Mr. José Martínez')).toEqual(['jose', 'martinez']);
    expect(nameTokens('J. Martinez')).toEqual(['j', 'martinez']);
  });

  it('recognizes nicknames, spelling differences, and initials', () => {
    expect(relateTokens('mari', 'marisol')).toBe('nickname');
    expect(relateTokens('bobby', 'robert')).toBe('nickname');
    expect(relateTokens('martinez', 'martin')).toBe('spelling');
    expect(relateTokens('j', 'jose')).toBe('initial');
    expect(relateTokens('daniel', 'marisol')).toBe('none');
  });

  it('keeps unrelated family names apart', () => {
    expect(jaroWinkler('ortiz', 'ortega')).toBeLessThan(0.88);
  });
});
