import { z } from 'zod';

export type IdentifierParseResult =
  | { success: true; value: string }
  | { success: false; error: string };

function isValidEmail(value: string): boolean {
  const atIndex = value.indexOf('@');
  if (atIndex <= 0 || atIndex !== value.lastIndexOf('@')) return false;

  const localPart = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);
  if (
    !/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/iu.test(localPart) ||
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..')
  ) return false;

  const labels = domain.split('.');
  if (labels.length < 2 || labels.some((label) => (
    label.length === 0 ||
    label.length > 63 ||
    !/^[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?$/iu.test(label)
  ))) return false;

  return /^[A-Z]{2,}$/iu.test(labels[labels.length - 1] ?? '');
}

export function parseIdentifier(raw: string): IdentifierParseResult {
  const value = raw.trim();
  if (!value) return { success: false, error: 'Saisissez un e-mail ou un pseudo.' };
  if (Array.from(value).length < 2) return { success: false, error: 'Au moins 2 caractères.' };
  if (Array.from(value).length > 254) return { success: false, error: '254 caractères maximum.' };
  if (/[\s\u0000-\u001f\u007f-\u009f]/u.test(value)) {
    return { success: false, error: "Pas d'espaces dans l'identifiant." };
  }
  if (value.includes('@') && !value.startsWith('@') && !isValidEmail(value)) {
    return { success: false, error: 'Adresse e-mail invalide.' };
  }
  return { success: true, value };
}

export const identifierSchema = z.string().transform((raw, context) => {
  const parsed = parseIdentifier(raw);
  if (!parsed.success) {
    context.addIssue({ code: 'custom', message: parsed.error });
    return z.NEVER;
  }
  return parsed.value;
});
