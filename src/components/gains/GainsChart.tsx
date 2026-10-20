import { useState } from 'react';
import { Card, EmptyState } from '../ui';
import { computeGains, formatGain, formatGainDay, type GainsDailyRow } from '../../lib/gains';
import { CalendarDays } from 'lucide-react';

export function GainsChart({ rows }: { rows: GainsDailyRow[] }) {
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const chartRows = [...rows].reverse().slice(-31);
  const maxValue = Math.max(1, ...chartRows.map((row) => row.montant_net));
  const width = 700;
  const height = 240;
  const left = 42;
  const right = 8;
  const top = 12;
  const bottom = 36;
  const plotHeight = height - top - bottom;
  const plotWidth = width - left - right;
  const step = plotWidth / Math.max(chartRows.length, 1);
  const selected = chartRows.find((row) => row.jour === activeDay);
  if (rows.length === 0) {
    return <Card className="gains-chart-empty"><EmptyState icon={<CalendarDays size={22} aria-hidden="true" />} title="Aucun gain sur cette période" description="" /></Card>;
  }
  return (
    <Card className="gains-chart-card">
      <p className="gains-chart-summary">Évolution du montant net quotidien sur {chartRows.length} jours avec gains.</p>
      {rows.length > 31 && <p className="gains-chart-note">Affichage des 31 derniers jours avec gains sur {rows.length} jours.</p>}
      {selected && <p className="gains-chart-tooltip" role="status">
        {formatGainDay(selected.jour)} · Net : {formatGain(selected.montant_net)} · Vp : {formatGain(computeGains(selected.montant_net).vp)} · Reçu : {formatGain(computeGains(selected.montant_net).recu)}
      </p>}
      <svg className="gains-chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Graphique des gains nets par jour. ${chartRows.map((row) => `${formatGainDay(row.jour)} : ${formatGain(row.montant_net)}`).join('; ')}`}>
        {[0, 0.5, 1].map((ratio) => {
          const y = top + plotHeight * ratio;
          return <g key={ratio}>
            <line className="gains-chart-gridline" x1={left} x2={width - right} y1={y} y2={y} />
            <text className="gains-chart-axis" x={left - 5} y={y + 3} textAnchor="end">{formatCompact(maxValue * (1 - ratio))}</text>
          </g>;
        })}
        {chartRows.map((row, index) => {
          const x = left + step * index + step / 2;
          const barHeight = row.montant_net / maxValue * plotHeight;
          const label = row.jour.slice(8, 10) + '/' + row.jour.slice(5, 7);
          const showLabel = chartRows.length <= 10 || index % Math.ceil(chartRows.length / 8) === 0 || index === chartRows.length - 1;
          return <g key={row.jour} tabIndex={0} role="button" aria-label={`${formatGainDay(row.jour)} : ${formatGain(row.montant_net)}`} onMouseEnter={() => setActiveDay(row.jour)} onMouseLeave={() => setActiveDay(null)} onFocus={() => setActiveDay(row.jour)} onBlur={() => setActiveDay(null)} onClick={() => setActiveDay(activeDay === row.jour ? null : row.jour)} onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setActiveDay(activeDay === row.jour ? null : row.jour);
            }
          }}>
            <rect x={x - Math.max(2, step * .28)} y={top + plotHeight - barHeight} width={Math.max(4, step * .56)} height={Math.max(barHeight, 1)} rx={3} className={`gains-chart-bar${activeDay === row.jour ? ' gains-chart-bar-active' : ''}`} />
            {showLabel && <text className="gains-chart-axis" x={x} y={height - 8} textAnchor="middle">{label}</text>}
          </g>;
        })}
      </svg>
    </Card>
  );
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)} M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} k`;
  return String(Math.round(value));
}
