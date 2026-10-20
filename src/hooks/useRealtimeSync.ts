import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { invalidateCorrectionRealtime } from './useCorrectionRequests';
import { notificationsKey, unreadNotificationsCountKey } from './useNotifications';
import {
  adminRegistrationsKey,
  adminStatsKey,
  agentsOverviewKey,
  dailyRegistrationsKey,
  recentRegistrationsKey,
  unconfirmedReceiverResultsKey,
} from './useAdmin';
import { registrationListKey, registrationStatsKey } from './useRegistrations';
import { dayRegistrationsKey, reportDayStatsKey } from './useDayReports';

export function useRealtimeSync() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const userId = profile?.id ?? '';
  const role = profile?.role;

  useEffect(() => {
    if (!userId || !role) return;

    let reportInvalidationTimer: number | undefined;
    const scheduleReportInvalidation = () => {
      window.clearTimeout(reportInvalidationTimer);
      reportInvalidationTimer = window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: reportDayStatsKey });
        void queryClient.invalidateQueries({ queryKey: dayRegistrationsKey });
        void queryClient.invalidateQueries({ queryKey: ['earliest-report-day'] });
      }, 1000);
    };

    const channel = supabase.channel(`realtime-sync-${userId}`);
    const receiverChannel = role === 'receveur'
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
    const registrationChannel = role === 'agent'
      ? receiverChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'registrations',
          filter: `agent_id=eq.${userId}`,
        },
        () => {
          scheduleReportInvalidation();
          void queryClient.invalidateQueries({ queryKey: registrationListKey });
          void queryClient.invalidateQueries({ queryKey: registrationStatsKey });
          void queryClient.invalidateQueries({ queryKey: ['registrations', 'detail'] });
          void queryClient.invalidateQueries({ queryKey: ['registration-receiver-result'] });
        },
      )
      : role === 'admin'
        ? receiverChannel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'registrations',
          },
          () => {
              scheduleReportInvalidation();
              void queryClient.invalidateQueries({ queryKey: adminRegistrationsKey });
            void queryClient.invalidateQueries({ queryKey: ['admin', 'agent-registrations'] });
            void queryClient.invalidateQueries({ queryKey: adminStatsKey });
            void queryClient.invalidateQueries({ queryKey: agentsOverviewKey });
            void queryClient.invalidateQueries({ queryKey: dailyRegistrationsKey });
            void queryClient.invalidateQueries({ queryKey: recentRegistrationsKey });
            void queryClient.invalidateQueries({ queryKey: unconfirmedReceiverResultsKey });
            void queryClient.invalidateQueries({ queryKey: ['registration-receiver-result'] });
            void queryClient.invalidateQueries({ queryKey: ['registrations', 'detail'] });
          },
        )
        : receiverChannel;
    const resultChannel = role === 'agent' || role === 'admin'
      ? registrationChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'receiver_progress',
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['registration-receiver-result'] });
        },
      )
      : registrationChannel;
    resultChannel
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
      window.clearTimeout(reportInvalidationTimer);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, role, userId]);
}
