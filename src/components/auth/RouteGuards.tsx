import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from '../../hooks/useAuth';
import { Button, Card } from '../ui';
import { LoadingFallback } from '../layout/AppSupport';

export function RequireAuth() {
  const { session, loading, profile, profileError } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingFallback />;
  if (!session) return <Navigate to="/connexion" replace state={{ from: location }} />;
  if (!profile) {
    return (
      <main className="route-message-page">
        <Card className="route-message-card">
          <h1>Profil indisponible</h1>
          <p role="alert">{profileError ?? 'Votre profil ne peut pas être chargé pour le moment.'}</p>
          <Button onClick={() => window.location.reload()}>Réessayer</Button>
        </Card>
      </main>
    );
  }
  if (profile.role === 'agent' && profile.is_suspended) {
    return <Navigate to="/suspendu" replace />;
  }
  return <Outlet />;
}

export function RequireRole({ role }: { role: UserRole }) {
  const { role: userRole } = useAuth();

  if (userRole !== role) {
    return <Navigate to={userRole === 'admin' ? '/admin' : '/espace'} replace />;
  }
  return <Outlet />;
}

export function GuestOnly() {
  const { session, loading, role, profileError } = useAuth();

  if (loading) return <LoadingFallback />;
  if (!session) return <Outlet />;
  if (!role) {
    return (
      <main className="route-message-page">
        <Card className="route-message-card">
          <h1>Profil indisponible</h1>
          <p role="alert">{profileError ?? 'Votre profil ne peut pas être chargé pour le moment.'}</p>
        </Card>
      </main>
    );
  }
  return <Navigate to={role === 'admin' ? '/admin' : '/espace'} replace />;
}
