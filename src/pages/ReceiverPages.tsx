import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  RotateCcw,
  UserRound,
  XCircle,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, EmptyState } from '../components/ui';
import { ExportPdfModal } from '../components/exports/ExportPdfModal';
import { ExportCsvModal } from '../components/exports/ExportCsvModal';
import { useAbidjanToday } from '../hooks/useAbidjanToday';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  chooseReceiverAmountMutation,
  formatReceiverPrize,
  formatReceiverAmount,
  getAddedReceiverIds,
  getReceiverStartIndex,
  normalizeReceiverPrize,
  parseReceiverAmount,
  sortReceiverRegistrations,
  shouldSubmitReceiverAmount,
  type ReceiverProgressStatus,
  type ReceiverRegistration,
  type ReceiverResult,
  type ReceiverValidationTrigger,
} from '../lib/receiver-workflow';
import { formatDailyNumber } from '../lib/registration-days';
import { toTitleCase } from '../lib/format';
import { formatNumeroForDisplay } from '../lib/numero';
import { hasDescription } from '../lib/description';
import { supabase } from '../lib/supabase';

type ReceiverBlock = {
  agent_id: string;
  full_name: string;
  total: number;
  nouveaux: number;
  en_cours: number;
  termines: number;
  gagnes: number;
  echecs: number;
  renonces: number;
  total_gains: number;
  dernier_ajout: string | null;
};

type ReceiverView = 'cartes' | 'liste';
type ReceiverListFilter = 'a-faire' | 'termines' | 'tous';
type UndoMessage = { registrationId: string; message: string };
type ReceiverItemResponse = Record<string, unknown> & {
  prize_amount?: number | string | null;
  description: string | null;
};

const receiverItemsKey = (agentId: string) => ['receiver-items', agentId] as const;
const receiverBlocksKey = ['receiver-blocks'] as const;
const viewPreferenceKey = 'djai_momo_receiver_view_preference';
const autoCopyPreferenceKey = 'djai_momo_receiver_auto_copy_email';
const swipeHelpPreferenceKey = 'djai_momo_receiver_has_swiped';
const progressStatusClass: Record<ReceiverProgressStatus, string> = {
  nouveau: 'receiver-status-nouveau',
  en_cours: 'receiver-status-en_cours',
  termine: 'receiver-status-termine',
};

function preferredView(): ReceiverView {
  return window.localStorage.getItem(viewPreferenceKey) === 'liste' ? 'liste' : 'cartes';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringField(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string') return value;
  }
  return null;
}

function normalizeReceiverItem(value: unknown): ReceiverRegistration | null {
  if (!isObject(value)) return null;
  const id = stringField(value, 'id');
  const agentId = stringField(value, 'agent_id');
  const sendDay = stringField(value, 'send_day');
  const email = stringField(value, 'email');
  const password = stringField(value, 'mdp', 'password');
  const numero = typeof value.numero === 'string' ? value.numero : null;
  const daySeq = value.day_seq;
  if (!id || !agentId || !sendDay || !email || password === null || typeof daySeq !== 'number') return null;

  const resultValue = stringField(value, 'result', 'receiver_result');
  const result: ReceiverResult | null = resultValue === 'gagne' || resultValue === 'echec' || resultValue === 'renonce'
    ? resultValue
    : null;
  const statusValue = stringField(value, 'progress_status', 'receiver_status', 'receiver_progress_status', 'status');
  const progressStatus: ReceiverProgressStatus = statusValue === 'en_cours' || statusValue === 'termine'
    ? statusValue
    : statusValue === 'nouveau'
      ? 'nouveau'
      : result
        ? 'termine'
        : 'nouveau';
  const prize = normalizeReceiverPrize(value.prize_amount);

  return {
    id,
    agent_id: agentId,
    send_day: sendDay,
    day_seq: daySeq,
    email,
    mdp: password,
    numero,
    description: stringField(value, 'description'),
    progress_status: progressStatus,
    result,
    prize,
  };
}

