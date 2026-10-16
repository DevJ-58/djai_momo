import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { registrationListKey, registrationStatsKey } from './useRegistrations';
import {
  DUPLICATE_REGISTRATION_MESSAGE,
  registrationErrorMessage,
} from '../lib/registration-errors';
import { supabase } from '../lib/supabase';
import type { Registration } from '../types/database';

type AddRegistrationInput = {
  email: string;
  mdp: string;
};

export function useAddRegistration() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ email, mdp }: AddRegistrationInput) => {
      if (!navigator.onLine) throw new Error('Vous êtes hors ligne. Reconnectez-vous pour ajouter un enregistré.');
      if (!user) throw new Error('Une erreur est survenue. Veuillez réessayer.');

      const { data: existing, error: lookupError } = await supabase
        .from('registrations')
        .select('id')
        .ilike('email', email.replace(/[\\%_]/g, '\\$&'))
        .limit(1)
        .maybeSingle();

      if (lookupError) throw new Error(registrationErrorMessage(lookupError));
      if (existing) throw new Error(DUPLICATE_REGISTRATION_MESSAGE);

      const { data, error } = await supabase
        .from('registrations')
        .insert({ agent_id: user.id, email, mdp })
        .select('id, agent_id, seq, email, mdp, status, amount, admin_note, confirmed_at, exported_at, created_at')
        .single()
        .returns<Registration>();

      if (error) throw new Error(registrationErrorMessage(error));
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: registrationListKey }),
        queryClient.invalidateQueries({ queryKey: registrationStatsKey }),
      ]);
    },
  });
}
