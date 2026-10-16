export const DUPLICATE_REGISTRATION_MESSAGE = 'Cet email est déjà enregistré dans votre liste.';

export function registrationErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code).toLocaleLowerCase('fr')
    : '';
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String(error.message).toLocaleLowerCase('fr')
    : '';
  const details = `${code} ${message}`;

  if (code === '23505') {
    return DUPLICATE_REGISTRATION_MESSAGE;
  }
  if (
    code === '42501' ||
    code === '23514' ||
    details.includes('row-level security') ||
    details.includes('row level security') ||
    details.includes('policy') ||
    details.includes('suspended') ||
    details.includes('suspendu')
  ) {
    return 'Votre compte ne permet pas d’enregistrer pour le moment.';
  }
  if (
    error instanceof TypeError ||
    details.includes('network') ||
    details.includes('fetch') ||
    details.includes('timeout') ||
    details.includes('offline') ||
    details.includes('failed to connect')
  ) {
    return 'Pas de connexion. Réessayez une fois en ligne.';
  }
  return 'Une erreur est survenue. Veuillez réessayer.';
}

export function registrationStatusErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code).toLocaleUpperCase('fr')
    : '';
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String(error.message).toLocaleLowerCase('fr')
    : '';
  const details = `${code} ${message}`;

  if (code === '23514') return 'Un enregistré « Payé » doit avoir un montant supérieur à 0.';
  if (code === '42501') return 'Action non autorisée.';
  if (
    error instanceof TypeError ||
    details.includes('network') ||
    details.includes('fetch') ||
    details.includes('timeout') ||
    details.includes('offline') ||
    details.includes('failed to connect')
  ) {
    return 'Pas de connexion. Réessayez une fois en ligne.';
  }
  return 'Une erreur est survenue. Veuillez réessayer.';
}
