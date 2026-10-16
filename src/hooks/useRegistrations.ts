import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { registrationErrorMessage } from '../lib/registration-errors';
import type { RegistrationFilters, RegistrationListItem } from '../types/database';

export const registrationListKey = ['registrations'] as const;
export const registrationStatsKey = ['my-stats'] as const;
export const registrationByIdKey = (registrationId: string) => ['registrations', 'detail', registrationId] as const;
const PAGE_SIZE = 20;

export function useRegistrations({ status, search }: RegistrationFilters) {
  return useInfiniteQuery({
    queryKey: [...registrationListKey, { status, search }],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('registrations')
        .select('id, seq, email, mdp, status, amount, admin_note, confirmed_at, exported_at, created_at')
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (search) query = query.ilike('email', `%${search}%`);

      const { data, error } = await query
        .range(pageParam * PAGE_SIZE, pageParam * PAGE_SIZE + PAGE_SIZE - 1)
        .returns<RegistrationListItem[]>();

      if (error) throw new Error(registrationErrorMessage(error));
      return data;
    },
    getNextPageParam: (lastPage, pages) => (
      lastPage.length === PAGE_SIZE ? pages.length : undefined
    ),
    refetchOnWindowFocus: true,
  });
}

export function useRegistrationById(registrationId: string) {
  return useQuery({
    queryKey: registrationByIdKey(registrationId),
    enabled: Boolean(registrationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('registrations')
        .select('id, seq, email, mdp, status, amount, admin_note, confirmed_at, exported_at, created_at')
        .eq('id', registrationId)
        .maybeSingle()
        .returns<RegistrationListItem | null>();
      if (error) throw new Error(registrationErrorMessage(error));
      if (!data) throw new Error('Cet enregistré n’existe plus.');
      return data;
    },
    refetchOnWindowFocus: true,
  });
}
