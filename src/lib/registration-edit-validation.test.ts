import { describe, expect, it } from 'vitest';
import { registrationUpdateInfoSchema } from './registration-edit-validation';

describe('registrationUpdateInfoSchema', () => {
  it('accepts email-to-pseudo and pseudo-to-email changes without changing field names', () => {
    expect(registrationUpdateInfoSchema.parse({ email: '  jean_test  ' }))
      .toEqual({ email: 'jean_test' });
    expect(registrationUpdateInfoSchema.parse({ email: '  Jean@Example.com  ' }))
      .toEqual({ email: 'Jean@Example.com' });
  });

  it('keeps password trimming and the 100-character limit', () => {
    expect(registrationUpdateInfoSchema.parse({ mdp: '  fake-pass  ' }))
      .toEqual({ mdp: 'fake-pass' });
    expect(registrationUpdateInfoSchema.safeParse({ mdp: ` ${'x'.repeat(101)} ` }).success).toBe(false);
  });

  it('normalizes a phone number and accepts an explicit clear', () => {
    expect(registrationUpdateInfoSchema.parse({ numero: '07 01 02 03 04' }))
      .toEqual({ numero: '0701020304' });
    expect(registrationUpdateInfoSchema.parse({ numero: '' }))
      .toEqual({ numero: null });
    expect(registrationUpdateInfoSchema.safeParse({ numero: '12x4' }).success).toBe(false);
  });

  it('normalizes optional descriptions and permits an explicit clear', () => {
    expect(registrationUpdateInfoSchema.parse({ description: '  ligne 1\nligne 2  ' }))
      .toEqual({ description: 'ligne 1\nligne 2' });
    expect(registrationUpdateInfoSchema.parse({ description: '' }))
      .toEqual({ description: null });
    expect(registrationUpdateInfoSchema.safeParse({ description: 'x'.repeat(301) }).success).toBe(false);
  });

  it('returns the shared invalid-identifier message', () => {
    const result = registrationUpdateInfoSchema.safeParse({ email: 'user@' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe('Adresse e-mail invalide.');
  });
});
