import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { registrationStatusErrorMessage } from '../lib/registration-errors';
import { REGISTRATION_STATUSES, type RegistrationStatus, type StatusHistoryEntry } from '../types/database';

export const registrationHistoryKey = (registrationId: string) => (
  ['registration-history', registrationId] as const
);

function isRegistrationStatus(value: unknown): value is RegistrationStatus {
  return typeof value === 'string' && REGISTRATION_STATUSES.some((status) => status === value);
}

function isStatusHistoryEntry(value: unknown): value is StatusHistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const fromStatus = 'from_status' in value ? value.from_status : undefined;
  const toStatus = 'to_status' in value ? value.to_status : undefined;
  const amount = 'amount' in value ? value.amount : undefined;
  const note = 'note' in value ? value.note : undefined;
  const adminName = 'changed_by_name' in value ? value.changed_by_name : undefined;
  const createdAt = 'created_at' in value ? value.created_at : undefined;

  return (fromStatus === null || isRegistrationStatus(fromStatus)) &&
    isRegistrationStatus(toStatus) &&
    (amount === null || typeof amount === 'number') &&
    (note === null || typeof note === 'string') &&
    (adminName === null || typeof adminName === 'string') &&
    typeof createdAt === 'string';
}

export function useRegistrationHistory(registrationId: string) {
  return useQuery({
    queryKey: registrationHistoryKey(registrationId),
    enabled: Boolean(registrationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_registration_history', { p_registration_id: registrationId });
      if (error) throw new Error(registrationStatusErrorMessage(error));
      const rows: unknown = data;
      if (!Array.isArray(rows) || !rows.every(isStatusHistoryEntry)) {
        throw new Error('Impossible de charger l’historique.');
      }
      return rows;
    },
    refetchOnWindowFocus: true,
  });
}
