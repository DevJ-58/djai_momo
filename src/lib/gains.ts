import { formatAmount } from './format';
import { getAbidjanToday } from './registration-days';

export const GAINS_RULE_TEXT = 'Comptent dans le montant net : les enregistrés au statut Payé ou Gagné, à la date de confirmation du paiement.';

export type GainValues = { net: number; vp: number; recu: number };

export type GainsPeriod = {
  id: string;
  from: string | null;
  to: string | null;
  label: string;
};

export type GainsFilters = { from?: string | null; to?: string | null; agentIds?: string[] };

export type GainsSummaryRow = {
  agent_id: string;
  full_name: string;
  nb_recus: number;
  montant_net: number;
  dernier_gain: string | null;
};

export type GainsDailyRow = { jour: string; nb_recus: number; montant_net: number };

export function computeGains(net: number): GainValues {
  return { net, vp: net / 2, recu: net / 4 };
}

export function formatGain(value: number): string {
  return formatAmount(Math.round(value));
}

export function normalizeGainNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

export function normalizeGainsSummary(value: unknown): GainsSummaryRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): GainsSummaryRow[] => {
    if (typeof item !== 'object' || item === null) return [];
    const row = item as Record<string, unknown>;
    if (typeof row.agent_id !== 'string' || typeof row.full_name !== 'string') return [];
    return [{
      agent_id: row.agent_id,
      full_name: row.full_name,
      nb_recus: normalizeGainNumber(row.nb_recus),
      montant_net: normalizeGainNumber(row.montant_net),
      dernier_gain: typeof row.dernier_gain === 'string' ? row.dernier_gain : null,
    }];
  });
}

export function normalizeGainsDaily(value: unknown): GainsDailyRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): GainsDailyRow[] => {
    if (typeof item !== 'object' || item === null) return [];
    const row = item as Record<string, unknown>;
    if (typeof row.jour !== 'string') return [];
    return [{
      jour: row.jour,
      nb_recus: normalizeGainNumber(row.nb_recus),
      montant_net: normalizeGainNumber(row.montant_net),
    }];
  });
}

function shiftDay(day: string, offset: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, date + offset, 12));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`;
}

function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function gainsPeriodFromSearch(search: string | URLSearchParams, today = getAbidjanToday()): GainsPeriod {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const from = params.get('du');
  const to = params.get('au');
  if (from && to && isDay(from) && isDay(to) && from <= to && to <= today) {
    return { id: 'custom', from, to, label: `${formatGainDay(from)} – ${formatGainDay(to)}` };
  }
  const period = params.get('periode');
  const presets: Record<string, GainsPeriod> = {
    today: { id: 'today', from: today, to: today, label: `Aujourd'hui · ${formatGainDay(today)}` },
    yesterday: { id: 'yesterday', from: shiftDay(today, -1), to: shiftDay(today, -1), label: `Hier · ${formatGainDay(shiftDay(today, -1))}` },
    '7': { id: '7', from: shiftDay(today, -6), to: today, label: `7 jours · ${formatGainDay(shiftDay(today, -6))} – ${formatGainDay(today)}` },
    '30': { id: '30', from: shiftDay(today, -29), to: today, label: `30 jours · ${formatGainDay(shiftDay(today, -29))} – ${formatGainDay(today)}` },
    month: { id: 'month', from: monthStart(today), to: today, label: `Ce mois-ci · ${formatGainDay(monthStart(today))} – ${formatGainDay(today)}` },
  };
  return period && presets[period] ? presets[period] : { id: 'all', from: null, to: null, label: 'Tout' };
}

export function formatGainDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  const label = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Abidjan',
  }).format(new Date(Date.UTC(year, month - 1, date, 12)));
  return label.charAt(0).toLocaleUpperCase('fr-FR') + label.slice(1);
}

function isDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, date] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, date, 12));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === date;
}

export function gainsRpcParameters(filters: GainsFilters) {
  const agentIds = filters.agentIds?.length ? filters.agentIds : null;
  if ((filters.from && !isDay(filters.from)) || (filters.to && !isDay(filters.to))) {
    throw new Error('Les dates des gains doivent respecter le format AAAA-MM-JJ.');
  }
  if (filters.from && filters.to && filters.from > filters.to) {
    throw new Error('La date de fin des gains ne peut pas précéder la date de début.');
  }
  return {
    p_from: filters.from || null,
    p_to: filters.to || null,
    p_agent_ids: agentIds,
  };
}
