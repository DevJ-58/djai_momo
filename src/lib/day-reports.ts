import { z } from 'zod';
import { formatAmount, toTitleCase } from './format';
import { REGISTRATION_STATUSES, type RegistrationStatus } from '../types/database';

export type ReportDayStatsRow = {
  day: string;
  agent_id: string;
  full_name: string;
  total: number;
  en_attente: number;
  gagne: number;
  paye: number;
  refuse: number;
  echec: number;
  renonce: number;
  autres: number;
  amount_gagne: number;
  amount_paye: number;
  envoyes: number;
  non_envoyes: number;
  first_at: string | null;
  last_at: string | null;
};

type ReportDayStatsRpcRow = Record<string, unknown> & {
  jour: string;
  agent_id: string;
  full_name: string;
  total: number;
  en_attente: number;
  gagne: number;
  paye: number;
  refuse: number;
  echec: number;
  renonce: number;
  autres: number;
  amount_gagne: number;
  amount_paye: number;
  envoyes: number;
  non_envoyes: number;
  first_at: string | null;
  last_at: string | null;
};

function isReportDayStatsRpcRow(value: unknown): value is ReportDayStatsRpcRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  const counts = [
    'total', 'en_attente', 'gagne', 'paye', 'refuse', 'echec', 'renonce',
    'autres', 'amount_gagne', 'amount_paye', 'envoyes', 'non_envoyes',
  ] as const;
  return typeof row.jour === 'string'
    && typeof row.agent_id === 'string'
    && typeof row.full_name === 'string'
    && counts.every((field) => typeof row[field] === 'number')
    && (typeof row.first_at === 'string' || row.first_at === null)
    && (typeof row.last_at === 'string' || row.last_at === null);
}

export function normalizeReportDayStats(payload: unknown): ReportDayStatsRow[] | null {
  if (payload === null) return [];
  if (!Array.isArray(payload)) return null;

  const rows: ReportDayStatsRow[] = [];
  for (const value of payload) {
    if (!isReportDayStatsRpcRow(value)) return null;

    rows.push({
      day: value.jour,
      agent_id: value.agent_id,
      full_name: value.full_name,
      total: value.total,
      en_attente: value.en_attente,
      gagne: value.gagne,
      paye: value.paye,
      refuse: value.refuse,
      echec: value.echec,
      renonce: value.renonce,
      autres: value.autres,
      amount_gagne: value.amount_gagne,
      amount_paye: value.amount_paye,
      envoyes: value.envoyes,
      non_envoyes: value.non_envoyes,
      first_at: value.first_at,
      last_at: value.last_at,
    });
  }
  return rows;
}

export type DayTotals = Omit<ReportDayStatsRow, 'agent_id' | 'full_name'> & {
  users: Array<Pick<ReportDayStatsRow, 'agent_id' | 'full_name' | 'total' | 'en_attente' | 'gagne' | 'paye' | 'refuse' | 'echec' | 'renonce' | 'autres' | 'amount_gagne' | 'amount_paye' | 'envoyes' | 'non_envoyes' | 'first_at' | 'last_at'>>;
};

export type ReportRegistration = {
  id: string;
  agent_id: string;
  day_seq: number;
  send_day: string;
  email: string;
  numero: string | null;
  description: string | null;
  status: RegistrationStatus;
  amount: number | null;
  exported_at: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
};

export type AgentDailyReportRegistration = Pick<
  ReportRegistration,
  'day_seq' | 'email' | 'status' | 'amount' | 'created_at'
>;

