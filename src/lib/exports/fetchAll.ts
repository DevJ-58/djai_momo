import { supabase } from '../supabase';
import { adminErrorMessage } from '../admin-errors';
import type { RegistrationExportRow, RegistrationStatus } from '../../types/database';

export type RegistrationExportFilters = {
  status?: RegistrationStatus | null;
  agentId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  exported?: 'all' | 'exported' | 'not_exported';
  agentName?: string;
};

export type FetchAllResult = {
  rows: RegistrationExportRow[];
  truncated: boolean;
};

const PAGE_SIZE = 1000;
const MAX_ROWS = 5000;

export async function fetchAllRegistrations(
  filters: RegistrationExportFilters,
  onProgress?: (loaded: number) => void,
): Promise<FetchAllResult> {
  const rows: RegistrationExportRow[] = [];

  for (let page = 0; page < MAX_ROWS / PAGE_SIZE; page += 1) {
    let query = supabase
      .from('registrations')
      .select('id, agent_id, seq, send_day, day_seq, email, mdp, status, amount, admin_note, confirmed_at, exported_at, created_at, profiles!inner(full_name, whatsapp)')
      .order('send_day', { ascending: true })
      .order('day_seq', { ascending: true });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.agentId) query = query.eq('agent_id', filters.agentId);
    if (filters.agentName) query = query.ilike('profiles.full_name', `%${filters.agentName}%`);
    if (filters.search) query = query.ilike('email', `%${filters.search}%`);
    if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00Z`);
    if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);
    if (filters.exported === 'exported') query = query.not('exported_at', 'is', null);
    if (filters.exported === 'not_exported') query = query.is('exported_at', null);

    const { data, error } = await query
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .returns<RegistrationExportRow[]>();
    if (error) throw new Error(adminErrorMessage(error));

    rows.push(...data);
    onProgress?.(rows.length);
    if (data.length < PAGE_SIZE) return { rows, truncated: false };
  }

  let probe = supabase
    .from('registrations')
    .select('id, profiles!inner(full_name)')
    .order('send_day', { ascending: true })
    .order('day_seq', { ascending: true });
  if (filters.status) probe = probe.eq('status', filters.status);
  if (filters.agentId) probe = probe.eq('agent_id', filters.agentId);
  if (filters.agentName) probe = probe.ilike('profiles.full_name', `%${filters.agentName}%`);
  if (filters.search) probe = probe.ilike('email', `%${filters.search}%`);
  if (filters.dateFrom) probe = probe.gte('created_at', `${filters.dateFrom}T00:00:00Z`);
  if (filters.dateTo) probe = probe.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);
  if (filters.exported === 'exported') probe = probe.not('exported_at', 'is', null);
  if (filters.exported === 'not_exported') probe = probe.is('exported_at', null);

  const { data, error } = await probe.range(MAX_ROWS, MAX_ROWS);
  if (error) throw new Error(adminErrorMessage(error));
  return { rows, truncated: data.length > 0 };
}
