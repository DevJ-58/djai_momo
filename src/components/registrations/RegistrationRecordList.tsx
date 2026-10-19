import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Check, Clipboard, Copy, Send } from 'lucide-react';
import { Badge, Button, Modal } from '../ui';
import { formatAmount, formatDate, formatRelative } from '../../lib/format';
import { useRegistrationHistory } from '../../hooks/useRegistrationHistory';
import { useRegistrationAudit } from '../../hooks/useAuditLog';
import { useUnmarkExported } from '../../hooks/useRegistrationExports';
import { useSetRegistrationStatus } from '../../hooks/useSetRegistrationStatus';
import { useUpdateRegistrationInfo } from '../../hooks/useUpdateRegistrationInfo';
import { useDeleteRegistrations } from '../../hooks/useDeleteRegistrations';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useAuth } from '../../hooks/useAuth';
import {
  useCreateCorrectionRequest,
  useHandleCorrectionRequest,
  useRegistrationCorrectionRequests,
} from '../../hooks/useCorrectionRequests';
import { useAbidjanToday } from '../../hooks/useAbidjanToday';
import { correctionRequestSchema, type CorrectionRequestValues } from '../../lib/correction-validation';
import { formatDailyNumber } from '../../lib/registration-days';
import { registrationAmountText, registrationStatusLabel } from '../../lib/registration-status';
import { useRegistrationReceiverResult } from '../../hooks/useRegistrations';
import { parseIdentifier } from '../../lib/parseIdentifier';
import { formatNumeroForDisplay, parseNumero } from '../../lib/numero';
import { formatDescriptionChange, hasDescription, parseDescription } from '../../lib/description';
import type { CorrectionRequest, RegistrationListItem, RegistrationStatus, RegistrationWithAgent } from '../../types/database';

export type RegistrationDisplayItem = RegistrationListItem & {
  agent_id?: string;
  profiles?: { full_name: string } | null;
  correction_requests?: Pick<CorrectionRequest, 'id' | 'status'>[] | null;
};

