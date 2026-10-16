import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileDown, ShieldOff, Trash2 } from 'lucide-react';
import { ExportPdfModal } from '../exports/ExportPdfModal';
import { Button, Input, Modal } from '../ui';
import { useDeleteUser, useDeletionImpact, type UserDeletionResult } from '../../hooks/useAdmin';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { toTitleCase } from '../../lib/format';
import type { AgentOverview } from '../../types/database';

type DeleteUserModalProps = {
  agent: AgentOverview | null;
  onClose: () => void;
  onDeleted: (result: UserDeletionResult) => void;
  onSuspend: (agent: AgentOverview) => void;
};

export function DeleteUserModal({ agent, onClose, onDeleted, onSuspend }: DeleteUserModalProps) {
  const online = useOnlineStatus();
  const mutation = useDeleteUser();
  const impact = useDeletionImpact(agent?.agent_id ?? '', Boolean(agent));
  const confirmationRef = useRef<HTMLInputElement>(null);
  const descriptionId = useId();
  const [confirmation, setConfirmation] = useState('');
  const [exportPdfOpen, setExportPdfOpen] = useState(false);
  const name = agent ? toTitleCase(agent.full_name) : '';
  const filters = useMemo(() => ({ status: null, agentId: agent?.agent_id ?? '' }), [agent?.agent_id]);
  const confirmed = confirmation.trim() === 'SUPPRIMER';
  const pending = mutation.isPending;

  const resetMutation = mutation.reset;
  useEffect(() => {
    setConfirmation('');
    setExportPdfOpen(false);
    resetMutation();
  }, [agent?.agent_id, resetMutation]);

  useEffect(() => {
    if (agent && impact.data && !exportPdfOpen) confirmationRef.current?.focus();
  }, [agent, exportPdfOpen, impact.data]);

  const deleteUser = async () => {
    if (!agent || !online || !confirmed || !impact.data || pending) return;
    try {
      const result = await mutation.mutateAsync(agent.agent_id);
      onDeleted(result);
    } catch {
      // The mutation exposes a translated message in its error state.
    }
  };

  const close = () => {
    if (!pending) onClose();
  };

  const suspendInstead = () => {
    if (!agent || pending) return;
    const selectedAgent = agent;
    onClose();
    onSuspend(selectedAgent);
  };

  return (
    <>
      <Modal
        open={Boolean(agent) && !exportPdfOpen}
        title={`Supprimer ${name} ?`}
        onClose={close}
        className="admin-delete-user-modal"
        descriptionId={descriptionId}
        initialFocusRef={confirmationRef}
        role="alertdialog"
        canClose={!pending}
        icon={<span className="delete-modal-icon"><AlertTriangle size={20} aria-hidden="true" /></span>}
      >
        {agent && (
          <div className="delete-user-content">
            {impact.isPending ? (
              <p className="modal-description" id={descriptionId} role="status">Calcul de l’impact de la suppression…</p>
            ) : impact.isError ? (
              <div className="delete-user-error" id={descriptionId} role="alert">
                <p>{impact.error.message}</p>
                <Button type="button" variant="secondary" onClick={() => void impact.refetch()}>Réessayer</Button>
              </div>
            ) : (
              <>
                <p className="modal-description" id={descriptionId}>
                  Le compte, ses {impact.data.registrations} enregistrés, leur historique et ses notifications seront supprimés définitivement. Cette action est irréversible.
                </p>
                {impact.data.notExported > 0 && (
                  <p className="delete-user-warning" role="status">
                    {impact.data.notExported} enregistrés n’ont pas encore été envoyés sur WhatsApp.
                  </p>
                )}
                <Input
                  ref={confirmationRef}
                  label="Tapez SUPPRIMER pour confirmer"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  aria-describedby={`${descriptionId} delete-user-confirm-hint`}
                  disabled={pending}
                />
                <span className="visually-hidden" id="delete-user-confirm-hint">
                  La saisie doit correspondre exactement à SUPPRIMER, sans tenir compte des espaces autour.
                </span>
              </>
            )}
            {!online && <p className="delete-user-error" role="status">Pas de connexion. Réessayez une fois en ligne.</p>}
            {mutation.isError && <p className="delete-user-error" role="alert">{mutation.error.message}</p>}
            <div className="delete-user-secondary-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setExportPdfOpen(true)}
                disabled={pending}
              >
                <FileDown size={17} aria-hidden="true" /> Exporter en PDF d’abord
              </Button>
              {!agent.is_suspended && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={suspendInstead}
                  disabled={!online || pending}
                >
                  <ShieldOff size={17} aria-hidden="true" /> Suspendre à la place
                </Button>
              )}
            </div>
            <div className="delete-user-actions">
              <Button type="button" variant="secondary" onClick={close} disabled={pending}>Annuler</Button>
              <Button
                type="button"
                variant="danger"
                className="delete-user-confirm-button"
                loading={pending}
                disabled={!online || !confirmed || !impact.data || impact.isFetching || pending}
                onClick={() => void deleteUser()}
              >
                <Trash2 size={17} aria-hidden="true" /> Supprimer définitivement
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {agent && (
        <ExportPdfModal
          open={exportPdfOpen}
          onClose={() => setExportPdfOpen(false)}
          filters={filters}
          title={`Enregistrés de ${name}`}
          subtitle="Export des enregistrements fictifs de cet utilisateur."
          filtersLabel={`Utilisateur : ${name}`}
          agentName={name}
        />
      )}
    </>
  );
}
