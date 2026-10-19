import { useEffect, useState } from 'react';
import { Download, TriangleAlert } from 'lucide-react';
import type { RegistrationExportRow } from '../../types/database';
import { fetchAllRegistrations, type RegistrationExportFilters } from '../../lib/exports/fetchAll';
import { downloadRegistrationsCsv, registrationsCsvFilename } from '../../lib/exports/csv';
import { Button, EmptyState, Modal, Skeleton } from '../ui';

type ExportCsvModalProps = {
  open: boolean;
  onClose: () => void;
  filters: RegistrationExportFilters;
  agentName?: string;
  emptyLabel?: string;
};

export function ExportCsvModal({
  open,
  onClose,
  filters,
  agentName,
  emptyLabel = 'Rien à exporter pour l’instant.',
}: ExportCsvModalProps) {
  const [rows, setRows] = useState<RegistrationExportRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includePasswords, setIncludePasswords] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setRows([]);
    setTruncated(false);
    setLoaded(0);
    setError(null);
    setIncludePasswords(false);
    setLoading(true);
    void fetchAllRegistrations(filters, (count) => {
      if (active) setLoaded(count);
    }).then((result) => {
      if (!active) return;
      setRows(result.rows);
      setTruncated(result.truncated);
      setLoaded(result.rows.length);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Une erreur est survenue. Veuillez réessayer.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [open, filters]);

  const download = () => {
    downloadRegistrationsCsv(rows, includePasswords, registrationsCsvFilename(agentName));
    onClose();
  };

  return (
    <Modal open={open} title="Exporter en CSV" onClose={onClose} className="export-modal">
      <div className="export-modal-content">
        {loading ? (
          <div className="export-loading">
            <Skeleton className="export-loading-line" />
            <span role="status">{loaded} lignes chargées…</span>
          </div>
        ) : error ? (
          <div className="export-error" role="alert">
            <p>{error}</p>
            <Button variant="secondary" onClick={onClose}>Fermer</Button>
          </div>
        ) : rows.length > 0 ? (
          <p>{agentName ? `Tous les enregistrés de ${agentName} (${rows.length})` : `${rows.length} enregistrés selon vos filtres actuels`}</p>
        ) : (
          <EmptyState icon={<Download size={22} aria-hidden="true" />} title={emptyLabel} description="" />
        )}
        {truncated && <p className="export-truncated" role="status">L’export est limité aux 5 000 premiers enregistrés correspondants.</p>}
        <label className="export-toggle">
          <input type="checkbox" checked={includePasswords} onChange={(event) => setIncludePasswords(event.target.checked)} />
          <span>Inclure les mots de passe</span>
        </label>
        {includePasswords && (
          <p className="export-warning"><TriangleAlert size={18} aria-hidden="true" />Le CSV contiendra les mots de passe en clair. Partagez-le avec précaution.</p>
        )}
        <p className="export-notice">Données de simulation : n’exportez que des informations fictives.</p>
        <Button onClick={download} disabled={loading || rows.length === 0}>
          Télécharger le CSV
        </Button>
      </div>
    </Modal>
  );
}
