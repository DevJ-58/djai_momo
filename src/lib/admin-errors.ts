export function adminErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code).toLocaleLowerCase('fr')
    : '';
  const message = error instanceof Error
    ? error.message.toLocaleLowerCase('fr')
    : typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message).toLocaleLowerCase('fr')
      : '';

  if (code === '42501') return 'Action non autorisée.';
  if (
    error instanceof TypeError ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('offline') ||
    message.includes('failed to connect')
  ) {
    return 'Pas de connexion. Réessayez une fois en ligne.';
  }
  return 'Une erreur est survenue. Veuillez réessayer.';
}
