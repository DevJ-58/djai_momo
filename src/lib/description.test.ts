import { describe, expect, it } from 'vitest';
import { formatDescriptionChange, hasDescription, parseDescription } from './description';
import { registrationErrorMessage } from './registration-errors';

describe('parseDescription', () => {
  it('returns null for empty values and whitespace', () => {
    expect(parseDescription(null)).toBeNull();
    expect(parseDescription(undefined)).toBeNull();
    expect(parseDescription(' \t\n ')).toBeNull();
  });

  it('trims surrounding whitespace and preserves case and accents', () => {
    expect(parseDescription('  Élève À Noël  ')).toBe('Élève À Noël');
  });

  it('accepts 300 characters and rejects 301', () => {
    expect(parseDescription('x'.repeat(300))).toHaveLength(300);
    expect(() => parseDescription('x'.repeat(301))).toThrow('300 caractères maximum.');
  });

  it('normalizes line endings and collapses three or more consecutive line breaks', () => {
    expect(parseDescription('un\r\nde\r\n\r\n\r\ntrois')).toBe('un\nde\n\ntrois');
  });

  it('removes control characters while retaining line breaks', () => {
    expect(parseDescription('a\u0000b\tc\n d\u007f')).toBe('abc\n d');
  });
});

describe('description display', () => {
  it('shows only non-empty descriptions', () => {
    expect(hasDescription('texte')).toBe(true);
    expect(hasDescription(null)).toBe(false);
    expect(hasDescription('')).toBe(false);
  });
});

describe('formatDescriptionChange', () => {
  it('uses an empty marker when an audit value is absent', () => {
    expect(formatDescriptionChange({ description: { de: null, vers: 'nouveau' } })?.text)
      .toBe('Description modifiée : (vide) -> nouveau');
  });

  it('truncates each visible value at 80 characters and retains the complete tooltip', () => {
    const from = 'a'.repeat(81);
    const to = 'b'.repeat(82);
    const result = formatDescriptionChange({ description: { de: from, vers: to } });

    expect(result?.text).toBe(`Description modifiée : ${'a'.repeat(79)}… -> ${'b'.repeat(79)}…`);
    expect(result?.title).toBe(`Description modifiée : ${from} -> ${to}`);
  });

  it('ignores audit entries without a description change', () => {
    expect(formatDescriptionChange({ email: { de: 'a', vers: 'b' } })).toBeNull();
  });
});

describe('registration description error translation', () => {
  it('maps description check violations to the user-facing message', () => {
    expect(registrationErrorMessage({
      code: '23514',
      message: 'registrations_description_check',
    })).toBe('La description doit contenir entre 1 et 300 caractères.');
  });
});
