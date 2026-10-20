import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import {
  exceedsReportLimits,
  buildReportDayStatsParameters,
  groupReportDayStats,
  normalizeReportDayStats,
  type ReportDayStatsParameters,
  type ReportRegistration,
} from '../lib/day-reports';
import type { RegistrationStatus } from '../types/database';

export const reportDayStatsKey = ['report-day-stats'] as const;
export const dayRegistrationsKey = ['day-registrations'] as const;
export const reportRowsKey = ['report-rows'] as const;

export type ReportDayFilters = {
  from?: string;
  to?: string;
  agentIds?: string[];
  enabled?: boolean;
};

export type ReportDayStatsDiagnostics = ReportDayStatsParameters & {
  code: string | null;
  message: string;
  details: string | null;
  hint: string | null;
  httpStatus: number | null;
};

export class ReportDayStatsError extends Error {
  constructor(
    message: string,
    readonly diagnostics: ReportDayStatsDiagnostics | null,
  ) {
    super(message);
    this.name = 'ReportDayStatsError';
  }
}

function hasErrorField(value: object, key: string): value is object & Record<string, unknown> {
  return key in value;
}

function errorField(error: unknown, key: string): unknown {
  if (typeof error !== 'object' || error === null || !hasErrorField(error, key)) return undefined;
  return error[key];
}

function stringField(error: unknown, key: string): string | null {
  const value = errorField(error, key);
  return typeof value === 'string' ? value : null;
}

function captureReportDayStatsError(error: unknown, parameters: ReportDayStatsParameters): ReportDayStatsError {
  const message = stringField(error, 'message');
  const diagnostics: ReportDayStatsDiagnostics = {
    code: stringField(error, 'code'),
    message: message ?? 'Erreur Supabase inconnue.',
    details: stringField(error, 'details'),
    hint: stringField(error, 'hint'),
    httpStatus: typeof errorField(error, 'status') === 'number' ? Number(errorField(error, 'status')) : null,
    ...parameters,
  };
  const lowerMessage = diagnostics.message.toLocaleLowerCase('fr');
  const displayMessage = !navigator.onLine
    || error instanceof TypeError
    || lowerMessage.includes('network')
    || lowerMessage.includes('fetch')
    || lowerMessage.includes('timeout')
    ? 'Pas de connexion. Réessayez une fois en ligne.'
    : 'Impossible de charger les jours. Réessayez.';
  return new ReportDayStatsError(displayMessage, diagnostics);
}

function frenchReportError(error: unknown, fallback: string): Error {
  const message = error instanceof Error ? error.message.toLocaleLowerCase('fr') : '';
  if (
    !navigator.onLine ||
    error instanceof TypeError ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout')
  ) {
    return new Error('Pas de connexion. Réessayez une fois en ligne.');
  }
  if (message.includes('réduisez la période')) return new Error('Réduisez la période (31 jours ou 2 000 enregistrés maximum).');
  return new Error(fallback);
}

export function reportDayStatsQueryOptions(filters: ReportDayFilters, userId = '') {
  return {
    queryKey: [...reportDayStatsKey, userId, filters],
    enabled: filters.enabled ?? true,
    queryFn: async () => {
      const parameters = buildReportDayStatsParameters(filters);
      try {
        const { data, error } = await supabase.rpc('report_day_stats', parameters);
        if (error) {
          if (import.meta.env.DEV) {
            console.error('report_day_stats failed', { code: error.code, message: error.message });
          }
          throw captureReportDayStatsError(error, parameters);
        }
        const payload: unknown = data;
        const rows = normalizeReportDayStats(payload);
        if (rows === null) {
          throw new ReportDayStatsError('Impossible de charger les jours. Réessayez.', {
            ...parameters,
            code: null,
            message: 'La fonction a renvoyé un format de statistiques inattendu (jour, agent_id, full_name et totaux attendus).',
            details: null,
            hint: null,
            httpStatus: null,
          });
        }
        return groupReportDayStats(rows);
      } catch (error) {
        if (error instanceof ReportDayStatsError) throw error;
        throw frenchReportError(error, 'Impossible de charger les jours. Réessayez.');
      }
    },
    staleTime: 30_000,
  };
}

export function useReportDayStats(filters: ReportDayFilters) {
  const { profile } = useAuth();
  return useQuery(reportDayStatsQueryOptions(filters, profile?.id ?? ''));
}

