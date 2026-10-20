import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminRegistrationsKey, adminStatsKey, agentsOverviewKey, dailyRegistrationsKey, recentRegistrationsKey, unconfirmedReceiverResultsKey } from './useAdmin';
import { registrationListKey, registrationStatsKey } from './useRegistrations';
import { registrationHistoryKey } from './useRegistrationHistory';
import { gainsDailyKey, gainsSummaryKey } from './useGains';
import { registrationStatusErrorMessage } from '../lib/registration-errors';
import { supabase } from '../lib/supabase';
import type { RegistrationStatus } from '../types/database';

type SetRegistrationStatusInput = {
  registrationId: string;
  newStatus: RegistrationStatus;
  amount: number | null;
  note: string | null;
};

export function useSetRegistrationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ registrationId, newStatus, amount, note }: SetRegistrationStatusInput) => {
      if (!navigator.onLine) throw new Error('Vous êtes hors ligne. Reconnectez-vous pour modifier le statut.');
      const { count, error } = await supabase
        .from('registrations')
        .update({
          status: newStatus,
          amount: newStatus === 'paye' || newStatus === 'gagne' ? amount : null,
          admin_note: note,
        }, { count: 'exact' })
        .eq('id', registrationId);
      if (error) {
        if (import.meta.env.DEV) {
          console.error('[useSetRegistrationStatus] Supabase update failed', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
        }
        throw new Error(registrationStatusErrorMessage(error));
      }
      if (count === 0) throw new Error('Aucun enregistré n’a été modifié. Vérifiez vos droits et réessayez.');
    },
    onSuccess: async (_data, { registrationId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: registrationListKey }),
        queryClient.invalidateQueries({ queryKey: adminRegistrationsKey }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'agent-registrations'] }),
        queryClient.invalidateQueries({ queryKey: registrationStatsKey }),
        queryClient.invalidateQueries({ queryKey: adminStatsKey }),
        queryClient.invalidateQueries({ queryKey: agentsOverviewKey }),
        queryClient.invalidateQueries({ queryKey: dailyRegistrationsKey }),
        queryClient.invalidateQueries({ queryKey: recentRegistrationsKey }),
        queryClient.invalidateQueries({ queryKey: unconfirmedReceiverResultsKey }),
        queryClient.invalidateQueries({ queryKey: registrationHistoryKey(registrationId) }),
        queryClient.invalidateQueries({ queryKey: gainsSummaryKey }),
        queryClient.invalidateQueries({ queryKey: gainsDailyKey }),
      ]);
    },
  });
}
