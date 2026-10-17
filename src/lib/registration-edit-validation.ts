import { z } from 'zod';

export const registrationUpdateInfoSchema = z.object({
  email: z.string().trim().email('L’e-mail est invalide.').max(254, 'L’e-mail ne peut pas dépasser 254 caractères.').optional(),
  mdp: z.string().trim().min(1, 'Le mot de passe est obligatoire.').max(100, 'Le mot de passe ne peut pas dépasser 100 caractères.').optional(),
  exported_at: z.string().nullable().optional(),
}).refine((value) => value.email !== undefined || value.mdp !== undefined || value.exported_at !== undefined, {
  message: 'Choisissez au moins un champ à modifier.',
}).transform((value) => ({
  ...(value.email !== undefined ? { email: value.email.trim() } : {}),
  ...(value.mdp !== undefined ? { mdp: value.mdp.trim() } : {}),
  ...(value.exported_at !== undefined ? { exported_at: value.exported_at } : {}),
}));

export const updateRegistrationInfoSchema = registrationUpdateInfoSchema;

export const deleteRegistrationsSchema = z.array(z.string().uuid('Identifiant invalide.')).max(500, 'Trop d’enregistrés à la fois : sélectionnez-en moins.').nonempty('Sélectionnez au moins un enregistrement.');
export const adminDeleteRegistrationsSchema = deleteRegistrationsSchema;

export type RegistrationUpdateInfoInput = z.infer<typeof registrationUpdateInfoSchema>;
export type RegistrationDeleteInput = z.infer<typeof deleteRegistrationsSchema>;
