import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clipboard, Copy, Download, FileText, Printer, Users, X } from 'lucide-react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { AdminRegistrationsPlaceholderPage } from './AdminPages';
import { ToastViewport } from '../components/layout/ToastViewport';
import { AgentDayReportActions } from '../components/reports/AgentDayReportActions';
import { DayReportCard } from '../components/reports/DayReportCard';
import { Badge, Button, Card, EmptyState, Modal, Skeleton } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useToast } from '../hooks/use-toast';
import { useAgentsOverview } from '../hooks/useAdmin';
import { reportDayStatsQueryOptions, ReportDayStatsError, useDayRegistrationById, useDayRegistrations, useEarliestReportDay, useReportDayStats, useReportRows, type ReportDayStatsDiagnostics } from '../hooks/useDayReports';
import {
  buildReportCsv,
  buildReportText,
  DEFAULT_REPORT_COLUMNS,
  exceedsReportLimits,
  filterReportRows,
  formatReportDate,
  formatReportTime,
  getDayBounds,
  isValidReportDay,
  lastReportConfigSchema,
  reportStatusCounts,
  readAdminDayUserFilter,
  savedReportModelsSchema,
  type DayTotals,
  type ReportColumn,
  type ReportConfig,
  type ReportRegistration,
  type SavedReportModel,
} from '../lib/day-reports';
import { formatAmount, toTitleCase } from '../lib/format';
import { REGISTRATION_STATUSES, type RegistrationStatus } from '../types/database';
import { REGISTRATION_STATUS_PRESENTATION } from '../lib/registration-status';

const PERIODS = [
  { id: '7', label: '7 jours' },
  { id: '30', label: '30 jours' },
  { id: 'month', label: 'Ce mois' },
  { id: 'all', label: 'Tout' },
] as const;

const STATUS_SHORT: Record<RegistrationStatus, string> = {
  en_attente: 'en attente',
  gagne: 'gagnés',
  paye: 'payés',
  refuse: 'refusés',
  echec: 'échecs',
  renonce: 'renoncés',
  probleme: 'problèmes',
};

const COLUMN_OPTIONS: Array<{ id: ReportColumn; label: string }> = [
  { id: 'time', label: 'Heure' },
  { id: 'user', label: 'Utilisateur' },
  { id: 'number', label: 'N°' },
  { id: 'identifier', label: 'Identifiant' },
  { id: 'phone', label: 'Numéro' },
  { id: 'status', label: 'Statut' },
  { id: 'amount', label: 'Montant' },
  { id: 'whatsapp', label: 'Envoi WhatsApp' },
  { id: 'description', label: 'Description' },
];

const BUILT_IN_MODELS: SavedReportModel[] = [
  { name: 'Complet', sections: { summary: true, users: true, details: true }, columns: [...DEFAULT_REPORT_COLUMNS], statuses: [...REGISTRATION_STATUSES], sort: 'time' },
  { name: 'Résumé', sections: { summary: true, users: true, details: false }, columns: [...DEFAULT_REPORT_COLUMNS], statuses: [...REGISTRATION_STATUSES], sort: 'time' },
  { name: 'Gains', sections: { summary: true, users: false, details: true }, columns: ['time', 'user', 'number', 'identifier', 'amount'], statuses: ['gagne', 'paye'], sort: 'time' },
];
const AGENT_MODELS = BUILT_IN_MODELS.filter((model) => model.name !== 'Gains');

const MODEL_STORAGE_KEY = 'djai-momo:day-report-models:v1';
const CONFIG_STORAGE_KEY = 'djai-momo:day-report-config:v1';
const REPORT_LIMIT_MESSAGE = 'Réduisez la période (31 jours ou 2 000 enregistrés maximum).';

function dateParts(day: string): [number, number, number] {
  return day.split('-').map(Number) as [number, number, number];
}

function reportTitleDate(day: string, includeYear = true): string {
  const [year, month, date] = day.split('-');
  return includeYear ? `${date}/${month}/${year}` : `${date}/${month}`;
}

function shiftDay(day: string, offset: number): string {
  const [year, month, date] = dateParts(day);
  const value = new Date(Date.UTC(year, month - 1, date + offset, 12));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}

function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

