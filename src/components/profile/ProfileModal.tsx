import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
  passwordWithConfirmationSchema,
  translatedAuthMessage,
} from '../../lib/auth-validation';
import {
  receiverFullNameSchema,
  receiverPasswordChangeSchema,
} from '../../lib/profile-validation';
import { Avatar, Button, Input, Modal } from '../ui';

type ProfileModalProps = {
  open: boolean;
  onClose: () => void;
  receiver?: boolean;
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void;
  footer?: ReactNode;
};

type LegacyPasswordValues = z.infer<typeof passwordWithConfirmationSchema>;
type FullNameValues = { fullName: string };
type ReceiverPasswordValues = z.infer<typeof receiverPasswordChangeSchema>;

function hasErrorCode(error: unknown, expected: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && error.code === expected;
}

function errorDetails(error: unknown): string {
  if (!(error instanceof Error)) return '';
  return `${error.name} ${error.message}`.toLocaleLowerCase('fr');
}

function isNetworkError(error: unknown): boolean {
  const details = errorDetails(error);
  return !navigator.onLine
    || error instanceof TypeError
    || details.includes('network')
    || details.includes('fetch')
    || details.includes('timeout')
    || details.includes('offline');
}

function passwordErrorMessage(error: unknown): string {
  if (
    hasErrorCode(error, 'invalid_credentials')
    || errorDetails(error).includes('invalid login credentials')
  ) {
    return 'Le mot de passe actuel est incorrect.';
  }
  if (
    hasErrorCode(error, 'weak_password')
    || errorDetails(error).includes('new_password_rejected')
    || errorDetails(error).includes('password should be at least')
    || errorDetails(error).includes('password is too weak')
    || errorDetails(error).includes('weak password')
  ) {
    return 'Choisissez un mot de passe plus solide.';
  }
  if (isNetworkError(error)) return 'Pas de connexion. Réessayez une fois en ligne.';
  return 'Impossible de modifier le mot de passe. Réessayez.';
}

function fullNameErrorMessage(error: unknown): string {
  if (hasErrorCode(error, '22023')) return 'Le nom doit contenir entre 2 et 60 caractères.';
  if (hasErrorCode(error, '42501')) return 'Action non autorisée.';
  if (isNetworkError(error)) return 'Pas de connexion. Réessayez une fois en ligne.';
  return 'Impossible de modifier le nom. Réessayez.';
}

