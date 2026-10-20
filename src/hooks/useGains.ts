import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { gainsRpcParameters, normalizeGainsDaily, normalizeGainsSummary, type GainsFilters } from '../lib/gains';
import { useAuth, type UserRole } from './useAuth';

export const gainsSummaryKey = ['gains', 'summary'] as const;
export const gainsDailyKey = ['gains', 'daily'] as const;

export class GainsQueryError extends Error {
  constructor(message: string, readonly technical: { code: string | null; message: string; parameters: ReturnType<typeof gainsRpcParameters> } | null) {
    super(message);
    this.name = 'GainsQueryError';
  }
}

function safeError(error: unknown, parameters: ReturnType<typeof gainsRpcParameters>): GainsQueryError {
  const message = error instanceof Error ? error.message.toLocaleLowerCase('fr') : '';
  const offline = !navigator.onLine || error instanceof TypeError || message.includes('network') || message.includes('fetch');
  const technical = typeof error === 'object' && error !== null
    ? {
      code: 'code' in error && typeof error.code === 'string' ? error.code : null,
      message: 'message' in error && typeof error.message === 'string' ? error.message : 'Erreur inconnue.',
      parameters,
    }
    : null;
  if (technical && import.meta.env.DEV) {
    console.error('Gains RPC failed', { code: technical.code, message: technical.message });
  }
  return new GainsQueryError(offline ? 'Pas de connexion. Réessayez une fois en ligne.' : 'Impossible de charger les gains. Réessayez.', technical);
}

function scopedFilters(filters: GainsFilters, profileId: string | undefined, role: UserRole | null): GainsFilters {
  return role === 'agent'
    ? { ...filters, agentIds: profileId ? [profileId] : [] }
    : filters;
}

export function useGainsSummary(filters: GainsFilters) {
  const { profile, role } = useAuth();
  const selected = scopedFilters(filters, profile?.id, role);
  const parameters = gainsRpcParameters(selected);
  return useQuery({
    queryKey: [...gainsSummaryKey, profile?.id ?? '', parameters],
    enabled: role === 'admin' || (role === 'agent' && Boolean(profile?.id)),
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('gains_summary', parameters);
        if (error) throw error;
        return normalizeGainsSummary(data);
      } catch (error) {
        throw safeError(error, parameters);
      }
    },
    refetchOnWindowFocus: true,
  });
}

export function useGainsDaily(filters: GainsFilters) {
  const { profile, role } = useAuth();
  const selected = scopedFilters(filters, profile?.id, role);
  const parameters = gainsRpcParameters(selected);
  return useQuery({
    queryKey: [...gainsDailyKey, profile?.id ?? '', parameters],
    enabled: role === 'admin' || (role === 'agent' && Boolean(profile?.id)),
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('gains_daily', parameters);
        if (error) throw error;
        return normalizeGainsDaily(data);
      } catch (error) {
        throw safeError(error, parameters);
      }
    },
    refetchOnWindowFocus: true,
  });
}
