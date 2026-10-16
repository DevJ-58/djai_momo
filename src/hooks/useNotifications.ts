import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { registrationErrorMessage } from '../lib/registration-errors';
import { useAuth } from './useAuth';
import type { Notification } from '../types/database';

export const notificationsKey = (userId: string) => ['notifications', userId] as const;
export const unreadNotificationsCountKey = (userId: string) => ['notifications-unread-count', userId] as const;

export function useNotifications() {
  const { profile } = useAuth();
  const userId = profile?.id ?? '';

  return useQuery({
    queryKey: notificationsKey(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, type, title, body, registration_id, read_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
        .returns<Notification[]>();
      if (error) throw new Error(registrationErrorMessage(error));
      return data;
    },
    refetchOnWindowFocus: true,
  });
}

export function useUnreadNotificationsCount() {
  const { profile } = useAuth();
  const userId = profile?.id ?? '';

  return useQuery({
    queryKey: unreadNotificationsCountKey(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null);
      if (error) throw new Error(registrationErrorMessage(error));
      return count ?? 0;
    },
    refetchOnWindowFocus: true,
  });
}

function useNotificationReadMutation() {
  const { profile } = useAuth();
  const userId = profile?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string | null) => {
      if (!navigator.onLine) throw new Error('Vous êtes hors ligne. Reconnectez-vous pour modifier les notifications.');
      let query = supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null);
      if (notificationId) query = query.eq('id', notificationId);
      const { error } = await query;
      if (error) throw new Error(registrationErrorMessage(error));
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: notificationsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: unreadNotificationsCountKey(userId) }),
      ]);
    },
  });
}

export function useMarkNotificationRead() {
  const mutation = useNotificationReadMutation();
  return {
    ...mutation,
    markRead: (notificationId: string) => mutation.mutateAsync(notificationId),
  };
}

export function useMarkAllNotificationsRead() {
  const mutation = useNotificationReadMutation();
  return {
    ...mutation,
    markAllRead: () => mutation.mutateAsync(null),
  };
}
