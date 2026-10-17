import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { registrationErrorMessage } from '../lib/registration-errors';
import { adminRegistrationsKey, adminStatsKey, agentsOverviewKey, agentExportCountsKey, dailyRegistrationsKey, recentRegistrationsKey } from './useAdmin';
import { registrationListKey, registrationStatsKey } from './useRegistrations';

export function useDeleteRegistrations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!navigator.onLine) throw new Error('Pas de connexion. Réessayez une fois en ligne.');
      const batches: string[][] = [];
      for (let index = 0; index < ids.length; index += 500) {
        batches.push(ids.slice(index, index + 500));
      }

      let deleted = 0;
      for (const batch of batches) {
        const { data, error } = await supabase.rpc('admin_delete_registrations', { p_ids: batch });
        if (error) throw new Error(registrationErrorMessage(error));
        deleted += Number(data ?? 0);
      }
      return deleted;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminRegistrationsKey }),
        queryClient.invalidateQueries({ queryKey: registrationListKey }),
        queryClient.invalidateQueries({ queryKey: registrationStatsKey }),
        queryClient.invalidateQueries({ queryKey: adminStatsKey }),
        queryClient.invalidateQueries({ queryKey: agentsOverviewKey }),
        queryClient.invalidateQueries({ queryKey: dailyRegistrationsKey }),
        queryClient.invalidateQueries({ queryKey: recentRegistrationsKey }),
        queryClient.invalidateQueries({ queryKey: agentExportCountsKey }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'agent-registrations'] }),
        queryClient.invalidateQueries({ queryKey: ['receiver-items'] }),
        queryClient.invalidateQueries({ queryKey: ['receiver-blocks'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
  });
}
