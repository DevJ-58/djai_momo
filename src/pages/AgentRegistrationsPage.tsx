import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Clock3,
  Inbox,
  RefreshCw,
  Search,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card, EmptyState, Input, Skeleton, StatCard } from '../components/ui';
import { ToastViewport } from '../components/layout/ToastViewport';
import { RegistrationDetails, RegistrationRecordList } from '../components/registrations/RegistrationRecordList';
import { useToast } from '../hooks/use-toast';
import { useMyStats } from '../hooks/useMyStats';
import { useRegistrationById, useRegistrations } from '../hooks/useRegistrations';
import { formatAmount, toTitleCase } from '../lib/format';
import { useAuth } from '../hooks/useAuth';
import { getRegistrationDetailId, updateRegistrationDetailParam } from '../lib/registration-detail-route';
import type { RegistrationListItem, RegistrationStatus } from '../types/database';

const statusFilters: Array<{ label: string; value: RegistrationStatus | null }> = [
  { label: 'Tous', value: null },
  { label: 'En attente', value: 'en_attente' },
  { label: 'Payé', value: 'paye' },
  { label: 'Refusé', value: 'refuse' },
  { label: 'Problème', value: 'probleme' },
  { label: 'Gagné', value: 'gagne' },
  { label: 'Échec', value: 'echec' },
  { label: 'Renoncé', value: 'renonce' },
];

export function AgentRegistrationsPage() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const handledDetailError = useRef('');
  const { toasts, show, dismiss } = useToast();
  const registrations = useRegistrations({ status, search: debouncedSearch.trim() });
  const notificationRegistrationId = getRegistrationDetailId(searchParams.toString());
  const notificationRegistration = useRegistrationById(notificationRegistrationId);
  const selected = notificationRegistration.data ?? null;
  const stats = useMyStats();
  const items = registrations.data?.pages.flat() ?? [];

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!notificationRegistrationId || !notificationRegistration.isError) return;
    const errorKey = `${notificationRegistrationId}:${notificationRegistration.error.message}`;
    if (handledDetailError.current === errorKey) return;
    handledDetailError.current = errorKey;
    show(notificationRegistration.error.message, 'error');
    setSearchParams(
      updateRegistrationDetailParam(searchParams.toString(), null),
      { replace: true },
    );
  }, [notificationRegistration.error, notificationRegistration.isError, notificationRegistrationId, searchParams, setSearchParams, show]);

  const refresh = () => {
    void registrations.refetch();
    void stats.refetch();
  };

  const hasActiveFilters = Boolean(search.trim() || status);
  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatus(null);
  };

  const selectRegistration = (registration: RegistrationListItem | null) => {
    setSearchParams(
      updateRegistrationDetailParam(searchParams.toString(), registration?.id ?? null),
      { replace: true },
    );
  };

  return (
    <div className="page-content agent-registrations-page">
      <header className="page-header agent-page-header">
        <div>
          <span className="eyebrow">BONJOUR {profile ? toTitleCase(profile.full_name) : ''}</span>
          <h1>Mes enregistrés</h1>
          <p>Retrouvez vos enregistrements et leur suivi.</p>
        </div>
        <div className="agent-header-actions">
          <Button
            variant="ghost"
            className="refresh-button"
            onClick={refresh}
            disabled={registrations.isFetching || stats.isFetching}
            aria-label="Actualiser la liste"
            title="Actualiser"
          >
            <RefreshCw size={18} aria-hidden="true" />
          </Button>
          <Link className="desktop-add-link" to="/espace/ajouter">
            <Button><span>Ajouter un enregistré</span></Button>
          </Link>
        </div>
      </header>

      <section className="agent-stats-grid" aria-label="Statistiques de mes enregistrements">
        {stats.isPending ? (
          Array.from({ length: 4 }, (_, index) => (
            <Card className="agent-stat-skeleton" key={index}>
              <Skeleton className="agent-stat-skeleton-icon" />
              <Skeleton className="agent-stat-skeleton-label" />
              <Skeleton className="agent-stat-skeleton-value" />
            </Card>
          ))
        ) : (
          <>
            <StatCard
              label="Total"
              value={stats.data ? String(stats.data.total) : '—'}
              icon={<UsersRound size={20} aria-hidden="true" />}
            />
            <StatCard
              label="Payés"
              value={stats.data ? String(stats.data.payes) : '—'}
              icon={<Check size={20} aria-hidden="true" />}
            />
            <StatCard
              label="En attente"
              value={stats.data ? String(stats.data.en_attente) : '—'}
              icon={<Clock3 size={20} aria-hidden="true" />}
            />
            <StatCard
              label="Montant reçu"
              value={stats.data ? formatAmount(stats.data.montant_total ?? 0) : '—'}
              icon={<Wallet size={20} aria-hidden="true" />}
            />
          </>
        )}
      </section>
      {stats.isError && (
        <div className="agent-error-row" role="alert">
          <span>{stats.error.message}</span>
          <Button variant="ghost" onClick={() => void stats.refetch()}>Réessayer</Button>
        </div>
      )}

      <section className="registration-list-section" aria-labelledby="registration-list-title">
        <div className="registration-list-heading">
          <div>
            <span className="section-kicker">HISTORIQUE</span>
            <h2 id="registration-list-title">Vos enregistrements</h2>
          </div>
          <span className="registration-count">{items.length} affiché{items.length > 1 ? 's' : ''}</span>
        </div>
        <div className="registration-filters">
          <Input
            className="registration-search"
            label="Rechercher par identifiant ou numéro"
            type="search"
            inputMode="email"
            autoComplete="off"
            placeholder="Identifiant ou numéro"
            icon={<Search size={18} aria-hidden="true" />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="status-filter-scroll" role="group" aria-label="Filtrer par statut">
            {statusFilters.map((filter) => (
              <button
                className={`status-filter-chip ${status === filter.value ? 'status-filter-chip-active' : ''}`}
                type="button"
                key={filter.label}
                aria-pressed={status === filter.value}
                onClick={() => setStatus(filter.value)}
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
              title="Impossible de charger vos enregistrements"
              description={registrations.error.message}
              action={<Button variant="secondary" onClick={() => void registrations.refetch()}>Réessayer</Button>}
            />
          </Card>
        ) : items.length === 0 && !selected && !notificationRegistration.isPending ? (
          <Card className="registration-empty">
            <EmptyState
              icon={<Inbox size={23} aria-hidden="true" />}
              title={hasActiveFilters ? 'Aucun résultat' : 'Aucun enregistré pour l’instant'}
              description={hasActiveFilters
                ? 'Aucun enregistrement ne correspond à ces filtres.'
                : 'Ajoutez votre premier enregistrement fictif pour le retrouver ici.'}
              action={hasActiveFilters
                ? <Button variant="secondary" onClick={resetFilters}>Réinitialiser</Button>
                : <Link to="/espace/ajouter"><Button>Ajouter mon premier</Button></Link>}
            />
          </Card>
        ) : (
          <RegistrationRecordList
            items={items}
            selected={null}
            onSelect={selectRegistration}
            readOnly
            show={show}
          />
        )}

        <RegistrationDetails
          registration={selected}
          loading={Boolean(notificationRegistrationId && notificationRegistration.isPending)}
          onClose={() => selectRegistration(null)}
          allowAgentCorrectionRequests={false}
          show={show}
        />

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

      <Link className="registration-fab" to="/espace/ajouter" aria-label="Ajouter un enregistré">
        <span aria-hidden="true">+</span>
      </Link>
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
