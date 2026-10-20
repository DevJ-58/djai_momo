import { useMemo, useState } from 'react';
import { ArrowDownWideNarrow, Coins, FileDown } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Avatar, Button, Card, EmptyState, Skeleton } from '../components/ui';
import { GainsCards } from '../components/gains/GainsCards';
import { GainsChart } from '../components/gains/GainsChart';
import { GainsErrorMessage } from '../components/gains/GainsErrorMessage';
import { GainsPdfModal } from '../components/gains/GainsPdfModal';
import { GainsPeriodPicker, useGainsPeriod } from '../components/gains/GainsPeriodPicker';
import { useAgentsOverview } from '../hooks/useAdmin';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useGainsDaily, useGainsSummary } from '../hooks/useGains';
import { computeGains, formatGain, formatGainDay, type GainsSummaryRow } from '../lib/gains';
import { toTitleCase } from '../lib/format';

type SortBy = 'net' | 'name' | 'count';

function sumTotals(rows: readonly Pick<GainsSummaryRow, 'montant_net' | 'nb_recus'>[]) {
  return rows.reduce((sum, row) => ({
    net: sum.net + row.montant_net,
    count: sum.count + row.nb_recus,
  }), { net: 0, count: 0 });
}

function useSelectedAgents() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = (searchParams.get('agents') ?? '').split(',').filter(Boolean);
  const toggle = (agentId: string) => {
    const nextIds = selected.includes(agentId)
      ? selected.filter((id) => id !== agentId)
      : [...selected, agentId];
    const next = new URLSearchParams(searchParams);
    if (nextIds.length) next.set('agents', nextIds.join(','));
    else next.delete('agents');
    setSearchParams(next, { replace: true });
  };
  return { selected, toggle };
}

