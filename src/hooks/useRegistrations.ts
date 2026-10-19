import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { registrationErrorMessage } from '../lib/registration-errors';
import { registrationSearchFilter } from '../lib/registration-search';
import type { RegistrationFilters, RegistrationListItem } from '../types/database';

export const registrationListKey = ['registrations'] as const;
export const registrationStatsKey = ['my-stats'] as const;
export const registrationByIdKey = (registrationId: string) => ['registrations', 'detail', registrationId] as const;
export const registrationReceiverResultKey = (registrationId: string) => ['registration-receiver-result', registrationId] as const;
const PAGE_SIZE = 20;

export type RegistrationReceiverResult = {
  result: 'gagne' | 'echec' | 'renonce' | null;
  amount: number | null;
  note: string | null;
  recordedAt: string | null;
};

function stringField(value: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    if (typeof value[key] === 'string') return value[key] as string;
  }
  return null;
}

function amountField(value: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const field = value[key];
    if (typeof field === 'number' && Number.isFinite(field)) return field;
    if (typeof field === 'string' && field.trim() !== '' && Number.isFinite(Number(field))) return Number(field);
  }
  return null;
}

function normalizeReceiverResult(value: unknown): RegistrationReceiverResult | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const resultValue = stringField(row, 'result', 'receiver_result');
  const result = resultValue === 'gagne' || resultValue === 'echec' || resultValue === 'renonce'
    ? resultValue
    : null;
  return {
    result,
    amount: amountField(row, 'prize_amount', 'prize', 'amount'),
    note: stringField(row, 'result_note', 'receiver_note', 'note'),
    recordedAt: stringField(row, 'result_at', 'receiver_result_at', 'completed_at', 'updated_at'),
  };
}

export function useRegistrations({ status, search }: RegistrationFilters) {
  return useInfiniteQuery({
    queryKey: [...registrationListKey, { status, search }],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('registrations')
        .select('id, seq, send_day, day_seq, email, mdp, numero, description, status, amount, admin_note, confirmed_at, exported_at, created_at')
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (search) query = query.or(registrationSearchFilter(search));

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

export async function fetchRegistrationById(registrationId: string): Promise<RegistrationListItem> {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, seq, send_day, day_seq, email, mdp, numero, description, status, amount, admin_note, confirmed_at, exported_at, created_at')
    .eq('id', registrationId)
    .maybeSingle()
    .returns<RegistrationListItem | null>();
  if (error) throw new Error(registrationErrorMessage(error));
  if (!data) throw new Error('Cet enregistré n’existe plus.');
  return data;
}

export function useRegistrationById(registrationId: string) {
  return useQuery({
    queryKey: registrationByIdKey(registrationId),
    enabled: Boolean(registrationId),
    queryFn: () => fetchRegistrationById(registrationId),
    refetchOnWindowFocus: true,
  });
}

export function useRegistrationReceiverResult(registrationId: string) {
  return useQuery({
    queryKey: registrationReceiverResultKey(registrationId),
    enabled: Boolean(registrationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receiver_items')
        .select('*')
        .eq('id', registrationId)
        .maybeSingle();
      if (error) throw new Error(registrationErrorMessage(error));
      return normalizeReceiverResult(data);
    },
    refetchOnWindowFocus: true,
  });
}
