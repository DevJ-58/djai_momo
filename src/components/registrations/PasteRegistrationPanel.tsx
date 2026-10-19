import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from '../ui';
import { useAddRegistrationsBatch, type BatchRegistrationResult } from '../../hooks/useAddRegistrationsBatch';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { validateParsedEntries, parseCredentials, type ParsedEntry, type ParseCredentialsResult } from '../../lib/parseCredentials';
import { DUPLICATE_REGISTRATION_MESSAGE } from '../../lib/registration-errors';
import { formatNumeroForDisplay } from '../../lib/numero';
import type { ToastMessage } from '../../hooks/use-toast';

type PasteRegistrationPanelProps = {
  addedCount: number;
  onAdded: (count: number) => void;
  showToast: (message: string, tone?: ToastMessage['tone']) => void;
};

type EntryOverride = {
  originalEmail: string;
  originalPassword: string;
  originalNumero: string | null;
  email: string;
  password: string;
  numero: string | null;
};

const emptyParseResult: ParseCredentialsResult = { entries: [], ignoredLines: [], truncated: false };
const AUTO_SAVE_KEY = 'registration-paste-auto-save';

function readAutoSavePreference() {
  try {
    return window.localStorage.getItem(AUTO_SAVE_KEY) === 'true';
  } catch {
    return false;
  }
}

function getEntryStatus(entry: ParsedEntry) {
  if (entry.status === 'valid') return { icon: '✓', label: 'Valide', className: 'valid' };
  if (entry.status === 'warning') return { icon: '⚠', label: 'À vérifier', className: 'warning' };
  return { icon: '✕', label: 'Invalide', className: 'invalid' };
}

