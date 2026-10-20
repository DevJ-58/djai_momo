import { useState } from 'react';
import { Eye, EyeOff, Info, LockKeyhole, UserRound } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Link, useSearchParams } from 'react-router-dom';
import { ToastViewport } from '../components/layout/ToastViewport';
import { Button, Card, Input } from '../components/ui';
import { PasteRegistrationPanel } from '../components/registrations/PasteRegistrationPanel';
import { useAddRegistration } from '../hooks/useAddRegistration';
import { useToast } from '../hooks/use-toast';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useReportDayStats } from '../hooks/useDayReports';
import { identifierSchema } from '../lib/parseIdentifier';
import { numeroSchema, parseNumero } from '../lib/numero';
import { descriptionSchema } from '../lib/description';
import { getDayBounds } from '../lib/day-reports';

const addRegistrationSchema = z.object({
  email: identifierSchema,
  mdp: z.string().trim().min(1, 'Saisissez un mot de passe.').max(100, 'Le mot de passe ne peut pas dépasser 100 caractères.'),
  numero: numeroSchema,
  description: descriptionSchema,
});

type AddRegistrationValues = z.input<typeof addRegistrationSchema>;

type RegistrationMode = 'saisie' | 'coller';
const MODE_PREFERENCE_KEY = 'registration-add-mode';

function readStoredMode(): RegistrationMode {
  try {
    return window.localStorage.getItem(MODE_PREFERENCE_KEY) === 'coller' ? 'coller' : 'saisie';
  } catch {
    return 'saisie';
  }
}

function storeMode(mode: RegistrationMode) {
  try {
    window.localStorage.setItem(MODE_PREFERENCE_KEY, mode);
  } catch {
    // La préférence de l'appareil est facultative si le stockage est indisponible.
  }
}

