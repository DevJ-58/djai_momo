export const DUPLICATE_REGISTRATION_MESSAGE = 'Cet identifiant existe déjà dans la liste de cet utilisateur.';

export function registrationErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code).toLocaleLowerCase('fr')
    : '';
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String(error.message).toLocaleLowerCase('fr')
    : '';
  const details = typeof error === 'object' && error !== null
    ? `${code} ${message} ${'details' in error ? String(error.details).toLocaleLowerCase('fr') : ''} ${'hint' in error ? String(error.hint).toLocaleLowerCase('fr') : ''}`
    : `${code} ${message}`;

  if (code === '23514' && message.includes('description')) {
    return 'La description doit contenir entre 1 et 300 caractères.';
  }
  if (code === '23514' && details.includes('numero')) {
    return 'Numéro invalide : chiffres uniquement, 4 à 20.';
  }
  if (code === '23505') {
    return 'Cet identifiant existe déjà dans la liste de cet utilisateur.';
  }
  if (code === '23514' || code === 'not_null') {
    return "L'identifiant et le mot de passe sont obligatoires.";
  }
  if (code === '42501') {
    return 'Action non autorisée.';
  }
  if (code === '54000') {
    return 'Trop d’enregistrés à la fois : sélectionnez-en moins.';
  }
  if (
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

export function adminRegistrationErrorMessage(error: unknown): string {
  return registrationErrorMessage(error);
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
