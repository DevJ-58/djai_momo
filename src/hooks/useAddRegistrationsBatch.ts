import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { registrationListKey, registrationStatsKey } from './useRegistrations';
import { DUPLICATE_REGISTRATION_MESSAGE, registrationErrorMessage } from '../lib/registration-errors';
import { insertRegistration } from './useAddRegistration';
import type { ParsedEntry } from '../lib/parseCredentials';

export type BatchRegistrationResult = {
  id: string;
  ok: boolean;
  daySeq?: number;
  sendDay?: string;
  error?: string;
};

type BatchInput = {
  entries: Pick<ParsedEntry, 'id' | 'email' | 'password'>[];
  onProgress?: (completed: number, total: number) => void;
};

function getErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return '';
  return String(error.code);
}

function isSequenceCollision(error: unknown) {
  if (getErrorCode(error) !== '23505') return false;
  const details = typeof error === 'object' && error !== null
    ? ['message', 'details', 'hint', 'constraint'].flatMap((key) =>
      key in error ? [String(error[key as keyof typeof error])] : [])
    : [];
  return details.join(' ').toLocaleLowerCase('fr').includes('seq');
}

function isNetworkError(error: unknown) {
  return error instanceof TypeError
    || registrationErrorMessage(error) === 'Pas de connexion. Réessayez une fois en ligne.';
}

const wait = (milliseconds: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, milliseconds);
});

export function useAddRegistrationsBatch() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ entries, onProgress }: BatchInput): Promise<BatchRegistrationResult[]> => {
      if (!user) throw new Error('Une erreur est survenue. Veuillez réessayer.');

      const results: BatchRegistrationResult[] = [];
      for (const [index, entry] of entries.entries()) {
        let result: BatchRegistrationResult | undefined;
        let networkAttempts = 0;
        let sequenceRetries = 0;

        while (!result) {
          try {
            const registration = await insertRegistration({
              email: entry.email,
              mdp: entry.password,
              agentId: user.id,
            });
            result = { id: entry.id, ok: true, daySeq: registration.day_seq, sendDay: registration.send_day };
          } catch (error) {
            const code = getErrorCode(error);
            if (code === '42501') {
              result = { id: entry.id, ok: false, error: registrationErrorMessage(error) };
              results.push(result);
              for (const remaining of entries.slice(index + 1)) {
                results.push({ id: remaining.id, ok: false, error: 'Non envoyé' });
              }
              onProgress?.(index + 1, entries.length);
              return results;
            }
            if (code === '23505' && isSequenceCollision(error) && sequenceRetries < 3) {
              sequenceRetries += 1;
              await wait(100 * sequenceRetries);
              continue;
            }
            if (isNetworkError(error)) {
              networkAttempts += 1;
              if (networkAttempts < 2) {
                await wait(100);
                continue;
              }
              results.push({ id: entry.id, ok: false, error: 'Pas de connexion. Réessayez une fois en ligne.' });
              for (const remaining of entries.slice(index + 1)) {
                results.push({ id: remaining.id, ok: false, error: 'Non envoyé' });
              }
              onProgress?.(index + 1, entries.length);
              return results;
            }

            result = {
              id: entry.id,
              ok: false,
              error: error instanceof Error && error.message === DUPLICATE_REGISTRATION_MESSAGE
                ? 'Déjà enregistré'
                : code === '23505' && !isSequenceCollision(error)
                  ? 'Déjà enregistré'
                  : code === '23505' && isSequenceCollision(error)
                    ? 'Conflit de numéro. Réessayez.'
                  : registrationErrorMessage(error),
            };
          }
        }

        results.push(result);
        onProgress?.(index + 1, entries.length);
      }
      return results;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: registrationListKey }),
        queryClient.invalidateQueries({ queryKey: registrationStatsKey }),
      ]);
    },
  });
}
