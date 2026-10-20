import { useState } from 'react';
import { CalendarDays, CircleUserRound, ClipboardList, Ellipsis, LayoutDashboard, LogOut, Plus, Sparkles, Users, Wallet } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { toTitleCase } from '../../lib/format';
import { useToast } from '../../hooks/use-toast';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { NotificationBell } from '../notifications/NotificationBell';
import { BottomNavItem } from './BottomNavItem';
import { Avatar, Button, Logo } from '../ui';
import { ProfileModal } from '../profile/ProfileModal';
import { ToastViewport } from './ToastViewport';
import { APP_NAME } from '../../lib/brand';
import { Modal } from '../ui';

type NavigationItem = {
  label: string;
  mobileLabel: string;
  to: string;
  icon: typeof LayoutDashboard;
  mobileHidden?: boolean;
};

const adminNavigation: NavigationItem[] = [
  { label: 'Tableau de bord', mobileLabel: 'Tableau', to: '/admin', icon: LayoutDashboard },
  { label: 'Utilisateurs', mobileLabel: 'Agents', to: '/admin/utilisateurs', icon: Users },
  { label: 'Enregistrés', mobileLabel: 'Liste', to: '/admin/enregistres', icon: ClipboardList, mobileHidden: true },
  { label: 'Jours', mobileLabel: 'Jours', to: '/admin/jours', icon: CalendarDays },
  { label: 'Gains', mobileLabel: 'Gains', to: '/admin/gains', icon: Wallet, mobileHidden: true },
];

const agentNavigation: NavigationItem[] = [
  { label: 'Mes enregistrés', mobileLabel: 'Liste', to: '/espace', icon: ClipboardList },
  { label: 'Ajouter', mobileLabel: 'Ajouter', to: '/espace/ajouter', icon: Plus },
  { label: 'Mes jours', mobileLabel: 'Jours', to: '/espace/jours', icon: CalendarDays },
  { label: 'Mes gains', mobileLabel: 'Gains', to: '/espace/gains', icon: Wallet },
];

export function AppShell() {
  const { profile, role, signOut } = useAuth();
  const isReceiver = role === 'receveur';
  const { pathname } = useLocation();
  useRealtimeSync();
  const queryClient = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const { toasts, show, dismiss } = useToast();
  const navigate = useNavigate();
  const receiverUserPage = pathname.startsWith('/receveur/u/');
  const navigation = role === 'admin'
    ? adminNavigation
    : role === 'agent'
      ? agentNavigation
      : import.meta.env.DEV
      ? [{ label: 'Design system', mobileLabel: 'Design', to: '/design-system', icon: Sparkles }]
        : [];
  const roleLabel = role === 'admin' ? 'Administrateur' : role === 'agent' ? 'Agent' : 'Receveur';
  const handleSignOut = async () => {
    if (signingOut) return;
    setSignOutError(null);
    setSigningOut(true);
    try {
      await signOut();
      if (isReceiver) {
        queryClient.removeQueries({ queryKey: ['receiver-items'] });
        queryClient.removeQueries({ queryKey: ['receiver-blocks'] });
      }
      setProfileOpen(false);
      navigate('/connexion', { replace: true });
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setSigningOut(false);
    }
  };

  if (isReceiver) {
    return (
      <div className="app-shell receiver-app-shell">
        <div className="ambient-background" aria-hidden="true">
          <span className="ambient-halo halo-yellow" />
          <span className="ambient-halo halo-peach" />
          <span className="ambient-halo halo-lemon" />
        </div>
        <header className={`receiver-global-header glass${receiverUserPage ? ' receiver-global-header-static' : ''}`} aria-label="En-tête receveur">
          <div className="receiver-global-header-inner">
            <Logo variant="icon" size={24} />
            <span className="receiver-live-indicator" title="En direct" aria-label="En direct" role="status">
              <span className="receiver-live-dot" aria-hidden="true" />
              <span className="sr-only">En direct</span>
            </span>
            <button
              type="button"
              className="receiver-profile-avatar"
              aria-label={`Ouvrir le profil de ${profile?.full_name ?? 'votre compte'}`}
              aria-haspopup="dialog"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen(true)}
            >
              <span className="receiver-profile-initial">
                {profile?.full_name.trim().charAt(0).toLocaleUpperCase('fr') || '?'}
              </span>
            </button>
          </div>
        </header>
        <main className="main-content receiver-main-content">
          <Outlet />
        </main>
        {profile && (
          <ProfileModal
            open={profileOpen}
            receiver
            onClose={() => setProfileOpen(false)}
            onToast={show}
            footer={(
              <div className="receiver-profile-footer">
                {signOutError && <p className="auth-error" role="alert">{signOutError}</p>}
                <Button
                  variant="secondary"
                  className="profile-signout receiver-profile-signout"
                  loading={signingOut}
                  onClick={() => void handleSignOut()}
                >
                  <LogOut size={18} aria-hidden="true" /> Se déconnecter
                </Button>
              </div>
            )}
          />
        )}
        <ToastViewport toasts={toasts} dismiss={dismiss} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="ambient-background" aria-hidden="true">
        <span className="ambient-halo halo-yellow" />
        <span className="ambient-halo halo-peach" />
        <span className="ambient-halo halo-lemon" />
      </div>
      <aside className="sidebar glass" aria-label="Navigation principale">
        <Link className="brand" to={role === 'admin' ? '/admin' : role === 'agent' ? '/espace' : '/design-system'} aria-label={`${APP_NAME} — accueil`}>
          <Logo variant="full" size={132} />
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
        {navigation.filter(({ mobileHidden }) => !mobileHidden).map(({ label, mobileLabel, to, icon: Icon }) => (
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
        {role === 'admin' && <BottomNavItem
          icon={<Ellipsis size={24} aria-hidden="true" />}
          label="Plus"
          accessibleLabel="Pages supplémentaires"
          title="Pages supplémentaires"
          active={moreOpen}
          onClick={() => setMoreOpen(true)}
          ariaHasPopup="dialog"
          ariaExpanded={moreOpen}
        />}
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
      {role === 'admin' && <Modal open={moreOpen} title="Pages supplémentaires" onClose={() => setMoreOpen(false)} className="mobile-more-modal">
        <nav className="mobile-more-links" aria-label="Pages administrateur">
          <Link className="mobile-more-link" to="/admin/enregistres" onClick={() => setMoreOpen(false)}><ClipboardList size={20} aria-hidden="true" /> Enregistrés</Link>
          <Link className="mobile-more-link" to="/admin/gains" onClick={() => setMoreOpen(false)}><Wallet size={20} aria-hidden="true" /> Gains</Link>
        </nav>
      </Modal>}
      {profile && (
        <ProfileModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          onToast={show}
          footer={(
            <>
              {signOutError && <p className="auth-error" role="alert">{signOutError}</p>}
              <Button className="profile-signout" loading={signingOut} onClick={() => void handleSignOut()}>
                <LogOut size={18} aria-hidden="true" /> Se déconnecter
              </Button>
            </>
          )}
        />
      )}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
