import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, Clipboard, Copy } from 'lucide-react';
import { Badge, Button, Modal } from '../ui';
import { formatAmount, formatDate, formatRelative } from '../../lib/format';
import { useRegistrationHistory } from '../../hooks/useRegistrationHistory';
import { useUnmarkExported } from '../../hooks/useRegistrationExports';
import { useSetRegistrationStatus } from '../../hooks/useSetRegistrationStatus';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import type { RegistrationListItem, RegistrationStatus, RegistrationWithAgent } from '../../types/database';

export type RegistrationDisplayItem = RegistrationListItem & {
  agent_id?: string;
  profiles?: { full_name: string } | null;
};

export function RegistrationRecordList<T extends RegistrationDisplayItem>({
  items,
  selected,
  onSelect,
  showAgent = false,
  showExportStatus = false,
  readOnly = true,
  allowStatusChange = false,
  show,
}: {
  items: T[];
  selected: T | null;
  onSelect: (registration: T | null) => void;
  showAgent?: boolean;
  showExportStatus?: boolean;
  readOnly?: boolean;
  allowStatusChange?: boolean;
  show?: (message: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const open = (registration: T) => onSelect(registration);

  return (
    <>
      <div className="registration-card-list" data-read-only={readOnly}>
        {items.map((registration) => (
          <button
            className="glass registration-card"
            type="button"
            key={registration.id}
            onClick={() => open(registration)}
          >
            <div className="registration-card-topline">
              <span className="registration-number">N° {registration.seq}</span>
              <span className="registration-card-status">
                <Badge status={registration.status} />
                {showExportStatus && registration.exported_at && <ExportedBadge />}
              </span>
            </div>
            <strong className="registration-card-email">{registration.email}</strong>
            {showAgent && registration.profiles?.full_name && (
              <span className="registration-agent-name">{registration.profiles.full_name}</span>
            )}
            <div className="registration-card-bottomline">
              <span>{registration.amount === null ? '—' : formatAmount(registration.amount)}</span>
              <time dateTime={registration.created_at}>{formatRelative(registration.created_at)}</time>
            </div>
          </button>
        ))}
      </div>

      <div className="registration-table-wrap glass">
        <table className="registration-table">
          <thead>
            <tr>
              {showAgent && <th>Utilisateur</th>}
              <th>N°</th><th>Email</th><th>Statut</th><th>Montant</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((registration) => (
              <tr
                key={registration.id}
                tabIndex={0}
                aria-label={`Enregistré numéro ${registration.seq}, ${registration.email}`}
                onClick={() => open(registration)}
                onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    open(registration);
                  }
                }}
              >
                {showAgent && <td>{registration.profiles?.full_name ?? '—'}</td>}
                <td><span className="registration-number">N° {registration.seq}</span></td>
                <td className="registration-table-email">{registration.email}</td>
                <td><Badge status={registration.status} />{showExportStatus && registration.exported_at && <ExportedBadge />}</td>
                <td>{registration.amount === null ? '—' : formatAmount(registration.amount)}</td>
                <td><time dateTime={registration.created_at}>{formatDate(registration.created_at)}</time></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <RegistrationDetails
          registration={selected}
          onClose={() => onSelect(null)}
          allowStatusChange={allowStatusChange}
          showExportStatus={showExportStatus}
          show={show}
        />
      )}
    </>
  );
}

