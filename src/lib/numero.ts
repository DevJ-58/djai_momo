import { z } from 'zod';

export const NUMERO_INVALID_MESSAGE = 'Numéro invalide : chiffres uniquement, 4 à 20.';

export function parseNumero(raw: string | null | undefined): string | null {
  if (raw == null || raw.trim() === '') return null;

  const numero = raw.replace(/[ \t\r\n\u00a0\u202f.\-()]/g, '');
  if (!/^\+?[0-9]{4,20}$/u.test(numero)) {
    throw new Error(NUMERO_INVALID_MESSAGE);
  }
  return numero;
}

export const numeroSchema = z.string().transform((raw, context) => {
  try {
    return parseNumero(raw);
  } catch {
    context.addIssue({ code: 'custom', message: NUMERO_INVALID_MESSAGE });
    return z.NEVER;
  }
});

export const optionalNumeroSchema = z.string().nullable().optional().transform((raw, context) => {
  if (raw === undefined) return undefined;
  try {
    return parseNumero(raw);
  } catch {
    context.addIssue({ code: 'custom', message: NUMERO_INVALID_MESSAGE });
    return z.NEVER;
  }
});

export function formatNumeroForDisplay(numero: string | null | undefined): string {
  if (!numero) return '';
  const hasPlus = numero.startsWith('+');
  const digits = hasPlus ? numero.slice(1) : numero;
  if (hasPlus && digits.startsWith('225') && digits.length > 3) {
    const groups = digits.slice(3).match(/.{1,2}/gu) ?? [];
    return `+225 ${groups.join(' ')}`;
  }
  const groups = digits.match(/.{1,2}/gu) ?? [];
  return `${hasPlus ? '+' : ''}${groups.join(' ')}`;
}

export function normalizeNumeroForSearch(raw: string): string {
  return raw.replace(/[ \t\r\n\u00a0\u202f.\-()]/g, '');
}
