import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  ArrowLeft,
  Check,
  Clock3,
  Eye,
  FileDown,
  Inbox,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Send,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ToastViewport } from '../components/layout/ToastViewport';
import { RegistrationRecordList } from '../components/registrations/RegistrationRecordList';
import { ExportPdfModal } from '../components/exports/ExportPdfModal';
import { WhatsAppExportModal } from '../components/exports/WhatsAppExportModal';
import {
  Avatar,
  ActionMenu,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Skeleton,
  StatCard,
} from '../components/ui';
import { useToast } from '../hooks/use-toast';
import {
  useAdminStats,
  useAgentProfile,
  useAgentRegistrations,
  useAdminRegistrations,
  useAgentExportCounts,
  useAgentsOverview,
  useDailyRegistrations,
  useRecentRegistrations,
  useToggleSuspension,
  useUpdateAgentWhatsapp,
} from '../hooks/useAdmin';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { formatAmount, formatDate, formatRelative, toTitleCase } from '../lib/format';
import type { AgentOverview, DailyPoint, RegistrationStatus, RegistrationWithAgent } from '../types/database';
import { generateAgentsSummaryPdf } from '../lib/exports/pdf';

const statusItems: Array<{ status: RegistrationStatus; label: string }> = [
  { status: 'en_attente', label: 'En attente' },
  { status: 'paye', label: 'Payés' },
  { status: 'refuse', label: 'Refusés' },
  { status: 'probleme', label: 'Problèmes' },
];