export function RegistrationDetails({
  registration,
  onClose,
  allowStatusChange = false,
  showExportStatus = false,
  show,
}: {
  registration: RegistrationListItem | RegistrationWithAgent | null;
  onClose: () => void;
  allowStatusChange?: boolean;
  showExportStatus?: boolean;
  show?: (message: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [copied, setCopied] = useState<'email' | 'password' | null>(null);
  const [currentStatus, setCurrentStatus] = useState(registration?.status ?? 'en_attente');
  const [currentAmount, setCurrentAmount] = useState(registration?.amount ?? null);
  const [currentExportedAt, setCurrentExportedAt] = useState(registration?.exported_at ?? null);
  const unmarkExported = useUnmarkExported();
  const online = useOnlineStatus();

  useEffect(() => {
    setPasswordVisible(false);
    setCopied(null);
    setCurrentStatus(registration?.status ?? 'en_attente');
    setCurrentAmount(registration?.amount ?? null);
    setCurrentExportedAt(registration?.exported_at ?? null);
  }, [registration?.id]);

  const copyValue = async (value: string, type: 'email' | 'password') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
      show?.(type === 'email' ? 'E-mail copié.' : 'Mot de passe copié.', 'success');
    } catch {
      show?.('Impossible de copier. Vérifiez les autorisations du navigateur.', 'error');
    }
  };

  return (
    <Modal
      open={Boolean(registration)}
      title="Détail de l’enregistrement"
      onClose={onClose}
      className="registration-detail-modal"
      backdropClassName="registration-detail-backdrop"
    >
      {registration && (
        <div className="registration-detail-content">
          <div className="registration-detail-row">
            <span className="registration-number">N° {registration.seq}</span>
            <span className="registration-card-status">
              <Badge status={currentStatus} />
              {showExportStatus && currentExportedAt && <ExportedBadge />}
            </span>
          </div>
          {'profiles' in registration && registration.profiles?.full_name && (
            <DetailField label="Utilisateur">
              <span className="registration-detail-value">{registration.profiles.full_name}</span>
            </DetailField>
          )}
          <DetailField label="E-mail">
            <span className="registration-detail-value">{registration.email}</span>
            <Button
              className="copy-field-button"
              variant="ghost"
              aria-label="Copier l’e-mail"
              onClick={() => void copyValue(registration.email, 'email')}
            >
              {copied === 'email' ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
              <span>{copied === 'email' ? 'Copié' : 'Copier'}</span>
            </Button>
          </DetailField>
          <DetailField label="Mot de passe">
            <span className="registration-detail-value registration-password-value">
              {passwordVisible ? registration.mdp : '••••••••'}
            </span>
            <div className="registration-password-actions">
              <Button
                className="copy-field-button"
                variant="ghost"
                onClick={() => setPasswordVisible((visible) => !visible)}
                aria-label={passwordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={passwordVisible}
              >
                {passwordVisible ? 'Masquer' : 'Afficher'}
              </Button>
              <Button
                className="copy-field-button"
                variant="ghost"
                aria-label="Copier le mot de passe"
                onClick={() => void copyValue(registration.mdp, 'password')}
              >
                {copied === 'password' ? <Check size={17} aria-hidden="true" /> : <Clipboard size={17} aria-hidden="true" />}
                <span>{copied === 'password' ? 'Copié' : 'Copier'}</span>
              </Button>
            </div>
          </DetailField>
          <DetailField label="Montant">
            <span className="registration-detail-value">
              {currentAmount === null ? '—' : formatAmount(currentAmount)}
            </span>
          </DetailField>
          <DetailField label="Date d’enregistrement">
            <time className="registration-detail-value" dateTime={registration.created_at}>
              {formatDate(registration.created_at)}
            </time>
          </DetailField>
          {showExportStatus && currentExportedAt && (
            <DetailField label="Envoi WhatsApp">
              <div className="registration-export-detail">
                <span>Envoyé sur WhatsApp le {formatDate(currentExportedAt)}</span>
                <Button
                  className="registration-unmark-exported"
                  variant="ghost"
                  loading={unmarkExported.isPending}
                  disabled={!online || unmarkExported.isPending}
                  onClick={async () => {
                    if (!window.confirm('Remettre cet enregistré en non envoyé ?')) return;
                    try {
                      await unmarkExported.mutateAsync(registration.id);
                      setCurrentExportedAt(null);
                      show?.('Enregistré remis en non envoyé.', 'success');
                    } catch (error) {
                      show?.(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.', 'error');
                    }
                  }}
                >
                  Remettre en non envoyé
                </Button>
              </div>
            </DetailField>
          )}
          {registration.confirmed_at && (
            <DetailField label="Date de confirmation">
              <time className="registration-detail-value" dateTime={registration.confirmed_at}>
                {formatDate(registration.confirmed_at)}
              </time>
            </DetailField>
          )}
          {allowStatusChange && (
            <StatusManagement
              registration={registration}
              onSaved={(status, amount) => {
                setCurrentStatus(status);
                setCurrentAmount(amount);
              }}
              show={show}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

function ExportedBadge() {
  return <span className="registration-exported-badge"><Check size={13} aria-hidden="true" /> Envoyé</span>;
}

const editableStatuses: Array<{ value: RegistrationStatus; label: string }> = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'paye', label: 'Payé' },
  { value: 'refuse', label: 'Refusé' },
  { value: 'probleme', label: 'Problème' },
];

function statusLabel(status: RegistrationStatus | null) {
  return editableStatuses.find((item) => item.value === status)?.label ?? '—';
}

function StatusManagement({
  registration,
  onSaved,
  show,
}: {
  registration: RegistrationListItem | RegistrationWithAgent;
  onSaved: (status: RegistrationStatus, amount: number | null) => void;
  show?: (message: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const history = useRegistrationHistory(registration.id);
  const updateStatus = useSetRegistrationStatus();
  const online = useOnlineStatus();
  const [savedStatus, setSavedStatus] = useState(registration.status);
  const [savedAmount, setSavedAmount] = useState(registration.amount);
  const [newStatus, setNewStatus] = useState(registration.status);
  const [amountText, setAmountText] = useState(registration.amount === null ? '' : String(registration.amount));
  const [note, setNote] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSavedStatus(registration.status);
    setSavedAmount(registration.amount);
    setNewStatus(registration.status);
    setAmountText(registration.amount === null ? '' : String(registration.amount));
    setNote('');
    setErrorMessage(null);
  }, [registration.id]);

  const requiresAmount = newStatus === 'paye' &&
    (savedAmount === null || newStatus !== savedStatus);
  const amount = amountText.trim() === '' ? null : Number(amountText);
  const validAmount = amount !== null && Number.isSafeInteger(amount) && amount > 0;
  const missingAmount = newStatus === 'paye' && !validAmount;
  const changed = newStatus !== savedStatus ||
    (newStatus === 'paye' && amount !== savedAmount);

  const confirmChange = async () => {
    if (!changed || missingAmount) return;
    setErrorMessage(null);
    try {
      await updateStatus.mutateAsync({
        registrationId: registration.id,
        newStatus,
        amount: newStatus === 'paye' ? amount : null,
        note: note.trim() || null,
      });
      setSavedStatus(newStatus);
      const updatedAmount = newStatus === 'paye' ? amount : null;
      setSavedAmount(updatedAmount);
      onSaved(newStatus, updatedAmount);
      if (newStatus !== 'paye') setAmountText('');
      setNote('');
      show?.('Statut mis à jour', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.';
      setErrorMessage(message);
      show?.(message, 'error');
    }
  };

  return (
    <section className="registration-status-management" aria-labelledby="registration-status-title">
      <h3 id="registration-status-title">Modifier le statut</h3>
      <label className="registration-management-field">
        <span className="field-label">Statut</span>
        <select
          className="registration-status-select"
          aria-label="Nouveau statut"
          value={newStatus}
          onChange={(event) => setNewStatus(event.target.value as RegistrationStatus)}
        >
          {editableStatuses.map(({ value, label }) => <option value={value} key={value}>{label}</option>)}
        </select>
      </label>
      {requiresAmount && (
        <label className="registration-management-field">
          <span className="field-label">Montant (FCFA)</span>
          <input
            className="input"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            aria-required="true"
            aria-invalid={missingAmount}
          />
          {missingAmount && (
            <span className="registration-form-error">
              Un enregistré « Payé » doit avoir un montant supérieur à 0.
            </span>
          )}
        </label>
      )}
      <label className="registration-management-field">
        <span className="field-label">Note (optionnelle)</span>
        <textarea
          className="registration-note-input"
          maxLength={300}
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-label="Note optionnelle, 300 caractères maximum"
        />
        <span className="registration-note-count">{note.length}/300</span>
      </label>
      {errorMessage && <p className="registration-form-error" role="alert">{errorMessage}</p>}
      <Button
        className="registration-status-submit"
        onClick={() => void confirmChange()}
        loading={updateStatus.isPending}
        disabled={!online || !changed || missingAmount || updateStatus.isPending}
      >
        Confirmer le changement
      </Button>
      {!online && <p className="auth-error" role="status">Reconnectez-vous à Internet pour modifier le statut.</p>}

      <section className="registration-history" aria-labelledby="registration-history-title">
        <h3 id="registration-history-title">Historique</h3>
        {history.isPending ? (
          <div className="registration-history-list" aria-label="Chargement de l’historique">
            {Array.from({ length: 2 }, (_, index) => <div className="registration-history-skeleton" key={index}><span /><span /><span /></div>)}
          </div>
        ) : history.isError ? (
          <div className="registration-history-error" role="alert">
            <span>{history.error.message}</span>
            <Button variant="ghost" onClick={() => void history.refetch()}>Réessayer</Button>
          </div>
        ) : history.data.length === 0 ? (
          <p className="registration-history-empty">Aucun historique pour l’instant.</p>
        ) : (
          <ol className="registration-history-list">
            {history.data.map((entry, index) => (
              <li className="registration-history-entry" key={`${entry.created_at}-${index}`}>
                <strong>{statusLabel(entry.from_status)} → {statusLabel(entry.to_status)}</strong>
                {entry.amount !== null && <span>Montant : {formatAmount(entry.amount)}</span>}
                {entry.note && <p>{entry.note}</p>}
                <span>{entry.changed_by_name ?? '—'}</span>
                <time dateTime={entry.created_at}>{formatDate(entry.created_at)}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="registration-detail-field">
      <span className="registration-detail-label">{label}</span>
      <div className="registration-detail-field-content">{children}</div>
    </div>
  );
}
