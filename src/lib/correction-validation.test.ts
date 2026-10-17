import { describe, expect, it } from 'vitest';
import { correctionRequestSchema } from './correction-validation';

describe('correction request message', () => {
  it('trims spaces before validating and returning the message', () => {
    expect(correctionRequestSchema.parse({ message: '  Corriger le nom  ' }))
      .toEqual({ message: 'Corriger le nom' });
  });

  it('rejects messages shorter than 3 trimmed characters', () => {
    expect(correctionRequestSchema.safeParse({ message: '  a ' }).success).toBe(false);
  });

  it('accepts 300 characters and rejects longer messages', () => {
    expect(correctionRequestSchema.safeParse({ message: 'x'.repeat(300) }).success).toBe(true);
    expect(correctionRequestSchema.safeParse({ message: 'x'.repeat(301) }).success).toBe(false);
  });
});
