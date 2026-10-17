import { useEffect, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button, Card, Input } from '../components/ui';
import { translatedAuthMessage } from '../lib/auth-validation';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Logo } from '../components/ui';
import { APP_NAME } from '../lib/brand';

const loginSchema = z.object({
  email: z.string().trim().email('Saisissez une adresse e-mail valide.'),
  password: z.string().min(1, 'Saisissez votre mot de passe.'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { signIn, role, resendSignupConfirmation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const online = useOnlineStatus();
  const [deletedAccountNotice, setDeletedAccountNotice] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const email = watch('email');

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('compte') !== 'supprime') return;
    setDeletedAccountNotice(true);
    searchParams.delete('compte');
    const search = searchParams.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash },
      { replace: true, state: location.state },
    );
  }, [location.hash, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const onSubmit = handleSubmit(async ({ email, password }) => {
    try {
      await signIn(email, password);
      const requestedPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      const destination = requestedPath ?? (
        role === 'admin' ? '/admin'
          : role === 'agent' ? '/espace'
            : role === 'receveur' ? '/receveur'
              : '/connexion'
      );
      navigate(destination, { replace: true });
    } catch (error) {
      const message = translatedAuthMessage(error);
      setError('root.server', {
        message,
      });
    }
  });

  const emailNotConfirmed = errors.root?.server?.message === "Votre email n'est pas encore confirmé.";
  const resendEmail = async () => {
    if (!online || !email || resendSeconds > 0 || isSubmitting || resending) return;
    setResendError(null);
    setResending(true);
    try {
      await resendSignupConfirmation(email);
      setResendSeconds(60);
    } catch (error) {
      setResendError(translatedAuthMessage(error));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthPageFrame eyebrow="RAVI DE VOUS REVOIR" title="Heureux de vous retrouver." description={`Connectez-vous pour accéder à votre espace ${APP_NAME}.`}>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {deletedAccountNotice && (
          <p className="auth-info-banner" role="status">
            Ce compte n’existe plus. Contactez l’administrateur ou créez un nouveau compte.
          </p>
        )}
        <Input
          label="Adresse e-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="vous@exemple.com"
          icon={<Mail size={18} />}
          error={errors.email?.message}
          {...register('email')}
        />
        <div className="password-field">
          <Input
            label="Mot de passe"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Votre mot de passe"
            icon={<LockKeyhole size={18} />}
            error={errors.password?.message}
            {...register('password')}
          />
          <button
            className="password-toggle"
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
          </button>
        </div>
        <div className="auth-inline-links">
          <Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        </div>
        {!online && <p className="auth-error" role="status">Reconnectez-vous à Internet pour vous connecter.</p>}
        {errors.root?.server?.message && <p className="auth-error" role="alert">{errors.root.server.message}</p>}
        {emailNotConfirmed && (
          <div className="auth-resend">
            {resendError && <p className="auth-error" role="alert">{resendError}</p>}
            <Button type="button" variant="secondary" loading={resending} disabled={!online || !email || resendSeconds > 0 || isSubmitting || resending} onClick={() => void resendEmail()}>
              {resendSeconds > 0 ? `Renvoyer l'email dans ${resendSeconds} s` : "Renvoyer l'email"}
            </Button>
          </div>
        )}
        <Button className="auth-submit" type="submit" loading={isSubmitting} disabled={!online || isSubmitting}>Se connecter</Button>
      </form>
      <p className="auth-switch">Vous n’avez pas encore de compte ? <Link to="/inscription">Créer un compte</Link></p>
    </AuthPageFrame>
  );
}

export function AuthPageFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <div className="ambient-background" aria-hidden="true">
        <span className="ambient-halo halo-yellow" />
        <span className="ambient-halo halo-peach" />
        <span className="ambient-halo halo-lemon" />
      </div>
      <Card className="auth-card">
        <Link className="auth-brand" to="/" aria-label={`${APP_NAME} — accueil`}>
          <Logo variant="full" className="auth-logo" />
        </Link>
        <span className="section-kicker auth-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="auth-description">{description}</p>
        {children}
      </Card>
    </main>
  );
}
