import { describe, expect, it, vi } from 'vitest';
import {
  buildReportDayStatsParameters,
  buildAgentDailyReportText,
  buildReportCsv,
  buildReportText,
  DEFAULT_REPORT_COLUMNS,
  exceedsReportLimits,
  getDayBounds,
  formatReportTime,
  groupReportDayStats,
  isValidReportDay,
  normalizeReportDayStats,
  reportStatusCounts,
  readAdminDayUserFilter,
  savedReportModelsSchema,
  shareReportOrCopy,
  type AgentDailyReportRegistration,
  type ReportDayStatsRow,
  type ReportRegistration,
} from './day-reports';
import { REGISTRATION_STATUSES } from '../types/database';

const makeStats = (agentId: string, values: Partial<ReportDayStatsRow> = {}): ReportDayStatsRow => ({
  day: '2026-10-19',
  agent_id: agentId,
  full_name: `Agent ${agentId}`,
  total: 2,
  en_attente: 1,
  gagne: 1,
  paye: 0,
  refuse: 0,
  echec: 0,
  renonce: 0,
  autres: 0,
  amount_gagne: 5000,
  amount_paye: 0,
  envoyes: 1,
  non_envoyes: 1,
  first_at: '2026-10-19T08:00:00Z',
  last_at: '2026-10-19T09:00:00Z',
  ...values,
});

const makeRegistration = (values: Partial<ReportRegistration> = {}): ReportRegistration => ({
  id: 'id-1',
  agent_id: 'agent-1',
  day_seq: 19,
  send_day: '2026-10-19',
  email: 'person@example.test',
  numero: null,
  description: null,
  status: 'gagne',
  amount: 5000,
  exported_at: null,
  created_at: '2026-10-19T09:12:00Z',
  profiles: { full_name: 'agent test' },
  ...values,
});

