import { z } from 'zod';

export const correctionRequestSchema = z.object({
  message: z.string()
    .trim()
    .min(3, 'Le message doit contenir au moins 3 caractères.')
    .max(300, 'Le message ne peut pas dépasser 300 caractères.'),
});

export type CorrectionRequestValues = z.infer<typeof correctionRequestSchema>;

export function correctionRequestErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : '';
  const message = error instanceof Error
    ? error.message.toLocaleLowerCase('fr')
    : typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message).toLocaleLowerCase('fr')
      : '';

  if (code === '23505') return 'Une demande est déjà en cours pour cet enregistré.';
  if (
    error instanceof TypeError ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('offline') ||
    message.includes('failed to connect')
  ) {
    return 'Pas de connexion. Réessayez une fois en ligne.';
  }
  return 'Une erreur est survenue. Veuillez réessayer.';
}