export function RegistrationRecordList<T extends RegistrationDisplayItem>({
  items,
  selected,
  onSelect,
  showAgent = false,
  showExportStatus = false,
  showCorrectionStatus = false,
  correctionRequestedIds,
  readOnly = true,
  allowStatusChange = false,
  show,
}: {
  items: T[];
  selected: T | null;
  onSelect: (registration: T | null) => void;
  showAgent?: boolean;
  showExportStatus?: boolean;
  showCorrectionStatus?: boolean;
  correctionRequestedIds?: ReadonlySet<string>;
  readOnly?: boolean;
  allowStatusChange?: boolean;
  show?: (message: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const today = useAbidjanToday();
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
              <span className="registration-number">{formatDailyNumber(registration.day_seq, registration.send_day, today)}</span>
              <span className="registration-card-status">
                <Badge status={registration.status} amount={registration.amount} />
                {showExportStatus && registration.exported_at && <ExportedBadge />}
                {showCorrectionStatus && correctionRequestedIds?.has(registration.id) && <CorrectionRequestedBadge />}
              </span>
            </div>
            <strong className="registration-card-email">{registration.email}</strong>
              {registration.numero !== null && (
                <span className="registration-card-numero">Numéro · {formatNumeroForDisplay(registration.numero)}</span>
              )}
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
        {items.some((registration) => registration.numero !== null) && (
          <table className="registration-table">
            <thead>
              <tr>
                {showAgent && <th>Utilisateur</th>}
                <th>N°</th><th>Identifiant</th><th>Numéro</th><th>Statut</th><th>Montant</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((registration) => (
                <tr
                  key={registration.id}
                  tabIndex={0}
                  aria-label={`Enregistré ${formatDailyNumber(registration.day_seq, registration.send_day, today)}, ${registration.email}`}
                  onClick={() => open(registration)}
                  onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      open(registration);
                    }
                  }}
                >
                  {showAgent && <td>{registration.profiles?.full_name ?? '—'}</td>}
                  <td><span className="registration-number">{formatDailyNumber(registration.day_seq, registration.send_day, today)}</span></td>
                  <td className="registration-table-email">{registration.email}</td>
                  <td>{registration.numero === null ? '' : formatNumeroForDisplay(registration.numero)}</td>
                  <td>
                    <Badge status={registration.status} amount={registration.amount} />
                    {showExportStatus && registration.exported_at && <ExportedBadge />}
                    {showCorrectionStatus && correctionRequestedIds?.has(registration.id) && <CorrectionRequestedBadge />}
                  </td>
                  <td>{registration.amount === null ? '—' : formatAmount(registration.amount)}</td>
                  <td><time dateTime={registration.created_at}>{formatDate(registration.created_at)}</time></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!items.some((registration) => registration.numero !== null) && (
        <table className="registration-table">
          <thead>
            <tr>
              {showAgent && <th>Utilisateur</th>}
              <th>N°</th><th>Identifiant</th><th>Statut</th><th>Montant</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((registration) => (
              <tr
                key={registration.id}
                tabIndex={0}
                aria-label={`Enregistré ${formatDailyNumber(registration.day_seq, registration.send_day, today)}, ${registration.email}`}
                onClick={() => open(registration)}
                onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    open(registration);
                  }
                }}
              >
                {showAgent && <td>{registration.profiles?.full_name ?? '—'}</td>}
                <td><span className="registration-number">{formatDailyNumber(registration.day_seq, registration.send_day, today)}</span></td>
                <td className="registration-table-email">{registration.email}</td>
                <td>
                  <Badge status={registration.status} amount={registration.amount} />
                  {showExportStatus && registration.exported_at && <ExportedBadge />}
                  {showCorrectionStatus && correctionRequestedIds?.has(registration.id) && <CorrectionRequestedBadge />}
                </td>
                <td>{registration.amount === null ? '—' : formatAmount(registration.amount)}</td>
                <td><time dateTime={registration.created_at}>{formatDate(registration.created_at)}</time></td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {selected && (
        <RegistrationDetails
          registration={selected}
          onClose={() => onSelect(null)}
          allowStatusChange={allowStatusChange}
          showExportStatus={showExportStatus}
          showCorrectionStatus={showCorrectionStatus}
          show={show}
        />
      )}
    </>
  );
}

export function RegistrationDetails({
  registration,
  onClose,
  loading = false,
  allowStatusChange = false,
  showExportStatus = false,
  showCorrectionStatus = false,
  allowAgentCorrectionRequests = true,
  show,
}: {
  registration: RegistrationListItem | RegistrationWithAgent | null;
  onClose: () => void;
  loading?: boolean;
  allowStatusChange?: boolean;
  showExportStatus?: boolean;
  showCorrectionStatus?: boolean;
  allowAgentCorrectionRequests?: boolean;
  show?: (message: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [copied, setCopied] = useState<'email' | 'password' | 'numero' | null>(null);
  const [currentStatus, setCurrentStatus] = useState(registration?.status ?? 'en_attente');
  const [currentAmount, setCurrentAmount] = useState(registration?.amount ?? null);
  const [currentExportedAt, setCurrentExportedAt] = useState(registration?.exported_at ?? null);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [emailInput, setEmailInput] = useState(registration?.email ?? '');
  const [descriptionInput, setDescriptionInput] = useState(registration?.description ?? '');
  const [currentDescription, setCurrentDescription] = useState(registration?.description ?? null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [numeroInput, setNumeroInput] = useState(registration?.numero ?? '');
  const [currentNumero, setCurrentNumero] = useState(registration?.numero ?? null);
  const [numeroError, setNumeroError] = useState<string | null>(null);
  const [resetExportOnSave, setResetExportOnSave] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const updateInfo = useUpdateRegistrationInfo();
  const deleteRegistrations = useDeleteRegistrations();
  const unmarkExported = useUnmarkExported();
  const online = useOnlineStatus();
  const { role, profile } = useAuth();
  const today = useAbidjanToday();
  const correctionRequests = useRegistrationCorrectionRequests(
    registration?.id ?? '',
    role !== 'agent' || allowAgentCorrectionRequests,
  );
  const correctionRequest = useCreateCorrectionRequest();
  const handleCorrection = useHandleCorrectionRequest();
  const receiverResult = useRegistrationReceiverResult(registration?.id ?? '');
  const openCorrection = correctionRequests.data?.find((request) => request.status === 'ouverte');

  useEffect(() => {
    setPasswordVisible(false);
    setCopied(null);
    setCurrentExportedAt(registration?.exported_at ?? null);
    setCorrectionModalOpen(false);
    setEditMode(false);
    setEmailInput(registration?.email ?? '');
    setDescriptionInput(registration?.description ?? '');
    setCurrentDescription(registration?.description ?? null);
    setDescriptionError(null);
    setNumeroInput(registration?.numero ?? '');
    setCurrentNumero(registration?.numero ?? null);
    setNumeroError(null);
    setResetExportOnSave(false);
    setIdentifierError(null);
    setPasswordInput('');
    setFormError(null);
  }, [registration?.id]);

  useEffect(() => {
    setCurrentStatus(registration?.status ?? 'en_attente');
    setCurrentAmount(registration?.amount ?? null);
  }, [registration?.id, registration?.status, registration?.amount]);

  const saveAdminUpdate = async () => {
    if (!registration || role !== 'admin') return;
    const parsedIdentifier = parseIdentifier(emailInput);
    if (!parsedIdentifier.success) {
      setIdentifierError(parsedIdentifier.error);
      return;
    }
    const trimmedPassword = passwordInput.trim();
    let parsedNumero: string | null;
    try {
      parsedNumero = parseNumero(numeroInput);
      setNumeroError(null);
    } catch (error) {
      setNumeroError(error instanceof Error ? error.message : 'Numéro invalide : chiffres uniquement, 4 à 20.');
      return;
    }
    let parsedDescription: string | null;
    try {
      parsedDescription = parseDescription(descriptionInput);
      setDescriptionError(null);
    } catch (error) {
      setDescriptionError(error instanceof Error ? error.message : '300 caractères maximum.');
      return;
    }
    const payload: { email?: string; mdp?: string; numero?: string | null; description?: string | null; exported_at?: string | null } = {};

    if (parsedIdentifier.value !== registration.email) payload.email = parsedIdentifier.value;
    if (trimmedPassword) payload.mdp = trimmedPassword;
    if (parsedNumero !== currentNumero) payload.numero = parsedNumero;
    if (parsedDescription !== currentDescription) payload.description = parsedDescription;
    if (resetExportOnSave && currentExportedAt) payload.exported_at = null;

    if (Object.keys(payload).length === 0) {
      setFormError('Aucune modification à enregistrer.');
      return;
    }

    try {
      setFormError(null);
      await updateInfo.mutateAsync({ registrationId: registration.id, values: payload });
      setEditMode(false);
      setEmailInput(parsedIdentifier.value);
      setNumeroInput(parsedNumero ?? '');
      setCurrentNumero(parsedNumero);
      setDescriptionInput(parsedDescription ?? '');
      setCurrentDescription(parsedDescription);
      if (payload.exported_at === null) setCurrentExportedAt(null);
      setIdentifierError(null);
      setNumeroError(null);
      setPasswordInput('');
      setResetExportOnSave(false);
      show?.('Informations mises à jour.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.';
      setFormError(message);
      show?.(message, 'error');
    }
  };

  const deleteSingleRegistration = async () => {
    if (!registration || role !== 'admin') return;
    const numeroPreview = currentNumero === null
      ? ''
      : `\nNuméro : ${formatNumeroForDisplay(currentNumero)}`;
    if (!window.confirm(`Supprimer cet enregistrement ?${numeroPreview}`)) return;

    try {
      await deleteRegistrations.mutateAsync([registration.id]);
      onClose();
      show?.('Enregistrement supprimé.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.';
      show?.(message, 'error');
    }
  };

  const copyValue = async (value: string, type: 'email' | 'password' | 'numero') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
      show?.(type === 'email' ? 'Identifiant copié.' : type === 'numero' ? 'Numéro copié.' : 'Mot de passe copié.', 'success');
    } catch {
      show?.('Impossible de copier. Vérifiez les autorisations du navigateur.', 'error');
    }
  };

  return (
    <>
      <Modal
        open={(Boolean(registration) || loading) && !correctionModalOpen}
        title="Détail de l’enregistrement"
        onClose={onClose}
        className="registration-detail-modal"
        backdropClassName="registration-detail-backdrop registration-details-backdrop"
      >
        {loading && !registration ? (
          <p role="status">
            {online ? 'Chargement de l’enregistrement…' : 'Hors ligne : reconnectez-vous pour charger l’enregistrement.'}
          </p>
        ) : registration && (
          <div className="registration-detail-content">
            <div className="registration-detail-row">
              <span className="registration-number">{formatDailyNumber(registration.day_seq, registration.send_day, today)}</span>
              <span className="registration-card-status">
                <Badge status={currentStatus} amount={currentAmount} />
                {showExportStatus && currentExportedAt && <ExportedBadge />}
                {showCorrectionStatus && openCorrection && <CorrectionRequestedBadge />}
              </span>
            </div>
            {'profiles' in registration && registration.profiles?.full_name && (
              <DetailField label="Utilisateur">
                <span className="registration-detail-value">{registration.profiles.full_name}</span>
              </DetailField>
            )}
            {role === 'admin' && editMode ? (
              <>
                <DetailField label="Identifiant">
                  <input
                    className="input registration-edit-input"
                    type="text"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="off"
                    value={emailInput}
                    onChange={(event) => {
                      setEmailInput(event.target.value);
                      setIdentifierError(null);
                    }}
                    aria-label="Modifier l’identifiant"
                    aria-invalid={Boolean(identifierError)}
                  />
                  {identifierError && <span className="registration-form-error">{identifierError}</span>}
                </DetailField>
                <DetailField label="Mot de passe">
                  <input
                    className="input registration-edit-input"
                    type="text"
                    value={passwordInput}
                    onChange={(event) => setPasswordInput(event.target.value)}
                    placeholder="Nouveau mot de passe"
                    aria-label="Nouveau mot de passe"
                  />
                </DetailField>
                <DetailField label="Numéro (facultatif)">
                  <input
                    className="input registration-edit-input"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="07 00 00 00 00"
                    value={numeroInput}
                    onChange={(event) => {
                      const value = event.target.value;
                      setNumeroInput(value);
                      setNumeroError(null);
                      let nextNumero: string | null;
                      try {
                        nextNumero = parseNumero(value);
                      } catch {
                        nextNumero = value.trim();
                      }
                      setResetExportOnSave(Boolean(currentExportedAt) && nextNumero !== currentNumero);
                    }}
                    aria-label="Modifier le numéro"
                    aria-invalid={Boolean(numeroError)}
                  />
                  {numeroError && <span className="registration-form-error">{numeroError}</span>}
                </DetailField>
                <DetailField label="Description (facultatif)">
                  <textarea
                    className="input registration-description-input"
                    rows={3}
                    maxLength={300}
                    autoComplete="off"
                    spellCheck
                    value={descriptionInput}
                    onChange={(event) => {
                      setDescriptionInput(event.target.value);
                      setDescriptionError(null);
                    }}
                    aria-label="Description (facultatif)"
                    aria-invalid={Boolean(descriptionError)}
                    aria-describedby="edit-description-error edit-description-count"
                  />
                  {descriptionError && (
                    <span id="edit-description-error" className="registration-form-error" role="alert">
                      {descriptionError}
                    </span>
                  )}
                  <span id="edit-description-count" className="registration-note-count">{descriptionInput.length}/300</span>
                </DetailField>
                {currentExportedAt && (
                  <label className="registration-reset-export-checkbox">
                    <input
                      type="checkbox"
                      checked={resetExportOnSave}
                      onChange={(event) => setResetExportOnSave(event.target.checked)}
                    />
                    <span>Remettre en non envoyé pour le renvoyer</span>
                  </label>
                )}
              </>
            ) : (
              <>
                <DetailField label="Identifiant">
                  <span className="registration-detail-value">{registration.email}</span>
                  <Button
                    className="copy-field-button"
                    variant="ghost"
                    aria-label="Copier l’identifiant"
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
                {currentNumero !== null && (
                  <DetailField label="Numéro">
                    <span className="registration-detail-value registration-password-value">
                      {formatNumeroForDisplay(currentNumero)}
                    </span>
                    {role === 'admin' && (
                      <Button
                        className="copy-field-button"
                        variant="ghost"
                        aria-label="Copier le numéro"
                        onClick={() => void copyValue(currentNumero, 'numero')}
                      >
                        {copied === 'numero' ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
                        <span>{copied === 'numero' ? 'Copié' : 'Copier'}</span>
                      </Button>
                    )}
                  </DetailField>
                )}
                {hasDescription(currentDescription) && (
                  <DetailField label="Description">
                    <p className="registration-description-text">{currentDescription}</p>
                  </DetailField>
                )}
              </>
            )}
            <DetailField label="Montant">
              <span className="registration-detail-value">
                {currentAmount === null ? '—' : formatAmount(currentAmount)}
              </span>
            </DetailField>
            {currentStatus === 'gagne' && (
              <p className="registration-awaiting-confirmation">
                À confirmer par l’administrateur.
              </p>
            )}
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
            <ReceiverResultSection
              result={receiverResult.data}
              registrationStatus={currentStatus}
              registrationAmount={currentAmount}
              offline={!online}
              loading={receiverResult.isPending}
              error={receiverResult.isError ? receiverResult.error.message : null}
              onRetry={() => void receiverResult.refetch()}
            />
            {role === 'agent' && allowAgentCorrectionRequests && (
              <CorrectionRequestSection
                requests={correctionRequests.data ?? []}
                loading={correctionRequests.isPending}
                error={correctionRequests.error?.message ?? null}
                openRequestExists={Boolean(openCorrection)}
                online={online}
                onRetry={() => void correctionRequests.refetch()}
                onRequest={() => setCorrectionModalOpen(true)}
              />
            )}
            {role === 'admin' && showCorrectionStatus && (
              <AdminCorrectionSection
                registration={registration}
                requests={correctionRequests.data ?? []}
                loading={correctionRequests.isPending}
                error={correctionRequests.error?.message ?? null}
                online={online}
                pending={handleCorrection.isPending}
                onRetry={() => void correctionRequests.refetch()}
                onHandle={async (requestId) => {
                  try {
                    await handleCorrection.mutateAsync({ requestId, registrationId: registration.id });
                    show?.('Demande de correction marquée comme traitée.', 'success');
                  } catch (error) {
                    show?.(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.', 'error');
                  }
                }}
              />
            )}
            {role === 'admin' && (
              <section className="registration-admin-actions" aria-label="Actions administrateur">
                {!editMode ? (
                  <Button variant="secondary" onClick={() => setEditMode(true)} disabled={!online}>
                    Modifier
                  </Button>
                ) : (
                  <div className="admin-confirm-actions">
                    <Button type="button" variant="secondary" onClick={() => {
                      setEditMode(false);
                      setFormError(null);
                      setIdentifierError(null);
                      setNumeroError(null);
                      setPasswordInput('');
                      setEmailInput(registration.email);
                      setNumeroInput(currentNumero ?? '');
                      setDescriptionInput(currentDescription ?? '');
                      setDescriptionError(null);
                      setResetExportOnSave(false);
                    }} disabled={updateInfo.isPending}>
                      Annuler
                    </Button>
                    <Button variant="primary" loading={updateInfo.isPending} disabled={!online || updateInfo.isPending} onClick={() => void saveAdminUpdate()}>
                      Enregistrer
                    </Button>
                  </div>
                )}
                <Button variant="danger" loading={deleteRegistrations.isPending} disabled={!online || deleteRegistrations.isPending} onClick={() => void deleteSingleRegistration()}>
                  Supprimer
                </Button>
              </section>
            )}
            {formError && <p className="registration-form-error" role="alert">{formError}</p>}
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
      <CorrectionRequestModal
        open={allowAgentCorrectionRequests && Boolean(registration) && correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        onSent={() => {
          setCorrectionModalOpen(false);
          show?.('Demande envoyée à l’administrateur', 'success');
        }}
        online={online}
        pending={correctionRequest.isPending}
        onSubmit={async (message) => {
          if (!registration || role !== 'agent' || !profile || correctionRequest.isPending) return;
          await correctionRequest.mutateAsync({ registrationId: registration.id, message });
        }}
      />
    </>
  );
}

function CorrectionRequestedBadge() {
  return <span className="correction-requested-badge">Correction demandée</span>;
}

function ReceiverResultSection({
  result,
  registrationStatus,
  registrationAmount,
  offline,
  loading,
  error,
  onRetry,
}: {
  result: { result: 'gagne' | 'echec' | 'renonce' | null; amount: number | null; note: string | null; recordedAt: string | null } | null | undefined;
  registrationStatus: RegistrationStatus;
  registrationAmount: number | null;
  offline: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <section className="receiver-result-section" aria-labelledby="receiver-result-title">
      <h3 id="receiver-result-title">Résultat du receveur</h3>
      {loading ? (
        <p role="status">
          {offline ? 'Hors ligne : reconnectez-vous pour charger le résultat.' : 'Chargement du résultat…'}
        </p>
      ) : error ? (
        <div className="registration-history-error" role="alert">
          <span>{error}</span><Button variant="ghost" onClick={onRetry}>Réessayer</Button>
        </div>
      ) : result?.result ? (
        <div className="receiver-result-content">
          <Badge
            status={result.result}
            amount={result.result === 'gagne' && registrationStatus === 'gagne' ? registrationAmount : null}
          />
          {result.result === 'gagne' && result.amount !== null && (
            <span>Montant du résultat : {formatAmount(result.amount)}</span>
          )}
          {result.note && <p>{result.note}</p>}
          {result.recordedAt && (
            <time dateTime={result.recordedAt}>{formatDate(result.recordedAt)}</time>
          )}
        </div>
      ) : (
        <p className="registration-history-empty">Aucun résultat enregistré.</p>
      )}
    </section>
  );
}

function CorrectionRequestSection({
  requests,
  loading,
  error,
  openRequestExists,
  online,
  onRetry,
  onRequest,
}: {
  requests: CorrectionRequest[];
  loading: boolean;
  error: string | null;
  openRequestExists: boolean;
  online: boolean;
  onRetry: () => void;
  onRequest: () => void;
}) {
  return (
    <section className="correction-request-section" aria-labelledby="agent-correction-title">
      <h3 id="agent-correction-title">Demandes de correction</h3>
      {loading ? (
        <p role="status">Chargement des demandes…</p>
      ) : error ? (
        <div className="registration-history-error" role="alert">
          <span>{error}</span><Button variant="ghost" onClick={onRetry}>Réessayer</Button>
        </div>
      ) : (
        <>
          {requests.map((request) => (
            <article className="correction-request-item" key={request.id}>
              <p>{request.message}</p>
              <span className={`correction-status correction-status-${request.status}`}>
                {request.status === 'ouverte' ? 'Correction demandée' : 'Correction traitée'}
              </span>
              <time dateTime={request.status === 'traitee' ? request.handled_at ?? request.created_at : request.created_at}>
                {request.status === 'traitee' && request.handled_at
                  ? `Traitée le ${formatDate(request.handled_at)}`
                  : `Demandée le ${formatDate(request.created_at)}`}
              </time>
            </article>
          ))}
          {openRequestExists ? (
            <Button variant="secondary" disabled><Check size={16} aria-hidden="true" /> Correction demandée</Button>
          ) : (
            <Button variant="secondary" onClick={onRequest} disabled={!online}>
              <Send size={16} aria-hidden="true" /> Demander une correction
            </Button>
          )}
          {!online && <p className="auth-error" role="status">Reconnectez-vous à Internet pour demander une correction.</p>}
        </>
      )}
    </section>
  );
}

function AdminCorrectionSection({
  registration,
  requests,
  loading,
  error,
  online,
  pending,
  onRetry,
  onHandle,
}: {
  registration: RegistrationListItem | RegistrationWithAgent;
  requests: CorrectionRequest[];
  loading: boolean;
  error: string | null;
  online: boolean;
  pending: boolean;
  onRetry: () => void;
  onHandle: (requestId: string) => Promise<void>;
}) {
  if (!loading && !error && requests.length === 0) return null;

  return (
    <section className="correction-request-section" aria-labelledby="admin-correction-title">
      <h3 id="admin-correction-title">Demande de correction</h3>
      {loading ? (
        <p role="status">Chargement de la demande…</p>
      ) : error ? (
        <div className="registration-history-error" role="alert">
          <span>{error}</span><Button variant="ghost" onClick={onRetry}>Réessayer</Button>
        </div>
      ) : requests.map((request) => (
        <article className="correction-request-item" key={request.id}>
          <p>{request.message}</p>
          <span>{'profiles' in registration ? registration.profiles?.full_name ?? 'Utilisateur' : 'Utilisateur'}</span>
          <span className={`correction-status correction-status-${request.status}`}>
            {request.status === 'ouverte' ? 'Correction demandée' : 'Correction traitée'}
          </span>
          <time dateTime={request.status === 'traitee' ? request.handled_at ?? request.created_at : request.created_at}>
            {request.status === 'traitee' && request.handled_at
              ? `Traitée le ${formatDate(request.handled_at)}`
              : `Demandée le ${formatDate(request.created_at)}`}
          </time>
          {request.status === 'ouverte' && (
            <>
              <Button
                variant="primary"
                loading={pending}
                disabled={!online || pending}
                onClick={() => void onHandle(request.id)}
              >
                Marquer comme traitée
              </Button>
              {!online && <p className="auth-error" role="status">Reconnectez-vous à Internet pour traiter cette demande.</p>}
            </>
          )}
        </article>
      ))}
    </section>
  );
}

function CorrectionRequestModal({
  open,
  onClose,
  onSent,
  online,
  pending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  online: boolean;
  pending: boolean;
  onSubmit: (message: string) => Promise<void>;
}) {
  const form = useForm<CorrectionRequestValues>({
    resolver: zodResolver(correctionRequestSchema),
    mode: 'onChange',
    defaultValues: { message: '' },
  });
  const message = form.watch('message') ?? '';

  useEffect(() => {
    if (open) {
      form.reset({ message: '' });
      form.clearErrors();
    }
  }, [open, form]);

  const send = form.handleSubmit(async ({ message: cleanMessage }) => {
    if (pending || !online) return;
    form.clearErrors('root.server');
    try {
      await onSubmit(cleanMessage);
      form.reset({ message: '' });
      onSent();
    } catch (error) {
      form.setError('root.server', {
        message: error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.',
      });
    }
  });

  return (
    <Modal
      open={open}
      title="Demander une correction"
      onClose={onClose}
      className="correction-request-modal"
      backdropClassName="registration-detail-backdrop"
      descriptionId="correction-request-description"
    >
      <form className="correction-request-form" onSubmit={(event) => void send(event)} noValidate>
        <p id="correction-request-description" className="modal-description">
          Décrivez les informations à corriger. Votre demande sera envoyée à l’administrateur.
        </p>
        <label className="field">
          <span className="field-label">Message</span>
          <textarea
            className="input correction-request-message"
            rows={4}
            maxLength={300}
            aria-label="Message de correction, 3 à 300 caractères"
            aria-invalid={Boolean(form.formState.errors.message)}
            aria-describedby="correction-message-help correction-message-count"
            {...form.register('message')}
          />
        </label>
        <div className="correction-request-footer">
          <span id="correction-message-help" className="field-hint">
            {form.formState.errors.message?.message ?? 'Entre 3 et 300 caractères après retrait des espaces autour.'}
          </span>
          <span id="correction-message-count" className="registration-note-count">{message.trim().length}/300</span>
        </div>
        {form.formState.errors.root?.server && <p className="registration-form-error" role="alert">{form.formState.errors.root.server.message}</p>}
        {!online && <p className="auth-error" role="status">Reconnectez-vous à Internet pour envoyer la demande.</p>}
        <div className="admin-confirm-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button type="submit" loading={pending} disabled={!online || pending || !form.formState.isValid}>
            Envoyer
          </Button>
        </div>
      </form>
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
  { value: 'gagne', label: 'Gagné' },
  { value: 'echec', label: 'Échec' },
  { value: 'renonce', label: 'Renoncé' },
];

function statusLabel(status: RegistrationStatus | null) {
  return registrationStatusLabel(status);
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
  const audit = useRegistrationAudit(registration.id);
  const updateStatus = useSetRegistrationStatus();
  const online = useOnlineStatus();
  const [savedStatus, setSavedStatus] = useState(registration.status);
  const [savedAmount, setSavedAmount] = useState(registration.amount);
  const [newStatus, setNewStatus] = useState(registration.status);
  const [amountText, setAmountText] = useState(registrationAmountText(registration.status, registration.amount) || (registration.amount === null ? '' : String(registration.amount)));
  const [note, setNote] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSavedStatus(registration.status);
    setSavedAmount(registration.amount);
    setNewStatus(registration.status);
    setAmountText(registrationAmountText(registration.status, registration.amount) || (registration.amount === null ? '' : String(registration.amount)));
    setNote('');
    setErrorMessage(null);
  }, [registration.id, registration.status, registration.amount]);

  const amountStatus = newStatus === 'paye' || newStatus === 'gagne';
  const showAmount = newStatus === 'gagne' ||
    (newStatus === 'paye' && (savedAmount === null || newStatus !== savedStatus));
  const amount = amountText.trim() === '' ? null : Number(amountText);
  const validAmount = amount !== null && Number.isSafeInteger(amount) && amount > 0;
  const missingAmount = amountStatus && !validAmount;
  const changed = newStatus !== savedStatus ||
    (amountStatus && amount !== savedAmount);
  const journalAudit = (audit.data ?? []).flatMap((entry) => {
    const change = formatDescriptionChange(entry.changes);
    const changes = entry.changes;
    const hasNumero = typeof changes === 'object' && changes !== null && 'numero' in changes;
    const numeroChange = hasNumero ? changes.numero : undefined;
    let numeroText: string | null = null;
    if (entry.action === 'update' && typeof numeroChange === 'object' && numeroChange !== null) {
      const from = 'de' in numeroChange && typeof numeroChange.de === 'string'
        ? formatNumeroForDisplay(numeroChange.de)
        : '';
      const to = 'vers' in numeroChange && typeof numeroChange.vers === 'string'
        ? formatNumeroForDisplay(numeroChange.vers)
        : '';
      numeroText = `Numéro : ${from} -> ${to}`;
    } else if (entry.action === 'delete' && typeof numeroChange === 'string' && numeroChange !== '') {
      numeroText = `Numéro : ${formatNumeroForDisplay(numeroChange)}`;
    }
    return [
      ...(change ? [{ entry, key: `${entry.id}-description`, text: change.text, title: change.title }] : []),
      ...(numeroText ? [{ entry, key: `${entry.id}-numero`, text: numeroText, title: undefined }] : []),
    ];
  });

  const confirmPayment = async () => {
    const paymentAmount = registration.amount;
    if (paymentAmount === null || paymentAmount <= 0 || !online || updateStatus.isPending) return;
    setErrorMessage(null);
    try {
      await updateStatus.mutateAsync({
        registrationId: registration.id,
        newStatus: 'paye',
        amount: paymentAmount,
        note: null,
      });
      setSavedStatus('paye');
      setSavedAmount(paymentAmount);
      setNewStatus('paye');
      setAmountText(String(paymentAmount));
      onSaved('paye', paymentAmount);
      show?.('Paiement confirmé', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.';
      setErrorMessage(message);
      show?.(message, 'error');
    }
  };

  const confirmChange = async () => {
    if (!changed || missingAmount) return;
    setErrorMessage(null);
    try {
      await updateStatus.mutateAsync({
        registrationId: registration.id,
        newStatus,
        amount: amountStatus ? amount : null,
        note: note.trim() || null,
      });
      setSavedStatus(newStatus);
      const updatedAmount = amountStatus ? amount : null;
      setSavedAmount(updatedAmount);
      onSaved(newStatus, updatedAmount);
      if (!amountStatus) setAmountText('');
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
      {showAmount && (
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
              Le montant doit être supérieur à 0.
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
      {registration.status === 'gagne' && (
        <Button
          className="registration-confirm-payment"
          loading={updateStatus.isPending}
          disabled={!online || updateStatus.isPending || registration.amount === null || registration.amount <= 0}
          onClick={() => void confirmPayment()}
        >
          Confirmer le paiement ({formatAmount(registration.amount ?? 0)})
        </Button>
      )}
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
      <section className="registration-history" aria-labelledby="registration-journal-title">
        <h3 id="registration-journal-title">Journal</h3>
        {audit.isPending ? (
          <p role="status">Chargement du journal…</p>
        ) : audit.isError ? (
          <div className="registration-history-error" role="alert">
            <span>{audit.error.message}</span>
            <Button variant="ghost" onClick={() => void audit.refetch()}>Réessayer</Button>
          </div>
        ) : journalAudit.length === 0 ? (
          <p className="registration-history-empty">Aucune modification enregistrée.</p>
        ) : (
          <ol className="registration-history-list">
            {journalAudit.map(({ entry, key, text, title }) => (
              <li className="registration-history-entry" key={key}>
                <strong title={title}>{text}</strong>
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