export function buildAgentDailyReportText(
  day: string,
  agentName: string,
  rows: readonly AgentDailyReportRegistration[],
): string {
  const ordered = [...rows].sort((first, second) => first.created_at.localeCompare(second.created_at));
  const [year, month, date] = day.split('-').map(Number);
  const dateValue = new Date(Date.UTC(year, month - 1, date, 12));
  const titleDate = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Africa/Abidjan',
  }).format(dateValue);
  const weekday = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', timeZone: 'Africa/Abidjan',
  }).format(dateValue);
  const counts = reportStatusCounts(ordered);
  const statusOrder: RegistrationStatus[] = ['gagne', 'paye', 'echec', 'renonce', 'en_attente', 'refuse', 'probleme'];
  const statusLines = statusOrder
    .filter((status) => counts[status] > 0)
    .map((status) => {
      const label = status === 'en_attente' ? 'En attente'
        : status === 'gagne' ? 'Gagnés'
          : status === 'paye' ? 'Payés'
            : status === 'refuse' ? 'Refusés'
              : status === 'echec' ? 'Échecs'
                : status === 'renonce' ? 'Renoncés'
                  : 'Problèmes';
      const amount = status === 'gagne' || status === 'paye'
        ? ordered.filter((row) => row.status === status).reduce((sum, row) => sum + (row.amount ?? 0), 0)
        : 0;
      return `${label} : ${counts[status]}${amount > 0 ? ` (${formatAmount(amount)})` : ''}`;
    });
  const detailLines = ordered.map((row) => {
    const label = row.status === 'en_attente' ? 'En attente'
      : row.status === 'gagne' ? 'Gagné'
        : row.status === 'paye' ? 'Payé'
          : row.status === 'refuse' ? 'Refusé'
            : row.status === 'echec' ? 'Échec'
              : row.status === 'renonce' ? 'Renoncé'
                : 'Problème';
    return [
      formatReportTime(row.created_at),
      `n°${row.day_seq}`,
      row.email,
      label,
      ...(row.amount === null ? [] : [formatAmount(row.amount)]),
    ].join(' · ');
  });
  return [
    `*RAPPORT DU ${titleDate} (${weekday}) — ${toTitleCase(agentName)}*`,
    `Total : ${ordered.length} enregistrés`,
    ...(statusLines.length ? [statusLines.join(' · ')] : []),
    '',
    '*Détail*',
    ...detailLines,
  ].join('\n');
}

export type ReportShareResult = 'shared' | 'copied' | 'cancelled';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readAdminDayUserFilter(search: string | URLSearchParams, isAgent = false): string | null {
  if (isAgent) return null;
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const value = params.get('u');
  return value && UUID_PATTERN.test(value) ? value : null;
}

export async function shareReportOrCopy(
  text: string,
  share: ((data: { text: string }) => Promise<void>) | undefined,
  copy: (value: string) => Promise<void>,
): Promise<ReportShareResult> {
  if (!share) {
    await copy(text);
    return 'copied';
  }
  try {
    await share({ text });
    return 'shared';
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') {
      return 'cancelled';
    }
    await copy(text);
    return 'copied';
  }
}

export type ReportDayStatsParameters = {
  p_from: string | null;
  p_to: string | null;
  p_agent_ids: string[] | null;
};

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function buildReportDayStatsParameters(filters: {
  from?: string;
  to?: string;
  agentIds?: string[];
}): ReportDayStatsParameters {
  const parameters: ReportDayStatsParameters = {
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_agent_ids: filters.agentIds?.length ? [...filters.agentIds] : null,
  };
  if ((parameters.p_from !== null && !isIsoDate(parameters.p_from))
    || (parameters.p_to !== null && !isIsoDate(parameters.p_to))) {
    throw new RangeError('Les dates de rapport doivent respecter le format AAAA-MM-JJ.');
  }
  return parameters;
}

const sumFields = [
  'total', 'en_attente', 'gagne', 'paye', 'refuse', 'echec', 'renonce',
  'autres', 'amount_gagne', 'amount_paye', 'envoyes', 'non_envoyes',
] as const;

export function groupReportDayStats(rows: readonly ReportDayStatsRow[]): DayTotals[] {
  const grouped = new Map<string, DayTotals>();
  for (const row of rows) {
    const existing = grouped.get(row.day);
    if (!existing) {
      grouped.set(row.day, {
        day: row.day,
        total: row.total,
        en_attente: row.en_attente,
        gagne: row.gagne,
        paye: row.paye,
        refuse: row.refuse,
        echec: row.echec,
        renonce: row.renonce,
        autres: row.autres,
        amount_gagne: row.amount_gagne,
        amount_paye: row.amount_paye,
        envoyes: row.envoyes,
        non_envoyes: row.non_envoyes,
        first_at: row.first_at,
        last_at: row.last_at,
        users: [row],
      });
      continue;
    }
    for (const field of sumFields) existing[field] += row[field];
    if (row.first_at && (!existing.first_at || row.first_at < existing.first_at)) existing.first_at = row.first_at;
    if (row.last_at && (!existing.last_at || row.last_at > existing.last_at)) existing.last_at = row.last_at;
    existing.users.push(row);
  }
  return [...grouped.values()].sort((first, second) => second.day.localeCompare(first.day));
}

