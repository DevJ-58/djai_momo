import { describe, expect, it } from 'vitest';
import { buildRegistrationsCsv } from './csv';
import type { RegistrationExportRow } from '../../types/database';

const row: RegistrationExportRow = {
  id: 'registration-id',
  agent_id: 'agent-id',
  seq: 2,
  send_day: '2025-01-02',
  day_seq: 1,
  email: 'Jean_Test',
  mdp: 'pass;"word',
  numero: '+2250701020304',
  description: null,
  status: 'gagne',
  amount: 5000,
  admin_note: null,
  confirmed_at: null,
  exported_at: null,
  created_at: '2025-01-02T12:00:00.000Z',
  profiles: { full_name: 'Élodie Test', whatsapp: '' },
};

describe('buildRegistrationsCsv', () => {
  it('exports the identifier column and leaves the password out by default', () => {
    const csv = buildRegistrationsCsv([row], false);
    expect(csv).toContain('\uFEFF"utilisateur";"n°";"identifiant";"statut";"montant";"date";"numero"');
    expect(csv).toContain('"Jean_Test"');
    expect(csv).not.toContain('"email"');
    expect(csv).not.toContain('pass;');
  });

  it('quotes and escapes credential values when passwords are included', () => {
    const csv = buildRegistrationsCsv([row], true);
    expect(csv).toContain('"mot de passe";"numero"');
    expect(csv).toContain('"pass;""word"');
    expect(csv).toContain("\"'+2250701020304\"");
  });

  it('exports an empty phone column when the number is null', () => {
    const csv = buildRegistrationsCsv([{ ...row, numero: null }], true);
    expect(csv).toContain('"pass;""word";""');
  });
});
