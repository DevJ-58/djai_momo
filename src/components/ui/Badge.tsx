import type { StatusKind } from '../../types/ui';
import { REGISTRATION_STATUS_PRESENTATION } from '../../lib/registration-status';
import { formatAmount } from '../../lib/format';

export function Badge({ status, amount }: { status: StatusKind; amount?: number | null }) {
  const presentation = REGISTRATION_STATUS_PRESENTATION[status];
  const label = status === 'gagne' && amount !== null && amount !== undefined
    ? `${presentation.label} · ${formatAmount(amount)}`
    : presentation.label;
  return (
    <span
      className={`status-badge status-${status}`}
      style={{ color: presentation.color, backgroundColor: presentation.background }}
    >
      {label}
    </span>
  );
}
