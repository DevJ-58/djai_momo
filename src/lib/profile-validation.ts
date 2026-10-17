import { z } from 'zod';

export const receiverFullNameSchema = z.string()
  .trim()
  .min(2, 'Le nom doit contenir entre 2 et 60 caractères.')
  .max(60, 'Le nom doit contenir entre 2 et 60 caractères.');

export const receiverPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Saisissez votre mot de passe actuel.'),
  password: z.string().min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères.'),
  confirmPassword: z.string().min(1, 'Confirmez votre nouveau mot de passe.'),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas.',
  path: ['confirmPassword'],
}).refine((values) => values.password !== values.currentPassword, {
  message: 'Le nouveau mot de passe doit être différent de l’ancien.',
  path: ['password'],
});
