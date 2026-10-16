import { useEffect, useState } from 'react';
import { Download, TriangleAlert } from 'lucide-react';
import { Button, EmptyState, Modal, Skeleton } from '../ui';
import { useToast } from '../../hooks/use-toast';
import { fetchAllRegistrations, type RegistrationExportFilters } from '../../lib/exports/fetchAll';
import { agentPdfFilename, generateRegistrationsPdf } from '../../lib/exports/pdf';
import type { RegistrationExportRow } from '../../types/database';

type ExportPdfModalProps = {
  open: boolean;
  onClose: () => void;
  filters: RegistrationExportFilters;
  title: string;
  subtitle: string;
  filtersLabel: string;
  filename?: string;
  agentName?: string;
  emptyLabel?: string;
};

export function ExportPdfModal({
  open,
  onClose,
  filters,
  title,
  subtitle,
  filtersLabel,
  filename,
  agentName,
  emptyLabel = 'Rien à exporter pour l’instant.',
}: ExportPdfModalProps) {
  const { show } = useToast();
  const [rows, setRows] = useState<RegistrationExportRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeStats, setIncludeStats] = useState(true);
  const [includePasswords, setIncludePasswords] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setRows([]);
    setTruncated(false);
    setLoaded(0);
    setError(null);
    setIncludeStats(true);
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

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await generateRegistrationsPdf({
        rows,
        title,
        subtitle,
        filtersLabel,
        includePasswords,
        includeStats,
        filename: filename ?? (agentName ? agentPdfFilename(agentName) : undefined),
      });
      show('PDF généré', 'success');
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Modal open={open} title="Exporter en PDF" onClose={onClose} className="export-modal">
      <div className="export-modal-content">
        {loading ? (
          <div className="export-loading">
            <Skeleton className="export-loading-line" />
            <span role="status">{loaded} lignes chargées…</span>
          </div>
        ) : error ? (
          <div className="export-error" role="alert">
            <p>{error}</p>
            <Button variant="secondary" onClick={() => onClose()}>Fermer</Button>
          </div>
        ) : rows.length > 0 ? (
          <p>{agentName ? `Tous les enregistrés de ${agentName} (${rows.length})` : `${rows.length} enregistrés selon vos filtres actuels`}</p>
        ) : (
          <EmptyState icon={<Download size={22} aria-hidden="true" />} title={emptyLabel} description="" />
        )}
        {truncated && <p className="export-truncated" role="status">L’export est limité aux 5 000 premiers enregistrés correspondants.</p>}
        <label className="export-toggle">
          <input type="checkbox" checked={includeStats} onChange={(event) => setIncludeStats(event.target.checked)} />
          <span>Inclure les statistiques</span>
        </label>
        <label className="export-toggle">
          <input type="checkbox" checked={includePasswords} onChange={(event) => setIncludePasswords(event.target.checked)} />
          <span>Inclure les mots de passe</span>
        </label>
        {includePasswords && (
          <p className="export-warning"><TriangleAlert size={18} aria-hidden="true" />Le PDF contiendra les mots de passe en clair. Partagez-le avec précaution.</p>
        )}
        <p className="export-notice">Données de simulation : n’exportez que des informations fictives.</p>
        {error && !loading && <p className="export-error" role="alert">{error}</p>}
        <Button onClick={() => void generate()} loading={generating} disabled={loading || rows.length === 0 || generating}>
          Générer le PDF
        </Button>
      </div>
    </Modal>
  );
}
