import { describe, expect, it } from 'vitest';
import { formatNumeroForDisplay, NUMERO_INVALID_MESSAGE, parseNumero } from './numero';

describe('parseNumero', () => {
  it.each([null, undefined, '', '   ', '\u00a0\u202f'])('returns null for an empty value (%s)', (value) => {
    expect(parseNumero(value)).toBeNull();
  });

  it.each([
    ['07 01 02 03 04', '0701020304'],
    ['+225 07 01 02 03 04', '+2250701020304'],
    ['07-01.02(03)04', '0701020304'],
  ])('normalizes %s', (value, expected) => {
    expect(parseNumero(value)).toBe(expected);
  });

  it.each(['07ab01020304', '123', '123456789012345678901', '07+01020304'])(
    'rejects invalid value %s with the shared message',
    (value) => {
      expect(() => parseNumero(value)).toThrow(NUMERO_INVALID_MESSAGE);
    },
  );
});

describe('formatNumeroForDisplay', () => {
  it.each([
    ['0701020304', '07 01 02 03 04'],
    ['+2250701020304', '+225 07 01 02 03 04'],
    ['1234567890123', '12 34 56 78 90 12 3'],
    [null, ''],
  ])('formats %s for display', (value, expected) => {
    expect(formatNumeroForDisplay(value)).toBe(expected);
  });
});
