import { describe, expect, it } from 'vitest';
import { passwordWithConfirmationSchema } from './auth-validation';

describe('password validation', () => {
  it('accepts a password with a letter, a number, and at least eight characters', () => {
    expect(passwordWithConfirmationSchema.safeParse({
      password: 'simulati0n',
      confirmPassword: 'simulati0n',
    }).success).toBe(true);
  });

  it('rejects a short password and mismatched confirmation', () => {
    const result = passwordWithConfirmationSchema.safeParse({
      password: 'abc123',
      confirmPassword: 'different123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        'Le mot de passe doit contenir au moins 8 caractères.',
      );
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        'Les mots de passe ne correspondent pas.',
      );
    }
  });
});
