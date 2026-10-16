import type { StatusKind } from '../../types/ui';

const statusLabels: Record<StatusKind, string> = {
  en_attente: 'En attente',
  paye: 'Payé',
  refuse: 'Refusé',
  probleme: 'Problème',
};

export function Badge({ status }: { status: StatusKind }) {
  return <span className={`status-badge status-${status}`}>{statusLabels[status]}</span>;
}
