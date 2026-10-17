import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { correctionRequestErrorMessage } from '../lib/correction-validation';
import { adminRegistrationsKey } from './useAdmin';
import { useAuth } from './useAuth';
import { notificationsKey, unreadNotificationsCountKey } from './useNotifications';
import { registrationListKey } from './useRegistrations';
import { supabase } from '../lib/supabase';
import type { CorrectionRequest } from '../types/database';

export const correctionRequestsKey = (registrationId: string) => (
  ['correction-requests', registrationId] as const
);
export const openCorrectionRegistrationIdsKey = ['admin', 'open-correction-registration-ids'] as const;

export function useRegistrationCorrectionRequests(registrationId: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: correctionRequestsKey(registrationId),
    enabled: Boolean(registrationId && profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('correction_requests')
        .select('id, registration_id, agent_id, message, status, created_at, handled_at')
        .eq('registration_id', registrationId)
        .order('created_at', { ascending: false })
        .returns<CorrectionRequest[]>();
      if (error) throw new Error(correctionRequestErrorMessage(error));
      return data;
    },
    refetchOnWindowFocus: true,
  });
}

export function useOpenCorrectionRegistrationIds() {
  const { role } = useAuth();

  return useQuery({
    queryKey: openCorrectionRegistrationIdsKey,
    enabled: role === 'admin',
    queryFn: async () => {
      const pageSize = 1000;
      const ids: string[] = [];
      for (let page = 0; ; page += 1) {
        const { data, error } = await supabase
          .from('correction_requests')
          .select('registration_id')
          .eq('status', 'ouverte')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw new Error(correctionRequestErrorMessage(error));
        ids.push(...data.map((row) => row.registration_id));
        if (data.length < pageSize) return [...new Set(ids)];
      }
    },
    refetchOnWindowFocus: true,
  });
}

export function useCreateCorrectionRequest() {
  const { profile, role } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ registrationId, message }: { registrationId: string; message: string }) => {
      if (role !== 'agent' || !profile) {
        throw new Error('Action non autorisée.');
      }
      if (!navigator.onLine) {
        throw new Error('Pas de connexion. Réessayez une fois en ligne.');
      }
      const { error } = await supabase.from('correction_requests').insert({
        registration_id: registrationId,
        agent_id: profile.id,
        message: message.trim(),
      });
      if (error) throw new Error(correctionRequestErrorMessage(error));
    },
    onSuccess: async (_data, { registrationId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: correctionRequestsKey(registrationId) }),
        queryClient.invalidateQueries({ queryKey: openCorrectionRegistrationIdsKey }),
      ]);
    },
  });
}

export function useHandleCorrectionRequest() {
  const { role } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId }: { requestId: string; registrationId: string }) => {
      if (role !== 'admin') throw new Error('Action non autorisée.');
      if (!navigator.onLine) {
        throw new Error('Pas de connexion. Réessayez une fois en ligne.');
      }
      const { error } = await supabase
        .from('correction_requests')
        .update({ status: 'traitee' })
        .eq('id', requestId)
        .eq('status', 'ouverte');
      if (error) throw new Error(correctionRequestErrorMessage(error));
    },
    onSettled: async (_data, _error, { registrationId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: correctionRequestsKey(registrationId) }),
        queryClient.invalidateQueries({ queryKey: openCorrectionRegistrationIdsKey }),
        queryClient.invalidateQueries({ queryKey: adminRegistrationsKey }),
        queryClient.invalidateQueries({ queryKey: registrationListKey }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] }),
      ]);
    },
  });
}

export function invalidateCorrectionRealtime(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
) {
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: ['correction-requests'] }),
    queryClient.invalidateQueries({ queryKey: openCorrectionRegistrationIdsKey }),
    queryClient.invalidateQueries({ queryKey: adminRegistrationsKey }),
    queryClient.invalidateQueries({ queryKey: registrationListKey }),
    queryClient.invalidateQueries({ queryKey: ['admin', 'agent-registrations'] }),
    queryClient.invalidateQueries({ queryKey: notificationsKey(userId) }),
    queryClient.invalidateQueries({ queryKey: unreadNotificationsCountKey(userId) }),
  ]);
}