export function AdminDashboardPage() {
  const { profile } = useAuth();
  const stats = useAdminStats();
  const agents = useAgentsOverview();
  const daily = useDailyRegistrations(14);
  const recent = useRecentRegistrations();
  const [activeDay, setActiveDay] = useState<number | null>(null);

  const refresh = () => {
    void Promise.all([stats.refetch(), agents.refetch(), daily.refetch(), recent.refetch()]);
  };
  const topAgents = [...(agents.data ?? [])]
    .sort((first, second) => second.total - first.total)
    .slice(0, 5);

  return (
    <div className="page-content admin-dashboard-page">
      <header className="page-header admin-page-header">
        <div>
          <span className="eyebrow">BONJOUR {profile ? toTitleCase(profile.full_name) : ''}</span>
          <h1>Tableau de bord</h1>
          <p>Vue d’ensemble des utilisateurs et des enregistrements fictifs.</p>
        </div>
        <Button
          variant="ghost"
          className="refresh-button"
          onClick={refresh}
          disabled={stats.isFetching || agents.isFetching || daily.isFetching || recent.isFetching}
          aria-label="Actualiser le tableau de bord"
          title="Actualiser"
        >
          <RefreshCw size={18} aria-hidden="true" />
        </Button>
      </header>

      <section className="admin-stats-grid" aria-label="Statistiques générales">
        {stats.isPending ? (
          Array.from({ length: 6 }, (_, index) => (
            <Card className="admin-stat-skeleton" key={index}>
              <Skeleton className="admin-stat-skeleton-icon" />
              <Skeleton className="admin-stat-skeleton-label" />
              <Skeleton className="admin-stat-skeleton-value" />
            </Card>
          ))
        ) : stats.isError ? (
          <Card className="admin-error-card" role="alert">
            <p>{stats.error.message}</p>
            <Button variant="secondary" onClick={() => void stats.refetch()}>Réessayer</Button>
          </Card>
        ) : (
          <>
            <StatCard
              label="Utilisateurs"
              value={String(stats.data.agents_total)}
              description={`${stats.data.agents_suspended} suspendu(s)`}
              icon={<UsersRound size={20} aria-hidden="true" />}
            />
            <StatCard label="Enregistrés" value={String(stats.data.total)} icon={<Inbox size={20} aria-hidden="true" />} />
            <StatCard label="En attente" value={String(stats.data.en_attente)} icon={<Clock3 size={20} aria-hidden="true" />} />
            <StatCard label="Payés" value={String(stats.data.payes)} icon={<Check size={20} aria-hidden="true" />} />
            <StatCard
              label="Refusés + problèmes"
              value={String(stats.data.refuses + stats.data.problemes)}
              description={`${stats.data.refuses} refusés · ${stats.data.problemes} problèmes`}
              icon={<Activity size={20} aria-hidden="true" />}
            />
            <StatCard
              label="Montant total payé"
              value={formatAmount(stats.data.montant_total)}
              icon={<Wallet size={20} aria-hidden="true" />}
            />
          </>
        )}
      </section>

      {stats.data && (
        <StatusDistribution
          total={stats.data.total}
          values={{
            en_attente: stats.data.en_attente,
            paye: stats.data.payes,
            refuse: stats.data.refuses,
            probleme: stats.data.problemes,
          }}
        />
      )}

      <section className="admin-section" aria-labelledby="activity-chart-title">
        <div className="section-heading">
          <div>
            <span className="section-kicker">TENDANCE</span>
            <h2 id="activity-chart-title">Activité des 14 derniers jours</h2>
          </div>
          <span className="admin-chart-legend">
            <span className="legend-registration" /> Enregistrés
            <span className="legend-paid" /> Payés
          </span>
        </div>
        {daily.isPending ? (
          <Card className="admin-chart-skeleton"><Skeleton className="admin-chart-skeleton-inner" /></Card>
        ) : daily.isError ? (
          <Card className="admin-inline-error" role="alert">
            <span>{daily.error.message}</span>
            <Button variant="ghost" onClick={() => void daily.refetch()}>Réessayer</Button>
          </Card>
        ) : daily.data.length === 0 ? (
          <Card className="admin-chart-empty">
            <EmptyState icon={<Activity size={22} aria-hidden="true" />} title="Aucune activité" description="Aucun enregistrement sur cette période." />
          </Card>
        ) : (
          <ActivityChart points={daily.data} activeDay={activeDay} onActiveDay={setActiveDay} />
        )}
      </section>

      <div className="admin-dashboard-columns">
        <section className="admin-section" aria-labelledby="top-agents-title">
          <div className="section-heading">
            <div>
              <span className="section-kicker">CLASSEMENT</span>
              <h2 id="top-agents-title">Utilisateurs les plus actifs</h2>
            </div>
            <Link className="admin-see-all" to="/admin/utilisateurs">Voir tous</Link>
          </div>
          {agents.isPending ? (
            <div className="admin-ranking-list">{Array.from({ length: 3 }, (_, index) => <Skeleton className="admin-ranking-skeleton" key={index} />)}</div>
          ) : agents.isError ? (
            <Card className="admin-inline-error" role="alert">
              <span>{agents.error.message}</span>
              <Button variant="ghost" onClick={() => void agents.refetch()}>Réessayer</Button>
            </Card>
          ) : topAgents.length === 0 ? (
            <Card className="admin-chart-empty"><EmptyState icon={<UsersRound size={22} aria-hidden="true" />} title="Aucun utilisateur pour l’instant" description="Les utilisateurs apparaîtront ici." /></Card>
          ) : (
            <Card className="admin-ranking-list">
              {topAgents.map((agent, index) => (
                <Link className="admin-ranking-row" to={`/admin/utilisateurs/${agent.agent_id}`} key={agent.agent_id}>
                  <span className="admin-ranking-position">{index + 1}</span>
                  <Avatar name={toTitleCase(agent.full_name)} size="small" />
                  <span className="admin-ranking-name">{toTitleCase(agent.full_name)}</span>
                  <span className="admin-ranking-count">{agent.total}</span>
                  <span className="admin-ranking-caption">enregistrés</span>
                  <span className="admin-ranking-paid">{agent.payes} payés · {formatAmount(agent.montant_total)}</span>
                </Link>
              ))}
            </Card>
          )}
        </section>

        <section className="admin-section" aria-labelledby="recent-registrations-title">
          <div className="section-heading">
            <div>
              <span className="section-kicker">DERNIÈRE ACTIVITÉ</span>
              <h2 id="recent-registrations-title">Activité récente</h2>
            </div>
          </div>
          {recent.isPending ? (
            <div className="admin-recent-list">{Array.from({ length: 4 }, (_, index) => <Skeleton className="admin-recent-skeleton" key={index} />)}</div>
          ) : recent.isError ? (
            <Card className="admin-inline-error" role="alert">
              <span>{recent.error.message}</span>
              <Button variant="ghost" onClick={() => void recent.refetch()}>Réessayer</Button>
            </Card>
          ) : recent.data.length === 0 ? (
            <Card className="admin-chart-empty"><EmptyState icon={<Inbox size={22} aria-hidden="true" />} title="Aucune activité récente" description="Les derniers enregistrements apparaîtront ici." /></Card>
          ) : (
            <Card className="admin-recent-list">
              {recent.data.map((registration) => (
                <div className="admin-recent-row" key={registration.id}>
                  <div className="admin-recent-copy">
                    <Link to={`/admin/utilisateurs/${registration.agent_id}`} className="admin-recent-agent">
                      {registration.profiles?.full_name ? toTitleCase(registration.profiles.full_name) : 'Utilisateur'}
                    </Link>
                    <span className="admin-recent-number">N° {registration.seq}</span>
                  </div>
                  <div className="admin-recent-meta">
                    <Badge status={registration.status} />
                    <time dateTime={registration.created_at}>{formatRelative(registration.created_at)}</time>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusDistribution({
  total,
  values,
}: {
  total: number;
  values: Record<RegistrationStatus, number>;
}) {
  return (
    <section className="admin-section" aria-labelledby="status-distribution-title">
      <div className="section-heading">
        <div>
          <span className="section-kicker">RÉPARTITION</span>
          <h2 id="status-distribution-title">Enregistrés par statut</h2>
        </div>
      </div>
      <Card className="admin-distribution-card">
        {total === 0 ? (
          <p className="admin-distribution-empty">Aucun enregistré à répartir pour le moment.</p>
        ) : (
          <>
            <div className="admin-distribution-bar" role="img" aria-label={`Répartition des ${total} enregistrés par statut`}>
              {statusItems.map(({ status }) => (
                <span
                  key={status}
                  className={`distribution-segment distribution-${status}`}
                  style={{ width: `${Math.min(100, (values[status] / total) * 100)}%` }}
                />
              ))}
            </div>
            <div className="admin-distribution-legend">
              {statusItems.map(({ status, label }) => (
                <div className="admin-distribution-item" key={status}>
                  <span className={`distribution-dot distribution-${status}`} aria-hidden="true" />
                  <span>{label}</span>
                  <strong>{values[status]}</strong>
                  <small>{((values[status] / total) * 100).toFixed(0)}%</small>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </section>
  );
}

function ActivityChart({
  points,
  activeDay,
  onActiveDay,
}: {
  points: DailyPoint[];
  activeDay: number | null;
  onActiveDay: (index: number | null) => void;
}) {
  const chartPoints = points.slice(-14);
  const maxValue = Math.max(1, ...chartPoints.flatMap((point) => [point.total, point.payes]));
  const chartWidth = 350;
  const chartHeight = 190;
  const left = 26;
  const right = 6;
  const top = 14;
  const bottom = 26;
  const plotHeight = chartHeight - top - bottom;
  const plotWidth = chartWidth - left - right;
  const groupWidth = plotWidth / Math.max(chartPoints.length, 1);
  const dayLabel = (value: string) => {
    const date = new Date(`${value}T12:00:00`);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(date)
      : value.slice(5, 10).replace('-', '/');
  };
  const selected = activeDay === null ? null : chartPoints[activeDay];

  return (
    <Card className="admin-chart-card">
      {selected && (
        <p className="admin-chart-tooltip" role="status">
          {dayLabel(selected.day)} · {selected.total} enregistrés · {selected.payes} payés
        </p>
      )}
      <svg
        className="admin-activity-chart"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label="Diagramme des enregistrements et paiements des 14 derniers jours"
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = top + plotHeight * ratio;
          const value = Math.round(maxValue * (1 - ratio));
          return (
            <g key={ratio}>
              <line x1={left} x2={chartWidth - right} y1={y} y2={y} className="chart-grid-line" />
              <text x={left - 5} y={y + 3} textAnchor="end" className="chart-axis-label">{value}</text>
            </g>
          );
        })}
        {chartPoints.map((point, index) => {
          const center = left + groupWidth * index + groupWidth / 2;
          const totalHeight = (point.total / maxValue) * plotHeight;
          const paidHeight = (point.payes / maxValue) * plotHeight;
          const showLabel = index % 2 === 0 || index === chartPoints.length - 1;
          return (
            <g
              key={`${point.day}-${index}`}
              className="chart-day"
              tabIndex={0}
              aria-label={`${dayLabel(point.day)} : ${point.total} enregistrés, ${point.payes} payés`}
              onMouseEnter={() => onActiveDay(index)}
              onMouseLeave={() => onActiveDay(null)}
              onFocus={() => onActiveDay(index)}
              onBlur={() => onActiveDay(null)}
              onTouchStart={() => onActiveDay(index)}
            >
              <rect
                x={center - 7}
                y={top + plotHeight - totalHeight}
                width={6}
                height={Math.max(0, totalHeight)}
                rx={3}
                className="chart-registration-bar"
              />
              <rect
                x={center + 1}
                y={top + plotHeight - paidHeight}
                width={6}
                height={Math.max(0, paidHeight)}
                rx={3}
                className="chart-paid-bar"
              />
              {showLabel && (
                <text x={center} y={chartHeight - 7} textAnchor="middle" className="chart-axis-label">
                  {dayLabel(point.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </Card>
  );
}

type AgentFilter = 'all' | 'active' | 'suspended';
type AgentSort = 'recent' | 'total' | 'amount';

export function AdminUsersPage() {
  const agents = useAgentsOverview();
  const exportCounts = useAgentExportCounts();
  const mutation = useToggleSuspension();
  const { toasts, show, dismiss } = useToast();
  const online = useOnlineStatus();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<AgentFilter>('all');
  const [sort, setSort] = useState<AgentSort>('recent');
  const [selected, setSelected] = useState<AgentOverview | null>(null);
  const [whatsappAgent, setWhatsappAgent] = useState<AgentOverview | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filteredAgents = useMemo(() => {
    const term = debouncedSearch.trim().toLocaleLowerCase('fr');
    return [...(agents.data ?? [])]
      .filter((agent) => {
        const matchesText = !term ||
          agent.full_name.toLocaleLowerCase('fr').includes(term) ||
          agent.whatsapp.toLocaleLowerCase('fr').includes(term);
        const matchesStatus = filter === 'all' ||
          (filter === 'suspended' ? agent.is_suspended : !agent.is_suspended);
        return matchesText && matchesStatus;
      })
      .sort((first, second) => {
        if (sort === 'total') return second.total - first.total;
        if (sort === 'amount') return second.montant_total - first.montant_total;
        return new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
      });
  }, [agents.data, debouncedSearch, filter, sort]);

  const confirmSuspension = async () => {
    if (!selected) return;
    const targetSuspension = !selected.is_suspended;
    try {
      await mutation.mutateAsync({ agentId: selected.agent_id, isSuspended: targetSuspension });
      show(targetSuspension ? 'Utilisateur suspendu.' : 'Utilisateur réactivé.', 'success');
      setSelected(null);
    } catch (error) {
      show(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.', 'error');
    }
  };

  const counts = agents.data ?? [];
  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setFilter('all');
  };

  const exportSummary = async () => {
    if (!agents.data) return;
    setSummaryLoading(true);
    try {
      await generateAgentsSummaryPdf({ rows: filteredAgents });
      show('PDF généré', 'success');
    } catch (error) {
      show(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.', 'error');
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <div className="page-content admin-users-page">
      <header className="page-header admin-page-header">
        <div>
          <span className="eyebrow">GESTION</span>
          <h1>Utilisateurs</h1>
          <p>{agents.isPending ? 'Chargement…' : `${counts.length} utilisateur${counts.length === 1 ? '' : 's'}`}</p>
        </div>
        <div className="admin-user-header-actions">
          <Button variant="secondary" onClick={() => void exportSummary()} loading={summaryLoading} disabled={agents.isPending || filteredAgents.length === 0}>
            <FileDown size={17} aria-hidden="true" /> Exporter le récapitulatif (PDF)
          </Button>
          <label className="admin-sort">
            <span>Trier par</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as AgentSort)}>
              <option value="recent">Plus récents</option>
              <option value="total">Plus d’enregistrés</option>
              <option value="amount">Plus de montant</option>
            </select>
          </label>
        </div>
      </header>

      <div className="admin-users-controls">
        <Input
          className="admin-user-search"
          label="Rechercher un utilisateur"
          type="search"
          autoComplete="off"
          placeholder="Nom ou numéro WhatsApp"
          icon={<Search size={18} aria-hidden="true" />}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="status-filter-scroll admin-account-filters" role="group" aria-label="Filtrer les utilisateurs">
          {[
            { value: 'all' as const, label: 'Tous' },
            { value: 'active' as const, label: 'Actifs' },
            { value: 'suspended' as const, label: 'Suspendus' },
          ].map((option) => (
            <button
              className={`status-filter-chip ${filter === option.value ? 'status-filter-chip-active' : ''}`}
              type="button"
              key={option.value}
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {agents.isPending ? (
        <div className="admin-agent-cards" aria-label="Chargement des utilisateurs">
          {Array.from({ length: 4 }, (_, index) => <Card className="admin-agent-skeleton" key={index}><Skeleton className="admin-agent-skeleton-line" /><Skeleton className="admin-agent-skeleton-line" /><Skeleton className="admin-agent-skeleton-line" /></Card>)}
        </div>
      ) : agents.isError ? (
        <Card className="admin-empty-card" role="alert">
          <EmptyState icon={<UsersRound size={22} aria-hidden="true" />} title="Impossible de charger les utilisateurs" description={agents.error.message} action={<Button variant="secondary" onClick={() => void agents.refetch()}>Réessayer</Button>} />
        </Card>
      ) : filteredAgents.length === 0 ? (
        <Card className="admin-empty-card">
          <EmptyState
            icon={<Inbox size={22} aria-hidden="true" />}
            title={counts.length === 0 ? 'Aucun utilisateur pour l’instant' : 'Aucun résultat'}
            description={counts.length === 0 ? 'Les utilisateurs apparaîtront ici.' : 'Aucun utilisateur ne correspond à cette recherche ou à ces filtres.'}
            action={counts.length > 0 ? <Button variant="secondary" onClick={resetFilters}>Réinitialiser</Button> : undefined}
          />
        </Card>
      ) : (
        <>
          <div className="admin-agent-cards">
            {filteredAgents.map((agent) => (
              <AgentCard
                agent={agent}
                key={agent.agent_id}
                onToggle={() => setSelected(agent)}
                notExportedCount={exportCounts.data?.[agent.agent_id] ?? 0}
                onWhatsApp={() => setWhatsappAgent(agent)}
                online={online}
              />
            ))}
          </div>
          <div className="admin-agents-table-wrap glass">
            <table className="admin-agents-table">
              <thead><tr><th>Utilisateur</th><th>WhatsApp</th><th>Statut du compte</th><th>Enregistrés</th><th>Payés</th><th>En attente</th><th>Montant payé</th><th>Dernière activité</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredAgents.map((agent) => (
                  <tr key={agent.agent_id}>
                    <td><Link className="admin-table-user" to={`/admin/utilisateurs/${agent.agent_id}`}><Avatar name={toTitleCase(agent.full_name)} size="small" />{toTitleCase(agent.full_name)}</Link></td>
                    <td>{agent.whatsapp}</td>
                    <td><AccountStatus suspended={agent.is_suspended} /></td>
                    <td>{agent.total}</td>
                    <td>{agent.payes}</td>
                    <td>{agent.en_attente}</td>
                    <td>{formatAmount(agent.montant_total)}</td>
                    <td>{agent.last_activity ? formatRelative(agent.last_activity) : '—'}</td>
                    <td className="admin-table-actions">
                      <Link to={`/admin/utilisateurs/${agent.agent_id}`} aria-label={`Voir la fiche de ${toTitleCase(agent.full_name)}`} title="Voir la fiche"><Eye size={17} aria-hidden="true" /></Link>
                      <AgentActionMenu
                        agent={agent}
                        onToggle={() => setSelected(agent)}
                        onWhatsApp={() => setWhatsappAgent(agent)}
                        notExportedCount={exportCounts.data?.[agent.agent_id] ?? 0}
                        online={online}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <SuspensionConfirmation
        agent={selected}
        pending={mutation.isPending}
        online={online}
        onCancel={() => setSelected(null)}
        onConfirm={() => void confirmSuspension()}
      />
      <WhatsAppExportModal
        open={Boolean(whatsappAgent)}
        agent={whatsappAgent}
        onClose={() => setWhatsappAgent(null)}
      />
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

function AgentCard({
  agent,
  onToggle,
  onWhatsApp,
  notExportedCount,
  online,
}: {
  agent: AgentOverview;
  onToggle: () => void;
  onWhatsApp: () => void;
  notExportedCount: number;
  online: boolean;
}) {
  return (
    <Card className="admin-agent-card">
      <div className="admin-agent-card-heading">
        <Avatar name={toTitleCase(agent.full_name)} size="large" />
        <div className="admin-agent-card-copy">
          <Link to={`/admin/utilisateurs/${agent.agent_id}`} className="admin-agent-name">{toTitleCase(agent.full_name)}</Link>
          <a href={whatsappUrl(agent.whatsapp)} target="_blank" rel="noopener noreferrer" className="admin-agent-whatsapp">{agent.whatsapp}</a>
        </div>
        <AccountStatus suspended={agent.is_suspended} />
      </div>
      <div className="admin-agent-mini-stats">
        <span><strong>{agent.total}</strong> total</span>
        <span><strong>{agent.payes}</strong> payés</span>
        <span><strong>{agent.en_attente}</strong> en attente</span>
      </div>
      <div className="admin-agent-card-meta">
        <span>Montant payé <strong>{formatAmount(agent.montant_total)}</strong></span>
        <span>Dernière activité <strong>{agent.last_activity ? formatRelative(agent.last_activity) : '—'}</strong></span>
      </div>
      <div className="admin-agent-card-actions">
        <Link className="button button-secondary" to={`/admin/utilisateurs/${agent.agent_id}`}>Voir la fiche</Link>
        <AgentActionMenu agent={agent} onToggle={onToggle} onWhatsApp={onWhatsApp} notExportedCount={notExportedCount} online={online} />
      </div>
    </Card>
  );
}

function AgentActionMenu({
  agent,
  onToggle,
  onWhatsApp,
  notExportedCount,
  online,
}: {
  agent: AgentOverview;
  onToggle: () => void;
  onWhatsApp: () => void;
  notExportedCount: number;
  online: boolean;
}) {
  return (
    <ActionMenu
      label={`Actions pour ${toTitleCase(agent.full_name)}`}
      items={[
        {
          label: 'Contacter sur WhatsApp',
          icon: <Phone size={16} />,
          href: whatsappUrl(agent.whatsapp),
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        {
          label: 'Envoyer sur WhatsApp',
          icon: <Send size={16} />,
          trailing: <span className="export-count-badge">{notExportedCount}</span>,
          onSelect: onWhatsApp,
        },
        {
          label: agent.is_suspended ? 'Réactiver' : 'Suspendre',
          icon: agent.is_suspended ? <ShieldCheck size={16} /> : <ShieldOff size={16} />,
          disabled: !online,
          destructive: !agent.is_suspended,
          positive: agent.is_suspended,
          separatorBefore: true,
          onSelect: onToggle,
        },
      ]}
    />
  );
}

function whatsappUrl(number: string): string {
  return `https://wa.me/${number.replace(/\D/g, '')}`;
}

function AccountStatus({ suspended }: { suspended: boolean }) {
  return (
    <span className={`account-status ${suspended ? 'account-status-suspended' : 'account-status-active'}`}>
      {suspended ? 'Suspendu' : 'Actif'}
    </span>
  );
}

function SuspensionConfirmation({
  agent,
  pending,
  online,
  onCancel,
  onConfirm,
}: {
  agent: AgentOverview | null;
  pending: boolean;
  online: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const suspended = agent ? !agent.is_suspended : false;
  const name = agent ? toTitleCase(agent.full_name) : '';
  return (
    <Modal
      open={Boolean(agent)}
      title={suspended ? `Suspendre ${name} ?` : `Réactiver ${name} ?`}
      onClose={onCancel}
      className="admin-confirm-modal"
    >
      {agent && (
        <>
          {!online && <p className="auth-error" role="status">Reconnectez-vous à Internet pour modifier ce compte.</p>}
          <p className="modal-description">
            {suspended
              ? 'Il ne pourra plus enregistrer de clients et verra un écran de suspension.'
              : 'Il pourra à nouveau accéder à son espace et enregistrer des clients.'}
          </p>
          <div className="admin-confirm-actions">
            <Button variant="secondary" onClick={onCancel} disabled={pending}>Annuler</Button>
            <Button variant={suspended ? 'danger' : 'primary'} loading={pending} disabled={!online || pending} onClick={onConfirm}>
              {suspended ? 'Confirmer la suspension' : 'Confirmer la réactivation'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

export function AdminAgentDetailPage() {
  const { id = '' } = useParams();
  const profile = useAgentProfile(id);
  const agents = useAgentsOverview();
  const exportCounts = useAgentExportCounts();
  const mutation = useToggleSuspension();
  const whatsappMutation = useUpdateAgentWhatsapp();
  const { toasts, show, dismiss } = useToast();
  const online = useOnlineStatus();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [selectedRegistration, setSelectedRegistration] = useState<RegistrationWithAgent | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AgentOverview | null>(null);
  const [exportPdfOpen, setExportPdfOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [editWhatsappOpen, setEditWhatsappOpen] = useState(false);
  const [whatsappValue, setWhatsappValue] = useState('');
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const agentPdfFilters = useMemo(() => ({ status: null, agentId: id }), [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filteredRegistrations = useAgentRegistrations(id, {
    status,
    search: debouncedSearch.trim(),
  });
  const agent = agents.data?.find((item) => item.agent_id === id);
  const registrationItems = filteredRegistrations.data?.pages.flat() ?? [];

  const toggleSuspension = async () => {
    if (!profile.data || profile.data.role !== 'agent') return;
    try {
      await mutation.mutateAsync({ agentId: id, isSuspended: !profile.data.is_suspended });
      show(profile.data.is_suspended ? 'Utilisateur réactivé.' : 'Utilisateur suspendu.', 'success');
      setConfirmTarget(null);
    } catch (error) {
      show(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.', 'error');
    }
  };

  const saveWhatsapp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\+[0-9]{8,15}$/.test(whatsappValue)) {
      setWhatsappError('Utilisez le format international : + suivi de 8 à 15 chiffres, par exemple +2250700000000.');
      return;
    }
    if (whatsappMutation.isPending) return;
    setWhatsappError(null);
    try {
      await whatsappMutation.mutateAsync({ agentId: id, whatsapp: whatsappValue });
      show('Numéro WhatsApp modifié.', 'success');
      setEditWhatsappOpen(false);
    } catch (error) {
      setWhatsappError(error instanceof Error ? error.message : 'Impossible de modifier le numéro. Veuillez réessayer.');
    }
  };

  if (profile.isPending || agents.isPending) {
    return (
      <div className="page-content admin-detail-page">
        <Skeleton className="admin-detail-header-skeleton" />
        <div className="admin-detail-stats">{Array.from({ length: 4 }, (_, index) => <Skeleton className="admin-detail-stat-skeleton" key={index} />)}</div>
      </div>
    );
  }

  if (profile.isError || agents.isError) {
    const message = profile.error?.message ?? agents.error?.message ?? 'Une erreur est survenue. Veuillez réessayer.';
    return (
      <div className="page-content">
        <Card className="admin-empty-card" role="alert"><EmptyState icon={<Inbox size={22} aria-hidden="true" />} title="Impossible de charger la fiche" description={message} action={<Button variant="secondary" onClick={() => { void profile.refetch(); void agents.refetch(); }}>Réessayer</Button>} /></Card>
      </div>
    );
  }

  if (!profile.data || profile.data.role !== 'agent') {
    return (
      <div className="page-content">
        <Card className="admin-empty-card">
          <EmptyState icon={<UsersRound size={22} aria-hidden="true" />} title="Utilisateur introuvable" description="Cet utilisateur n’existe pas ou n’est pas un agent." action={<Link className="button button-secondary" to="/admin/utilisateurs"><ArrowLeft size={17} aria-hidden="true" /> Retour aux utilisateurs</Link>} />
        </Card>
      </div>
    );
  }

  const profileWhatsapp = profile.data.whatsapp;
  const isSuspended = profile.data.is_suspended;
  const accountOverview = agent ?? {
    agent_id: id,
    full_name: profile.data.full_name,
    whatsapp: profile.data.whatsapp,
    is_suspended: profile.data.is_suspended,
    created_at: profile.data.created_at,
    total: 0,
    payes: 0,
    en_attente: 0,
    montant_total: 0,
    last_activity: null,
  };

  return (
    <div className="page-content admin-detail-page">
      <Link className="admin-back-link" to="/admin/utilisateurs"><ArrowLeft size={18} aria-hidden="true" /> Retour aux utilisateurs</Link>
      <header className="admin-agent-detail-header">
        <Avatar name={toTitleCase(profile.data.full_name)} size="large" />
        <div className="admin-agent-detail-copy">
          <span className="eyebrow">FICHE UTILISATEUR</span>
          <h1>{toTitleCase(profile.data.full_name)}</h1>
          <a href={whatsappUrl(profile.data.whatsapp)} target="_blank" rel="noopener noreferrer">{profile.data.whatsapp}</a>
          <AccountStatus suspended={isSuspended} />
          <span className="admin-agent-created">Inscrit le {formatDate(profile.data.created_at)}</span>
        </div>
        <div className="admin-detail-header-actions">
          <Button variant="secondary" onClick={() => setExportPdfOpen(true)}>
            <FileDown size={17} aria-hidden="true" /> Exporter en PDF
          </Button>
          <Button variant="secondary" onClick={() => setWhatsappOpen(true)}>
            <Send size={17} aria-hidden="true" /> Envoyer sur WhatsApp
            <span className="export-count-badge">{exportCounts.data?.[id] ?? 0}</span>
          </Button>
          <Button variant="secondary" onClick={() => { setWhatsappValue(profileWhatsapp); setWhatsappError(null); setEditWhatsappOpen(true); }}>
            <Phone size={17} aria-hidden="true" /> Modifier le numéro WhatsApp
          </Button>
          <Button variant={isSuspended ? 'primary' : 'danger'} onClick={() => setConfirmTarget(accountOverview)} disabled={!online}>
            {isSuspended ? <ShieldCheck size={18} aria-hidden="true" /> : <ShieldOff size={18} aria-hidden="true" />}
            {isSuspended ? 'Réactiver' : 'Suspendre'}
          </Button>
          <a className="button button-secondary" href={whatsappUrl(profile.data.whatsapp)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </div>
      </header>

      <section className="admin-detail-stats" aria-label="Statistiques de l’utilisateur">
        <StatCard label="Total" value={String(accountOverview.total)} icon={<UsersRound size={20} aria-hidden="true" />} />
        <StatCard label="Payés" value={String(accountOverview.payes)} icon={<Check size={20} aria-hidden="true" />} />
        <StatCard label="En attente" value={String(accountOverview.en_attente)} icon={<Clock3 size={20} aria-hidden="true" />} />
        <StatCard label="Montant payé" value={formatAmount(accountOverview.montant_total)} icon={<Wallet size={20} aria-hidden="true" />} />
      </section>

      <section className="registration-list-section" aria-labelledby="admin-agent-registration-title">
        <div className="registration-list-heading">
          <div>
            <span className="section-kicker">HISTORIQUE</span>
            <h2 id="admin-agent-registration-title">Ses enregistrés</h2>
          </div>
          <span className="registration-count">{registrationItems.length} affiché{registrationItems.length > 1 ? 's' : ''}</span>
        </div>
        <div className="registration-filters">
          <Input
            className="registration-search"
            label="Rechercher par e-mail"
            type="search"
            inputMode="email"
            autoComplete="off"
            placeholder="Saisissez un e-mail"
            icon={<Search size={18} aria-hidden="true" />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="status-filter-scroll" role="group" aria-label="Filtrer par statut">
            {[{ label: 'Tous', value: null }, ...statusItems.map(({ status: value, label }) => ({ label, value }))].map((filter) => (
              <button
                className={`status-filter-chip ${status === filter.value ? 'status-filter-chip-active' : ''}`}
                type="button"
                key={filter.label}
                aria-pressed={status === filter.value}
                onClick={() => { setStatus(filter.value); setSelectedRegistration(null); }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        {filteredRegistrations.isPending ? (
          <div className="registration-card-list" aria-label="Chargement des enregistrements">
            {Array.from({ length: 4 }, (_, index) => <Card className="registration-skeleton" key={index}><Skeleton className="registration-skeleton-line registration-skeleton-short" /><Skeleton className="registration-skeleton-line" /><Skeleton className="registration-skeleton-line registration-skeleton-medium" /></Card>)}
          </div>
        ) : filteredRegistrations.isError ? (
          <Card className="registration-empty"><EmptyState icon={<Inbox size={23} aria-hidden="true" />} title="Impossible de charger les enregistrements" description={filteredRegistrations.error.message} action={<Button variant="secondary" onClick={() => void filteredRegistrations.refetch()}>Réessayer</Button>} /></Card>
        ) : registrationItems.length === 0 ? (
          <Card className="registration-empty"><EmptyState icon={<Inbox size={23} aria-hidden="true" />} title="Aucun enregistré" description="Aucun enregistrement ne correspond à ces filtres." /></Card>
        ) : (
          <RegistrationRecordList
            items={registrationItems}
            selected={selectedRegistration}
            onSelect={setSelectedRegistration}
            allowStatusChange
            showExportStatus
            readOnly
            show={show}
          />
        )}
        {filteredRegistrations.hasNextPage && (
          <div className="load-more-wrap">
            <Button variant="secondary" loading={filteredRegistrations.isFetchingNextPage} onClick={() => void filteredRegistrations.fetchNextPage()}>
              Charger plus
            </Button>
          </div>
        )}
      </section>
      <SuspensionConfirmation
        agent={confirmTarget}
        pending={mutation.isPending}
        online={online}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => void toggleSuspension()}
      />
      <ExportPdfModal
        open={exportPdfOpen}
        onClose={() => setExportPdfOpen(false)}
        filters={agentPdfFilters}
        title={`Enregistrés de ${toTitleCase(profile.data.full_name)}`}
        subtitle="Export des enregistrements fictifs de cet utilisateur."
        filtersLabel={`Utilisateur : ${toTitleCase(profile.data.full_name)}`}
        agentName={toTitleCase(profile.data.full_name)}
      />
      <WhatsAppExportModal open={whatsappOpen} agent={accountOverview} onClose={() => setWhatsappOpen(false)} />
      <Modal open={editWhatsappOpen} title="Modifier le numéro WhatsApp" onClose={() => setEditWhatsappOpen(false)}>
        <form className="admin-whatsapp-form" onSubmit={(event) => void saveWhatsapp(event)} noValidate>
          <label className="field" htmlFor="agent-whatsapp">
            <span className="field-label">Numéro WhatsApp</span>
            <input
              id="agent-whatsapp"
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={whatsappValue}
              onChange={(event) => setWhatsappValue(event.target.value)}
              aria-describedby="agent-whatsapp-hint"
              aria-invalid={Boolean(whatsappError)}
              disabled={whatsappMutation.isPending}
            />
          </label>
          <p className="field-hint" id="agent-whatsapp-hint">Format attendu : + suivi de 8 à 15 chiffres, par exemple +2250700000000.</p>
          {!online && <p className="auth-error" role="status">Reconnectez-vous à Internet pour modifier ce numéro.</p>}
          {whatsappError && <p className="auth-error" role="alert">{whatsappError}</p>}
          <div className="admin-confirm-actions">
            <Button type="button" variant="secondary" onClick={() => setEditWhatsappOpen(false)} disabled={whatsappMutation.isPending}>Annuler</Button>
            <Button type="submit" loading={whatsappMutation.isPending} disabled={!online || whatsappMutation.isPending}>Enregistrer</Button>
          </div>
        </form>
      </Modal>
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

export function AdminRegistrationsPlaceholderPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [debouncedAgentSearch, setDebouncedAgentSearch] = useState('');
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exported, setExported] = useState<'all' | 'exported' | 'not_exported'>('all');
  const [exportPdfOpen, setExportPdfOpen] = useState(false);
  const [selected, setSelected] = useState<RegistrationWithAgent | null>(null);
  const { toasts, show, dismiss } = useToast();
  const registrations = useAdminRegistrations({
    status,
    search: debouncedSearch.trim(),
    agentName: debouncedAgentSearch.trim(),
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    exported,
  });
  const exportFilters = useMemo(() => ({
    status,
    search: debouncedSearch.trim(),
    agentName: debouncedAgentSearch.trim(),
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    exported,
  }), [status, debouncedSearch, debouncedAgentSearch, dateFrom, dateTo, exported]);
  const filtersLabel = [
    status ? `Statut : ${statusItems.find((item) => item.status === status)?.label ?? status}` : '',
    debouncedSearch.trim() ? `E-mail : ${debouncedSearch.trim()}` : '',
    debouncedAgentSearch.trim() ? `Utilisateur : ${debouncedAgentSearch.trim()}` : '',
    dateFrom ? `Du ${dateFrom}` : '',
    dateTo ? `Au ${dateTo}` : '',
    exported === 'exported' ? 'Envoyés sur WhatsApp' : exported === 'not_exported' ? 'Non envoyés' : '',
  ].filter(Boolean).join(' · ') || 'Aucun filtre';
  const items = registrations.data?.pages.flat() ?? [];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedAgentSearch(agentSearch);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, agentSearch]);

  return (
    <div className="page-content admin-registrations-page">
      <header className="page-header admin-page-header">
        <div>
          <span className="eyebrow">ESPACE ADMIN</span>
          <h1>Enregistrés</h1>
          <p>Tous les enregistrements, tous utilisateurs confondus.</p>
        </div>
        <div className="registration-export-actions">
          <Button className="registration-export-desktop" variant="secondary" onClick={() => setExportPdfOpen(true)}>
            <FileDown size={17} aria-hidden="true" /> Exporter en PDF
          </Button>
          <details className="registration-export-mobile">
            <summary>Exporter</summary>
            <div><button type="button" onClick={() => setExportPdfOpen(true)}>Exporter en PDF</button></div>
          </details>
        </div>
      </header>
      <section className="registration-list-section" aria-labelledby="admin-registrations-title">
        <div className="registration-list-heading">
          <div><span className="section-kicker">SUIVI</span><h2 id="admin-registrations-title">Tous les enregistrés</h2></div>
          <span className="registration-count">{items.length} affiché{items.length > 1 ? 's' : ''}</span>
        </div>
        <div className="admin-registration-filters">
          <Input
            className="registration-search"
            label="Rechercher par e-mail"
            type="search"
            inputMode="email"
            autoComplete="off"
            placeholder="Saisissez un e-mail"
            icon={<Search size={18} aria-hidden="true" />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Input
            className="registration-search"
            label="Rechercher par nom d’utilisateur"
            type="search"
            autoComplete="off"
            placeholder="Nom de l’utilisateur"
            icon={<Search size={18} aria-hidden="true" />}
            value={agentSearch}
            onChange={(event) => setAgentSearch(event.target.value)}
          />
          <Input
            className="registration-date-filter"
            label="Date de début"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
          <Input
            className="registration-date-filter"
            label="Date de fin"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
          <label className="admin-sort">
            <span>Envoi WhatsApp</span>
            <select value={exported} onChange={(event) => setExported(event.target.value as typeof exported)}>
              <option value="all">Tous</option>
              <option value="exported">Envoyés</option>
              <option value="not_exported">Non envoyés</option>
            </select>
          </label>
          <div className="status-filter-scroll" role="group" aria-label="Filtrer par statut">
            {[{ label: 'Tous', value: null }, ...statusItems.map(({ status: value, label }) => ({ label, value }))].map((filter) => (
              <button
                className={`status-filter-chip ${status === filter.value ? 'status-filter-chip-active' : ''}`}
                type="button"
                key={filter.label}
                aria-pressed={status === filter.value}
                onClick={() => { setStatus(filter.value); setSelected(null); }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        {registrations.isPending ? (
          <div className="registration-card-list" aria-label="Chargement des enregistrements">
            {Array.from({ length: 4 }, (_, index) => (
              <Card className="registration-skeleton" key={index}>
                <Skeleton className="registration-skeleton-line registration-skeleton-short" />
                <Skeleton className="registration-skeleton-line" />
                <Skeleton className="registration-skeleton-line registration-skeleton-medium" />
              </Card>
            ))}
          </div>
        ) : registrations.isError ? (
          <Card className="registration-empty">
            <EmptyState
              icon={<Inbox size={23} aria-hidden="true" />}
              title="Impossible de charger les enregistrements"
              description={registrations.error.message}
              action={<Button variant="secondary" onClick={() => void registrations.refetch()}>Réessayer</Button>}
            />
          </Card>
        ) : items.length === 0 ? (
          <Card className="registration-empty">
            <EmptyState icon={<Inbox size={23} aria-hidden="true" />} title="Aucun enregistré" description="Aucun enregistrement ne correspond à ces filtres." />
          </Card>
        ) : (
          <RegistrationRecordList
            items={items}
            selected={selected}
            onSelect={setSelected}
            showAgent
            allowStatusChange
            showExportStatus
            readOnly
            show={show}
          />
        )}
        {registrations.hasNextPage && (
          <div className="load-more-wrap">
            <Button
              variant="secondary"
              loading={registrations.isFetchingNextPage}
              onClick={() => void registrations.fetchNextPage()}
            >
              Charger plus
            </Button>
          </div>
        )}
      </section>
      <ExportPdfModal
        open={exportPdfOpen}
        onClose={() => setExportPdfOpen(false)}
        filters={exportFilters}
        title="Tous les enregistrés"
        subtitle="Liste des enregistrements fictifs."
        filtersLabel={filtersLabel}
      />
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