export function AddRegistrationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryMode = searchParams.get('mode');
  const mode: RegistrationMode =
    queryMode === 'saisie' || queryMode === 'coller' ? queryMode : readStoredMode();
  const mutation = useAddRegistration();
  const online = useOnlineStatus();
  const today = getDayBounds().today;
  const todayStats = useReportDayStats({ from: today, to: today });
  const { toasts, show, dismiss } = useToast();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setFocus,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<AddRegistrationValues, undefined, z.output<typeof addRegistrationSchema>>({
    resolver: zodResolver(addRegistrationSchema),
    defaultValues: { email: '', mdp: '', numero: '', description: '' },
  });
  const numeroField = register('numero');
  const description = watch('description') ?? '';

  const selectMode = (nextMode: RegistrationMode) => {
    storeMode(nextMode);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('mode', nextMode);
    setSearchParams(nextParams, { replace: true });
  };

  const submit = handleSubmit(async ({ email, mdp, numero, description: cleanDescription }) => {
    clearErrors('root.server');
    try {
      const registration = await mutation.mutateAsync({ email, mdp, numero, description: cleanDescription });
      reset();
      setPasswordVisible(false);
      setAddedCount((count) => count + 1);
      show(`Enregistré ${registration.day_seq}`, 'success');
      setFocus('email');
    } catch (error) {
      setError('root.server', {
        message: error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.',
      });
    }
  });

  return (
    <div className="page-content add-registration-page">
      <header className="page-header add-registration-header">
        <div>
          <span className="eyebrow">NOUVELLE SAISIE</span>
          <h1>Ajouter un enregistré</h1>
          <p>Saisissez les informations fictives à conserver.</p>
        </div>
        <Link className="back-to-registrations" to="/espace">Retour à mes enregistrés</Link>
      </header>
      <Link className="add-today-report-link" to={`/espace/jours/${today}`}>
        Rapport du jour ({todayStats.data?.[0]?.total ?? 0})
      </Link>

      <Card className="add-registration-card">
        <div className="simulation-notice" role="note">
          <Info size={21} aria-hidden="true" />
          <p>Données de simulation : saisissez uniquement des informations fictives. N'entrez jamais l'identifiant ou le mot de passe d'un vrai compte.</p>
        </div>
        <div className="registration-add-tabs" role="tablist" aria-label="Mode d’ajout">
          <button
            id="registration-tab-saisie"
            className={`registration-add-tab${mode === 'saisie' ? ' active' : ''}`}
            type="button"
            role="tab"
            aria-selected={mode === 'saisie'}
            aria-controls="registration-panel-saisie"
            tabIndex={mode === 'saisie' ? 0 : -1}
            onClick={() => selectMode('saisie')}
          >
            Saisie
          </button>
          <button
            id="registration-tab-coller"
            className={`registration-add-tab${mode === 'coller' ? ' active' : ''}`}
            type="button"
            role="tab"
            aria-selected={mode === 'coller'}
            aria-controls="registration-panel-coller"
            tabIndex={mode === 'coller' ? 0 : -1}
            onClick={() => selectMode('coller')}
          >
            Coller
          </button>
        </div>
        {mode === 'saisie' ? (
        <form id="registration-panel-saisie" className="add-registration-form" role="tabpanel" aria-labelledby="registration-tab-saisie" onSubmit={submit} noValidate>
          {!online && <p className="auth-error" role="status">Reconnectez-vous à Internet pour ajouter un enregistré.</p>}
          <Input
            label="E-mail ou pseudo"
            type="text"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            placeholder="email ou pseudo"
            icon={<UserRound size={18} aria-hidden="true" />}
            error={errors.email?.message}
            {...register('email')}
          />
          <div className="password-field">
            <Input
              label="Mot de passe"
              type={passwordVisible ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Mot de passe fictif"
              icon={<LockKeyhole size={18} aria-hidden="true" />}
              error={errors.mdp?.message}
              {...register('mdp')}
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setPasswordVisible((visible) => !visible)}
              aria-label={passwordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={passwordVisible}
            >
              {passwordVisible
                ? <EyeOff size={19} aria-hidden="true" />
                : <Eye size={19} aria-hidden="true" />}
            </button>
          </div>
          <Input
            label="Numéro (facultatif)"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="07 00 00 00 00"
            error={errors.numero?.message}
            {...numeroField}
            onBlur={(event) => {
              void numeroField.onBlur(event);
              try {
                parseNumero(event.target.value);
                clearErrors('numero');
              } catch (error) {
                setError('numero', {
                  message: error instanceof Error ? error.message : 'Numéro invalide : chiffres uniquement, 4 à 20.',
                });
              }
            }}
          />
          <label className="field add-registration-description-field">
            <span className="field-label">Description (facultatif)</span>
            <textarea
              className="input registration-description-input"
              rows={3}
              maxLength={300}
              autoComplete="off"
              spellCheck
              aria-label="Description (facultatif)"
              aria-invalid={Boolean(errors.description)}
              aria-describedby="add-description-error add-description-count"
              {...register('description')}
            />
            {errors.description?.message && (
              <span id="add-description-error" className="registration-form-error" role="alert">
                {errors.description.message}
              </span>
            )}
            <span id="add-description-count" className="registration-note-count">{description.length}/300</span>
          </label>
          {errors.root?.server?.message && (
            <p className="auth-error" role="alert">{errors.root.server.message}</p>
          )}
          <div className="add-registration-submit-wrap">
            <Button
              className="add-registration-submit"
              type="submit"
              loading={isSubmitting || mutation.isPending}
              disabled={!online || mutation.isPending}
            >
              Enregistrer
            </Button>
            <p className="session-add-count" aria-live="polite">
              {addedCount} ajoutés pendant cette session
            </p>
          </div>
        </form>
        ) : (
          <div id="registration-panel-coller" role="tabpanel" aria-labelledby="registration-tab-coller">
            <PasteRegistrationPanel
              addedCount={addedCount}
              onAdded={(count) => setAddedCount((current) => current + count)}
              showToast={show}
            />
          </div>
        )}
      </Card>
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