export function PasteRegistrationPanel({ addedCount, onAdded, showToast }: PasteRegistrationPanelProps) {
  const online = useOnlineStatus();
  const { mutateAsync: addBatch } = useAddRegistrationsBatch();
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParseCredentialsResult>(emptyParseResult);
  const [autoSave, setAutoSave] = useState(readAutoSavePreference);
  const [userPasted, setUserPasted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [results, setResults] = useState<Record<string, BatchRegistrationResult>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [clipboardMessage, setClipboardMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submitLock = useRef(false);
  const entryOverrides = useRef(new Map<string, EntryOverride>());
  const removedEntryIds = useRef(new Set<string>());
  const submittedCredentials = useRef(new Map<string, string>());

  const parseInputText = (value: string): ParseCredentialsResult => {
    const result = parseCredentials(value);
    const entries = result.entries.flatMap((entry) => {
      if (removedEntryIds.current.has(entry.id)) return [];
      const override = entryOverrides.current.get(entry.id);
      if (!override) return [entry];
      if (
        entry.email !== override.originalEmail
        || entry.password !== override.originalPassword
        || entry.numero !== override.originalNumero
      ) {
        entryOverrides.current.delete(entry.id);
        return [entry];
      }
      return [{ ...entry, email: override.email, password: override.password, numero: override.numero }];
    });
    return { ...result, entries: validateParsedEntries(entries) };
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextParsed = parseInputText(text);
      setParsed(nextParsed);
      if (text) {
        setResults((current) => {
          const next = { ...current };
          for (const id of Object.keys(next)) {
            const entry = nextParsed.entries.find((candidate) => candidate.id === id);
            const submitted = submittedCredentials.current.get(id);
            if (!entry || submitted !== JSON.stringify([entry.email, entry.password, entry.numero])) {
              delete next[id];
            }
          }
          return next;
        });
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    try {
      window.localStorage.setItem(AUTO_SAVE_KEY, String(autoSave));
    } catch {
      // The preference is optional when storage is unavailable.
    }
  }, [autoSave]);

  const entries = parsed.entries;
  const validCount = entries.filter((entry) => entry.status === 'valid').length;
  const warningCount = entries.filter((entry) => entry.status === 'warning').length;
  const invalidCount = entries.filter((entry) => entry.status === 'invalid').length;
  const eligibleEntries = useMemo(
    () => entries.filter((entry) => entry.status === 'valid' || (entry.status === 'warning' && confirmed[entry.id])),
    [entries, confirmed],
  );
  const automaticReady = autoSave
    && userPasted
    && online
    && !isSubmitting
    && entries.length > 0
    && entries.every((entry) => entry.status === 'valid')
    && parsed.ignoredLines.length === 0
    && !parsed.truncated;

  const submitEntries = useCallback(async (targetEntries: ParsedEntry[]) => {
    if (submitLock.current || !targetEntries.length || !online) return;
    submitLock.current = true;
    setIsSubmitting(true);
    setProgress({ completed: 0, total: targetEntries.length });
    setUserPasted(false);
    setCountdown(null);
    for (const entry of targetEntries) {
      submittedCredentials.current.set(entry.id, JSON.stringify([entry.email, entry.password, entry.numero]));
    }
    try {
      const batchResults = await addBatch({
        entries: targetEntries,
        onProgress: (completed, total) => setProgress({ completed, total }),
      });
      const nextResults = { ...results };
      for (const result of batchResults) nextResults[result.id] = result;
      setResults(nextResults);
      const added = batchResults.filter((result) => result.ok);
      if (added.length) {
        onAdded(added.length);
        showToast(`${added.length} enregistré${added.length > 1 ? 's' : ''} ajouté${added.length > 1 ? 's' : ''}.`, 'success');
      }
      const failed = batchResults.find((result) => result.error && result.error !== DUPLICATE_REGISTRATION_MESSAGE && result.error !== 'Non envoyé');
      if (failed?.error) showToast(failed.error, 'error');
      const allSucceeded = entries.length > 0 && entries.every((entry) => nextResults[entry.id]?.ok);
      if (allSucceeded) {
        entryOverrides.current.clear();
        removedEntryIds.current.clear();
        submittedCredentials.current.clear();
        setText('');
        setParsed(emptyParseResult);
        setConfirmed({});
        setVisibility({});
        window.setTimeout(() => textareaRef.current?.focus(), 0);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.', 'error');
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
      setProgress(null);
    }
  }, [addBatch, entries, onAdded, online, results, showToast]);

  useEffect(() => {
    if (!automaticReady) {
      setCountdown(null);
      return undefined;
    }
    setCountdown(3);
    const interval = window.setInterval(() => {
      setCountdown((current) => current === null || current <= 1 ? current : current - 1);
    }, 1000);
    const timeout = window.setTimeout(() => {
      void submitEntries(entries);
    }, 3000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [automaticReady, entries, submitEntries]);

  const changeText = (value: string, pasted = false) => {
    if (pasted || (!text && value)) {
      entryOverrides.current.clear();
      removedEntryIds.current.clear();
      submittedCredentials.current.clear();
      setResults({});
    }
    setText(value);
    setUserPasted(pasted);
    setCountdown(null);
    setClipboardMessage('');
    if (pasted) setParsed(parseInputText(value));
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    changeText(event.clipboardData.getData('text'), true);
  };

  const pasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) throw new Error('clipboard-unavailable');
      const clipboardText = await navigator.clipboard.readText();
      textareaRef.current?.focus();
      changeText(clipboardText, true);
    } catch {
      setClipboardMessage('Collez manuellement dans la zone');
      setUserPasted(false);
      textareaRef.current?.focus();
    }
  };

  const updateEntry = (id: string, field: 'email' | 'password' | 'numero', value: string) => {
    const existingEntry = parsed.entries.find((entry) => entry.id === id);
    if (existingEntry) {
      const existingOverride = entryOverrides.current.get(id);
      const email = field === 'email' ? value : existingEntry.email;
      const password = field === 'password' ? value : existingEntry.password;
      const numero = field === 'numero' ? value || null : existingEntry.numero;
      entryOverrides.current.set(id, {
        originalEmail: existingOverride?.originalEmail ?? existingEntry.email,
        originalPassword: existingOverride?.originalPassword ?? existingEntry.password,
        originalNumero: existingOverride ? existingOverride.originalNumero : existingEntry.numero,
        email,
        password,
        numero,
      });
    }
    setParsed((current) => ({
      ...current,
      entries: validateParsedEntries(current.entries.map((entry) => (
        entry.id === id ? { ...entry, [field]: value } : entry
      ))),
    }));
    setConfirmed((current) => ({ ...current, [id]: false }));
    setResults((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setUserPasted(false);
  };

  const removeEntry = (id: string) => {
    removedEntryIds.current.add(id);
    entryOverrides.current.delete(id);
    submittedCredentials.current.delete(id);
    setParsed((current) => ({
      ...current,
      entries: validateParsedEntries(current.entries.filter((entry) => entry.id !== id)),
    }));
    setConfirmed((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setResults((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    submittedCredentials.current.delete(id);
    setUserPasted(false);
  };

  const handleClear = () => {
    entryOverrides.current.clear();
    removedEntryIds.current.clear();
    submittedCredentials.current.clear();
    changeText('');
    setParsed(emptyParseResult);
    setResults({});
    setConfirmed({});
    setVisibility({});
    setClipboardMessage('');
    textareaRef.current?.focus();
  };

  const retryEntries = entries.filter((entry) => (
    entry.status !== 'invalid'
    && (entry.status !== 'warning' || confirmed[entry.id])
    && results[entry.id]
    && !results[entry.id].ok
    && results[entry.id].error !== DUPLICATE_REGISTRATION_MESSAGE
  ));
  const pendingEntries = eligibleEntries.filter((entry) => !results[entry.id]);
  const insertedResults = Object.values(results).filter((result) => result.ok);
  const insertedSequences = insertedResults.flatMap((result) => result.daySeq === undefined ? [] : [result.daySeq]);
  const allSucceededCount = insertedResults.length;

  return (
    <div className="paste-registration-panel">
      {!online && <p className="auth-error" role="status">Vous êtes hors ligne. L’enregistrement sera disponible dès le retour de la connexion.</p>}
      <label className="paste-textarea-label" htmlFor="credentials-paste">Collez vos informations ici</label>
      <textarea
        ref={textareaRef}
        id="credentials-paste"
        className="paste-textarea"
        value={text}
        disabled={isSubmitting}
        onChange={(event) => changeText(event.target.value)}
        onPaste={handlePaste}
        aria-describedby="credentials-paste-help"
      />
      <p id="credentials-paste-help" className="paste-help">
        Exemple : jean@example.com, MotDePasse, 07 00 00 00 00 ou jean_test, MotDePasse. Le numéro est facultatif. Identifiant et mot de passe peuvent aussi être sur deux lignes, avec ou sans libellés.
      </p>
      <div className="paste-input-actions">
        <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => void pasteFromClipboard()}>
          Coller depuis le presse-papiers
        </Button>
        <Button type="button" variant="secondary" disabled={isSubmitting} onClick={handleClear}>Vider</Button>
        <span className="paste-detected-count" aria-live="polite">{entries.length} détectés</span>
      </div>
      {clipboardMessage && <p className="paste-feedback" role="status">{clipboardMessage}</p>}

      <label className="paste-auto-toggle">
        <input type="checkbox" checked={autoSave} disabled={isSubmitting} onChange={(event) => setAutoSave(event.target.checked)} />
        <span>Enregistrer automatiquement si tout est valide</span>
      </label>

      {countdown !== null && (
        <div className="paste-countdown" role="status">
          <span>Enregistrement dans {countdown} s</span>
          <Button type="button" variant="secondary" onClick={() => { setUserPasted(false); setCountdown(null); }}>
            Annuler
          </Button>
        </div>
      )}

      {text.trim() && entries.length === 0 && (
        <p className="paste-feedback" role="status">Aucun identifiant détecté. Vérifiez le texte collé.</p>
      )}

      {!!entries.length && (
        <section className="paste-preview" aria-label="Aperçu des informations détectées">
          <div className="paste-summary" aria-live="polite">
            <span>{validCount} valides</span>
            <span>{warningCount} à vérifier</span>
            <span>{invalidCount} invalides</span>
          </div>
          <Button
            className="paste-show-all"
            type="button"
            disabled={isSubmitting}
            variant="secondary"
            onClick={() => setShowAllPasswords((visible) => !visible)}
          >
            Tout {showAllPasswords ? 'masquer' : 'afficher'} les mots de passe
          </Button>
          <div className="paste-entry-list" role="table" aria-label="Entrées détectées">
            <div className={`paste-entry-header${entries.some((entry) => entry.numero !== null) ? ' has-numero' : ''}`} role="row">
              <span role="columnheader">État</span>
              <span role="columnheader">Identifiant</span>
              <span role="columnheader">Mot de passe</span>
              {entries.some((entry) => entry.numero !== null) && <span role="columnheader">Numéro</span>}
              <span role="columnheader">Actions</span>
            </div>
            {entries.map((entry) => {
              const status = getEntryStatus(entry);
              const visible = visibility[entry.id] ?? showAllPasswords;
              const result = results[entry.id];
              return (
                <div className={`paste-entry ${status.className}${entries.some((candidate) => candidate.numero !== null) ? ' has-numero' : ''}`} role="row" key={entry.id}>
                  <div className="paste-entry-status" role="cell">
                    <span className={`paste-status-icon ${status.className}`} role="img" aria-label={status.label}>{status.icon}</span>
                    <span className="paste-mobile-label">{status.label}</span>
                  </div>
                  <label className="paste-field" role="cell">
                    <span className="paste-mobile-label">Identifiant</span>
                    <input
                      aria-label={`Identifiant de l’entrée ${entry.sourceLine}`}
                      type="text"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      disabled={isSubmitting}
                      autoComplete="off"
                      value={entry.email}
                      onChange={(event) => updateEntry(entry.id, 'email', event.target.value)}
                    />
                  </label>
                  <div className="paste-password-field" role="cell">
                    <label className="paste-field">
                      <span className="paste-mobile-label">Mot de passe</span>
                      <input
                        aria-label={`Mot de passe de l’entrée ${entry.sourceLine}`}
                        type={visible ? 'text' : 'password'}
                        disabled={isSubmitting}
                        autoComplete="new-password"
                        value={entry.password}
                        onChange={(event) => updateEntry(entry.id, 'password', event.target.value)}
                      />
                    </label>
                    <button
                      className="paste-password-toggle"
                      type="button"
                      aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      aria-pressed={visible}
                      onClick={() => setVisibility((current) => ({ ...current, [entry.id]: !visible }))}
                    >
                      {visible ? 'Masquer' : 'Afficher'}
                    </button>
                  </div>
                  {entries.some((candidate) => candidate.numero !== null) && (
                    <label className="paste-field" role="cell">
                      <span className="paste-mobile-label">Numéro</span>
                      <input
                        aria-label={`Numéro de l’entrée ${entry.sourceLine}`}
                        type="tel"
                        inputMode="tel"
                        autoComplete="off"
                        disabled={isSubmitting}
                        value={entry.numero === null ? '' : entry.issues.includes('Numéro invalide : chiffres uniquement, 4 à 20.')
                          ? entry.numero
                          : formatNumeroForDisplay(entry.numero)}
                        onChange={(event) => updateEntry(entry.id, 'numero', event.target.value)}
                      />
                    </label>
                  )}
                  <div className="paste-entry-actions" role="cell">
                    {entry.status === 'warning' && (
                      <label className="paste-confirm">
                        <input
                          type="checkbox"
                          disabled={isSubmitting}
                          checked={confirmed[entry.id] ?? false}
                          onChange={(event) => setConfirmed((current) => ({ ...current, [entry.id]: event.target.checked }))}
                        />
                        <span>J’ai vérifié</span>
                      </label>
                    )}
                    <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => removeEntry(entry.id)}>Retirer</Button>
                    {result?.error && <span className="paste-entry-result">{result.error}</span>}
                    {entry.issues.map((issue) => <span className="paste-entry-issue" key={issue}>{issue}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!!parsed.ignoredLines.length && (
        <details className="paste-ignored-lines">
          <summary>Lignes non reconnues ({parsed.ignoredLines.length})</summary>
          <ul>{parsed.ignoredLines.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul>
        </details>
      )}
      {parsed.truncated && <p className="paste-feedback" role="status">Le texte ou le nombre d’entrées dépasse la limite. Le surplus a été ignoré.</p>}

      {!!allSucceededCount && (
        <Card className="paste-result-card" aria-live="polite">
          <strong>
            {allSucceededCount} enregistrés
            {insertedSequences.length > 0 && ` (n° ${Math.min(...insertedSequences)} à ${Math.max(...insertedSequences)})`}
          </strong>
          <Link to="/espace">Voir mes enregistrés</Link>
        </Card>
      )}

      {progress && (
        <div className="paste-progress" role="status" aria-live="polite">
          <span>Enregistrement {progress.completed} sur {progress.total}</span>
          <progress max={progress.total} value={progress.completed} aria-label="Progression de l’enregistrement" />
        </div>
      )}

      {!!retryEntries.length && (
        <Button
          type="button"
          variant="secondary"
          disabled={!online || isSubmitting}
          onClick={() => void submitEntries(retryEntries)}
        >
          Réessayer les échecs
        </Button>
      )}

      <div className="paste-sticky-actions">
        <Button
          type="button"
          className="paste-submit"
          loading={isSubmitting}
          disabled={!online || isSubmitting || pendingEntries.length === 0}
          onClick={() => void submitEntries(pendingEntries)}
        >
          Enregistrer {validCount} enregistrés
        </Button>
        <p className="session-add-count" aria-live="polite">{addedCount} ajoutés pendant cette session</p>
      </div>
    </div>
  );
}
