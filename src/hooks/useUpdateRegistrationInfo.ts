import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { adminRegistrationsKey, agentExportCountsKey, adminStatsKey, agentsOverviewKey, dailyRegistrationsKey, recentRegistrationsKey } from './useAdmin';
import { registrationListKey, registrationStatsKey } from './useRegistrations';
import { registrationHistoryKey } from './useRegistrationHistory';
import { registrationErrorMessage } from '../lib/registration-errors';
import { updateRegistrationInfoSchema, type RegistrationUpdateInfoInput } from '../lib/registration-edit-validation';
import { registrationAuditKey } from './useAuditLog';

export function useUpdateRegistrationInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ registrationId, values }: { registrationId: string; values: RegistrationUpdateInfoInput }) => {
      if (!navigator.onLine) throw new Error('Pas de connexion. Réessayez une fois en ligne.');
      const parsed = updateRegistrationInfoSchema.safeParse(values);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Une erreur est survenue. Veuillez réessayer.');
      }

      const updateObject = parsed.data;
      const { error } = await supabase
        .from('registrations')
        .update(updateObject)
        .eq('id', registrationId)
        .select('id');

      if (error) {
        throw new Error(registrationErrorMessage(error));
      }
    },
    onSuccess: async (_data, { registrationId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminRegistrationsKey }),
        queryClient.invalidateQueries({ queryKey: registrationListKey }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'agent-registrations'] }),
        queryClient.invalidateQueries({ queryKey: agentExportCountsKey }),
        queryClient.invalidateQueries({ queryKey: registrationStatsKey }),
        queryClient.invalidateQueries({ queryKey: adminStatsKey }),
        queryClient.invalidateQueries({ queryKey: agentsOverviewKey }),
        queryClient.invalidateQueries({ queryKey: dailyRegistrationsKey }),
        queryClient.invalidateQueries({ queryKey: recentRegistrationsKey }),
        queryClient.invalidateQueries({ queryKey: registrationHistoryKey(registrationId) }),
        queryClient.invalidateQueries({ queryKey: registrationAuditKey(registrationId) }),
      ]);
    },
  });
}
