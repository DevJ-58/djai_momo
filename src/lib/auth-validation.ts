import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .regex(/[A-Za-z]/, 'Le mot de passe doit contenir au moins une lettre.')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.');

export const passwordWithConfirmationSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirmez votre mot de passe.'),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas.',
  path: ['confirmPassword'],
});

export function translatedAuthMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Une erreur est survenue. Veuillez réessayer.';
}
