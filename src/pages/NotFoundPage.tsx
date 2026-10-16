import { Link } from 'react-router-dom';
import { Button, Card } from '../components/ui';
import { Logo } from '../components/ui';

export function NotFoundPage() {
  return (
    <main className="route-message-page">
      <Card className="route-message-card not-found-card">
        <Logo variant="full" size={160} className="route-message-logo" />
        <span className="section-kicker">ERREUR 404</span>
        <h1>Cette page n’existe pas.</h1>
        <p>Le lien est peut-être incorrect ou la page a été déplacée.</p>
        <Link to="/"><Button>Retour à l’accueil</Button></Link>
      </Card>
    </main>
  );
}
