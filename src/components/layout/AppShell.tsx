import { useState } from 'react';
import { CircleUserRound, ClipboardList, LayoutDashboard, LogOut, Plus, Sparkles, Users } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import { toTitleCase } from '../../lib/format';
import { passwordWithConfirmationSchema, translatedAuthMessage } from '../../lib/auth-validation';
import { useToast } from '../../hooks/use-toast';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { NotificationBell } from '../notifications/NotificationBell';
import { BottomNavItem } from './BottomNavItem';
import { Avatar, Button, Logo, Modal } from '../ui';
import { ToastViewport } from './ToastViewport';
import { APP_NAME } from '../../lib/brand';

type NavigationItem = {
  label: string;
  mobileLabel: string;
  to: string;
  icon: typeof LayoutDashboard;
};

const adminNavigation: NavigationItem[] = [
  { label: 'Tableau de bord', mobileLabel: 'Tableau', to: '/admin', icon: LayoutDashboard },
  { label: 'Utilisateurs', mobileLabel: 'Utilisateurs', to: '/admin/utilisateurs', icon: Users },
  { label: 'Enregistrés', mobileLabel: 'Enregistrés', to: '/admin/enregistres', icon: ClipboardList },
];

const agentNavigation: NavigationItem[] = [
  { label: 'Mes enregistrés', mobileLabel: 'Enregistrés', to: '/espace', icon: ClipboardList },
  { label: 'Ajouter', mobileLabel: 'Ajouter', to: '/espace/ajouter', icon: Plus },
];

type PasswordValues = z.infer<typeof passwordWithConfirmationSchema>;

export function AppShell() {
  const { profile, role, signOut, updatePassword } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const { toasts, show, dismiss } = useToast();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const navigation = role === 'admin'
    ? adminNavigation
    : role === 'agent'
      ? agentNavigation
      : import.meta.env.DEV
      ? [{ label: 'Design system', mobileLabel: 'Design', to: '/design-system', icon: Sparkles }]
        : [];
  const roleLabel = role === 'admin' ? 'Administrateur' : 'Agent';
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordWithConfirmationSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const handleSignOut = async () => {
    if (signingOut) return;
    setSignOutError(null);
    setSigningOut(true);
    try {
      await signOut();
      setProfileOpen(false);
      navigate('/connexion', { replace: true });
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setSigningOut(false);
    }
  };

  const changePassword = passwordForm.handleSubmit(async ({ password }) => {
    setPasswordError(null);
    try {
      await updatePassword(password);
      passwordForm.reset();
      show('Votre mot de passe a été modifié.', 'success');
    } catch (error) {
      setPasswordError(translatedAuthMessage(error));
    }
  });

  return (
    <div className="app-shell">
      <div className="ambient-background" aria-hidden="true">
        <span className="ambient-halo halo-yellow" />
        <span className="ambient-halo halo-peach" />
        <span className="ambient-halo halo-lemon" />
      </div>
      <aside className="sidebar glass" aria-label="Navigation principale">
        <Link className="brand" to={role === 'admin' ? '/admin' : role === 'agent' ? '/espace' : '/design-system'} aria-label={`${APP_NAME} — accueil`}>
          <Logo variant="full" size={168} />
        </Link>
        <p className="nav-caption">ESPACE</p>
        <nav className="nav-list">
          {navigation.map(({ label, to, icon: Icon }) => (
            <NavLink
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
              to={to}
              key={to}
              end={to === '/admin'}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
          {(role === 'agent' || role === 'admin') && <NotificationBell placement="sidebar" />}
        </nav>
        <div className="sidebar-profile">
          {profile ? (
            <>
              <Avatar name={profile.full_name} size="small" />
              <div className="sidebar-profile-copy">
                <strong title={toTitleCase(profile.full_name)}>{toTitleCase(profile.full_name)}</strong>
                <span>{roleLabel}</span>
                <button className="sidebar-profile-link" type="button" onClick={() => setProfileOpen(true)}>Gérer mon profil</button>
              </div>
              <Button variant="ghost" className="sidebar-signout" loading={signingOut} onClick={() => void handleSignOut()}>
                <LogOut size={17} aria-hidden="true" /><span>Se déconnecter</span>
              </Button>
              {signOutError && <p className="auth-error sidebar-error" role="alert">{signOutError}</p>}
            </>
          ) : (
            <Link className="sidebar-login" to="/connexion">Se connecter</Link>
          )}
        </div>
      </aside>
      <main className="main-content">
        <header className="mobile-brand-header">
          <Link to={role === 'admin' ? '/admin' : role === 'agent' ? '/espace' : '/design-system'} aria-label={`${APP_NAME} — accueil`}>
            <Logo variant="icon" size={40} />
          </Link>
        </header>
        <Outlet />
      </main>
      <nav className="mobile-nav glass" aria-label="Navigation principale">
        {navigation.map(({ label, mobileLabel, to, icon: Icon }) => (
          <BottomNavItem
            key={to}
            icon={<Icon size={24} aria-hidden="true" />}
            label={mobileLabel}
            accessibleLabel={label}
            title={label}
            to={to}
            end={to === '/admin'}
          />
        ))}
        {(role === 'agent' || role === 'admin') && <NotificationBell placement="mobile" />}
        {profile && (
          <BottomNavItem
            icon={<CircleUserRound size={24} aria-hidden="true" />}
            label="Profil"
            accessibleLabel="Profil"
            title="Profil"
            active={profileOpen}
            onClick={() => setProfileOpen(true)}
            ariaHasPopup="dialog"
            ariaExpanded={profileOpen}
          />
        )}
      </nav>
      {profile && (
        <Modal open={profileOpen} title="Votre profil" onClose={() => setProfileOpen(false)}>
          <div className="profile-sheet">
            <div className="profile-sheet-heading">
              <Avatar name={profile.full_name} size="large" />
              <div><strong>{profile.full_name}</strong><span>{roleLabel}</span></div>
            </div>
            <div className="profile-detail"><span>WhatsApp</span><strong>{profile.whatsapp}</strong></div>
            <form className="profile-password-form" onSubmit={changePassword} noValidate>
              <h3>Changer mon mot de passe</h3>
              <label className="field">
                <span className="field-label">Nouveau mot de passe</span>
                <input className="input" type="password" autoComplete="new-password" {...passwordForm.register('password')} />
                {passwordForm.formState.errors.password?.message && <span className="field-error">{passwordForm.formState.errors.password.message}</span>}
              </label>
              <label className="field">
                <span className="field-label">Confirmer le mot de passe</span>
                <input className="input" type="password" autoComplete="new-password" {...passwordForm.register('confirmPassword')} />
                {passwordForm.formState.errors.confirmPassword?.message && <span className="field-error">{passwordForm.formState.errors.confirmPassword.message}</span>}
              </label>
              {passwordError && <p className="auth-error" role="alert">{passwordError}</p>}
              {!online && <p className="auth-error" role="status">Reconnectez-vous à Internet pour modifier votre mot de passe.</p>}
              <Button type="submit" loading={passwordForm.formState.isSubmitting} disabled={!online || passwordForm.formState.isSubmitting}>
                Changer mon mot de passe
              </Button>
            </form>
            {signOutError && <p className="auth-error" role="alert">{signOutError}</p>}
            <Button className="profile-signout" loading={signingOut} onClick={() => void handleSignOut()}>
              <LogOut size={18} aria-hidden="true" /> Se déconnecter
            </Button>
          </div>
        </Modal>
      )}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
