import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, TriangleAlert } from 'lucide-react';
import { Avatar, Button, EmptyState, Modal, Skeleton } from '../ui';
import { useMarkExported } from '../../hooks/useRegistrationExports';
import { useToast } from '../../hooks/use-toast';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { adminErrorMessage } from '../../lib/admin-errors';
import { fetchAllRegistrations } from '../../lib/exports/fetchAll';
import { buildMessages, buildWaLink, normalizePhone, type WhatsAppEntry } from '../../lib/exports/whatsapp';
import { toTitleCase } from '../../lib/format';
import type { AgentOverview, RegistrationExportRow, RegistrationStatus } from '../../types/database';

type WhatsAppExportModalProps = {
  open: boolean;
  agent: AgentOverview | null;
  onClose: () => void;
};

type Scope = 'not_exported' | 'all' | 'status';

const statusOptions: Array<{ value: RegistrationStatus; label: string }> = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'paye', label: 'Payé' },
  { value: 'refuse', label: 'Refusé' },
  { value: 'probleme', label: 'Problème' },
];

export function WhatsAppExportModal({ open, agent, onClose }: WhatsAppExportModalProps) {
  const { show } = useToast();
  const markExported = useMarkExported();
  const online = useOnlineStatus();
  const [rows, setRows] = useState<RegistrationExportRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>('not_exported');
  const [status, setStatus] = useState<RegistrationStatus>('en_attente');
  const [openedPart, setOpenedPart] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    if (!open || !agent) return;
    let active = true;
    setRows([]);
    setTruncated(false);
    setLoaded(0);
    setScope('not_exported');
    setStatus('en_attente');
    setOpenedPart(false);
    setError(null);
    setMarkError(null);
    setLoading(true);
    void fetchAllRegistrations({ agentId: agent.agent_id }, (count) => {
      if (active) setLoaded(count);
    }).then((result) => {
      if (active) setRows(result.rows);
      if (active) setTruncated(result.truncated);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : adminErrorMessage(reason));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [open, agent?.agent_id]);

  const unexported = rows.filter((row) => row.exported_at === null);
  const scopedRows = useMemo(() => (
    scope === 'not_exported'
      ? unexported
      : scope === 'status'
        ? rows.filter((row) => row.status === status)
        : rows
  ), [rows, scope, status, unexported]);
  const entries: WhatsAppEntry[] = scopedRows.map((row) => ({
    seq: row.seq,
    email: row.email,
    mdp: row.mdp,
    agentName: row.profiles?.full_name ?? agent?.full_name ?? '',
  }));
  const messages = useMemo(() => buildMessages(entries), [rows, scope, status, agent?.full_name]);
  useEffect(() => setPreviewIndex(0), [rows, scope, status]);
  const phone = normalizePhone(agent?.whatsapp);
  const invalid = !phone;

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMarkError('Impossible de copier. Vérifiez les autorisations du navigateur.');
    }
  };

  const finishExport = async () => {
    if (!agent || !openedPart || !online || confirming) return;
    setMarkError(null);
    setConfirming(true);
    try {
      const confirmed = window.confirm(`Marquer ${scopedRows.length} enregistrés comme envoyés sur WhatsApp ?`);
      if (!confirmed) return;
      await markExported.mutateAsync(scopedRows.map((row) => row.id));
      show(`${scopedRows.length} enregistrés marqués comme envoyés`, 'success');
      onClose();
    } catch (reason) {
      setMarkError(reason instanceof Error ? reason.message : 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal open={open} title="Envoyer sur WhatsApp" onClose={onClose} className="export-modal whatsapp-export-modal">
      {agent && (
        <div className="whatsapp-export-content">
          <div className="whatsapp-agent-heading">
            <Avatar name={toTitleCase(agent.full_name)} size="large" />
            <div><strong>{toTitleCase(agent.full_name)}</strong><span>{agent.whatsapp || 'Numéro absent'}</span></div>
          </div>
          {invalid && <p className="export-warning" role="alert"><TriangleAlert size={18} aria-hidden="true" />Numéro WhatsApp invalide ou absent</p>}
          {truncated && <p className="export-truncated" role="status">La liste d’envoi est limitée aux 5 000 premiers enregistrés.</p>}
          {loading ? (
            <div className="export-loading" aria-label="Chargement des enregistrés"><Skeleton className="export-loading-line" /><span>{loaded} lignes chargées…</span></div>
          ) : error ? (
            <div className="export-error" role="alert"><p>{error}</p><Button variant="secondary" onClick={onClose}>Fermer</Button></div>
          ) : (
            <>
              <fieldset className="whatsapp-scope">
                <legend>Périmètre</legend>
                <label><input type="radio" name="whatsapp-scope" checked={scope === 'not_exported'} onChange={() => { setScope('not_exported'); setOpenedPart(false); }} />Pas encore envoyés ({unexported.length})</label>
                <label><input type="radio" name="whatsapp-scope" checked={scope === 'all'} onChange={() => { setScope('all'); setOpenedPart(false); }} />Tous ({rows.length})</label>
                <label><input type="radio" name="whatsapp-scope" checked={scope === 'status'} onChange={() => { setScope('status'); setOpenedPart(false); }} />Un statut précis</label>
                {scope === 'status' && (
                  <select aria-label="Choisir un statut" value={status} onChange={(event) => { setStatus(event.target.value as RegistrationStatus); setOpenedPart(false); }}>
                    {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({rows.filter((row) => row.status === option.value).length})</option>)}
                  </select>
                )}
              </fieldset>
              {scopedRows.length === 0 ? (
                <EmptyState icon={<Check size={22} aria-hidden="true" />} title="Rien à envoyer pour l’instant" description="" />
              ) : (
                <>
                  <h3>Aperçu</h3>
                  {messages.length > 1 && (
                    <label className="whatsapp-preview-select">
                      <span>Aperçu du message</span>
                      <select
                        value={previewIndex}
                        onChange={(event) => setPreviewIndex(Number(event.target.value))}
                        aria-label="Choisir la partie à prévisualiser"
                      >
                        {messages.map((_message, index) => <option value={index} key={index}>Partie {index + 1}/{messages.length}</option>)}
                      </select>
                    </label>
                  )}
                  <pre className="whatsapp-preview">{messages[previewIndex]}</pre>
                  {messages.length > 1 && <p className="whatsapp-parts-count">Votre envoi sera découpé en {messages.length} messages</p>}
                  <div className="whatsapp-parts">
                    {messages.map((text, index) => (
                      <div className="whatsapp-part" key={`part-${index}`}>
                        <a
                          className={`button button-primary whatsapp-open-link ${invalid ? 'is-disabled' : ''}`}
                          href={invalid ? undefined : buildWaLink(phone, text)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-disabled={invalid}
                          onClick={(event) => {
                            if (invalid) event.preventDefault();
                            else setOpenedPart(true);
                          }}
                        >
                          Ouvrir WhatsApp · partie {index + 1}/{messages.length}
                        </a>
                        <Button variant="secondary" onClick={() => void copyText(text)}><Copy size={16} aria-hidden="true" /> Copier</Button>
                      </div>
                    ))}
                  </div>
                  <Button variant="secondary" onClick={() => void copyText(messages.join('\n\n'))}><Copy size={16} aria-hidden="true" /> Copier tout le texte</Button>
                </>
              )}
              {copied && <p className="export-success" role="status">Texte copié.</p>}
              {markError && <p className="export-error" role="alert">{markError}</p>}
              {!online && <p className="auth-error" role="status">Reconnectez-vous à Internet pour marquer les envois.</p>}
              <p className="export-notice">Données de simulation : n’envoyez que des informations fictives.</p>
              {openedPart && scopedRows.length > 0 && (
                <Button onClick={() => void finishExport()} loading={confirming} disabled={!online || confirming}>
                  J’ai tout envoyé : marquer comme envoyés
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
