import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { AuthPageFrame } from './LoginPage';
import { Button, Input } from '../components/ui';
import { ToastViewport } from '../components/layout/ToastViewport';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/use-toast';
import { passwordWithConfirmationSchema, translatedAuthMessage } from '../lib/auth-validation';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Logo } from '../components/ui';

const emailSchema = z.object({
  email: z.string().trim().email('Saisissez une adresse e-mail valide.'),
});

type EmailValues = z.infer<typeof emailSchema>;
type PasswordValues = z.infer<typeof passwordWithConfirmationSchema>;

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const online = useOnlineStatus();
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const submit = handleSubmit(async ({ email }) => {
    try {
      await sendPasswordReset(email);
      setSent(true);
      setCooldown(60);
    } catch (error) {
      setError('root.server', { message: translatedAuthMessage(error) });
    }
  });

  return (
    <AuthPageFrame eyebrow="RÉCUPÉRATION DU COMPTE" title="Mot de passe oublié ?" description="Saisissez l’adresse e-mail de votre compte pour recevoir un lien de réinitialisation.">
      <form className="auth-form" onSubmit={submit} noValidate>
        {!online && <p className="auth-error" role="status">Reconnectez-vous à Internet pour demander un lien.</p>}
        <Input
          label="Adresse e-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="vous@exemple.com"
          icon={<Mail size={18} aria-hidden="true" />}
          error={errors.email?.message}
          {...register('email')}
        />
        {errors.root?.server?.message && <p className="auth-error" role="alert">{errors.root.server.message}</p>}
        {sent && (
          <p className="auth-success" role="status">
            Si un compte existe avec cet email, un lien vient d'être envoyé.
          </p>
        )}
        <Button className="auth-submit" type="submit" loading={isSubmitting} disabled={!online || cooldown > 0 || isSubmitting}>
          {cooldown > 0 ? `Nouvel envoi dans ${cooldown} s` : sent ? 'Renvoyer le lien' : 'Envoyer le lien'}
        </Button>
      </form>
      <p className="auth-switch"><Link to="/connexion">Retour à la connexion</Link></p>
    </AuthPageFrame>
  );
}

export function ResetPasswordPage() {
  const { loading, session, role, passwordRecovery, updatePassword } = useAuth();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const { toasts, show, dismiss } = useToast();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordWithConfirmationSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const hasUrlError = /(?:^|[&#?])error=/.test(window.location.href);
  const invalidLink = hasUrlError || (!loading && !passwordRecovery && !completed);

  const submit = handleSubmit(async ({ password }) => {
    setErrorMessage(null);
    setSaving(true);
    try {
      await updatePassword(password);
      setCompleted(true);
      show('Votre mot de passe a été modifié.', 'success');
      window.setTimeout(() => {
        navigate(role === 'admin' ? '/admin' : role === 'agent' ? '/espace' : '/connexion', { replace: true });
      }, 900);
    } catch (error) {
      const message = translatedAuthMessage(error);
      setErrorMessage(message);
      setError('root.server', { message });
    } finally {
      setSaving(false);
    }
  });

  if (loading) {
    return <div className="route-loading" role="status"><Logo variant="full" size={160} className="loading-logo" /><span>Chargement de votre espace…</span></div>;
  }

  if (!session || invalidLink) {
    return (
      <AuthPageFrame eyebrow="RÉCUPÉRATION DU COMPTE" title="Lien invalide ou expiré" description={errorMessage ?? 'Ce lien de réinitialisation ne fonctionne plus. Demandez-en un nouveau pour continuer.'}>
        <p className="auth-switch"><Link to="/mot-de-passe-oublie">Demander un nouveau lien</Link></p>
        <p className="auth-switch"><Link to="/connexion">Retour à la connexion</Link></p>
      </AuthPageFrame>
    );
  }

  return (
    <AuthPageFrame eyebrow="SÉCURITÉ DU COMPTE" title="Choisissez un nouveau mot de passe" description="Utilisez au moins 8 caractères, avec une lettre et un chiffre.">
      <form className="auth-form" onSubmit={submit} noValidate>
        {!online && <p className="auth-error" role="status">Reconnectez-vous à Internet pour modifier votre mot de passe.</p>}
        <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
        <Input label="Confirmer le mot de passe" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        {errors.root?.server?.message && <p className="auth-error" role="alert">{errors.root.server.message}</p>}
        <Button className="auth-submit" type="submit" loading={isSubmitting || saving} disabled={!online || isSubmitting || saving}>Modifier le mot de passe</Button>
      </form>
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </AuthPageFrame>
  );
}