export function formatReportDate(day: string, options: Intl.DateTimeFormatOptions = {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}): string {
  const [year, month, date] = day.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, date, 12));
  return new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'Africa/Abidjan' }).format(value);
}

export function formatReportTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date);
}

export function getDayBounds(now = new Date()): { today: string; yesterday: string } {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Abidjan', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const [year, month, date] = today.split('-').map(Number);
  const yesterday = new Date(Date.UTC(year, month - 1, date - 1, 12));
  return {
    today,
    yesterday: `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterday.getUTCDate()).padStart(2, '0')}`,
  };
}

export function isValidReportDay(day: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(day) || day > today) return false;
  const [year, month, date] = day.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, date, 12));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === date;
}

export function filterReportRows(rows: readonly ReportRegistration[], statuses: readonly RegistrationStatus[], agentIds: readonly string[]): ReportRegistration[] {
  return rows.filter((row) => statuses.includes(row.status) && (agentIds.length === 0 || agentIds.includes(row.agent_id)));
}

export type ReportSections = { summary: boolean; users: boolean; details: boolean };
export type ReportColumn = 'time' | 'user' | 'number' | 'identifier' | 'phone' | 'status' | 'amount' | 'whatsapp' | 'description';

export type ReportConfig = {
  name: string;
  sections: ReportSections;
  columns: ReportColumn[];
  statuses: RegistrationStatus[];
  sort: 'time' | 'user';
};

export const DEFAULT_REPORT_COLUMNS: ReportColumn[] = ['time', 'user', 'number', 'identifier', 'status', 'amount', 'whatsapp'];

export const reportConfigSchema = z.object({
  name: z.string().trim().min(1).max(30),
  sections: z.object({ summary: z.boolean(), users: z.boolean(), details: z.boolean() }),
  columns: z.array(z.enum(['time', 'user', 'number', 'identifier', 'phone', 'status', 'amount', 'whatsapp', 'description'])),
  statuses: z.array(z.enum(REGISTRATION_STATUSES)),
  sort: z.enum(['time', 'user']),
}).strict();

export const savedReportModelsSchema = z.array(reportConfigSchema).max(10);
export type SavedReportModel = z.infer<typeof reportConfigSchema>;
export const lastReportConfigSchema = z.object({
  rangeKind: z.enum(['day', '7', 'month', 'custom']),
  from: z.string(),
  to: z.string(),
  agentIds: z.array(z.string()),
  statuses: z.array(z.enum(REGISTRATION_STATUSES)),
  sections: z.object({ summary: z.boolean(), users: z.boolean(), details: z.boolean() }),
  columns: z.array(z.enum(['time', 'user', 'number', 'identifier', 'phone', 'status', 'amount', 'whatsapp', 'description'])),
  sort: z.enum(['time', 'user']),
  title: z.string().max(80),
  note: z.string().max(300),
}).strict();

