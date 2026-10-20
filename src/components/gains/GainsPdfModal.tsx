import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button, Modal } from '../ui';
import { useToast } from '../../hooks/use-toast';
import { generateGainsPdf } from '../../lib/exports/pdf';
import type { GainsDailyRow, GainsSummaryRow } from '../../lib/gains';

export function GainsPdfModal({
  open,
  onClose,
  rows,
  daily,
  periodLabel,
  totals,
}: {
  open: boolean;
  onClose: () => void;
  rows: GainsSummaryRow[];
  daily: GainsDailyRow[];
  periodLabel: string;
  totals: { net: number; count: number };
}) {
  const { show } = useToast();
  const [includeDaily, setIncludeDaily] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await generateGainsPdf({ rows, daily, periodLabel, totals, includeDaily });
      show('PDF des gains généré.', 'success');
      onClose();
    } catch {
      setError('Impossible de générer le PDF. Réessayez.');
    } finally {
      setGenerating(false);
    }
  };
  return <Modal open={open} title="Exporter les gains en PDF" onClose={onClose}>
    <div className="gains-export-content">
      <p>Le fichier contiendra le classement des utilisateurs et les totaux de la période : {periodLabel}.</p>
      <label className="export-toggle">
        <input type="checkbox" checked={includeDaily} onChange={(event) => setIncludeDaily(event.target.checked)} />
        <span>Inclure le détail par jour</span>
      </label>
      {error && <p className="gains-error" role="alert">{error}</p>}
      <Button onClick={() => void generate()} loading={generating}><Download size={17} aria-hidden="true" /> Générer le PDF</Button>
    </div>
  </Modal>;
}
