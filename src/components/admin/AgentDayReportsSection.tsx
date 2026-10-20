import { useMemo, useState } from 'react';
import { CalendarDays, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { Button, Card, EmptyState, Skeleton } from '../ui';
import { DayReportCard } from '../reports/DayReportCard';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { reportDayStatsQueryOptions, useEarliestReportDay } from '../../hooks/useDayReports';
import { getDayBounds, type DayTotals } from '../../lib/day-reports';

const PERIODS = [
  { id: '7', label: '7 jours' },
  { id: '30', label: '30 jours' },
  { id: 'month', label: 'Ce mois' },
  { id: 'all', label: 'Tout' },
] as const;

function dayOffset(day: string, offset: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, date + offset, 12));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}

function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

function monthRanges(to: string, count: number, from?: string): Array<{ from: string; to: string }> {
  const ranges: Array<{ from: string; to: string }> = [];
  let [year, month] = to.slice(0, 7).split('-').map(Number);
  while (ranges.length < count && (!from || `${year}-${String(month).padStart(2, '0')}` >= from.slice(0, 7))) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const next = new Date(Date.UTC(year, month, 1, 12));
    const last = dayOffset(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`, -1);
    ranges.unshift({ from: from && from > start ? from : start, to: last < to ? last : to });
    month -= 1;
    if (month === 0) { month = 12; year -= 1; }
  }
  return ranges;
}

function emptyDay(day: string): DayTotals {
  return {
    day, total: 0, en_attente: 0, gagne: 0, paye: 0, refuse: 0, echec: 0, renonce: 0,
    autres: 0, amount_gagne: 0, amount_paye: 0, envoyes: 0, non_envoyes: 0,
    first_at: null, last_at: null, users: [],
  };
}

function monthTitle(day: string): string {
  const [year, month] = day.slice(0, 7).split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Africa/Abidjan' })
    .format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

export function AgentDayReportsSection({ agentId, returnTo }: { agentId: string; returnTo: string }) {
  const today = getDayBounds().today;
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('30');
  const [monthsVisible, setMonthsVisible] = useState(2);
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const earliest = useEarliestReportDay([agentId], period === 'all');
  const from = period === '7' ? dayOffset(today, -6)
    : period === '30' ? dayOffset(today, -29)
      : period === 'month' ? monthStart(today)
        : undefined;
  const ranges = period === 'all'
    ? earliest.data ? monthRanges(today, monthsVisible, earliest.data) : []
    : monthRanges(today, 2, from);
  const stats = useQueries({
    queries: ranges.map((range) => reportDayStatsQueryOptions({ ...range, agentIds: [agentId] }, agentId)),
  });
  const pending = period === 'all' && earliest.isPending || stats.some((query) => query.isPending);
  const error = stats.find((query) => query.isError)?.error ?? (period === 'all' && earliest.isError ? earliest.error : null);
  const groups = useMemo(() => {
    const dayMap = new Map<string, DayTotals>();
    for (const day of stats.flatMap((query) => query.data ?? [])) dayMap.set(day.day, day);
    if (!dayMap.has(today)) dayMap.set(today, emptyDay(today));
    const months = new Map<string, DayTotals[]>();
    for (const item of [...dayMap.values()].filter((day) => day.day <= today && (!from || day.day >= from))) {
      const key = item.day.slice(0, 7);
      months.set(key, [...(months.get(key) ?? []), item]);
    }
    return [...months.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [from, stats, today]);
  const hasMore = period === 'all'
    && Boolean(earliest.data && ranges[0] && earliest.data < ranges[0].from);

  return (
    <section className="registration-list-section agent-days-section" aria-labelledby="agent-days-heading">
      <div className="registration-list-heading">
        <div><span className="section-kicker">ACTIVITÉ</span><h2 id="agent-days-heading">Jours</h2></div>
        <Button variant="secondary" onClick={() => navigate(`/admin/jours?u=${encodeURIComponent(agentId)}&periode=${period}&ouvrirRapport=1`)}>
          <FileText size={17} aria-hidden="true" /> Rapport
        </Button>
      </div>
      <div className="day-period-filters" role="group" aria-label="Période des jours de cet utilisateur">
        {PERIODS.map(({ id, label }) => <button
          type="button"
          key={id}
          aria-pressed={period === id}
          className={`status-filter-chip ${period === id ? 'status-filter-chip-active' : ''}`}
          onClick={() => { setPeriod(id); setMonthsVisible(2); }}
        >{label}</button>)}
      </div>
      {!online && <p className="day-report-offline" role="status">Hors ligne. Les données affichées peuvent ne pas être à jour.</p>}
      {pending ? <div className="day-report-grid" aria-label="Chargement des jours">
        {[1, 2, 3].map((item) => <Card className="day-card-skeleton" key={item}><Skeleton /><Skeleton /><Skeleton /></Card>)}
      </div> : error ? <div>
        <p className="day-report-error" role="alert">
          {error instanceof Error ? error.message : 'Impossible de charger les jours. Réessayez.'}
        </p>
        <Button variant="secondary" onClick={() => {
          stats.forEach((query) => { void query.refetch(); });
          if (earliest.isError) void earliest.refetch();
        }}>Réessayer</Button>
      </div> : <>
        {!groups.some(([, days]) => days.some((item) => item.total > 0)) && <EmptyState
          icon={<CalendarDays size={22} aria-hidden="true" />}
          title="Aucun enregistré sur cette période"
          description="Ajustez la période ou réessayez plus tard."
        />}
        {groups.map(([month, days]) => <section className="day-month-section" key={month}>
          <h3>{monthTitle(`${month}-01`)}</h3>
          <div className="day-report-grid">{days.map((day) => <DayReportCard
            key={day.day}
            day={day}
            today={today}
            agentOnly={false}
            agentId={agentId}
            returnTo={returnTo}
          />)}</div>
        </section>)}
      </>}
      {hasMore && !pending && <Button variant="secondary" onClick={() => setMonthsVisible((current) => current + 2)}>Charger plus</Button>}
    </section>
  );
}
