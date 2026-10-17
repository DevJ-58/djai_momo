import { describe, expect, it } from 'vitest';
import { receiverFullNameSchema, receiverPasswordChangeSchema } from './profile-validation';

describe('receiver profile validation', () => {
  it('trims names and accepts lengths from 2 to 60 characters', () => {
    expect(receiverFullNameSchema.parse('  Aminata  ')).toBe('Aminata');
    expect(receiverFullNameSchema.safeParse(' A ').success).toBe(false);
    expect(receiverFullNameSchema.safeParse(` ${'A'.repeat(61)} `).success).toBe(false);
    expect(receiverFullNameSchema.parse(` ${'A'.repeat(60)} `)).toHaveLength(60);
  });

  it('requires at least eight characters for a new password', () => {
    expect(receiverPasswordChangeSchema.safeParse({
      currentPassword: 'old-password',
      password: 'short7',
      confirmPassword: 'short7',
    }).success).toBe(false);
    expect(receiverPasswordChangeSchema.safeParse({
      currentPassword: 'old-password',
      password: 'new-pass',
      confirmPassword: 'new-pass',
    }).success).toBe(true);
  });

  it('requires matching confirmation and a password different from the current one', () => {
    expect(receiverPasswordChangeSchema.safeParse({
      currentPassword: 'old-password',
      password: 'new-password',
      confirmPassword: 'other-password',
    }).success).toBe(false);
    expect(receiverPasswordChangeSchema.safeParse({
      currentPassword: 'same-password',
      password: 'same-password',
      confirmPassword: 'same-password',
    }).success).toBe(false);
  });
});