export function ProfileModal({
  open,
  onClose,
  receiver = false,
  onToast,
  footer,
}: ProfileModalProps) {
  const { profile, user, updateMyFullName, updatePassword, updatePasswordWithCurrentPassword } = useAuth();
  const online = useOnlineStatus();
  const nameSubmitting = useRef(false);
  const passwordSubmitting = useRef(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState({
    current: false,
    password: false,
    confirm: false,
  });

  const nameForm = useForm<FullNameValues>({
    resolver: zodResolver(z.object({ fullName: receiverFullNameSchema })),
    mode: 'onChange',
    defaultValues: { fullName: profile?.full_name ?? '' },
  });
  const receiverPasswordForm = useForm<ReceiverPasswordValues>({
    resolver: zodResolver(receiverPasswordChangeSchema),
    mode: 'onChange',
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  });
  const legacyPasswordForm = useForm<LegacyPasswordValues>({
    resolver: zodResolver(passwordWithConfirmationSchema),
    mode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!open) return;
    nameForm.reset({ fullName: profile?.full_name ?? '' });
    receiverPasswordForm.reset();
    legacyPasswordForm.reset();
    setNameError(null);
    setPasswordError(null);
    setVisiblePasswords({ current: false, password: false, confirm: false });
  }, [legacyPasswordForm, nameForm, open, profile?.full_name, receiverPasswordForm]);

  const close = () => {
    nameForm.reset();
    receiverPasswordForm.reset();
    legacyPasswordForm.reset();
    setNameError(null);
    setPasswordError(null);
    onClose();
  };

  const saveName = nameForm.handleSubmit(async ({ fullName }) => {
    if (!online || nameSubmitting.current) return;
    nameSubmitting.current = true;
    setNameError(null);
    try {
      await updateMyFullName(fullName);
      nameForm.reset({ fullName });
      onToast('Nom modifié');
    } catch (error) {
      setNameError(fullNameErrorMessage(error));
    } finally {
      nameSubmitting.current = false;
    }
  });

  const changeReceiverPassword = receiverPasswordForm.handleSubmit(async (values) => {
    if (!online || passwordSubmitting.current) return;
    passwordSubmitting.current = true;
    setPasswordError(null);
    try {
      if (!user?.email) throw new Error('missing-account-email');
      await updatePasswordWithCurrentPassword(values.currentPassword, values.password);
      receiverPasswordForm.reset();
      onToast('Mot de passe modifié');
      close();
    } catch (error) {
      setPasswordError(passwordErrorMessage(error));
    } finally {
      passwordSubmitting.current = false;
    }
  });

  const changeLegacyPassword = legacyPasswordForm.handleSubmit(async ({ password }) => {
    if (!online || passwordSubmitting.current) return;
    passwordSubmitting.current = true;
    setPasswordError(null);
    try {
      await updatePassword(password);
      legacyPasswordForm.reset();
      onToast('Votre mot de passe a été modifié.');
    } catch (error) {
      setPasswordError(translatedAuthMessage(error));
    } finally {
      passwordSubmitting.current = false;
    }
  });

  const toggleVisibility = (key: keyof typeof visiblePasswords) => {
    setVisiblePasswords((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <Modal open={open} title="Votre profil" onClose={close} className="profile-modal-panel">
      <div className="profile-sheet">
        {receiver ? (
          <>
            <div className="receiver-profile-identity">
              <strong>{profile?.full_name ?? ''}</strong>
              <span>{user?.email ?? ''}</span>
            </div>
            <form className="profile-section-form" onSubmit={saveName} noValidate>
              <h3>Mes informations</h3>
              <Input
                label="Nom complet"
                autoComplete="name"
                maxLength={60}
                error={nameForm.formState.errors.fullName?.message}
                {...nameForm.register('fullName')}
              />
              {nameError && <p className="auth-error" role="alert">{nameError}</p>}
              <Button
                type="submit"
                className="profile-submit"
                loading={nameForm.formState.isSubmitting}
                disabled={!online || !nameForm.formState.isValid || !nameForm.formState.isDirty}
              >
                Enregistrer le nom
              </Button>
            </form>
            <form className="profile-password-form" onSubmit={changeReceiverPassword} noValidate>
              <h3>Changer mon mot de passe</h3>
              <label className="field">
                <span className="field-label">Mot de passe actuel</span>
                <div className="profile-password-input">
                  <input
                    className="input"
                    type={visiblePasswords.current ? 'text' : 'password'}
                    autoComplete="current-password"
                    {...receiverPasswordForm.register('currentPassword')}
                  />
                  <button
                    type="button"
                    className="password-toggle profile-visibility-toggle"
                    aria-label={visiblePasswords.current ? 'Masquer le mot de passe actuel' : 'Afficher le mot de passe actuel'}
                    aria-pressed={visiblePasswords.current}
                    onClick={() => toggleVisibility('current')}
                  >
                    {visiblePasswords.current ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                  </button>
                </div>
                {receiverPasswordForm.formState.errors.currentPassword?.message && (
                  <span className="field-error">{receiverPasswordForm.formState.errors.currentPassword.message}</span>
                )}
              </label>
              <label className="field">
                <span className="field-label">Nouveau mot de passe</span>
                <div className="profile-password-input">
                  <input
                    className="input"
                    type={visiblePasswords.password ? 'text' : 'password'}
                    autoComplete="new-password"
                    {...receiverPasswordForm.register('password')}
                  />
                  <button
                    type="button"
                    className="password-toggle profile-visibility-toggle"
                    aria-label={visiblePasswords.password ? 'Masquer le nouveau mot de passe' : 'Afficher le nouveau mot de passe'}
                    aria-pressed={visiblePasswords.password}
                    onClick={() => toggleVisibility('password')}
                  >
                    {visiblePasswords.password ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                  </button>
                </div>
                {receiverPasswordForm.formState.errors.password?.message && (
                  <span className="field-error">{receiverPasswordForm.formState.errors.password.message}</span>
                )}
              </label>
              <label className="field">
                <span className="field-label">Confirmer le nouveau mot de passe</span>
                <div className="profile-password-input">
                  <input
                    className="input"
                    type={visiblePasswords.confirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    {...receiverPasswordForm.register('confirmPassword')}
                  />
                  <button
                    type="button"
                    className="password-toggle profile-visibility-toggle"
                    aria-label={visiblePasswords.confirm ? 'Masquer la confirmation' : 'Afficher la confirmation'}
                    aria-pressed={visiblePasswords.confirm}
                    onClick={() => toggleVisibility('confirm')}
                  >
                    {visiblePasswords.confirm ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                  </button>
                </div>
                {receiverPasswordForm.formState.errors.confirmPassword?.message && (
                  <span className="field-error">{receiverPasswordForm.formState.errors.confirmPassword.message}</span>
                )}
              </label>
              {passwordError && <p className="auth-error" role="alert">{passwordError}</p>}
              {!online && <p className="auth-error" role="status">Pas de connexion. Réessayez une fois en ligne.</p>}
              <Button
                type="submit"
                className="profile-submit"
                loading={receiverPasswordForm.formState.isSubmitting}
                disabled={!online || !receiverPasswordForm.formState.isValid}
              >
                Changer mon mot de passe
              </Button>
            </form>
            {footer}
          </>
        ) : (
          <>
            {profile && (
              <>
                <div className="profile-sheet-heading">
                  <Avatar name={profile.full_name} size="large" />
                  <div><strong>{profile.full_name}</strong><span>{profile.role === 'admin' ? 'Administrateur' : 'Agent'}</span></div>
                </div>
                <div className="profile-detail"><span>WhatsApp</span><strong>{profile.whatsapp}</strong></div>
              </>
            )}
            <form className="profile-password-form" onSubmit={changeLegacyPassword} noValidate>
              <h3>Changer mon mot de passe</h3>
              <label className="field">
                <span className="field-label">Nouveau mot de passe</span>
                <input className="input" type="password" autoComplete="new-password" {...legacyPasswordForm.register('password')} />
                {legacyPasswordForm.formState.errors.password?.message && <span className="field-error">{legacyPasswordForm.formState.errors.password.message}</span>}
              </label>
              <label className="field">
                <span className="field-label">Confirmer le mot de passe</span>
                <input className="input" type="password" autoComplete="new-password" {...legacyPasswordForm.register('confirmPassword')} />
                {legacyPasswordForm.formState.errors.confirmPassword?.message && <span className="field-error">{legacyPasswordForm.formState.errors.confirmPassword.message}</span>}
              </label>
              {passwordError && <p className="auth-error" role="alert">{passwordError}</p>}
              {!online && <p className="auth-error" role="status">Reconnectez-vous à Internet pour modifier votre mot de passe.</p>}
              <Button type="submit" loading={legacyPasswordForm.formState.isSubmitting} disabled={!online || !legacyPasswordForm.formState.isValid}>
                Changer mon mot de passe
              </Button>
            </form>
            {footer}
          </>
        )}
      </div>
    </Modal>
  );
}
