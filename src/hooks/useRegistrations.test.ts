import { beforeEach, describe, expect, it, vi } from 'vitest';

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));

vi.mock('../lib/supabase', () => ({ supabase: supabaseMock }));

import { fetchRegistrationById } from './useRegistrations';

describe('fetchRegistrationById', () => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    returns: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.maybeSingle.mockReturnValue(query);
    supabaseMock.from.mockReturnValue(query);
  });

  it('fetches a notification target by id without requiring it in the current list', async () => {
    const registration = {
      id: 'registration-outside-list',
      seq: 1,
      send_day: '2026-10-19',
      day_seq: 1,
      email: 'fake@example.test',
      mdp: 'fake-password',
      status: 'gagne',
      amount: 5000,
      admin_note: null,
      confirmed_at: null,
      exported_at: null,
      created_at: '2026-10-19T12:00:00.000Z',
    };
    query.returns.mockResolvedValue({ data: registration, error: null });

    await expect(fetchRegistrationById(registration.id)).resolves.toEqual(registration);
    expect(supabaseMock.from).toHaveBeenCalledWith('registrations');
    expect(query.eq).toHaveBeenCalledWith('id', registration.id);
  });

  it('reports a deleted registration with the expected French message', async () => {
    query.returns.mockResolvedValue({ data: null, error: null });

    await expect(fetchRegistrationById('deleted-id')).rejects.toThrow('Cet enregistré n’existe plus.');
  });

  it('maps a row-level security rejection to a French authorization message', async () => {
    query.returns.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });

    await expect(fetchRegistrationById('other-agent-id')).rejects.toThrow('Action non autorisée.');
  });
});
