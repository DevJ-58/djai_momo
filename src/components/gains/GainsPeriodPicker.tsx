import { useSearchParams } from 'react-router-dom';
import { gainsPeriodFromSearch, type GainsPeriod } from '../../lib/gains';
import { getAbidjanToday } from '../../lib/registration-days';

const options = [
  ['all', 'Tout'],
  ['today', "Aujourd'hui"],
  ['yesterday', 'Hier'],
  ['7', '7 jours'],
  ['30', '30 jours'],
  ['month', 'Ce mois-ci'],
  ['custom', 'Personnalisé'],
] as const;

export function useGainsPeriod() {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = gainsPeriodFromSearch(searchParams);
  const selectPreset = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete('du');
    next.delete('au');
    next.set('periode', id === 'custom' ? 'custom' : id);
    if (id === 'custom') {
      next.set('du', period.from ?? getAbidjanToday());
      next.set('au', period.to ?? getAbidjanToday());
    }
    setSearchParams(next, { replace: true });
  };
  const setCustomRange = (from: string, to: string) => {
    const end = to < from ? from : to;
    const next = new URLSearchParams(searchParams);
    next.delete('periode');
    next.set('du', from);
    next.set('au', end);
    setSearchParams(next, { replace: true });
  };
  return { period, selectPreset, setCustomRange };
}

export function GainsPeriodPicker({
  period,
  onPreset,
  onCustomRange,
}: {
  period: GainsPeriod;
  onPreset: (id: string) => void;
  onCustomRange: (from: string, to: string) => void;
}) {
  const today = getAbidjanToday();
  return (
    <section className="gains-period-picker" aria-label="Période des gains">
      <div className="day-period-filters" role="group" aria-label="Choisir une période de gains">
        {options.map(([id, label]) => <button
          type="button"
          key={id}
          className={`status-filter-chip${period.id === id ? ' status-filter-chip-active' : ''}`}
          aria-pressed={period.id === id}
          onClick={() => onPreset(id)}
        >{label}</button>)}
      </div>
      {period.id === 'custom' && <div className="gains-custom-dates">
        <label>Du<input aria-label="Date de début" type="date" max={today} value={period.from ?? today} onChange={(event) => onCustomRange(event.target.value, period.to ?? event.target.value)} /></label>
        <label>Au<input aria-label="Date de fin" type="date" min={period.from ?? undefined} max={today} value={period.to ?? today} onChange={(event) => onCustomRange(period.from ?? today, event.target.value)} /></label>
      </div>}
      <p className="gains-period-label" aria-live="polite">{period.label}</p>
    </section>
  );
}

