import { describe, expect, it } from 'vitest';
import { REGISTRATION_STATUSES } from '../types/database';
import { REGISTRATION_STATUS_PRESENTATION, registrationAmountText } from './registration-status';

describe('registration status presentation', () => {
  it('provides a label and color pair for every registration status', () => {
    expect(Object.keys(REGISTRATION_STATUS_PRESENTATION).sort()).toEqual([...REGISTRATION_STATUSES].sort());
    expect(REGISTRATION_STATUS_PRESENTATION).toMatchObject({
      en_attente: { label: 'En attente', color: '#075985', background: '#E0F2FE' },
      paye: { label: 'Payé', color: '#065F46', background: '#D1FAE5' },
      refuse: { label: 'Refusé', color: '#9F1239', background: '#FFE4E6' },
      probleme: { label: 'Problème', color: '#5B21B6', background: '#EDE9FE' },
      gagne: { label: 'Gagné', color: '#15803D', background: '#DCFCE7' },
      echec: { label: 'Échec', color: '#F43F5E', background: '#FFE4E6' },
      renonce: { label: 'Renoncé', color: '#57534E', background: '#E7E5E4' },
    });
  });

  it('prefills the amount only for a gained registration', () => {
    expect(registrationAmountText('gagne', 5000)).toBe('5000');
    expect(registrationAmountText('gagne', null)).toBe('');
    expect(registrationAmountText('paye', 5000)).toBe('');
  });
});