function useReceiverBlocks() {
  return useQuery({
    queryKey: receiverBlocksKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receiver_blocks')
        .select('agent_id, full_name, total, nouveaux, en_cours, termines, gagnes, echecs, renonces, total_gains, dernier_ajout')
        .returns<ReceiverBlock[]>();
      if (error) throw new Error('Impossible de charger les utilisateurs. Réessayez une fois en ligne.');
      return data ?? [];
    },
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

function useReceiverItems(agentId: string) {
  return useQuery({
    queryKey: receiverItemsKey(agentId),
    enabled: Boolean(agentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receiver_items')
        .select('*')
        .eq('agent_id', agentId)
        .order('send_day', { ascending: true })
        .order('day_seq', { ascending: true })
        .returns<ReceiverItemResponse[]>();
      if (error) throw new Error('Impossible de charger les enregistrés. Réessayez une fois en ligne.');
      const rows = (data ?? []).map(normalizeReceiverItem);
      if (rows.some((item) => item === null)) {
        throw new Error('Les enregistrés reçus sont incomplets. Réessayez plus tard.');
      }
      return sortReceiverRegistrations(rows.filter((item): item is ReceiverRegistration => item !== null));
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
}

function receiverErrorMessage(error: unknown): string {
  const code = isObject(error) && 'code' in error ? String(error.code) : '';
  const message = isObject(error) && 'message' in error ? String(error.message).toLowerCase() : '';
  if (code === '22023') return 'Le prix est obligatoire.';
  if (code === 'P0003') return 'Ce résultat n’est pas un gain.';
  if (code === '55000') return 'Cet enregistré est déjà terminé.';
  if (code === '42501') return 'Action non autorisée.';
  if (code === 'P0002') return 'Cet enregistré n’existe plus.';
  if (
    error instanceof TypeError ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('offline')
  ) {
    return 'Pas de connexion. Réessayez une fois en ligne.';
  }
  return 'Une erreur est survenue. Réessayez.';
}

function formatRelativeTime(value: string | null): string {
  if (!value) return 'Aucune activité récente';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'Aucune activité récente';

  const deltaMinutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (deltaMinutes < 1) return 'à l’instant';
  if (deltaMinutes < 60) return `il y a ${deltaMinutes} min`;
  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) return `il y a ${deltaHours} h`;
  return `il y a ${Math.round(deltaHours / 24)} j`;
}

export function ReceiverDashboardPage() {
  const { data: blocks = [], isPending, isError, error } = useReceiverBlocks();

  const totalTodo = useMemo(
    () => blocks.reduce((sum, block) => sum + block.nouveaux + block.en_cours, 0),
    [blocks],
  );
  const totalGains = useMemo(
    () => blocks.reduce((sum, block) => sum + (block.total_gains ?? 0), 0),
    [blocks],
  );

  const sortedBlocks = useMemo(() => [...blocks].sort((left, right) => {
    const leftTodo = left.nouveaux + left.en_cours;
    const rightTodo = right.nouveaux + right.en_cours;
    if (leftTodo !== rightTodo) return rightTodo - leftTodo;
    const leftLast = left.dernier_ajout ? new Date(left.dernier_ajout).getTime() : 0;
    const rightLast = right.dernier_ajout ? new Date(right.dernier_ajout).getTime() : 0;
    return rightLast - leftLast;
  }), [blocks]);

  return (
    <div className="page-content receiver-page">
      <main className="receiver-content">
        <div className="receiver-summary-row">
          <strong>{totalTodo} à faire</strong>
          <span className="receiver-summary-separator" aria-hidden="true">·</span>
          <span className="receiver-summary-gains">
            <strong>{totalGains.toLocaleString('fr-FR')} FCFA</strong> gagnés aujourd'hui
          </span>
        </div>

        {isPending && <div className="receiver-loading" role="status">Chargement des comptes…</div>}
        {!isPending && isError && (
          <div className="receiver-error" role="alert">
            {error instanceof Error ? error.message : 'Impossible de charger les utilisateurs.'}
          </div>
        )}

        {!isPending && !isError && blocks.length === 0 && (
          <EmptyState
            icon={<CheckCircle2 size={22} aria-hidden="true" />}
            title="Rien à traiter pour l'instant"
            description="Les nouveaux comptes apparaîtront ici dès qu'ils seront envoyés."
          />
        )}

        {!isPending && !isError && blocks.length > 0 && totalTodo === 0 && (
          <div className="receiver-all-done-banner" role="status">Tout est terminé ✓</div>
        )}

        {!isPending && !isError && blocks.length > 0 && (
          <section className="receiver-grid" aria-label="Comptes à traiter">
            {sortedBlocks.map((block) => {
              const todoCount = block.nouveaux + block.en_cours;
              const progress = block.total > 0 ? Math.round((block.termines / block.total) * 100) : 0;
              const complete = block.total > 0 && todoCount === 0;
              const results = [
                block.gagnes > 0 ? `${block.gagnes} gagné${block.gagnes === 1 ? '' : 's'}` : null,
                block.echecs > 0 ? `${block.echecs} échec${block.echecs === 1 ? '' : 's'}` : null,
                block.renonces > 0 ? `${block.renonces} renoncé${block.renonces === 1 ? '' : 's'}` : null,
              ].filter((result): result is string => result !== null);

              return (
                <Link
                  key={block.agent_id}
                  to={`/receveur/u/${block.agent_id}`}
                  className={`receiver-user-card glass ${complete ? 'receiver-user-card-complete' : ''}`}
                  aria-label={`Voir les comptes de ${toTitleCase(block.full_name)}`}
                >
                  <div className="receiver-user-card-top">
                    <div className="receiver-user-avatar" aria-hidden="true"><UserRound size={18} /></div>
                    <div className="receiver-user-copy">
                      <h2>{toTitleCase(block.full_name)}</h2>
                    </div>
                  </div>
                  <div className="receiver-card-meta">
                    <strong>{todoCount} à faire</strong>
                    <span className="receiver-card-time">{formatRelativeTime(block.dernier_ajout)}</span>
                  </div>
                  {block.nouveaux > 0 && (
                    <span className="receiver-new-badge">
                      {block.nouveaux} nouveau{block.nouveaux > 1 ? 'x' : ''}
                    </span>
                  )}
                  {complete && <span className="receiver-complete-badge">Tout terminé</span>}
                  <div className="receiver-progress-row-line" aria-label={`Progression ${block.termines}/${block.total}`}>
                    <span>{block.termines}/{block.total} terminés</span><span>{progress}%</span>
                  </div>
                  <div className="receiver-progress-bar" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
                  {results.length > 0 && <div className="receiver-card-result">{results.join(' · ')}</div>}
                </Link>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}

type RegistrationCardProps = {
  item: ReceiverRegistration;
  numberLabel: string;
  amountValue: string;
  busy: boolean;
  online: boolean;
  copied: boolean;
  passwordCopied: boolean;
  numeroCopied: boolean;
  autoCopied: boolean;
  onAmountChange: (id: string, value: string) => void;
  onAmountSubmit: (id: string, trigger: ReceiverValidationTrigger) => void;
  onOutcome: (id: string, result: Exclude<ReceiverResult, 'gagne'>) => void;
  onReopen: (id: string) => void;
  onCopy: (item: ReceiverRegistration, field: 'email' | 'mdp' | 'numero') => void;
  onSelect: (id: string) => void;
};

function RegistrationCard({
  item,
  numberLabel,
  amountValue,
  busy,
  online,
  copied,
  passwordCopied,
  numeroCopied,
  autoCopied,
  onAmountChange,
  onAmountSubmit,
  onOutcome,
  onReopen,
  onCopy,
  onSelect,
}: RegistrationCardProps) {
  const complete = item.progress_status === 'termine';
  const amountEnabled = !complete || item.result === 'gagne';
  const formattedPrize = formatReceiverPrize(item.prize);
  const resultText = item.result === 'gagne'
    ? formattedPrize ? `Gagné · ${formattedPrize} FCFA` : 'Gagné'
    : item.result === 'echec'
      ? 'Échec'
      : item.result === 'renonce'
        ? 'Renoncé'
        : null;
  const descriptionId = `receiver-description-${item.id}`;

  return (
    <article
        className={`receiver-registration-card glass ${complete ? 'receiver-registration-complete' : ''}`}
        onClick={() => onSelect(item.id)}
        onFocusCapture={(event) => {
          if (event.target instanceof HTMLElement && event.target.closest('.receiver-description-toggle')) return;
          onSelect(item.id);
        }}
      aria-label={`${numberLabel}, ${complete ? 'terminé' : 'à traiter'}`}
    >
      <div className="receiver-registration-heading" aria-live="polite" aria-atomic="true">
        <strong>{numberLabel}</strong>
        <div className="receiver-registration-statuses">
          <span className={`receiver-status ${progressStatusClass[item.progress_status]}`}>
            {item.progress_status === 'nouveau' ? 'Nouveau' : item.progress_status === 'en_cours' ? 'En cours' : 'Terminé ✓'}
          </span>
          {resultText && <span className="receiver-result-label">{resultText}</span>}
        </div>
      </div>

      <CredentialLine
        label="Identifiant"
        value={item.email}
        copied={copied}
        autoCopied={autoCopied}
        onCopy={() => onCopy(item, 'email')}
      />
      <CredentialLine
        label="Mot de passe"
        value={item.mdp}
        copied={passwordCopied}
        autoCopied={false}
        onCopy={() => onCopy(item, 'mdp')}
      />
      {item.numero !== null && (
        <CredentialLine
          label="Numéro"
          value={formatNumeroForDisplay(item.numero)}
          copied={numeroCopied}
          autoCopied={false}
          onCopy={() => onCopy(item, 'numero')}
        />
      )}
      {hasDescription(item.description) && (
        <ReceiverDescription id={descriptionId} description={item.description} />
      )}

      {amountEnabled && (
        <div className="receiver-amount-field">
          <label htmlFor={`receiver-amount-${item.id}`}>Montant obtenu (FCFA)</label>
          <div className="receiver-amount-input-wrap">
            <input
              id={`receiver-amount-${item.id}`}
              className="receiver-amount-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={amountValue}
              disabled={!online || busy}
              onChange={(event) => onAmountChange(item.id, formatReceiverAmount(event.target.value))}
              onBlur={() => onAmountSubmit(item.id, 'blur')}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onAmountSubmit(item.id, 'enter');
                  event.currentTarget.blur();
                }
              }}
              aria-describedby={`receiver-amount-help-${item.id}`}
            />
            <button
              type="button"
              className="receiver-amount-submit"
              onClick={() => onAmountSubmit(item.id, 'ok')}
              disabled={!online || busy || parseReceiverAmount(amountValue) === null}
              aria-label="Enregistrer le montant"
            >
              <Check size={20} aria-hidden="true" /><span>OK</span>
            </button>
          </div>
          <span id={`receiver-amount-help-${item.id}`} className="receiver-field-help">
            Entre 1 et 999 999 999 FCFA
          </span>
        </div>
      )}

      {!complete && (
        <div className="receiver-outcome-actions">
          <button type="button" className="receiver-outcome-button receiver-outcome-fail" disabled={!online || busy} onClick={() => onOutcome(item.id, 'echec')}>
            <XCircle size={18} aria-hidden="true" /><span>Échec</span>
          </button>
          <button type="button" className="receiver-outcome-button receiver-outcome-skip" disabled={!online || busy} onClick={() => onOutcome(item.id, 'renonce')}>
            <Ban size={18} aria-hidden="true" /><span>Renoncé</span>
          </button>
        </div>
      )}

      {complete && (
        <button type="button" className="receiver-reopen-button" disabled={!online || busy} onClick={() => onReopen(item.id)}>
          <RotateCcw size={18} aria-hidden="true" /><span>Rouvrir</span>
        </button>
      )}
    </article>
  );
}

function ReceiverDescription({ id, description }: { id: string; description: string }) {
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    const text = textRef.current;
    if (!text) return undefined;

    const measure = () => {
      const lineHeight = Number.parseFloat(window.getComputedStyle(text).lineHeight);
      setCanExpand(text.scrollHeight > lineHeight * 2 + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(text);
    return () => observer.disconnect();
  }, [description]);

  return (
    <div className="receiver-description">
      <p
        id={id}
        ref={textRef}
        className={`receiver-description-text${expanded ? ' expanded' : ''}`}
      >
        {description}
      </p>
      {canExpand && (
        <button
          className="receiver-description-toggle"
          type="button"
          aria-controls={id}
          aria-expanded={expanded}
          onPointerDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
        >
          {expanded ? 'Voir moins' : 'Voir plus'}
        </button>
      )}
    </div>
  );
}

function CredentialLine({
  label,
  value,
  copied,
  autoCopied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  autoCopied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="receiver-credential-line">
      <div className="receiver-credential-copy">
        <span>{label}</span>
        <code>{value}</code>
        {autoCopied && <span className="receiver-auto-copy-feedback" role="status">Identifiant copié ✓</span>}
      </div>
      <button type="button" className="receiver-copy-button" onClick={onCopy} aria-label={`Copier ${label.toLowerCase()}`}>
        {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
        <span>{copied ? 'Copié ✓' : 'Copier'}</span>
      </button>
    </div>
  );
}

export function ReceiverUserPage() {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const today = useAbidjanToday();
  const { agentId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: blocks = [] } = useReceiverBlocks();
  const itemsQuery = useReceiverItems(agentId);
  const items = itemsQuery.data ?? [];
  const [storedView, setStoredView] = useState<ReceiverView>(preferredView);
  const [listFilter, setListFilter] = useState<ReceiverListFilter>('a-faire');
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const amountDraftsRef = useRef<Record<string, string>>({});
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<Record<string, boolean>>({});
  const [autoCopyFeedback, setAutoCopyFeedback] = useState<Record<string, boolean>>({});
  const [undoMessage, setUndoMessage] = useState<UndoMessage | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [autoCopyEmail, setAutoCopyEmail] = useState(() => window.localStorage.getItem(autoCopyPreferenceKey) !== 'false');
  const [hasSwiped, setHasSwiped] = useState(() => window.localStorage.getItem(swipeHelpPreferenceKey) === 'true');
  const [newIds, setNewIds] = useState<string[]>([]);
  const previousIdsRef = useRef<Set<string> | null>(null);
  const previousAgentIdRef = useRef(agentId);
  const inFlightIdsRef = useRef<Set<string>>(new Set());
  const lastSavedAmountsRef = useRef<Map<string, number>>(new Map());
  const startedIdsRef = useRef<Set<string>>(new Set());
  const lastCurrentIdRef = useRef<string | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; target: EventTarget | null } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportCsvOpen, setExportCsvOpen] = useState(false);

  const viewParameter = searchParams.get('vue');
  const view: ReceiverView = viewParameter === 'cartes' || viewParameter === 'liste' ? viewParameter : storedView;
  const currentId = searchParams.get('c');
  const agent = blocks.find((block) => block.agent_id === agentId);
  const name = agent ? toTitleCase(agent.full_name) : 'Agent';
  const completedCount = items.filter((item) => item.progress_status === 'termine').length;
  const currentIndexInItems = items.findIndex((item) => item.id === currentId);
  const currentIndex = currentIndexInItems === -1 ? getReceiverStartIndex(items) : currentIndexInItems;
  const currentItem = items[currentIndex];
  const todoCount = items.length - completedCount;
  const exportFilters = useMemo(() => ({ agentId, agentName: name }), [agentId, name]);

  const updateCurrentParam = useCallback((id: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('c', id);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const updateItem = useCallback((id: string, change: Partial<ReceiverRegistration>) => {
    queryClient.setQueryData<ReceiverRegistration[]>(receiverItemsKey(agentId), (current) => (
      current?.map((item) => item.id === id ? { ...item, ...change } : item)
    ));
  }, [agentId, queryClient]);

  const removeItem = useCallback((id: string) => {
    queryClient.setQueryData<ReceiverRegistration[]>(receiverItemsKey(agentId), (current) => (
      current?.filter((item) => item.id !== id)
    ));
    setNewIds((current) => current.filter((itemId) => itemId !== id));
    void queryClient.invalidateQueries({ queryKey: receiverItemsKey(agentId) });
  }, [agentId, queryClient]);

  const markBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const showUndo = useCallback((id: string, message: string) => {
    setUndoMessage({ registrationId: id, message });
  }, []);

  const submitAmount = useCallback(async (id: string, trigger: ReceiverValidationTrigger) => {
    if (!online) return;
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item) return;
    const value = amountDraftsRef.current[id] ?? (formatReceiverPrize(item.prize) ? formatReceiverAmount(String(item.prize)) : '');
    const amount = parseReceiverAmount(value);
    const mutation = chooseReceiverAmountMutation(item.result, amount);
    if (
      amount === null ||
      !mutation ||
      !shouldSubmitReceiverAmount(trigger, amount, inFlightIdsRef.current.has(id), lastSavedAmountsRef.current.get(id))
    ) return;
    if (item.result === 'gagne' && item.prize === amount) return;
    if (item.progress_status === 'termine' && item.result !== 'gagne') return;

    inFlightIdsRef.current.add(id);
    markBusy(id, true);
    setActionError(null);
    try {
      const response = mutation === 'set_result'
        ? await supabase.rpc('receiver_set_result', {
          p_registration_id: id,
          p_result: 'gagne',
          p_prize: amount,
          p_note: null,
        })
        : await supabase.rpc('receiver_update_prize', {
          p_registration_id: id,
          p_prize: amount,
          p_note: null,
        });
      if (response.error) {
        if (String(response.error.code) === 'P0002') removeItem(id);
        throw response.error;
      }

      if (mutation === 'set_result') updateItem(id, { progress_status: 'termine', result: 'gagne', prize: amount });
      else updateItem(id, { prize: amount });
      amountDraftsRef.current = { ...amountDraftsRef.current, [id]: formatReceiverAmount(String(amount)) };
      setAmountDrafts(amountDraftsRef.current);
      lastSavedAmountsRef.current.set(id, amount);
      showUndo(id, mutation === 'update_prize' ? 'Montant corrigé' : 'Gagné enregistré');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: receiverItemsKey(agentId) }),
        queryClient.invalidateQueries({ queryKey: receiverBlocksKey }),
      ]);
    } catch (error) {
      setActionError(receiverErrorMessage(error));
    } finally {
      inFlightIdsRef.current.delete(id);
      markBusy(id, false);
    }
  }, [agentId, markBusy, online, queryClient, removeItem, showUndo, updateItem]);

  const flushAmount = useCallback((id: string | null) => {
    if (id) void submitAmount(id, 'leave');
  }, [submitAmount]);

  const selectCard = useCallback((id: string, copyAutomatically = false) => {
    const previousId = lastCurrentIdRef.current;
    if (previousId && previousId !== id) flushAmount(previousId);
    if (previousId === id) return;
    lastCurrentIdRef.current = id;
    updateCurrentParam(id);
    if (copyAutomatically && autoCopyEmail) {
      const item = itemsRef.current.find((candidate) => candidate.id === id);
      if (item) void copyCredential(item, 'email', true);
    }
  }, [autoCopyEmail, flushAmount, updateCurrentParam]);

  const setResult = useCallback(async (id: string, result: ReceiverResult) => {
    if (!online || inFlightIdsRef.current.has(id)) return;
    inFlightIdsRef.current.add(id);
    markBusy(id, true);
    setActionError(null);
    try {
      const response = await supabase.rpc('receiver_set_result', {
        p_registration_id: id,
        p_result: result,
        p_prize: null,
        p_note: null,
      });
      if (response.error) {
        if (String(response.error.code) === 'P0002') removeItem(id);
        throw response.error;
      }
      updateItem(id, { progress_status: 'termine', result, prize: null });
      amountDraftsRef.current = { ...amountDraftsRef.current, [id]: '' };
      setAmountDrafts(amountDraftsRef.current);
      lastSavedAmountsRef.current.delete(id);
      showUndo(id, result === 'echec' ? 'Échec enregistré' : 'Renoncé enregistré');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: receiverItemsKey(agentId) }),
        queryClient.invalidateQueries({ queryKey: receiverBlocksKey }),
      ]);
    } catch (error) {
      setActionError(receiverErrorMessage(error));
    } finally {
      inFlightIdsRef.current.delete(id);
      markBusy(id, false);
    }
  }, [agentId, markBusy, online, queryClient, removeItem, showUndo, updateItem]);

  const reopen = useCallback(async (id: string) => {
    if (!online || inFlightIdsRef.current.has(id)) return;
    inFlightIdsRef.current.add(id);
    markBusy(id, true);
    setActionError(null);
    try {
      const { error } = await supabase.rpc('receiver_reopen', { p_registration_id: id });
      if (error) {
        if (String(error.code) === 'P0002') removeItem(id);
        throw error;
      }
      updateItem(id, { progress_status: 'en_cours', result: null, prize: null });
      amountDraftsRef.current = { ...amountDraftsRef.current, [id]: '' };
      setAmountDrafts(amountDraftsRef.current);
      lastSavedAmountsRef.current.delete(id);
      setUndoMessage(null);
      void queryClient.invalidateQueries({ queryKey: receiverItemsKey(agentId) });
      void queryClient.invalidateQueries({ queryKey: receiverBlocksKey });
    } catch (error) {
      setActionError(receiverErrorMessage(error));
    } finally {
      inFlightIdsRef.current.delete(id);
      markBusy(id, false);
    }
  }, [agentId, markBusy, queryClient, removeItem, updateItem]);

  const undo = async () => {
    if (!undoMessage || undoBusy || !online) return;
    const id = undoMessage.registrationId;
    setUndoBusy(true);
    try {
      const { error } = await supabase.rpc('receiver_reopen', { p_registration_id: id });
      if (error) {
        if (String(error.code) === 'P0002') removeItem(id);
        throw error;
      }
      updateItem(id, { progress_status: 'en_cours', result: null, prize: null });
      amountDraftsRef.current = { ...amountDraftsRef.current, [id]: '' };
      setAmountDrafts(amountDraftsRef.current);
      lastSavedAmountsRef.current.delete(id);
      setUndoMessage(null);
      void queryClient.invalidateQueries({ queryKey: receiverItemsKey(agentId) });
      void queryClient.invalidateQueries({ queryKey: receiverBlocksKey });
    } catch (error) {
      setActionError(receiverErrorMessage(error));
      setUndoMessage(null);
    } finally {
      setUndoBusy(false);
    }
  };

  const copyCredential = useCallback(async (item: ReceiverRegistration, field: 'email' | 'mdp' | 'numero', automatic = false) => {
    try {
      const value = field === 'numero' ? item.numero : item[field];
      if (value === null) return;
      await navigator.clipboard.writeText(value);
      if (typeof navigator.vibrate === 'function') navigator.vibrate(25);
      if (automatic) {
        setAutoCopyFeedback((current) => ({ ...current, [item.id]: true }));
        window.setTimeout(() => setAutoCopyFeedback((current) => ({ ...current, [item.id]: false })), 1500);
      } else {
        const feedbackKey = `${item.id}:${field}`;
        setCopyFeedback((current) => ({ ...current, [feedbackKey]: true }));
        window.setTimeout(() => setCopyFeedback((current) => ({ ...current, [feedbackKey]: false })), 1500);
      }
      if (item.progress_status === 'nouveau' && !startedIdsRef.current.has(item.id)) {
        startedIdsRef.current.add(item.id);
        void (async () => {
          try {
            const { error } = await supabase.rpc('receiver_start', { p_registration_id: item.id });
            if (error) setActionError(receiverErrorMessage(error));
            else void queryClient.invalidateQueries({ queryKey: receiverItemsKey(agentId) });
          } catch (error) {
            setActionError(receiverErrorMessage(error));
          }
        })();
      }
    } catch {
      if (!automatic) setActionError('Impossible de copier. Vérifiez les autorisations du navigateur.');
    }
  }, [agentId, queryClient]);

  const copyCredentialRef = useRef(copyCredential);
  copyCredentialRef.current = copyCredential;

  const changeView = (nextView: ReceiverView) => {
    flushAmount(currentItem?.id ?? null);
    window.localStorage.setItem(viewPreferenceKey, nextView);
    setStoredView(nextView);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('vue', nextView);
      return next;
    }, { replace: true });
  };

  const changeAmount = (id: string, value: string) => {
    const next = { ...amountDraftsRef.current, [id]: value };
    amountDraftsRef.current = next;
    setAmountDrafts(next);
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (item?.result === 'gagne' && parseReceiverAmount(value) !== lastSavedAmountsRef.current.get(id)) {
      lastSavedAmountsRef.current.delete(id);
    }
  };

  const handleScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      const container = carouselRef.current;
      if (!container) return;
      const center = container.getBoundingClientRect().left + container.clientWidth / 2;
      let nearest: HTMLElement | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const child of Array.from(container.children)) {
        if (!(child instanceof HTMLElement) || !child.dataset.registrationId) continue;
        const bounds = child.getBoundingClientRect();
        const distance = Math.abs(bounds.left + bounds.width / 2 - center);
        if (distance < nearestDistance) {
          nearest = child;
          nearestDistance = distance;
        }
      }
      if (nearest?.dataset.registrationId) selectCard(nearest.dataset.registrationId, true);
    });
  }, [selectCard]);

  useEffect(() => {
    if (viewParameter !== 'cartes' && viewParameter !== 'liste') {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('vue', storedView);
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams, storedView, viewParameter]);

  useEffect(() => {
    if (itemsQuery.isPending || !agentId) return;
    const validCurrent = currentId && items.some((item) => item.id === currentId);
    const selected = validCurrent ? currentId : items[getReceiverStartIndex(items)]?.id;
    if (selected) {
      lastCurrentIdRef.current = selected;
      if (selected !== currentId) updateCurrentParam(selected);
    } else if (currentId) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('c');
        return next;
      }, { replace: true });
    }
  }, [agentId, currentId, items, itemsQuery.isPending, setSearchParams, updateCurrentParam]);

  useEffect(() => {
    if (previousAgentIdRef.current !== agentId) {
      previousAgentIdRef.current = agentId;
      previousIdsRef.current = null;
      lastCurrentIdRef.current = null;
      setNewIds([]);
    }
    if (!itemsQuery.isSuccess) return;

    const ids = new Set(items.map((item) => item.id));
    const added = getAddedReceiverIds(previousIdsRef.current, items.map((item) => item.id));
    if (added.length) setNewIds((current) => [...new Set([...current, ...added])]);
    previousIdsRef.current = ids;
  }, [agentId, items, itemsQuery.isSuccess]);

  useEffect(() => {
    if (view !== 'cartes' || !currentId || currentIndexInItems === -1) return;
    const frame = requestAnimationFrame(() => {
      const container = carouselRef.current;
      if (!container) return;
      const selected = Array.from(container.children).find((child) => (
        child instanceof HTMLElement && child.dataset.registrationId === currentId
      ));
      if (selected instanceof HTMLElement) {
        container.scrollTo({
          left: selected.offsetLeft - (container.clientWidth - selected.clientWidth) / 2,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [currentId, currentIndexInItems, view, items]);

  useEffect(() => {
    if (!undoMessage) return undefined;
    const timeout = window.setTimeout(() => setUndoMessage(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [undoMessage]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
  }, []);

  const scrollToCard = (index: number) => {
    const target = items[index];
    if (!target) return;
    flushAmount(currentItem?.id ?? null);
    const container = carouselRef.current;
    const slide = container && Array.from(container.children).find((child) => (
      child instanceof HTMLElement && child.dataset.registrationId === target.id
    ));
    if (container && slide instanceof HTMLElement) {
      container.scrollTo({
        left: slide.offsetLeft - (container.clientWidth - slide.clientWidth) / 2,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    }
    selectCard(target.id, true);
  };

  const showAutoCopyPreference = (checked: boolean) => {
    setAutoCopyEmail(checked);
    window.localStorage.setItem(autoCopyPreferenceKey, String(checked));
  };

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartRef.current = { x: event.touches[0]?.clientX ?? 0, target: event.target };
  };
  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || (start.target instanceof Element && start.target.closest('input, button, code'))) return;
    if (Math.abs((event.changedTouches[0]?.clientX ?? start.x) - start.x) > 40) {
      setHasSwiped(true);
      window.localStorage.setItem(swipeHelpPreferenceKey, 'true');
    }
  };

  const filteredList = items.filter((item) => (
    listFilter === 'a-faire'
      ? item.progress_status !== 'termine'
      : listFilter === 'termines'
        ? item.progress_status === 'termine'
        : true
  ));
  const visibleStart = items.length > 60 ? Math.max(0, currentIndex - 5) : 0;
  const visibleEnd = items.length > 60 ? Math.min(items.length, currentIndex + 6) : items.length;
  const cardNumber = (item: ReceiverRegistration) => formatDailyNumber(item.day_seq, item.send_day, today);
  const registrationCard = (item: ReceiverRegistration) => (
    <RegistrationCard
      key={item.id}
      item={item}
      numberLabel={cardNumber(item)}
      amountValue={amountDrafts[item.id] ?? (formatReceiverPrize(item.prize) ? formatReceiverAmount(String(item.prize)) : '')}
      busy={busyIds.has(item.id)}
      online={online}
      copied={Boolean(copyFeedback[`${item.id}:email`])}
      passwordCopied={Boolean(copyFeedback[`${item.id}:mdp`])}
      numeroCopied={Boolean(copyFeedback[`${item.id}:numero`])}
      autoCopied={Boolean(autoCopyFeedback[item.id])}
      onAmountChange={changeAmount}
      onAmountSubmit={(id, trigger) => { void submitAmount(id, trigger); }}
      onOutcome={(id, result) => { void setResult(id, result); }}
      onReopen={(id) => { void reopen(id); }}
      onCopy={(registration, field) => { void copyCredentialRef.current(registration, field); }}
      onSelect={(id) => {
        if (view === 'liste') selectCard(id);
      }}
    />
  );

  return (
    <div className="page-content receiver-page receiver-user-page">
      <header className="receiver-user-header glass" aria-label="En-tête des enregistrés">
        <div className="receiver-user-header-main">
          <Link to="/receveur" className="receiver-back-button" aria-label="Retour aux utilisateurs">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
          <div className="receiver-header-copy">
            <span className="eyebrow">AGENT</span>
            <h1>{name}</h1>
          </div>
          <span className="receiver-progress-pill">{completedCount}/{items.length} terminés</span>
          <details className="receiver-export-menu">
            <summary>Exporter</summary>
            <div>
              <button type="button" onClick={() => setExportOpen(true)}>Exporter en PDF</button>
              <button type="button" onClick={() => setExportCsvOpen(true)}>Exporter en CSV</button>
            </div>
          </details>
        </div>
        <div className="receiver-user-header-controls">
          <div className="receiver-view-switch" role="tablist" aria-label="Mode d’affichage">
            <button type="button" role="tab" aria-selected={view === 'cartes'} className={view === 'cartes' ? 'active' : ''} onClick={() => changeView('cartes')}>Cartes</button>
            <button type="button" role="tab" aria-selected={view === 'liste'} className={view === 'liste' ? 'active' : ''} onClick={() => changeView('liste')}>Liste</button>
          </div>
          {view === 'cartes' && (
            <label className="receiver-auto-copy-toggle">
              <input type="checkbox" checked={autoCopyEmail} onChange={(event) => showAutoCopyPreference(event.target.checked)} />
              <span>Copie auto de l’identifiant</span>
            </label>
          )}
        </div>
      </header>

      <main className="receiver-content receiver-user-content">
        {!online && <p className="receiver-offline-notice" role="status">Hors ligne : les actions de traitement sont désactivées. La copie reste disponible.</p>}
        {itemsQuery.isPending && <div className="receiver-loading" role="status">Chargement des enregistrés…</div>}
        {itemsQuery.isError && (
          <div className="receiver-error" role="alert">
            {itemsQuery.error instanceof Error ? itemsQuery.error.message : 'Impossible de charger les enregistrés.'}
          </div>
        )}
        {actionError && <p className="receiver-error" role="alert">{actionError}</p>}
        {!itemsQuery.isPending && !itemsQuery.isError && items.length === 0 && (
          <EmptyState
            icon={<CheckCircle2 size={22} aria-hidden="true" />}
            title="Aucun enregistré"
            description="Les nouveaux enregistrés de cet agent apparaîtront ici."
            action={<Link to="/receveur"><Button type="button">Retour aux utilisateurs</Button></Link>}
          />
        )}
        {!itemsQuery.isPending && !itemsQuery.isError && items.length > 0 && (
          <>
            {newIds.length > 0 && (
              <button
                type="button"
                className="receiver-new-items-pill"
                onClick={() => {
                  const firstNewIndex = items.findIndex((item) => newIds.includes(item.id));
                  if (firstNewIndex >= 0) {
                    if (view === 'cartes') scrollToCard(firstNewIndex);
                    else selectCard(items[firstNewIndex].id);
                  }
                  setNewIds([]);
                }}
              >
                ↓ {newIds.length} nouveau{newIds.length > 1 ? 'x' : ''}
              </button>
            )}

            {view === 'cartes' ? (
              <>
                {todoCount === 0 && currentIndex === items.length - 1 && (
                  <div className="receiver-all-done-banner receiver-all-done-user">
                    <span>Tout est terminé pour {name} ✓</span>
                    <Link to="/receveur"><Button type="button" variant="secondary">Retour aux utilisateurs</Button></Link>
                  </div>
                )}
                <div className="receiver-carousel-controls">
                  <strong>{currentIndex + 1} / {items.length}</strong>
                  <span>{todoCount} à faire</span>
                  <button type="button" aria-label="Enregistré précédent" disabled={currentIndex <= 0} onClick={() => scrollToCard(currentIndex - 1)}>
                    <ChevronLeft size={20} aria-hidden="true" /><span>Précédent</span>
                  </button>
                  <button type="button" aria-label="Enregistré suivant" disabled={currentIndex >= items.length - 1} onClick={() => scrollToCard(currentIndex + 1)}>
                    <span>Suivant</span><ChevronRight size={20} aria-hidden="true" />
                  </button>
                </div>
                {!hasSwiped && items.length > 1 && <p className="receiver-swipe-help">Glissez pour passer au suivant</p>}
                <div
                  className="receiver-carousel"
                  ref={carouselRef}
                  onScroll={handleScroll}
                  onTouchStart={onTouchStart}
                  onTouchEnd={onTouchEnd}
                  onKeyDown={(event) => {
                    if (event.target instanceof HTMLElement && event.target.closest('input, button')) return;
                    if (window.getSelection()?.toString()) return;
                    if (event.key === 'ArrowLeft' && currentIndex > 0) scrollToCard(currentIndex - 1);
                    if (event.key === 'ArrowRight' && currentIndex < items.length - 1) scrollToCard(currentIndex + 1);
                  }}
                  tabIndex={0}
                  aria-label="Cartes des enregistrés"
                >
                  {Array.from({ length: visibleStart }, (_, index) => (
                    <div key={`before-${items[index]?.id}`} className="receiver-slide receiver-slide-spacer" aria-hidden="true" />
                  ))}
                  {items.slice(visibleStart, visibleEnd).map((item) => (
                    <div className="receiver-slide" data-registration-id={item.id} key={item.id}>
                      {registrationCard(item)}
                    </div>
                  ))}
                  {Array.from({ length: items.length - visibleEnd }, (_, index) => (
                    <div key={`after-${items[visibleEnd + index]?.id}`} className="receiver-slide receiver-slide-spacer" aria-hidden="true" />
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="receiver-list-tabs" role="tablist" aria-label="Filtrer les enregistrés">
                  <button type="button" role="tab" aria-selected={listFilter === 'a-faire'} className={listFilter === 'a-faire' ? 'active' : ''} onClick={() => setListFilter('a-faire')}>
                    À faire <span>{todoCount}</span>
                  </button>
                  <button type="button" role="tab" aria-selected={listFilter === 'termines'} className={listFilter === 'termines' ? 'active' : ''} onClick={() => setListFilter('termines')}>
                    Terminés <span>{completedCount}</span>
                  </button>
                  <button type="button" role="tab" aria-selected={listFilter === 'tous'} className={listFilter === 'tous' ? 'active' : ''} onClick={() => setListFilter('tous')}>
                    Tous <span>{items.length}</span>
                  </button>
                </div>
                <div className="receiver-registration-list">
                  {filteredList.map((item) => registrationCard(item))}
                  {filteredList.length === 0 && (
                    <p className="receiver-list-empty" role="status">
                      {listFilter === 'a-faire' ? 'Aucun enregistré à traiter.' : 'Aucun résultat dans cette liste.'}
                    </p>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {undoMessage && (
        <div className="receiver-undo-toast glass" role="status" aria-live="polite">
          <span>{undoMessage.message}</span>
          <button type="button" disabled={!online || undoBusy} onClick={() => void undo()}>
            <RotateCcw size={16} aria-hidden="true" /> Annuler
          </button>
        </div>
      )}
      <ExportPdfModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filters={exportFilters}
        title={`Enregistrés de ${name}`}
        subtitle="Données fictives"
        filtersLabel="Tous les enregistrés de cet agent"
        agentName={name}
      />
      <ExportCsvModal
        open={exportCsvOpen}
        onClose={() => setExportCsvOpen(false)}
        filters={exportFilters}
        agentName={name}
      />
    </div>
  );
}
