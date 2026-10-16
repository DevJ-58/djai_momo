import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminRegistrationsKey, agentExportCountsKey } from './useAdmin';
import { registrationListKey, registrationStatsKey } from './useRegistrations';
import { adminErrorMessage } from '../lib/admin-errors';
import { supabase } from '../lib/supabase';

const EXPORT_BATCH_SIZE = 100;

export function useMarkExported() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!navigator.onLine) throw new Error('Vous êtes hors ligne. Reconnectez-vous pour mettre à jour les envois.');
      for (let index = 0; index < ids.length; index += EXPORT_BATCH_SIZE) {
        const batch = ids.slice(index, index + EXPORT_BATCH_SIZE);
        const { error } = await supabase
          .from('registrations')
          .update({ exported_at: new Date().toISOString() })
          .in('id', batch);
        if (error) throw new Error(adminErrorMessage(error));
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminRegistrationsKey }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'agent-registrations'] }),
        queryClient.invalidateQueries({ queryKey: registrationListKey }),
        queryClient.invalidateQueries({ queryKey: registrationStatsKey }),
        queryClient.invalidateQueries({ queryKey: agentExportCountsKey }),
      ]);
    },
  });
}

export function useUnmarkExported() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!navigator.onLine) throw new Error('Vous êtes hors ligne. Reconnectez-vous pour mettre à jour les envois.');
      const { error } = await supabase
        .from('registrations')
        .update({ exported_at: null })
        .eq('id', id);
      if (error) throw new Error(adminErrorMessage(error));
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminRegistrationsKey }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'agent-registrations'] }),
        queryClient.invalidateQueries({ queryKey: registrationListKey }),
        queryClient.invalidateQueries({ queryKey: registrationStatsKey }),
        queryClient.invalidateQueries({ queryKey: agentExportCountsKey }),
      ]);
    },
  });
}
