import { z } from 'zod';
import { identifierSchema } from './parseIdentifier';
import { optionalNumeroSchema } from './numero';
import { descriptionSchema } from './description';

export const registrationUpdateInfoSchema = z.object({
  email: identifierSchema.optional(),
  mdp: z.string().trim().min(1, 'Le mot de passe est obligatoire.').max(100, 'Le mot de passe ne peut pas dépasser 100 caractères.').optional(),
  numero: optionalNumeroSchema,
  description: descriptionSchema,
  exported_at: z.string().nullable().optional(),
}).refine((value) => value.email !== undefined || value.mdp !== undefined || value.numero !== undefined || value.description !== undefined || value.exported_at !== undefined, {
  message: 'Choisissez au moins un champ à modifier.',
}).transform((value) => ({
  ...(value.email !== undefined ? { email: value.email.trim() } : {}),
  ...(value.mdp !== undefined ? { mdp: value.mdp.trim() } : {}),
  ...(value.numero !== undefined ? { numero: value.numero } : {}),
  ...(value.description !== undefined ? { description: value.description } : {}),
  ...(value.exported_at !== undefined ? { exported_at: value.exported_at } : {}),
}));

export const updateRegistrationInfoSchema = registrationUpdateInfoSchema;

export const deleteRegistrationsSchema = z.array(z.string().uuid('Identifiant invalide.')).max(500, 'Trop d’enregistrés à la fois : sélectionnez-en moins.').nonempty('Sélectionnez au moins un enregistrement.');
export const adminDeleteRegistrationsSchema = deleteRegistrationsSchema;

export type RegistrationUpdateInfoInput = z.infer<typeof registrationUpdateInfoSchema>;
export type RegistrationDeleteInput = z.infer<typeof deleteRegistrationsSchema>;
