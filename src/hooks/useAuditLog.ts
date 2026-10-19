import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { adminErrorMessage } from '../lib/admin-errors';

export type AuditActionFilter = 'all' | 'update' | 'delete';

export type AuditLogFilters = {
  action?: AuditActionFilter;
  userId?: string;
  period?: 'today' | '7d' | '30d' | 'all';
  page?: number;
  pageSize?: number;
};

export type AuditLogEntry = {
  id: string;
  registration_id: string;
  agent_id: string | null;
  seq: number | null;
  day_seq: number | null;
  send_day: string | null;
  action: 'update' | 'delete';
  changes: Record<string, unknown> | null;
  actor: string | null;
  created_at: string;
  profile?: { full_name: string | null } | null;
  actor_profile?: { full_name: string | null } | null;
};

export const registrationAuditKey = (registrationId: string) => (
  ['registration-audit-by-registration', registrationId] as const
);

export function useAuditLog(filters: AuditLogFilters = {}) {
  const pageSize = filters.pageSize ?? 30;
  const page = filters.page ?? 0;

  return useQuery({
    queryKey: ['registration-audit', filters],
    queryFn: async () => {
      let query = supabase
        .from('registration_audit')
        .select('id, registration_id, agent_id, seq, day_seq, send_day, action, changes, actor, created_at, profiles!registration_audit_agent_id_fkey(full_name), profiles!registration_audit_actor_fkey(full_name)')
        .order('created_at', { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (filters.action && filters.action !== 'all') query = query.eq('action', filters.action);
      if (filters.userId) query = query.eq('agent_id', filters.userId);
      if (filters.period === 'today') query = query.gte('created_at', new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
      if (filters.period === '7d') query = query.gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      if (filters.period === '30d') query = query.gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const { data, error } = await query.returns<AuditLogEntry[]>();
      if (error) throw new Error(adminErrorMessage(error));
      return data ?? [];
    },
    enabled: true,
  });
}

export function useRegistrationAudit(registrationId: string) {
  return useQuery({
    queryKey: registrationAuditKey(registrationId),
    enabled: Boolean(registrationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('registration_audit')
        .select('id, registration_id, agent_id, seq, day_seq, send_day, action, changes, actor, created_at, profiles!registration_audit_agent_id_fkey(full_name), profiles!registration_audit_actor_fkey(full_name)')
        .eq('registration_id', registrationId)
        .order('created_at', { ascending: false })
        .returns<AuditLogEntry[]>();
      if (error) throw new Error(adminErrorMessage(error));
      return data ?? [];
    },
  });
}
