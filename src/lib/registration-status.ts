import type { RegistrationStatus } from '../types/database';

export type RegistrationStatusPresentation = {
  label: string;
  color: string;
  background: string;
};

export const REGISTRATION_STATUS_PRESENTATION = {
  en_attente: { label: 'En attente', color: '#075985', background: '#E0F2FE' },
  paye: { label: 'Payé', color: '#065F46', background: '#D1FAE5' },
  refuse: { label: 'Refusé', color: '#9F1239', background: '#FFE4E6' },
  probleme: { label: 'Problème', color: '#5B21B6', background: '#EDE9FE' },
  gagne: { label: 'Gagné', color: '#15803D', background: '#DCFCE7' },
  echec: { label: 'Échec', color: '#F43F5E', background: '#FFE4E6' },
  renonce: { label: 'Renoncé', color: '#57534E', background: '#E7E5E4' },
} satisfies Record<RegistrationStatus, RegistrationStatusPresentation>;

export function registrationStatusLabel(status: RegistrationStatus | null): string {
  return status ? REGISTRATION_STATUS_PRESENTATION[status].label : '—';
}

export function registrationAmountText(status: RegistrationStatus, amount: number | null): string {
  return status === 'gagne' && amount !== null ? String(amount) : '';
}
