import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { adminErrorMessage } from '../lib/admin-errors';
import type {
  AdminStats,
  AdminRegistrationFilters,
  AgentOverview,
  DailyPoint,
  RegistrationFilters,
  RegistrationWithAgent,
  RecentRegistration,
} from '../types/database';
import type { AuthProfile } from './useAuth';

const PAGE_SIZE = 20;

export const adminStatsKey = ['admin', 'stats'] as const;
export const agentsOverviewKey = ['admin', 'agents'] as const;
export const dailyRegistrationsKey = ['admin', 'daily-registrations'] as const;
export const recentRegistrationsKey = ['admin', 'recent-registrations'] as const;
export const adminRegistrationsKey = ['admin', 'registrations'] as const;
export const agentExportCountsKey = ['admin', 'agent-export-counts'] as const;
export const agentProfileKey = (agentId: string) => ['admin', 'agent-profile', agentId] as const;
export const agentRegistrationsKey = (agentId: string, filters: RegistrationFilters) => (
  ['admin', 'agent-registrations', agentId, filters] as const
);

function isAgentOverview(value: unknown): value is AgentOverview {
  if (typeof value !== 'object' || value === null) return false;
  return 'agent_id' in value &&
    typeof value.agent_id === 'string' &&
    'full_name' in value &&
    typeof value.full_name === 'string' &&
    'whatsapp' in value &&
    typeof value.whatsapp === 'string' &&
    'is_suspended' in value &&
    typeof value.is_suspended === 'boolean' &&
    'created_at' in value &&
    typeof value.created_at === 'string' &&
    'total' in value &&
    typeof value.total === 'number' &&
    'payes' in value &&
    typeof value.payes === 'number' &&
    'en_attente' in value &&
    typeof value.en_attente === 'number' &&
    'montant_total' in value &&
    typeof value.montant_total === 'number' &&
    'last_activity' in value &&
    (typeof value.last_activity === 'string' || value.last_activity === null);
}

function isDailyPoint(value: unknown): value is DailyPoint {
  if (typeof value !== 'object' || value === null) return false;
  return 'day' in value &&
    typeof value.day === 'string' &&
    'total' in value &&
    typeof value.total === 'number' &&
    'payes' in value &&
    typeof value.payes === 'number';
}

export function useAdminStats() {
  return useQuery({
    queryKey: adminStatsKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_stats').returns<AdminStats[]>().maybeSingle();
      if (error) throw new Error(adminErrorMessage(error));
      if (!data) throw new Error('Impossible de charger les statistiques.');
      return data;
    },
    refetchOnWindowFocus: true,
  });
}

export function useAgentsOverview() {
  return useQuery({
    queryKey: agentsOverviewKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('admin_agents_overview')
        .overrideTypes<AgentOverview[], { merge: false }>();
      if (error) throw new Error(adminErrorMessage(error));
      const rows: unknown = data;
      if (!Array.isArray(rows) || !rows.every(isAgentOverview)) {
        throw new Error('Impossible de charger les utilisateurs.');
      }
      return rows;
    },
    refetchOnWindowFocus: true,
  });
}

export function useDailyRegistrations(days: number) {
  return useQuery({
    queryKey: [...dailyRegistrationsKey, days],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('admin_daily_registrations', { days })
        .overrideTypes<DailyPoint[], { merge: false }>();
      if (error) throw new Error(adminErrorMessage(error));
      const rows: unknown = data;
      if (!Array.isArray(rows) || !rows.every(isDailyPoint)) {
        throw new Error('Impossible de charger l’activité.');
      }
      return rows;
    },
    refetchOnWindowFocus: true,
  });
}

export function useRecentRegistrations() {
  return useQuery({
    queryKey: recentRegistrationsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('registrations')
        .select('id, agent_id, seq, email, status, amount, admin_note, confirmed_at, exported_at, created_at, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(8)
        .returns<RecentRegistration[]>();
      if (error) throw new Error(adminErrorMessage(error));
      return data;
    },
    refetchOnWindowFocus: true,
  });
}

export function useAgentProfile(agentId: string) {
  return useQuery({
    queryKey: agentProfileKey(agentId),
    enabled: Boolean(agentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, whatsapp, role, is_suspended, created_at')
        .eq('id', agentId)
        .maybeSingle()
        .returns<AuthProfile | null>();
      if (error) throw new Error(adminErrorMessage(error));
      return data;
    },
    refetchOnWindowFocus: true,
  });
}

export function useAgentRegistrations(agentId: string, { status, search }: RegistrationFilters) {
  return useInfiniteQuery({
    queryKey: agentRegistrationsKey(agentId, { status, search }),
    enabled: Boolean(agentId),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('registrations')
        .select('id, agent_id, seq, email, mdp, status, amount, admin_note, confirmed_at, exported_at, created_at, profiles(full_name)')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (search) query = query.ilike('email', `%${search}%`);

      const { data, error } = await query
        .range(pageParam * PAGE_SIZE, pageParam * PAGE_SIZE + PAGE_SIZE - 1)
        .returns<RegistrationWithAgent[]>();
      if (error) throw new Error(adminErrorMessage(error));
      return data;
    },
    getNextPageParam: (lastPage, pages) => (
      lastPage.length === PAGE_SIZE ? pages.length : undefined
    ),
    refetchOnWindowFocus: true,
  });
}