export function AdminGainsPage() {
  const { period, selectPreset, setCustomRange } = useGainsPeriod();
  const { selected, toggle } = useSelectedAgents();
  const filters = { from: period.from, to: period.to, agentIds: selected };
  const summary = useGainsSummary(filters);
  const daily = useGainsDaily(filters);
  const agents = useAgentsOverview();
  const online = useOnlineStatus();
  const [sortBy, setSortBy] = useState<SortBy>('net');
  const [pdfOpen, setPdfOpen] = useState(false);
  const totals = sumTotals(summary.data ?? []);
  const rows = useMemo(() => {
    const summaryMap = new Map((summary.data ?? []).map((row) => [row.agent_id, row]));
    return (agents.data ?? [])
      .filter((agent) => selected.length === 0 || selected.includes(agent.agent_id))
      .map((agent) => summaryMap.get(agent.agent_id) ?? {
        agent_id: agent.agent_id,
        full_name: agent.full_name,
        nb_recus: 0,
        montant_net: 0,
        dernier_gain: null,
      })
      .sort((first, second) => {
        if ((first.montant_net === 0) !== (second.montant_net === 0)) return first.montant_net === 0 ? 1 : -1;
        if (sortBy === 'name') return first.full_name.localeCompare(second.full_name, 'fr');
        if (sortBy === 'count') return second.nb_recus - first.nb_recus || second.montant_net - first.montant_net;
        return second.montant_net - first.montant_net || first.full_name.localeCompare(second.full_name, 'fr');
      });
  }, [agents.data, selected, sortBy, summary.data]);

  return <div className="page-content gains-page">
    <header className="page-header admin-page-header gains-page-header">
      <div><span className="eyebrow">ESPACE ADMIN</span><h1>Gains</h1><p>Montants reçus et répartition par utilisateur.</p></div>
      <Button variant="secondary" onClick={() => setPdfOpen(true)} disabled={summary.isPending || summary.isError || rows.length === 0}>
        <FileDown size={18} aria-hidden="true" /> Exporter en PDF
      </Button>
    </header>
    <GainsPeriodPicker period={period} onPreset={selectPreset} onCustomRange={setCustomRange} />
    <details className="gains-agent-filter">
      <summary>Utilisateurs {selected.length ? `(${selected.length} sélectionné${selected.length === 1 ? '' : 's'})` : '(tous)'}</summary>
      {agents.isPending ? <p role="status">Chargement des utilisateurs…</p>
        : agents.isError ? <p role="alert">{agents.error.message}</p>
          : <fieldset>
            <legend>Filtrer par utilisateurs (aucun choix = tous)</legend>
            <div className="gains-agent-options">{(agents.data ?? []).map((agent) => <label key={agent.agent_id}>
              <input type="checkbox" checked={selected.includes(agent.agent_id)} onChange={() => toggle(agent.agent_id)} />
              <span>{toTitleCase(agent.full_name)}</span>
            </label>)}</div>
          </fieldset>}
    </details>
    {!online && <p className="day-report-offline" role="status">Hors ligne. Les données peuvent ne pas être à jour.</p>}
    {summary.isError ? <GainsErrorMessage error={summary.error} isAdmin onRetry={() => void summary.refetch()} />
      : <GainsCards net={totals.net} count={totals.count} loading={summary.isPending} />}

    <section className="gains-section" aria-labelledby="gains-ranking-heading">
      <div className="section-heading gains-section-heading">
        <div><span className="section-kicker">CLASSEMENT</span><h2 id="gains-ranking-heading">Par utilisateur</h2></div>
        <label className="gains-sort-label"><ArrowDownWideNarrow size={17} aria-hidden="true" /><span>Trier</span>
          <select aria-label="Trier les utilisateurs" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}>
            <option value="net">Montant net</option><option value="name">Nom</option><option value="count">Nombre reçu</option>
          </select>
        </label>
      </div>
      {summary.isPending || agents.isPending ? <div className="gains-ranking-skeletons">{[1, 2, 3].map((item) => <Skeleton key={item} />)}</div>
        : summary.isError ? null
          : agents.isError ? <p className="gains-error" role="alert">{agents.error.message}</p>
            : rows.length === 0 ? <EmptyState icon={<Coins size={22} aria-hidden="true" />} title="Aucun utilisateur pour cette sélection" description="Modifiez le filtre ou la période." />
              : <>
                <div className="gains-user-cards">{rows.map((row, index) => <GainsUserCard row={row} index={index} total={totals.net} key={row.agent_id} />)}</div>
                <div className="gains-table-wrap">
                  <table className="gains-table">
                    <thead><tr><th>Utilisateur</th><th>Enregistrés ayant reçu</th><th>Montant net</th><th>Montant Vp</th><th>Montant reçu</th><th>Part du total</th></tr></thead>
                    <tbody>{rows.map((row) => <GainsTableRow row={row} total={totals.net} key={row.agent_id} />)}</tbody>
                  </table>
                </div>
              </>}
    </section>
    <section className="gains-section" aria-labelledby="gains-chart-heading">
      <div className="section-heading"><div><span className="section-kicker">ÉVOLUTION</span><h2 id="gains-chart-heading">Montant net par jour</h2></div></div>
      {daily.isPending ? <Card className="gains-chart-skeleton"><Skeleton /></Card>
        : daily.isError ? <GainsErrorMessage error={daily.error} isAdmin onRetry={() => void daily.refetch()} />
          : <GainsChart rows={daily.data ?? []} />}
    </section>
    <GainsPdfModal open={pdfOpen} onClose={() => setPdfOpen(false)} rows={rows} daily={daily.data ?? []} periodLabel={period.label} totals={totals} />
  </div>;
}

function GainsUserCard({ row, index, total }: { row: GainsSummaryRow; index: number; total: number }) {
  const values = computeGains(row.montant_net);
  const share = total > 0 ? row.montant_net / total * 100 : 0;
  return <Link to={`/admin/utilisateurs/${row.agent_id}`} className={`glass gains-user-card${row.montant_net === 0 ? ' gains-user-no-gain' : ''}`}>
    <div className="gains-user-card-heading"><span className="gains-user-rank">{row.montant_net > 0 ? index + 1 : '—'}</span><Avatar name={toTitleCase(row.full_name)} size="small" /><strong>{toTitleCase(row.full_name)}</strong></div>
    <span>{row.nb_recus} enregistrés ayant reçu</span>
    <div className="gains-user-values"><span>Net <strong>{formatGain(values.net)}</strong></span><span>Vp <strong>{formatGain(values.vp)}</strong></span><span>Reçu <strong>{formatGain(values.recu)}</strong></span></div>
    <span className="gains-share-label">Part du total : {share.toFixed(1)}%</span>
    <span className="gains-share-track"><span style={{ width: `${Math.min(100, share)}%` }} /></span>
  </Link>;
}

