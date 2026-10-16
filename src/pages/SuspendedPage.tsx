import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button, Card, Logo } from '../components/ui';

export function SuspendedPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setError(null);
    setLoading(true);
    try {
      await signOut();
      navigate('/connexion', { replace: true });
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="route-message-page">
      <Card className="route-message-card">
        <Logo variant="full" className="suspended-logo" />
        <span className="section-kicker">COMPTE SUSPENDU</span>
        <h1>Votre compte est temporairement suspendu.</h1>
        <p>Veuillez contacter l’administrateur pour obtenir de l’aide et rétablir votre accès.</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <Button loading={loading} onClick={handleSignOut}>Se déconnecter</Button>
      </Card>
    </main>
  );
}