function shiftMonth(day: string, offset: number): string {
  const [year, month] = dateParts(day);
  const value = new Date(Date.UTC(year, month - 1 + offset, 1, 12));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function monthRanges(from: string | undefined, to: string, count = Number.POSITIVE_INFINITY): Array<{ from: string; to: string }> {
  const ranges: Array<{ from: string; to: string }> = [];
  let cursor = monthStart(to);
  while (ranges.length < count && (!from || cursor.slice(0, 7) >= from.slice(0, 7))) {
    const nextMonth = shiftMonth(cursor, 1);
    const start = from && from > cursor ? from : cursor;
    const endOfMonth = shiftDay(nextMonth, -1);
    const end = endOfMonth < to ? endOfMonth : to;
    ranges.unshift({ from: start, to: end });
    cursor = shiftMonth(cursor, -1);
  }
  return ranges;
}

function initialRange(today: string, period: string): { from?: string; to: string } {
  if (period === 'day') return { from: today, to: today };
  if (period === 'all') return { to: today };
  if (period === 'month') return { from: monthStart(today), to: today };
  const days = Number(period);
  return { from: shiftDay(today, -(days - 1)), to: today };
}

function monthLabel(day: string): string {
  const [year, month] = dateParts(`${day.slice(0, 7)}-01`);
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Africa/Abidjan' })
    .format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

function nonZeroStatuses(stats: DayTotals | DayTotals['users'][number]) {
  return REGISTRATION_STATUSES
    .map((status) => ({ status, count: status === 'probleme' ? stats.autres : stats[status] }))
    .filter(({ count }) => count > 0);
}

function ReportDiagnostics({ error, visible }: { error: unknown; visible: boolean }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  if (!visible || !(error instanceof ReportDayStatsError) || !error.diagnostics) return null;

  const diagnostics: ReportDayStatsDiagnostics = error.diagnostics;
  const text = [
    `Code : ${diagnostics.code ?? '—'}`,
    `Message : ${diagnostics.message}`,
    `Détails : ${diagnostics.details ?? '—'}`,
    `Indice : ${diagnostics.hint ?? '—'}`,
    `Statut HTTP : ${diagnostics.httpStatus ?? '—'}`,
    `p_from : ${diagnostics.p_from ?? 'null'}`,
    `p_to : ${diagnostics.p_to ?? 'null'}`,
    `p_agent_ids : ${diagnostics.p_agent_ids === null ? 'null' : JSON.stringify(diagnostics.p_agent_ids)}`,
  ].join('\n');

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  };

  return (
    <details className="report-diagnostics">
      <summary>Détails techniques</summary>
      <pre>{text}</pre>
      <Button variant="secondary" className="report-diagnostics-copy" onClick={() => void copyDiagnostics()}>
        {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
        {copied ? 'Copié ✓' : 'Copier'}
      </Button>
      <span className={copyFailed ? 'report-diagnostics-copy-error' : 'sr-only'} aria-live="polite">
        {copied ? 'Détails techniques copiés.' : copyFailed ? 'Copie impossible. Autorisez le presse-papiers puis réessayez.' : ''}
      </span>
    </details>
  );
}

function dayRegistrationFromStats(day: string): DayTotals {
  return {
    day, total: 0, en_attente: 0, gagne: 0, paye: 0, refuse: 0, echec: 0, renonce: 0,
    autres: 0, amount_gagne: 0, amount_paye: 0, envoyes: 0, non_envoyes: 0,
    first_at: null, last_at: null, users: [],
  };
}

function ReportGenerator({
  open,
  day,
  initialAgentIds,
  agentOptions,
  onClose,
  show,
}: {
  open: boolean;
  day?: string;
  initialAgentIds: string[];
  agentOptions: Array<{ agent_id: string; full_name: string }>;
  onClose: () => void;
  show: (message: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const { profile, role } = useAuth();
  const isAgent = role === 'agent';
  const [rangeKind, setRangeKind] = useState(day ? 'custom' : '7');
  const initialDates = initialRange(getDayBounds().today, day ? 'day' : '7');
  const [from, setFrom] = useState(day ?? initialDates.from ?? '');
  const [to, setTo] = useState(day ?? initialDates.to);
  const [agentIds, setAgentIds] = useState<string[]>(initialAgentIds);
  const [statuses, setStatuses] = useState<RegistrationStatus[]>([...REGISTRATION_STATUSES]);
  const [sections, setSections] = useState({ summary: true, users: !isAgent, details: true });
  const [columns, setColumns] = useState<ReportColumn[]>(DEFAULT_REPORT_COLUMNS.filter((column) => !isAgent || column !== 'user'));
  const [sort, setSort] = useState<'time' | 'user'>('time');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [modelName, setModelName] = useState('');
  const [models, setModels] = useState<SavedReportModel[]>([]);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const reportQuery = useReportRows({
    from: rangeKind === 'custom' ? from : initialRange(getDayBounds().today, rangeKind).from ?? '2000-01-01',
    to: rangeKind === 'custom' ? to : initialRange(getDayBounds().today, rangeKind).to,
    agentIds: isAgent ? (profile ? [profile.id] : []) : agentIds,
    statuses,
    enabled: open && generated,
  });
  const rows = useMemo(() => filterReportRows(reportQuery.data ?? [], statuses, isAgent ? [] : agentIds), [agentIds, isAgent, reportQuery.data, statuses]);
  const start = rangeKind === 'custom' ? from : initialRange(getDayBounds().today, rangeKind).from ?? '2000-01-01';
  const end = rangeKind === 'custom' ? to : initialRange(getDayBounds().today, rangeKind).to;
  const defaultTitle = start === end
    ? `Rapport du ${reportTitleDate(start)}`
    : `Rapport du ${reportTitleDate(start, start.slice(0, 4) !== end.slice(0, 4))} au ${reportTitleDate(end)}`;
  const currentTitle = title.trim() || defaultTitle;
  const textTitle = !title.trim() && start === end
    ? `${currentTitle} (${formatReportDate(start, { weekday: 'long' })})`
    : currentTitle;
  const config: ReportConfig = { name: 'Personnalisé', sections, columns, statuses, sort };
  const modelOptions = isAgent ? AGENT_MODELS : BUILT_IN_MODELS;

  useEffect(() => {
    if (!open) return;
    try {
      const stored = localStorage.getItem(`${MODEL_STORAGE_KEY}:${role ?? 'guest'}`);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        const result = savedReportModelsSchema.safeParse(parsed);
        if (result.success) setModels(result.data);
        else show('Les modèles enregistrés sont invalides et n’ont pas été chargés.', 'error');
      }
      const savedConfig = localStorage.getItem(`${CONFIG_STORAGE_KEY}:${role ?? 'guest'}`);
      if (savedConfig) {
        const parsedConfig: unknown = JSON.parse(savedConfig);
        const result = lastReportConfigSchema.safeParse(parsedConfig);
        if (result.success) {
          setRangeKind(result.data.rangeKind);
          setFrom(result.data.from);
          setTo(result.data.to);
          setAgentIds(result.data.agentIds);
          setStatuses(result.data.statuses);
          setSections({ ...result.data.sections, users: isAgent ? false : result.data.sections.users });
          setColumns(COLUMN_OPTIONS.map(({ id }) => id).filter((column) => result.data.columns.includes(column) && (!isAgent || column !== 'user')));
          setSort(result.data.sort);
          setTitle(result.data.title);
          setNote(result.data.note);
        } else show('Les derniers réglages mémorisés sont invalides et n’ont pas été chargés.', 'error');
      }
    } catch {
      setModels([]);
      show('Impossible de charger les réglages enregistrés sur cet appareil.', 'error');
    }
    setGenerated(false);
  }, [isAgent, open, role, show]);

  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(`${CONFIG_STORAGE_KEY}:${role ?? 'guest'}`, JSON.stringify({ rangeKind, from, to, agentIds, statuses, sections, columns, sort, title, note }));
    } catch {
      show('Impossible de mémoriser les réglages sur cet appareil.', 'error');
    }
  }, [agentIds, columns, from, note, open, rangeKind, role, sections, show, sort, statuses, to, title]);

  const applyModel = (model: SavedReportModel) => {
    setSections({ ...model.sections, users: isAgent ? false : model.sections.users });
    setColumns(COLUMN_OPTIONS.map(({ id }) => id).filter((column) => model.columns.includes(column) && (!isAgent || column !== 'user')));
    setStatuses(model.statuses);
    setSort(model.sort);
    setGenerated(false);
  };

  const saveModel = () => {
    if (models.length >= 10) {
      show('Vous avez atteint la limite de 10 modèles.', 'error');
      return;
    }
    const candidate = { ...config, name: modelName.trim() };
    const validated = savedReportModelsSchema.safeParse([...models, candidate]);
    if (!validated.success) {
      show('Saisissez un nom de 30 caractères maximum pour le modèle.', 'error');
      return;
    }
    try {
      localStorage.setItem(`${MODEL_STORAGE_KEY}:${role ?? 'guest'}`, JSON.stringify(validated.data));
    } catch {
      show('Impossible d’enregistrer le modèle sur cet appareil.', 'error');
      return;
    }
    setModels(validated.data);
    setModelName('');
    show('Modèle enregistré.', 'success');
  };

  const downloadCsv = () => {
    if (!reportQuery.data) return;
    const columnLabels = columns.map((column) => COLUMN_OPTIONS.find((option) => option.id === column)?.label ?? column);
    const detailOnly = sections.details;
    const headers = detailOnly ? ['jour', ...columnLabels] : ['jour', 'utilisateur', 'total', 'gagnés', 'payés', 'échecs', 'renoncés', 'en attente', 'refusés', 'montant gagné', 'montant payé'];
    const csvRows = detailOnly
      ? rows.map((row) => [row.send_day, ...columns.map((column) => columnValue(row, column))])
      : buildUserSummaryRows(rows);
    const blob = new Blob([buildReportCsv(headers, csvRows)], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = start === end ? `rapport-${start}.csv` : `rapport-${start}-au-${end}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(buildReportText(textTitle, rows, config, note));
      setCopied(true);
      show('Copié ✓', 'success');
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      show('Impossible de copier le rapport. Réessayez.', 'error');
    }
  };

  const requestPrint = () => window.print();
  const toggle = <T extends string>(list: T[], value: T, setter: (values: T[]) => void) => setter(
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
  );

  return (
    <Modal open={open} onClose={onClose} title="Générer un rapport" className="report-generator-modal">
      <div className="report-generator">
        <section className="report-settings">
          <div className="report-models">
            <strong>Modèles</strong>
            {[...modelOptions, ...models].map((model, index) => (
              <span className="report-model-item" key={`${model.name}-${index}`}>
                <button type="button" className="status-filter-chip" onClick={() => applyModel(model)}>{model.name}</button>
                {index >= modelOptions.length && <button className="report-model-remove" type="button" aria-label={`Supprimer le modèle ${model.name}`} onClick={() => {
                  const next = models.filter((item) => item !== model);
                  try {
                    localStorage.setItem(`${MODEL_STORAGE_KEY}:${role ?? 'guest'}`, JSON.stringify(next));
                    setModels(next);
                  } catch {
                    show('Impossible de supprimer le modèle sur cet appareil.', 'error');
                  }
                }}><X size={15} aria-hidden="true" /></button>}
              </span>
            ))}
          </div>
          <fieldset><legend>Période</legend>
            <div className="report-option-row">
              {[
                { value: 'day', label: 'Ce jour' },
                { value: '7', label: '7 derniers jours' },
                { value: 'month', label: 'Ce mois' },
                { value: 'custom', label: 'Personnalisée' },
              ].map(({ value, label }) => <button type="button" key={value} className={`status-filter-chip ${rangeKind === value ? 'status-filter-chip-active' : ''}`} onClick={() => {
                setRangeKind(value);
                if (value === 'day' && day) { setFrom(day); setTo(day); }
                else if (value !== 'custom') {
                  const range = initialRange(getDayBounds().today, value);
                  setFrom(range.from ?? '2000-01-01'); setTo(range.to);
                }
                setGenerated(false);
              }}>{label}</button>)}
            </div>
            {rangeKind === 'custom' && <div className="report-date-fields">
              <label>Du<input type="date" value={from} max={getDayBounds().today} onChange={(event) => { setFrom(event.target.value); setGenerated(false); }} /></label>
              <label>Au<input type="date" value={to} max={getDayBounds().today} onChange={(event) => { setTo(event.target.value); setGenerated(false); }} /></label>
            </div>}
          </fieldset>
          {!isAgent && <fieldset><legend>Utilisateurs</legend>
            <label className="report-select-all"><input type="checkbox" checked={agentIds.length === 0} onChange={() => setAgentIds([])} /> Tous les utilisateurs</label>
            <div className="report-choice-list">{agentOptions.map((agent) => <label key={agent.agent_id}><input type="checkbox" checked={agentIds.includes(agent.agent_id)} onChange={() => toggle(agentIds, agent.agent_id, setAgentIds)} /> {toTitleCase(agent.full_name)}</label>)}</div>
          </fieldset>}
          <fieldset><legend>Statuts à inclure</legend><div className="report-option-row">
            {REGISTRATION_STATUSES.map((status) => <button type="button" key={status} aria-pressed={statuses.includes(status)} className={`status-filter-chip ${statuses.includes(status) ? 'status-filter-chip-active' : ''}`} onClick={() => toggle(statuses, status, setStatuses)}>{REGISTRATION_STATUS_PRESENTATION[status].label}</button>)}
          </div></fieldset>
          <fieldset><legend>Sections</legend><div className="report-choice-list report-inline-choices">
            {(['summary', 'users', 'details'] as const).filter((section) => !isAgent || section !== 'users').map((section) => <label key={section}><input type="checkbox" checked={sections[section]} onChange={(event) => { setSections({ ...sections, [section]: event.target.checked }); setGenerated(false); }} /> {section === 'summary' ? 'Résumé' : section === 'users' ? 'Par utilisateur' : 'Détail des enregistrés'}</label>)}
          </div></fieldset>
          {sections.details && <fieldset><legend>Colonnes du détail</legend><div className="report-choice-list report-inline-choices">
            {COLUMN_OPTIONS.filter(({ id }) => !isAgent || id !== 'user').map(({ id, label }) => <label key={id}><input type="checkbox" checked={columns.includes(id)} onChange={() => {
              const next = columns.includes(id) ? columns.filter((column) => column !== id) : [...columns, id];
              setColumns(COLUMN_OPTIONS.map(({ id: optionId }) => optionId).filter((column) => next.includes(column)));
              setGenerated(false);
            }} /> {label}</label>)}
          </div><label className="report-sort">Tri du détail<select value={sort} onChange={(event) => setSort(event.target.value as 'time' | 'user')}><option value="time">Heure</option><option value="user">Utilisateur puis heure</option></select></label></fieldset>}
          <label className="report-text-field">Titre du rapport<input maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={currentTitle} /></label>
          <label className="report-text-field">Note de fin<textarea maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <div className="report-save-model"><input aria-label="Nom du modèle" maxLength={30} placeholder="Nom du modèle (30 caractères)" value={modelName} onChange={(event) => setModelName(event.target.value)} /><Button variant="secondary" onClick={saveModel} disabled={!modelName.trim()}>Enregistrer comme modèle</Button></div>
          <Button onClick={() => {
            if (!isValidReportDay(from, getDayBounds().today) || !isValidReportDay(to, getDayBounds().today) || from > to || exceedsReportLimits(from, to, 0)) {
              show(REPORT_LIMIT_MESSAGE, 'error');
              return;
            }
            if (!Object.values(sections).some(Boolean)) {
              show('Sélectionnez au moins une section.', 'error');
              return;
            }
            if (sections.details && columns.length === 0) {
              show('Sélectionnez au moins une colonne pour le détail.', 'error');
              return;
            }
            setGenerated(true);
          }}>Générer</Button>
        </section>
        <section className="report-preview" aria-live="polite">
          <h3>Aperçu</h3>
          {reportQuery.isFetching && <p role="status">Chargement du rapport…</p>}
          {reportQuery.isError && <p role="alert">{reportQuery.error.message}</p>}
          {reportQuery.data && <>
            <div className="print-report"><h1>{currentTitle}</h1><p>Généré le {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Abidjan' }).format(new Date())}</p>
              {sections.summary && <div className="report-summary-preview">
                <p><strong>Total :</strong> {rows.length} enregistré{rows.length === 1 ? '' : 's'}{!isAgent && <> · <strong>Utilisateurs :</strong> {new Set(rows.map((row) => row.agent_id)).size}</>}</p>
                <p>{REGISTRATION_STATUSES.map((status) => {
                  const count = reportStatusCounts(rows)[status];
                  if (!count) return null;
                  const amount = status === 'gagne' || status === 'paye'
                    ? rows.filter((row) => row.status === status).reduce((total, row) => total + (row.amount ?? 0), 0)
                    : 0;
                  const label = status === 'en_attente' ? 'En attente' : REGISTRATION_STATUS_PRESENTATION[status].label;
                  return <span key={status}>{label} : {count}{amount > 0 ? ` (${formatAmount(amount)})` : ''} · </span>;
                }).filter(Boolean)}</p>
              </div>}
              {sections.users && <ul>{buildUserSummaryRows(rows).map((row, index) => <li key={`${row[0]}-${index}`}>{row.join(' · ')}</li>)}</ul>}
              {sections.details && rows.length > 0 && <table><thead><tr>{columns.map((column) => <th key={column}>{COLUMN_OPTIONS.find((item) => item.id === column)?.label}</th>)}</tr></thead><tbody>{sortRows(rows, sort).map((row) => <tr key={row.id}>{columns.map((column) => <td key={column}>{columnValue(row, column)}</td>)}</tr>)}</tbody></table>}
              {note && <p>{note}</p>}
            </div>
            <div className="report-output-actions">
              <Button variant="secondary" onClick={() => void copyText()}><Clipboard size={16} aria-hidden="true" />{copied ? 'Copié ✓' : 'Copier le texte'}</Button>
              <Button variant="secondary" onClick={downloadCsv}><Download size={16} aria-hidden="true" />Télécharger CSV</Button>
              <Button variant="secondary" onClick={requestPrint}><Printer size={16} aria-hidden="true" />Imprimer / PDF</Button>
            </div>
          </>}
        </section>
      </div>
    </Modal>
  );
}

function sortRows(rows: ReportRegistration[], sort: 'time' | 'user'): ReportRegistration[] {
  return [...rows].sort((a, b) => a.send_day.localeCompare(b.send_day) || (sort === 'user'
    ? toTitleCase(a.profiles?.full_name ?? '').localeCompare(toTitleCase(b.profiles?.full_name ?? ''), 'fr') || a.created_at.localeCompare(b.created_at)
    : a.created_at.localeCompare(b.created_at)));
}

function columnValue(row: ReportRegistration, column: ReportColumn): string {
  switch (column) {
    case 'time': return formatReportTime(row.created_at);
    case 'user': return toTitleCase(row.profiles?.full_name ?? '—');
    case 'number': return `n°${row.day_seq}`;
    case 'identifier': return row.email;
    case 'phone': return row.numero ?? '—';
    case 'status': return REGISTRATION_STATUS_PRESENTATION[row.status].label;
    case 'amount': return row.amount === null ? '—' : formatAmount(row.amount);
    case 'whatsapp': return row.exported_at ? `Envoyé ${formatReportTime(row.exported_at)}` : 'Non envoyé';
    case 'description': return row.description ?? '—';
  }
}

function buildUserSummaryRows(rows: ReportRegistration[]): string[][] {
  const users = new Map<string, ReportRegistration[]>();
  for (const row of rows) {
    const key = `${row.send_day}:${row.agent_id}`;
    const values = users.get(key) ?? [];
    values.push(row);
    users.set(key, values);
  }
  return [...users.entries()].map(([agentId, registrations]) => {
    const counts = reportStatusCounts(registrations);
    return [
      registrations[0].send_day,
      toTitleCase(registrations[0].profiles?.full_name ?? agentId.slice(agentId.indexOf(':') + 1)),
      String(registrations.length),
      String(counts.gagne),
      String(counts.paye),
      String(counts.echec),
      String(counts.renonce),
      String(counts.en_attente),
      String(counts.refuse),
      formatAmount(registrations.filter((row) => row.status === 'gagne').reduce((total, row) => total + (row.amount ?? 0), 0)),
      formatAmount(registrations.filter((row) => row.status === 'paye').reduce((total, row) => total + (row.amount ?? 0), 0)),
    ];
  }).sort((first, second) => first[0].localeCompare(second[0]) || first[1].localeCompare(second[1], 'fr'));
}

function RegistrationPreview({ registration, onClose, hideUser }: { registration: ReportRegistration | null; onClose: () => void; hideUser: boolean }) {
  if (!registration) return null;
  return <Modal open onClose={onClose} title="Détail de l’enregistré">
    <div className="day-registration-detail">
      {!hideUser && <p><strong>Utilisateur</strong><span>{toTitleCase(registration.profiles?.full_name ?? '—')}</span></p>}
      <p><strong>N°</strong><span>n°{registration.day_seq}</span></p>
      <p><strong>Identifiant</strong><span>{registration.email}</span></p>
      {registration.numero && <p><strong>Numéro</strong><span>{registration.numero}</span></p>}
      <p><strong>Statut</strong><span><Badge status={registration.status} amount={registration.amount} /></span></p>
      <p><strong>Montant</strong><span>{registration.amount === null ? '—' : formatAmount(registration.amount)}</span></p>
      <p><strong>Envoi WhatsApp</strong><span>{registration.exported_at ? `Envoyé ${formatReportTime(registration.exported_at)}` : 'Non envoyé'}</span></p>
      <p><strong>Date</strong><span>{formatReportDate(registration.send_day)} · {formatReportTime(registration.created_at)}</span></p>
      {registration.description && <p><strong>Description</strong><span>{registration.description}</span></p>}
    </div>
  </Modal>;
}

export function DayReportsPage() {
  const { profile, role } = useAuth();
  const isAgent = role === 'agent';
  const today = getDayBounds().today;
  const params = useParams();
  const day = params.date;
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [period, setPeriod] = useState<((typeof PERIODS)[number])['id']>(() => {
    const requested = new URLSearchParams(location.search).get('periode');
    return PERIODS.find(({ id }) => id === requested)?.id ?? '30';
  });
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(() => {
    const initialAgentId = readAdminDayUserFilter(location.search, isAgent);
    return initialAgentId ? [initialAgentId] : [];
  });
  const [statuses, setStatuses] = useState<RegistrationStatus[]>([]);
  const [monthsVisible, setMonthsVisible] = useState(2);
  const [generatorOpen, setGeneratorOpen] = useState(() => new URLSearchParams(location.search).get('ouvrirRapport') === '1');
  const [tab, setTab] = useState<'days' | 'global'>('days');
  const detailAgentId = readAdminDayUserFilter(searchParams, isAgent);
  const { toasts, show, dismiss } = useToast();
  const online = useOnlineStatus();
  const agentList = useAgentsOverview(!isAgent);
  const detailId = searchParams.get('r') ?? '';
  const { from, to } = initialRange(today, period);
  const reportAgentIds = isAgent && profile ? [profile.id] : selectedAgentIds;
  const earliestDay = useEarliestReportDay(reportAgentIds, period === 'all' && !day);
  const requestedMonthRanges = period === 'all'
    ? earliestDay.data ? monthRanges(undefined, today, monthsVisible) : []
    : monthRanges(from, to);
  const monthQueries = useQueries({
    queries: requestedMonthRanges.map((range) => reportDayStatsQueryOptions({
      ...range,
      agentIds: reportAgentIds,
    }, profile?.id ?? '')),
  });
  const statsIsPending = (period === 'all' && earliestDay.isPending) || monthQueries.some((query) => query.isPending);
  const statsError = monthQueries.find((query) => query.isError)?.error
    ?? (period === 'all' && earliestDay.isError ? earliestDay.error : null);
  const validDay = day && isValidReportDay(day, today) ? day : undefined;
  const detailStats = useReportDayStats({
    from: validDay,
    to: validDay,
    agentIds: isAgent && profile ? [profile.id] : detailAgentId ? [detailAgentId] : undefined,
    enabled: Boolean(validDay),
  });
  const dayList = useDayRegistrations(validDay ?? '', {
    agentIds: isAgent && profile ? [profile.id] : detailAgentId ? [detailAgentId] : undefined,
    statuses: statuses.length ? statuses : undefined,
  });
  const allStats = monthQueries.flatMap((query) => query.data ?? []);
  const dayRows = dayList.data?.pages.flat() ?? [];
  const visibleDetailRow = dayRows.find((row) => row.id === detailId) ?? null;
  const detailById = useDayRegistrationById(detailId, validDay, !visibleDetailRow);
  const monthGroups = useMemo(() => {
    const filtered = allStats.filter((item) => item.day <= today && (!from || item.day >= from));
    const days = [...filtered];
    if ((!from || from <= today) && !days.some((item) => item.day === today)) days.unshift(dayRegistrationFromStats(today));
    const groups = new Map<string, DayTotals[]>();
    for (const item of days) {
      const key = item.day.slice(0, 7);
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, monthsVisible);
  }, [allStats, from, isAgent, monthsVisible, period, today]);
  const hasMoreMonths = period === 'all'
    && Boolean(earliestDay.data && requestedMonthRanges[0] && earliestDay.data < requestedMonthRanges[0].from);
  const currentDay = detailStats.data?.[0] ?? dayRegistrationFromStats(day ?? today);
  const queryDetailRow = visibleDetailRow ?? detailById.data ?? null;

  useEffect(() => {
    if (day && !isValidReportDay(day, today)) navigate(isAgent ? '/espace/jours' : '/admin/jours', { replace: true, state: { invalidDay: true } });
  }, [day, isAgent, navigate, today]);

  useEffect(() => {
    if (location.state && typeof location.state === 'object' && 'invalidDay' in location.state) {
      show('Date invalide.', 'error');
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate, show]);

  useEffect(() => {
    if (isAgent && profile) setSelectedAgentIds([profile.id]);
  }, [isAgent, profile]);

  const selectRegistration = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('r', id);
    else next.delete('r');
    setSearchParams(next, { replace: true });
  };
  const selectDetailAgent = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('u', id);
    else next.delete('u');
    setSearchParams(next, { replace: true });
  };
  const profileReturnPath = detailAgentId ? `/admin/utilisateurs/${detailAgentId}` : null;
  const stateReturnTo = location.state && typeof location.state === 'object' && 'returnTo' in location.state
    ? location.state.returnTo
    : null;
  const returnFromDetail = () => {
    if (profileReturnPath && stateReturnTo === profileReturnPath && window.history.length > 1) {
      navigate(-1);
    } else if (profileReturnPath) {
      navigate(`${profileReturnPath}?u=${encodeURIComponent(detailAgentId ?? '')}`);
    } else {
      navigate(isAgent ? '/espace/jours' : '/admin/jours');
    }
  };

  useEffect(() => {
    if (!detailId || !detailById.isError) return;
    show(detailById.error.message, 'error');
    selectRegistration(null);
  }, [detailById.error, detailById.isError, detailId, searchParams, show]);

  const toggleStatus = (status: RegistrationStatus) => setStatuses((current) => (
    current.includes(status) ? current.filter((value) => value !== status) : [...current, status]
  ));

  const userOptions = isAgent
    ? []
    : (agentList.data ?? []).map(({ agent_id, full_name }) => ({ agent_id, full_name }));

  if (day) {
    const basePath = isAgent ? '/espace/jours' : '/admin/jours';
    const dayPath = (targetDay: string) => `${basePath}/${targetDay}${detailAgentId ? `?u=${encodeURIComponent(detailAgentId)}` : ''}`;
    return <div className="page-content day-report-page">
      <header className="day-report-detail-header">
        <Button variant="ghost" className="icon-button" aria-label={profileReturnPath ? 'Retour à la fiche utilisateur' : 'Retour aux jours'} onClick={returnFromDetail}><ArrowLeft size={20} aria-hidden="true" /></Button>
        <div><span className="eyebrow">{isAgent ? 'ESPACE AGENT' : 'ESPACE ADMIN'}</span><h1>{formatReportDate(day)}</h1></div>
        {isAgent && profile && detailStats.data && <AgentDayReportActions day={day} agentId={profile.id} agentName={profile.full_name} total={currentDay.total} show={show} compact />}
        <div className="day-report-header-actions">
          <Button variant="secondary" aria-label="Jour précédent" onClick={() => navigate(dayPath(shiftDay(day, -1)), { state: location.state })}><ArrowLeft size={18} aria-hidden="true" /></Button>
          <Button variant="secondary" aria-label="Jour suivant" disabled={day >= today} onClick={() => navigate(dayPath(shiftDay(day, 1)), { state: location.state })}><ArrowRight size={18} aria-hidden="true" /></Button>
          <Button onClick={() => setGeneratorOpen(true)}><FileText size={17} aria-hidden="true" /> Rapport</Button>
        </div>
      </header>
      {detailStats.isPending ? <Card className="day-report-summary"><Skeleton /><Skeleton /><Skeleton /></Card> : detailStats.isError ? <><p role="alert" className="day-report-error">{detailStats.error.message}</p><ReportDiagnostics error={detailStats.error} visible={role === 'admin'} /></> : <Card className="day-report-summary">
        <div className="day-summary-total"><strong>{currentDay.total}</strong><span>enregistrés</span></div>
        <span>{isAgent ? 'Mes enregistrés' : `${currentDay.users.length} utilisateur${currentDay.users.length === 1 ? '' : 's'}`}</span>
        <div className="day-report-statuses">{nonZeroStatuses(currentDay).map(({ status, count }) => <span className={`day-report-status status-${status}`} key={status}>{count} {STATUS_SHORT[status]}</span>)}</div>
        <p>Gagné : {formatAmount(currentDay.amount_gagne)} · Payé : {formatAmount(currentDay.amount_paye)}</p>
        <p>{currentDay.envoyes} envoyés sur WhatsApp / {currentDay.non_envoyes} non envoyés</p>
        <p>de {formatReportTime(currentDay.first_at)} à {formatReportTime(currentDay.last_at)}</p>
      </Card>}
      {!isAgent && detailAgentId && <button className="day-filter-pill" type="button" onClick={() => selectDetailAgent(null)}>Filtré : {toTitleCase(currentDay.users.find((user) => user.agent_id === detailAgentId)?.full_name ?? userOptions.find((user) => user.agent_id === detailAgentId)?.full_name ?? '')} ✕</button>}
      {!isAgent && currentDay.users.length > 0 && <section className="day-report-users">
        <div className="registration-list-heading"><div><span className="section-kicker">RÉPARTITION</span><h2>Par utilisateur</h2></div>
        </div>
        <div className="day-user-grid">{currentDay.users.map((user) => <button type="button" key={user.agent_id} className={`glass day-user-card ${detailAgentId === user.agent_id ? 'day-user-card-active' : ''}`} onClick={() => selectDetailAgent(detailAgentId === user.agent_id ? null : user.agent_id)}>
          <strong>{toTitleCase(user.full_name)}</strong><span>{user.total} enregistrés</span>
          <span className="day-report-statuses">{nonZeroStatuses(user).map(({ status, count }) => <span className={`day-report-status status-${status}`} key={status}>{count} {STATUS_SHORT[status]}</span>)}</span>
          <small>de {formatReportTime(user.first_at)} à {formatReportTime(user.last_at)}</small>
        </button>)}</div>
      </section>}
      <section className="day-registration-section">
        <div className="registration-list-heading"><div><span className="section-kicker">DÉTAIL</span><h2>Enregistrés du jour</h2></div><span className="registration-count">{dayRows.length} affichés</span></div>
        <div className="status-filter-scroll" role="group" aria-label="Filtrer par statut">
          {REGISTRATION_STATUSES.map((status) => <button type="button" key={status} aria-pressed={statuses.includes(status)} className={`status-filter-chip ${statuses.includes(status) ? 'status-filter-chip-active' : ''}`} onClick={() => toggleStatus(status)}>{REGISTRATION_STATUS_PRESENTATION[status].label}</button>)}
        </div>
        {dayList.isPending ? <><p className="sr-only" role="status">Chargement des enregistrés du jour…</p><div className="day-registrations-list">{[1, 2, 3].map((item) => <Card key={item}><Skeleton /><Skeleton /></Card>)}</div></>
          : dayList.isError ? <p role="alert" className="day-report-error">{dayList.error.message}</p>
            : dayRows.length === 0 ? <EmptyState icon={<CalendarDays />} title="Aucun enregistré pour cette sélection" description="Essayez de modifier les filtres." />
              : <div className="day-registrations-list">{dayRows.map((row) => <button key={row.id} className="glass day-registration-row" type="button" onClick={() => selectRegistration(row.id)}>
                <time dateTime={row.created_at}>{formatReportTime(row.created_at)}</time>
                {!isAgent && <strong>{toTitleCase(row.profiles?.full_name ?? '—')}</strong>}
                <span>n°{row.day_seq}</span><span className="day-registration-email">{row.email}</span>
                <Badge status={row.status} amount={row.amount} />
                <span className={row.exported_at ? 'day-exported' : 'day-not-exported'}>{row.exported_at ? `Envoyé ${formatReportTime(row.exported_at)}` : 'Non envoyé'}</span>
              </button>)}</div>}
        {dayList.hasNextPage && <Button variant="secondary" onClick={() => void dayList.fetchNextPage()} loading={dayList.isFetchingNextPage}>Charger plus</Button>}
      </section>
      <RegistrationPreview registration={queryDetailRow} onClose={() => selectRegistration(null)} hideUser={isAgent} />
      <ReportGenerator open={generatorOpen} day={day} initialAgentIds={detailAgentId ? [detailAgentId] : []} agentOptions={userOptions} onClose={() => setGeneratorOpen(false)} show={show} />
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </div>;
  }

  const monthGroupsForDisplay = monthGroups;
  return <div className="page-content day-report-page">
    {!isAgent && <div className="day-report-tabs" role="tablist" aria-label="Vues des rapports">
      <button type="button" role="tab" aria-selected={tab === 'days'} onClick={() => setTab('days')}>Par jour</button>
      <button type="button" role="tab" aria-selected={tab === 'global'} onClick={() => setTab('global')}>Vue globale</button>
    </div>}
    {!isAgent && tab === 'global' ? <AdminRegistrationsPlaceholderPage /> : <>
      <header className="page-header admin-page-header">
        <div><span className="eyebrow">{isAgent ? 'ESPACE AGENT' : 'ESPACE ADMIN'}</span><h1>{isAgent ? 'Mes jours' : 'Jours'}</h1><p>{isAgent ? 'Consultez vos enregistrés jour par jour.' : 'Consultez les enregistrés par journée.'}</p></div>
        <div className="day-report-header-actions">
          <Button onClick={() => setGeneratorOpen(true)}><FileText size={17} aria-hidden="true" /> Rapport</Button>
          {!isAgent && <label className="day-agent-select"><Users size={17} aria-hidden="true" /><select aria-label="Filtrer par utilisateur" value={selectedAgentIds[0] ?? ''} onChange={(event) => setSelectedAgentIds(event.target.value ? [event.target.value] : [])}><option value="">Tous les utilisateurs</option>{userOptions.map((agent) => <option key={agent.agent_id} value={agent.agent_id}>{toTitleCase(agent.full_name)}</option>)}</select></label>}
        </div>
      </header>
      <div className="day-period-filters" role="group" aria-label="Période">
        {PERIODS.map(({ id, label }) => <button type="button" key={id} className={`status-filter-chip ${period === id ? 'status-filter-chip-active' : ''}`} aria-pressed={period === id} onClick={() => { setPeriod(id); setMonthsVisible(2); }}>{label}</button>)}
      </div>
      {!online && <p className="day-report-offline" role="status">Hors ligne. Les données affichées peuvent ne pas être à jour.</p>}
      {statsIsPending ? <><p className="sr-only" role="status">Chargement des jours…</p><div className="day-report-grid">{[1, 2, 3, 4, 5, 6].map((item) => <Card className="day-card-skeleton" key={item}><Skeleton /><Skeleton /><Skeleton /></Card>)}</div></>
        : statsError ? <><p className="day-report-error" role="alert">{statsError instanceof Error ? statsError.message : 'Impossible de charger les jours. Réessayez.'}</p><ReportDiagnostics error={statsError} visible={role === 'admin'} /></>
          : <>
            {!monthGroupsForDisplay.some(([, days]) => days.some((item) => item.total > 0)) && <EmptyState icon={<CalendarDays />} title="Aucun enregistré sur cette période" description="Ajustez la période ou le filtre utilisateur." />}
            {monthGroupsForDisplay.map(([month, days]) => <section className="day-month-section" key={month}>
              <h2>{monthLabel(`${month}-01`)}</h2>
              <div className="day-report-grid">{days.map((item) => <DayReportCard
                key={item.day}
                day={item}
                today={today}
                agentOnly={isAgent}
                agentId={!isAgent ? selectedAgentIds[0] : undefined}
                returnTo={!isAgent && selectedAgentIds[0] ? `/admin/utilisateurs/${selectedAgentIds[0]}` : undefined}
                actions={isAgent && item.day === today && profile
                  ? <AgentDayReportActions day={item.day} agentId={profile.id} agentName={profile.full_name} total={item.total} show={show} compact />
                  : undefined}
              />)}</div>
            </section>)}
          </>}
      {hasMoreMonths && !statsIsPending && <Button variant="secondary" onClick={() => setMonthsVisible((count) => count + 2)}>Charger plus</Button>}
      <ReportGenerator open={generatorOpen} initialAgentIds={selectedAgentIds} agentOptions={userOptions} onClose={() => setGeneratorOpen(false)} show={show} />
    </>}
    <ToastViewport toasts={toasts} dismiss={dismiss} />
  </div>;
}
