import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { registrationErrorMessage } from '../lib/registration-errors';
import { registrationStatsKey } from './useRegistrations';
import type { AgentStats } from '../types/database';

const emptyStats: AgentStats = {
  total: 0,
  payes: 0,
  en_attente: 0,
  refuses: 0,
  problemes: 0,
  montant_total: 0,
};

export function useMyStats() {
  return useQuery({
    queryKey: registrationStatsKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_stats').returns<AgentStats>().maybeSingle();
      if (error) throw new Error(registrationErrorMessage(error));
      return data ?? emptyStats;
    },
    refetchOnWindowFocus: true,
  });
}
