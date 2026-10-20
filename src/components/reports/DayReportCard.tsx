import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatAmount } from '../../lib/format';
import { formatReportDate } from '../../lib/day-reports';
import type { DayTotals } from '../../lib/day-reports';
import type { RegistrationStatus } from '../../types/database';

const STATUS_SHORT: Record<RegistrationStatus, string> = {
  en_attente: 'en attente',
  gagne: 'gagnés',
  paye: 'payés',
  refuse: 'refusés',
  echec: 'échecs',
  renonce: 'renoncés',
  probleme: 'problèmes',
};

function nonZeroStatuses(day: DayTotals) {
  return ([
    ['en_attente', day.en_attente],
    ['gagne', day.gagne],
    ['paye', day.paye],
    ['refuse', day.refuse],
    ['echec', day.echec],
    ['renonce', day.renonce],
    ['probleme', day.autres],
  ] as Array<[RegistrationStatus, number]>).filter(([, count]) => count > 0);
}

export function DayReportCard({
  day,
  today,
  agentOnly,
  agentId,
  returnTo,
  actions,
}: {
  day: DayTotals;
  today: string;
  agentOnly: boolean;
  agentId?: string;
  returnTo?: string;
  actions?: ReactNode;
}) {
  const marker = day.day === today ? 'Aujourd’hui' : day.day === shiftDay(today, -1) ? 'Hier' : '';
  const weekday = formatReportDate(day.day, { weekday: 'short' }).replace('.', '');
  const destination = `${agentOnly ? '/espace/jours' : '/admin/jours'}/${day.day}${!agentOnly && agentId ? `?u=${encodeURIComponent(agentId)}` : ''}`;
  return (
    <div className="day-report-card-container">
      <Link
        className="glass day-report-card"
        to={destination}
        state={returnTo ? { returnTo } : undefined}
        aria-label={`Jour ${formatReportDate(day.day, { day: 'numeric', month: 'long', year: 'numeric' })} : ${day.total} enregistrés`}
      >
        <span className="day-report-number"><strong>{Number(day.day.slice(-2))}</strong><small>{weekday}.</small></span>
        <span className="day-report-copy">
          <span className="day-report-title"><strong>{day.total} enregistré{day.total === 1 ? '' : 's'}</strong><span>{agentOnly ? '' : `${day.users.length} utilisateur${day.users.length === 1 ? '' : 's'}`}</span></span>
          {marker && <span className="day-report-marker">{marker}</span>}
          {day.total === 0 && <span className="day-report-muted">Aucun enregistré pour l’instant</span>}
          {day.total > 0 && <>
            <span className="day-report-statuses">
              {nonZeroStatuses(day).map(([status, count]) => (
                <span key={status} className={`day-report-status status-${status}`}>{count} {STATUS_SHORT[status]}</span>
              ))}
            </span>
            {(day.amount_gagne > 0 || day.amount_paye > 0) && <span className="day-report-amounts">
              {day.amount_gagne > 0 && <>Gagné : {formatAmount(day.amount_gagne)}</>}
              {day.amount_gagne > 0 && day.amount_paye > 0 && ' · '}
              {day.amount_paye > 0 && <>Payé : {formatAmount(day.amount_paye)}</>}
            </span>}
            {day.non_envoyes > 0 && <span className="day-report-unsent">{day.non_envoyes} non envoyé{day.non_envoyes === 1 ? '' : 's'}</span>}
          </>}
        </span>
        <ChevronDown className="day-report-chevron" size={18} aria-hidden="true" />
      </Link>
      {actions && <div className="day-report-card-actions">{actions}</div>}
    </div>
  );
}

function shiftDay(day: string, offset: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, date + offset, 12));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}