export function useEarliestReportDay(agentIds?: string[], enabled = true) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['earliest-report-day', profile?.id ?? '', agentIds],
    enabled,
    queryFn: async () => {
      try {
        let query = supabase
          .from('registrations')
          .select('send_day')
          .order('send_day', { ascending: true })
          .limit(1);
        if (agentIds?.length) query = query.in('agent_id', agentIds);
        const { data, error } = await query.maybeSingle().returns<{ send_day: string } | null>();
        if (error) throw error;
        return data?.send_day ?? null;
      } catch (error) {
        throw frenchReportError(error, 'Impossible de charger les jours. Réessayez.');
      }
    },
    staleTime: 60_000,
  });
}

export function useDayRegistrations(
  day: string,
  filters: { agentIds?: string[]; statuses?: RegistrationStatus[] } = {},
) {
  const { profile } = useAuth();
  return useInfiniteQuery({
    queryKey: [...dayRegistrationsKey, profile?.id ?? '', day, filters],
    enabled: Boolean(day),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      try {
        let query = supabase
          .from('registrations')
          .select('id, agent_id, day_seq, send_day, email, numero, description, status, amount, exported_at, created_at, profiles(full_name)')
          .eq('send_day', day)
          .order('created_at', { ascending: true })
          .range(pageParam, pageParam + 49);
        if (filters.agentIds?.length) query = query.in('agent_id', filters.agentIds);
        if (filters.statuses?.length) query = query.in('status', filters.statuses);
        const { data, error } = await query.returns<ReportRegistration[]>();
        if (error) throw error;
        return data;
      } catch (error) {
        throw frenchReportError(error, 'Impossible de charger les jours. Réessayez.');
      }
    },
    getNextPageParam: (lastPage, pages) => lastPage.length === 50 ? pages.reduce((count, page) => count + page.length, 0) : undefined,
  });
}

export function useReportRows(config: {
  from: string;
  to: string;
  agentIds?: string[];
  statuses?: RegistrationStatus[];
  enabled?: boolean;
}) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: [...reportRowsKey, profile?.id ?? '', config],
    enabled: config.enabled ?? Boolean(config.from && config.to),
    queryFn: async () => {
      try {
        if (config.statuses && config.statuses.length === 0) return [];
        const countQuery = supabase
          .from('registrations')
          .select('id', { count: 'exact', head: true })
          .gte('send_day', config.from)
          .lte('send_day', config.to);
        let filteredCountQuery = countQuery;
        if (config.agentIds?.length) filteredCountQuery = filteredCountQuery.in('agent_id', config.agentIds);
        if (config.statuses?.length) filteredCountQuery = filteredCountQuery.in('status', config.statuses);
        const counted = await filteredCountQuery;
        if (counted.error) throw counted.error;
        if (exceedsReportLimits(config.from, config.to, counted.count ?? 0)) {
          throw new Error('Réduisez la période (31 jours ou 2 000 enregistrés maximum).');
        }
        const result: ReportRegistration[] = [];
        for (let offset = 0; ; offset += 1000) {
          let query = supabase
            .from('registrations')
            .select('id, agent_id, day_seq, send_day, email, numero, description, status, amount, exported_at, created_at, profiles(full_name)')
            .gte('send_day', config.from)
            .lte('send_day', config.to)
            .order('send_day', { ascending: true })
            .order('created_at', { ascending: true })
            .range(offset, offset + 999);
          if (config.agentIds?.length) query = query.in('agent_id', config.agentIds);
          if (config.statuses?.length) query = query.in('status', config.statuses);
          const { data, error } = await query.returns<ReportRegistration[]>();
          if (error) throw error;
          result.push(...data);
          if (result.length > 2000) {
            throw new Error('Réduisez la période (31 jours ou 2 000 enregistrés maximum).');
          }
          if (data.length < 1000) return result;
        }
      } catch (error) {
        throw frenchReportError(error, 'Impossible de charger les jours. Réessayez.');
      }
    },
    staleTime: 30_000,
  });
}

export function useDayRegistrationById(registrationId: string, day?: string, enabled = true) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: [...dayRegistrationsKey, profile?.id ?? '', 'detail', registrationId, day],
    enabled: Boolean(enabled && registrationId && day),
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('registrations')
          .select('id, agent_id, day_seq, send_day, email, numero, description, status, amount, exported_at, created_at, profiles(full_name)')
          .eq('id', registrationId)
          .eq('send_day', day ?? '')
          .maybeSingle()
          .returns<ReportRegistration | null>();
        if (error) throw error;
        return data;
      } catch (error) {
        throw frenchReportError(error, 'Impossible de charger les jours. Réessayez.');
      }
    },
  });
}
