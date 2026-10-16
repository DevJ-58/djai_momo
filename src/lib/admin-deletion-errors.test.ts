import { describe, expect, it } from 'vitest';
import { adminDeletionErrorMessage } from './admin-deletion-errors';

describe('adminDeletionErrorMessage', () => {
  it('translates the RPC guard errors', () => {
    expect(adminDeletionErrorMessage({ code: '42501', message: 'Vous ne pouvez pas supprimer votre propre compte' }))
      .toBe('Vous ne pouvez pas supprimer votre propre compte.');
    expect(adminDeletionErrorMessage({ code: '42501', message: 'Seuls les comptes utilisateur peuvent être supprimés' }))
      .toBe('Ce compte ne peut pas être supprimé.');
    expect(adminDeletionErrorMessage({ code: 'P0002', message: 'not found' }))
      .toBe('Cet utilisateur n’existe plus.');
    expect(adminDeletionErrorMessage({ code: '42501', message: 'forbidden' }))
      .toBe('Action non autorisée.');
  });

  it('translates network failures and hides unrecognized technical details', () => {
    expect(adminDeletionErrorMessage(new TypeError('Failed to fetch')))
      .toBe('Pas de connexion. Réessayez une fois en ligne.');
    expect(adminDeletionErrorMessage({ message: 'internal database failure' }))
      .toBe('Impossible de supprimer cet utilisateur. Veuillez réessayer.');
  });
});
