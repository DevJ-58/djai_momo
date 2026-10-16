import { useEffect, useState } from 'react';
import { Mail, Phone, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button, Input } from '../components/ui';
import { AuthPageFrame } from './LoginPage';
import { passwordSchema, translatedAuthMessage } from '../lib/auth-validation';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères.'),
  whatsapp: z.string().regex(/^\+[0-9]{8,15}$/, 'Utilisez le format international, par exemple +2250700000000.'),
  email: z.string().trim().email('Saisissez une adresse e-mail valide.'),
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirmez votre mot de passe.'),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas.',
  path: ['confirmPassword'],
});

type SignupValues = z.infer<typeof signupSchema>;

export function SignupPage() {
  const { signUp, resendSignupConfirmation } = useAuth();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', whatsapp: '', email: '', password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const onSubmit = handleSubmit(async ({ fullName, whatsapp, email, password }) => {
    setConfirmationEmail(null);
    try {
      const result = await signUp({ fullName, whatsapp, email, password });
      if (result.needsEmailConfirmation) {
        setConfirmationEmail(email);
        setResendSeconds(60);
      } else {
        navigate('/espace', { replace: true });
      }
    } catch (error) {
      setError('root.server', {
        message: translatedAuthMessage(error),
      });
    }
  });

  const resendEmail = async () => {
    if (!online || !confirmationEmail || resendSeconds > 0 || isSubmitting || resending) return;
    setResendError(null);
    setResending(true);
    try {
      await resendSignupConfirmation(confirmationEmail);
      setResendSeconds(60);
    } catch (error) {
      setResendError(translatedAuthMessage(error));
    } finally {
      setResending(false);
    }
  };

  if (confirmationEmail) {
    return (
      <AuthPageFrame eyebrow="CONFIRMATION DE VOTRE ADRESSE" title="Vérifiez votre boîte mail" description={`Un lien de confirmation a été envoyé à ${confirmationEmail}.`}>
        <div className="auth-form">
          <p className="auth-description">Confirmez votre adresse pour pouvoir vous connecter.</p>
          {resendError && <p className="auth-error" role="alert">{resendError}</p>}
          {!online && <p className="auth-error" role="status">Reconnectez-vous à Internet pour renvoyer l’e-mail.</p>}
          <Button type="button" className="auth-submit" disabled={!online || resendSeconds > 0 || isSubmitting || resending} loading={isSubmitting || resending} onClick={() => void resendEmail()}>
            {resendSeconds > 0 ? `Renvoyer l'email dans ${resendSeconds} s` : "Renvoyer l'email"}
          </Button>
          <p className="auth-switch"><Link to="/connexion">Aller à la connexion</Link></p>
        </div>
      </AuthPageFrame>
    );
  }

  return (
    <AuthPageFrame eyebrow="VOTRE ESPACE VOUS ATTEND" title="Bienvenue chez djai_momo." description="Quelques informations et votre espace sera prêt.">
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {!online && <p className="auth-error" role="status">Reconnectez-vous à Internet pour créer votre compte.</p>}
        <Input
          label="Nom complet"
          type="text"
          autoComplete="name"
          inputMode="text"
          placeholder="Votre nom complet"
          icon={<UserRound size={18} />}
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <Input
          label="Numéro WhatsApp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+2250700000000"
          icon={<Phone size={18} />}
          error={errors.whatsapp?.message}
          {...register('whatsapp')}
        />
        <p className="field-hint">Format international : + suivi de 8 à 15 chiffres, par exemple +2250700000000.</p>
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
        <Input
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          placeholder="8 caractères minimum"
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label="Confirmer le mot de passe"
          type="password"
          autoComplete="new-password"
          placeholder="Saisissez à nouveau le mot de passe"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        {errors.root?.server?.message && <p className="auth-error" role="alert">{errors.root.server.message}</p>}
        <Button className="auth-submit" type="submit" loading={isSubmitting} disabled={!online || isSubmitting}>Créer mon compte</Button>
      </form>
      <p className="auth-switch">Vous avez déjà un compte ? <Link to="/connexion">Se connecter</Link></p>
    </AuthPageFrame>
  );
}
