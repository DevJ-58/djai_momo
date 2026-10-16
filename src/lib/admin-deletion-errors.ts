type DeletionError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export function adminDeletionErrorMessage(error: unknown): string {
  if (error instanceof TypeError) {
    return 'Pas de connexion. Réessayez une fois en ligne.';
  }

  const details = typeof error === 'object' && error !== null
    ? error as DeletionError
    : {};
  const code = details.code ?? '';
  const message = `${details.message ?? ''} ${details.details ?? ''} ${details.hint ?? ''}`.toLocaleLowerCase('fr');

  if (message.includes('propre compte')) return 'Vous ne pouvez pas supprimer votre propre compte.';
  if (message.includes('seuls les comptes')) return 'Ce compte ne peut pas être supprimé.';
  if (code === 'P0002') return 'Cet utilisateur n’existe plus.';
  if (code === '42501') return 'Action non autorisée.';
  if (
    code === 'FETCH_ERROR' ||
    code === 'NETWORK_ERROR' ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('offline') ||
    message.includes('pas de connexion') ||
    message.includes('timeout')
  ) {
    return 'Pas de connexion. Réessayez une fois en ligne.';
  }
  return 'Impossible de supprimer cet utilisateur. Veuillez réessayer.';
}