function safeCsvCell(value: string): string {
  const neutralized = /^[=+\-@]/u.test(value) ? `'${value}` : value;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export function buildReportCsv(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(safeCsvCell).join(';')).join('\r\n')}`;
}

function statusSummary(row: ReportRegistration): string {
  const label = row.status === 'en_attente' ? 'En attente'
    : row.status === 'gagne' ? 'Gagné'
      : row.status === 'paye' ? 'Payé'
        : row.status === 'refuse' ? 'Refusé'
          : row.status === 'echec' ? 'Échec'
            : row.status === 'renonce' ? 'Renoncé'
              : 'Problème';
  return `${label}${row.amount === null ? '' : ` (${formatAmount(row.amount)})`}`;
}

export function buildReportText(title: string, rows: readonly ReportRegistration[], config: ReportConfig, note: string): string {
  const ordered = [...rows].sort((a, b) => a.send_day.localeCompare(b.send_day) || (
    config.sort === 'user'
      ? toTitleCase(a.profiles?.full_name ?? '').localeCompare(toTitleCase(b.profiles?.full_name ?? ''), 'fr')
        || a.created_at.localeCompare(b.created_at)
      : a.created_at.localeCompare(b.created_at)
  ));
  const uniqueDays = [...new Set(ordered.map((row) => row.send_day))];
  const lines = [`*${title.toLocaleUpperCase('fr-FR')}*`];
  if (config.sections.summary) {
    const gained = ordered.filter((row) => row.status === 'gagne');
    const paid = ordered.filter((row) => row.status === 'paye');
    const counts = reportStatusCounts(ordered);
    lines.push(`Total : ${ordered.length} enregistrés · ${new Set(ordered.map((row) => row.agent_id)).size} utilisateurs`);
    lines.push([
      `Gagnés : ${counts.gagne}${counts.gagne ? ` (${formatAmount(gained.reduce((sum, row) => sum + (row.amount ?? 0), 0))})` : ''}`,
      `Payés : ${counts.paye}${counts.paye ? ` (${formatAmount(paid.reduce((sum, row) => sum + (row.amount ?? 0), 0))})` : ''}`,
      `Échecs : ${counts.echec}`,
      `Renoncés : ${counts.renonce}`,
      `En attente : ${counts.en_attente}`,
      `Refusés : ${counts.refuse}`,
      `Problèmes : ${counts.probleme}`,
    ].filter((item, index) => index < 2 || Number(item.match(/\d+/u)?.[0] ?? 0) > 0).join(' · '));
  }
  if (config.sections.users) {
    lines.push('', '*Par utilisateur*');
    const names = new Map<string, ReportRegistration[]>();
    for (const row of ordered) {
      const current = names.get(row.agent_id) ?? [];
      current.push(row);
      names.set(row.agent_id, current);
    }
    for (const values of names.values()) {
      const counts = reportStatusCounts(values);
      const details = REGISTRATION_STATUSES
        .filter((status) => counts[status] > 0)
        .map((status) => `${counts[status]} ${status === 'en_attente' ? 'en attente' : status === 'gagne' ? 'gagnés' : status === 'paye' ? 'payés' : status === 'refuse' ? 'refusés' : status === 'echec' ? 'échecs' : status === 'renonce' ? 'renoncés' : 'problèmes'}`)
        .join(', ');
      lines.push(`• ${toTitleCase(values[0].profiles?.full_name ?? 'Utilisateur')} : ${values.length} (${details})`);
    }
  }
  if (config.sections.details) {
    lines.push('', '*Détail*');
    for (const day of uniqueDays) {
      lines.push(`*${formatReportDate(day)}*`);
      for (const row of ordered.filter((item) => item.send_day === day)) {
        const values: Partial<Record<ReportColumn, string>> = {
          time: formatReportTime(row.created_at),
          user: toTitleCase(row.profiles?.full_name ?? '—'),
          number: `n°${row.day_seq}`,
          identifier: row.email,
          phone: row.numero ?? '—',
          status: statusSummary(row),
          amount: row.amount === null ? '—' : formatAmount(row.amount),
          whatsapp: row.exported_at ? `Envoyé ${formatReportTime(row.exported_at)}` : 'Non envoyé',
          description: row.description ?? '—',
        };
        lines.push(config.columns.map((column) => values[column] ?? '').join(' · '));
      }
    }
  }
  if (note.trim()) lines.push('', note.trim());
  return lines.join('\n');
}

export function exceedsReportLimits(from: string, to: string, count: number): boolean {
  const fromTime = Date.parse(`${from}T12:00:00Z`);
  const toTime = Date.parse(`${to}T12:00:00Z`);
  return !Number.isFinite(fromTime) || !Number.isFinite(toTime) || toTime < fromTime
    || (toTime - fromTime) / 86_400_000 + 1 > 31 || count > 2000;
}

export function reportStatusCounts(rows: readonly Pick<ReportRegistration, 'status'>[]): Record<RegistrationStatus, number> {
  const counts = Object.fromEntries(REGISTRATION_STATUSES.map((status) => [status, 0])) as Record<RegistrationStatus, number>;
  for (const row of rows) counts[row.status] += 1;
  return counts;
}