describe('day reports', () => {
  it('uses Abidjan day boundaries and rejects future or invalid day strings', () => {
    expect(getDayBounds(new Date('2026-10-18T23:59:59.999Z'))).toEqual({
      today: '2026-10-18', yesterday: '2026-10-17',
    });
    expect(getDayBounds(new Date('2026-10-19T00:00:00.000Z'))).toEqual({
      today: '2026-10-19', yesterday: '2026-10-18',
    });
    expect(isValidReportDay('2026-10-19', '2026-10-19')).toBe(true);
    expect(isValidReportDay('2026-02-30', '2026-10-19')).toBe(false);
    expect(isValidReportDay('2026-10-20', '2026-10-19')).toBe(false);
    expect(formatReportTime('2026-10-19T09:12:00.000Z')).toBe('09:12');
  });

  it('sends exact RPC argument names with nulls for absent filters and valid date strings', () => {
    expect(buildReportDayStatsParameters({})).toEqual({
      p_from: null,
      p_to: null,
      p_agent_ids: null,
    });
    expect(buildReportDayStatsParameters({
      from: '2026-10-01',
      to: '2026-10-19',
      agentIds: [],
    })).toEqual({
      p_from: '2026-10-01',
      p_to: '2026-10-19',
      p_agent_ids: null,
    });
    expect(buildReportDayStatsParameters({
      from: '2026-10-01',
      to: '2026-10-19',
      agentIds: ['agent-uuid'],
    })).toEqual({
      p_from: '2026-10-01',
      p_to: '2026-10-19',
      p_agent_ids: ['agent-uuid'],
    });
    expect(() => buildReportDayStatsParameters({ from: '2026-2-01' })).toThrow('AAAA-MM-JJ');
  });

  it('reads only a valid admin user filter from the URL and ignores agent filters', () => {
    const id = '123e4567-e89b-42d3-a456-426614174000';
    expect(readAdminDayUserFilter(`?u=${id}`)).toBe(id);
    expect(readAdminDayUserFilter('?u=invalid')).toBeNull();
    expect(readAdminDayUserFilter('?u=')).toBeNull();
    expect(readAdminDayUserFilter(`?u=${id}`, true)).toBeNull();
  });

  it('builds a password-free agent report in chronological order with amounts', () => {
    const rowsWithPrivateFields = [
      { day_seq: 2, email: 'second@example.test', status: 'paye' as const, amount: 9000, created_at: '2026-10-19T09:14:00Z', mdp: 'SECRET_PASSWORD', numero: 'SECRET_NUMBER', description: 'SECRET_DESCRIPTION' },
      { day_seq: 1, email: 'first@example.test', status: 'gagne' as const, amount: 18000, created_at: '2026-10-19T08:12:00Z', mdp: 'SECRET_PASSWORD', numero: 'SECRET_NUMBER', description: 'SECRET_DESCRIPTION' },
      { day_seq: 3, email: 'waiting@example.test', status: 'en_attente' as const, amount: null, created_at: '2026-10-19T10:00:00Z', mdp: 'SECRET_PASSWORD', numero: 'SECRET_NUMBER', description: 'SECRET_DESCRIPTION' },
    ];
    const rows: AgentDailyReportRegistration[] = rowsWithPrivateFields;
    const text = buildAgentDailyReportText('2026-10-19', 'Agent Test', rows);
    const normalizedText = text.replace(/\s+/g, ' ');
    expect(text).toContain('*RAPPORT DU 19/10/2026 (lundi) — Agent Test*');
    expect(text).toContain('Total : 3 enregistrés');
    expect(normalizedText).toContain('Gagnés : 1 (18 000 FCFA) · Payés : 1 (9 000 FCFA) · En attente : 1');
    expect(normalizedText.indexOf('first@example.test')).toBeLessThan(normalizedText.indexOf('second@example.test'));
    expect(normalizedText).not.toContain('SECRET_PASSWORD');
    expect(normalizedText).not.toContain('SECRET_NUMBER');
    expect(normalizedText).not.toContain('SECRET_DESCRIPTION');
  });

  it('falls back to copying when report sharing is unavailable or fails', async () => {
    const copy = vi.fn(async () => undefined);
    expect(await shareReportOrCopy('rapport', undefined, copy)).toBe('copied');
    expect(copy).toHaveBeenCalledWith('rapport');
    const failedShare = vi.fn(async () => { throw new Error('unsupported'); });
    expect(await shareReportOrCopy('rapport', failedShare, copy)).toBe('copied');
    expect(failedShare).toHaveBeenCalledWith({ text: 'rapport' });
    expect(copy).toHaveBeenCalledTimes(2);
  });

  it('aggregates RPC rows by day and preserves user-level details', () => {
    const grouped = groupReportDayStats([
      makeStats('a'),
      makeStats('b', {
        total: 3, en_attente: 0, gagne: 2, amount_gagne: 12_000,
        first_at: '2026-10-19T07:00:00Z', last_at: '2026-10-19T11:00:00Z',
      }),
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].total).toBe(5);
    expect(grouped[0].gagne).toBe(3);
    expect(grouped[0].amount_gagne).toBe(17_000);
    expect(grouped[0].users.map((user) => user.agent_id)).toEqual(['a', 'b']);
    expect(grouped[0].first_at).toBe('2026-10-19T07:00:00Z');
    expect(grouped[0].last_at).toBe('2026-10-19T11:00:00Z');
  });

  it('normalizes the RPC jour column and treats null or empty data as no rows', () => {
    const { day, ...stats } = makeStats('agent-1');
    const normalized = normalizeReportDayStats([{ jour: day, ...stats }]);
    expect(normalized).toEqual([makeStats('agent-1')]);
    expect(normalizeReportDayStats(null)).toEqual([]);
    expect(normalizeReportDayStats([])).toEqual([]);
    expect(normalizeReportDayStats([{ day, ...stats }])).toBeNull();
  });

  it('reconciles report preview counts and amounts against daily RPC statistics', () => {
    const rows = [
      makeRegistration(),
      makeRegistration({ id: 'id-2', day_seq: 20, status: 'en_attente', amount: null }),
    ];
    const stats = makeStats('agent-1', { total: 2, en_attente: 1, gagne: 1, amount_gagne: 5000 });
    const preview = reportStatusCounts(rows);
    expect(rows.length).toBe(stats.total);
    expect(preview.en_attente).toBe(stats.en_attente);
    expect(preview.gagne).toBe(stats.gagne);
    expect(rows.filter((row) => row.status === 'gagne').reduce((total, row) => total + (row.amount ?? 0), 0)).toBe(stats.amount_gagne);
  });

  it('builds text using selected sections and columns without password data', () => {
    const text = buildReportText('Rapport du 19/10/2026', [makeRegistration()], {
      name: 'Complet',
      sections: { summary: false, users: true, details: true },
      columns: ['time', 'identifier'],
      statuses: [...REGISTRATION_STATUSES],
      sort: 'time',
    }, '');
    expect(text).toContain('*Par utilisateur*');
    expect(text).toContain('*Détail*');
    expect(text).toContain('09:12 · person@example.test');
    expect(text).not.toContain('Total :');
    expect(text.toLocaleLowerCase('fr')).not.toContain('mdp');
    expect(DEFAULT_REPORT_COLUMNS).not.toContain('password' as never);
  });

  it('writes protected UTF-8 CSV cells with BOM, semicolons and escaped quotes', () => {
    const csv = buildReportCsv(['jour', 'identifiant', 'description'], [
      ['2026-10-19', '=1+1', 'a "quote"; test'],
    ]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain(';');
    expect(csv).toContain("\"'=1+1\"");
    expect(csv).toContain('"a ""quote""; test"');
  });

  it('validates saved models and enforces report limits', () => {
    expect(savedReportModelsSchema.safeParse([{
      name: 'Mon modèle',
      sections: { summary: true, users: false, details: true },
      columns: DEFAULT_REPORT_COLUMNS,
      statuses: [...REGISTRATION_STATUSES],
      sort: 'time',
    }]).success).toBe(true);
    expect(savedReportModelsSchema.safeParse([{
      name: 'x'.repeat(31),
      sections: { summary: true, users: false, details: true },
      columns: DEFAULT_REPORT_COLUMNS,
      statuses: [...REGISTRATION_STATUSES],
      sort: 'time',
    }]).success).toBe(false);
    expect(exceedsReportLimits('2026-10-01', '2026-10-31', 2000)).toBe(false);
    expect(exceedsReportLimits('2026-10-01', '2026-11-01', 1)).toBe(true);
    expect(exceedsReportLimits('2026-10-01', '2026-10-02', 2001)).toBe(true);
  });
});