function GainsTableRow({ row, total }: { row: GainsSummaryRow; total: number }) {
  const values = computeGains(row.montant_net);
  const share = total > 0 ? row.montant_net / total * 100 : 0;
  return <tr className={row.montant_net === 0 ? 'gains-user-no-gain' : ''}>
    <td><Link className="gains-table-user" to={`/admin/utilisateurs/${row.agent_id}`}><Avatar name={toTitleCase(row.full_name)} size="small" />{toTitleCase(row.full_name)}</Link></td>
    <td>{row.nb_recus}</td><td>{formatGain(values.net)}</td><td>{formatGain(values.vp)}</td><td>{formatGain(values.recu)}</td>
    <td><span className="gains-share-label">{share.toFixed(1)}%</span><span className="gains-share-track"><span style={{ width: `${Math.min(100, share)}%` }} /></span></td>
  </tr>;
}

export function AgentGainsPage() {
  const { period, selectPreset, setCustomRange } = useGainsPeriod();
  const filters = { from: period.from, to: period.to };
  const summary = useGainsSummary(filters);
  const daily = useGainsDaily(filters);
  const online = useOnlineStatus();
  const total = sumTotals(summary.data ?? []);
  const current = summary.data?.[0];
  return <div className="page-content gains-page">
    <header className="page-header gains-page-header">
      <div><span className="eyebrow">ESPACE AGENT</span><h1>Mes gains</h1><p>Suivez vos montants reçus.</p></div>
    </header>
    <GainsPeriodPicker period={period} onPreset={selectPreset} onCustomRange={setCustomRange} />
    {!online && <p className="day-report-offline" role="status">Hors ligne. Les données peuvent ne pas être à jour.</p>}
    {summary.isError ? <GainsErrorMessage error={summary.error} isAdmin={false} onRetry={() => void summary.refetch()} />
      : <GainsCards net={total.net} count={total.count} loading={summary.isPending} />}
    <p className="gains-privacy-note">Vos gains ne sont visibles que par vous et par l'administrateur.</p>
    <section className="gains-section" aria-labelledby="my-gains-chart-heading">
      <div className="section-heading"><div><span className="section-kicker">ÉVOLUTION</span><h2 id="my-gains-chart-heading">Montant net par jour</h2></div></div>
      {daily.isPending ? <Card className="gains-chart-skeleton"><Skeleton /></Card>
        : daily.isError ? <GainsErrorMessage error={daily.error} isAdmin={false} onRetry={() => void daily.refetch()} />
          : <GainsChart rows={daily.data ?? []} />}
    </section>
    <section className="gains-section" aria-labelledby="my-gains-daily-heading">
      <div className="section-heading"><div><span className="section-kicker">JOUR APRÈS JOUR</span><h2 id="my-gains-daily-heading">Détail quotidien</h2></div></div>
      {daily.isPending ? <div className="gains-ranking-skeletons">{[1, 2].map((item) => <Skeleton key={item} />)}</div>
        : daily.isError ? null
          : daily.data?.length ? <>
            <div className="gains-daily-cards">{daily.data.map((row) => <Card className="gains-daily-card" key={row.jour}>
              <strong>{formatDailyLabel(row.jour)}</strong><span>{row.nb_recus} enregistrés ayant reçu</span>
              <span className="gains-user-values">
                <span>Net <strong>{formatGain(row.montant_net)}</strong></span>
                <span>Vp <strong>{formatGain(computeGains(row.montant_net).vp)}</strong></span>
                <span>Reçu <strong>{formatGain(computeGains(row.montant_net).recu)}</strong></span>
              </span>
            </Card>)}</div>
            <div className="gains-table-wrap"><table className="gains-table gains-daily-table">
              <thead><tr><th>Jour</th><th>Enregistrés ayant reçu</th><th>Net</th><th>Vp</th><th>Reçu</th></tr></thead>
              <tbody>{daily.data.map((row) => <tr key={row.jour}><td>{formatDailyLabel(row.jour)}</td><td>{row.nb_recus}</td><td>{formatGain(row.montant_net)}</td><td>{formatGain(computeGains(row.montant_net).vp)}</td><td>{formatGain(computeGains(row.montant_net).recu)}</td></tr>)}</tbody>
            </table></div>
          </> : <EmptyState icon={<Coins size={22} aria-hidden="true" />} title="Aucun gain sur cette période" description="" />}
    </section>
    {summary.isSuccess && summary.data.length === 0 && <span className="sr-only">{current ? 'Gains chargés.' : 'Aucun gain enregistré.'}</span>}
  </div>;
}

function formatDailyLabel(day: string): string {
  return formatGainDay(day);
}
