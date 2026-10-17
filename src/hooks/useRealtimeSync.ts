import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { invalidateCorrectionRealtime } from './useCorrectionRequests';
import { notificationsKey, unreadNotificationsCountKey } from './useNotifications';

export function useRealtimeSync() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const userId = profile?.id ?? '';
  const role = profile?.role;

  useEffect(() => {
    if (!userId || !role) return;

    const channel = supabase.channel(`realtime-sync-${userId}`);
    const roleChannel = role === 'receveur'
      ? channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'receiver_progress',
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['receiver-items'] });
          void queryClient.invalidateQueries({ queryKey: ['receiver-blocks'] });
        },
      )
      : channel;
    roleChannel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'correction_requests',
          ...(role === 'agent' ? { filter: `agent_id=eq.${userId}` } : {}),
        },
        () => invalidateCorrectionRealtime(queryClient, userId),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: notificationsKey(userId) });
          void queryClient.invalidateQueries({ queryKey: unreadNotificationsCountKey(userId) });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, role, userId]);
}