export function useAdminRegistrations({
  status,
  search,
  agentName,
  agentId,
  dateFrom,
  dateTo,
  exported = 'all',
}: AdminRegistrationFilters) {
  return useInfiniteQuery({
    queryKey: [...adminRegistrationsKey, { status, search, agentName, agentId, dateFrom, dateTo, exported }],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('registrations')
        .select('id, agent_id, seq, email, mdp, status, amount, admin_note, confirmed_at, exported_at, created_at, profiles!inner(full_name, whatsapp)')
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (search) query = query.ilike('email', `%${search}%`);
      if (agentName) query = query.ilike('profiles.full_name', `%${agentName}%`);
      if (agentId) query = query.eq('agent_id', agentId);
      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00Z`);
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999Z`);
      if (exported === 'exported') query = query.not('exported_at', 'is', null);
      if (exported === 'not_exported') query = query.is('exported_at', null);

      const { data, error } = await query
        .range(pageParam * PAGE_SIZE, pageParam * PAGE_SIZE + PAGE_SIZE - 1)
        .returns<RegistrationWithAgent[]>();
      if (error) throw new Error(adminErrorMessage(error));
      return data;
    },
    getNextPageParam: (lastPage, pages) => (
      lastPage.length === PAGE_SIZE ? pages.length : undefined
    ),
    refetchOnWindowFocus: true,
  });
}

export function useAgentExportCounts() {
  return useQuery({
    queryKey: agentExportCountsKey,
    queryFn: async () => {
      const counts: Record<string, number> = {};
      const pageSize = 1000;
      for (let page = 0; ; page += 1) {
        const { data, error } = await supabase
          .from('registrations')
          .select('agent_id')
          .is('exported_at', null)
          .range(page * pageSize, page * pageSize + pageSize - 1);
        if (error) throw new Error(adminErrorMessage(error));
        for (const row of data) counts[row.agent_id] = (counts[row.agent_id] ?? 0) + 1;
        if (data.length < pageSize) return counts;
      }
    },
    refetchOnWindowFocus: true,
  });
}

type ToggleSuspensionInput = {
  agentId: string;
  isSuspended: boolean;
};

export function useToggleSuspension() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, isSuspended }: ToggleSuspensionInput) => {
      if (!navigator.onLine) throw new Error('Vous êtes hors ligne. Reconnectez-vous pour modifier ce compte.');
      const { error } = await supabase
        .from('profiles')
        .update({ is_suspended: isSuspended })
        .eq('id', agentId)
        .eq('role', 'agent')
        .select('id')
        .single();
      if (error) throw new Error(adminErrorMessage(error));
    },
    onMutate: async ({ agentId, isSuspended }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: agentsOverviewKey }),
        queryClient.cancelQueries({ queryKey: adminStatsKey }),
        queryClient.cancelQueries({ queryKey: agentProfileKey(agentId) }),
      ]);

      const previousAgents = queryClient.getQueryData<AgentOverview[]>(agentsOverviewKey);
      const previousStats = queryClient.getQueryData<AdminStats>(adminStatsKey);
      const previousProfile = queryClient.getQueryData<AuthProfile | null>(agentProfileKey(agentId));
      const previousSuspended = previousAgents?.find((agent) => agent.agent_id === agentId)?.is_suspended
        ?? previousProfile?.is_suspended;

      queryClient.setQueryData<AgentOverview[]>(agentsOverviewKey, (agents) => (
        agents?.map((agent) => agent.agent_id === agentId
          ? { ...agent, is_suspended: isSuspended }
          : agent)
      ));
      queryClient.setQueryData<AuthProfile | null>(agentProfileKey(agentId), (profile) => (
        profile ? { ...profile, is_suspended: isSuspended } : profile
      ));
      if (previousStats && previousSuspended !== undefined && previousSuspended !== isSuspended) {
        queryClient.setQueryData<AdminStats>(adminStatsKey, {
          ...previousStats,
          agents_suspended: Math.max(
            0,
            previousStats.agents_suspended + (isSuspended ? 1 : -1),
          ),
        });
      }

      return { previousAgents, previousStats, previousProfile, agentId };
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      queryClient.setQueryData(agentsOverviewKey, context.previousAgents);
      queryClient.setQueryData(adminStatsKey, context.previousStats);
      queryClient.setQueryData(agentProfileKey(context.agentId), context.previousProfile);
    },
    onSettled: async (_data, _error, { agentId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: agentsOverviewKey }),
        queryClient.invalidateQueries({ queryKey: adminStatsKey }),
        queryClient.invalidateQueries({ queryKey: agentProfileKey(agentId) }),
      ]);
    },
  });
}

export function useUpdateAgentWhatsapp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, whatsapp }: { agentId: string; whatsapp: string }) => {
      if (!navigator.onLine) throw new Error('Vous êtes hors ligne. Reconnectez-vous pour modifier ce numéro.');
      const { error } = await supabase
        .from('profiles')
        .update({ whatsapp })
        .eq('id', agentId)
        .eq('role', 'agent')
        .select('id')
        .single();
      if (error) throw new Error(adminErrorMessage(error));
    },
    onSuccess: async (_data, { agentId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: agentProfileKey(agentId) }),
        queryClient.invalidateQueries({ queryKey: agentsOverviewKey }),
      ]);
    },
  });
}
