import { useState } from 'react';
import { CircleHelp, Coins, HandCoins, Wallet } from 'lucide-react';
import { Card, Modal, Skeleton } from '../ui';
import { computeGains, formatGain, GAINS_RULE_TEXT } from '../../lib/gains';

export function GainsCards({
  net,
  count,
  loading = false,
}: {
  net: number;
  count: number;
  loading?: boolean;
}) {
  const [informationOpen, setInformationOpen] = useState(false);
  const values = computeGains(net);
  const cards = [
    { label: 'Montant net', amount: values.net, formula: 'Somme des montants reçus', icon: Wallet },
    { label: 'Montant Vp', amount: values.vp, formula: 'Net ÷ 2', icon: Coins },
    { label: 'Montant reçu', amount: values.recu, formula: 'Vp ÷ 2', icon: HandCoins },
  ];

  return (
    <>
      <section className="gains-cards" aria-label="Synthèse des gains">
        {cards.map(({ label, amount, formula, icon: Icon }, index) => (
          <Card className={`gains-summary-card${index === 0 ? ' gains-summary-card-primary' : ''}`} key={label}>
            <div className="gains-summary-heading">
              <span className="gains-summary-icon"><Icon size={19} aria-hidden="true" /></span>
              <span>{label}</span>
              {index === 0 && <button
                type="button"
                className="gains-info-button"
                aria-label="Expliquer le calcul des gains"
                onClick={() => setInformationOpen(true)}
              ><CircleHelp size={18} aria-hidden="true" /></button>}
            </div>
            {loading ? <Skeleton className="gains-value-skeleton" /> : <strong className="gains-summary-value">{formatGain(amount)}</strong>}
            <span className="gains-summary-formula">{formula}</span>
            {index === 0 && <span className="gains-summary-count">{loading ? 'Chargement…' : `${count} enregistré${count === 1 ? '' : 's'} ayant reçu`}</span>}
          </Card>
        ))}
      </section>
      <p className="gains-rule-note">{GAINS_RULE_TEXT}</p>
      <Modal open={informationOpen} title="Comprendre les gains" onClose={() => setInformationOpen(false)}>
        <p className="gains-explanation">{GAINS_RULE_TEXT}</p>
        <p className="gains-explanation">Le montant Vp correspond à la moitié du net, et le montant reçu à la moitié du Vp. Ces montants sont calculés à partir des données retournées par la base de données.</p>
      </Modal>
    </>
  );
}
