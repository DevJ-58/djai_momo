import { WifiOff } from 'lucide-react';
import { Button, Card } from '../components/ui';

export function OfflinePage() {
  return (
    <main className="offline-page">
      <Card className="offline-card">
        <span className="offline-icon"><WifiOff size={28} aria-hidden="true" /></span>
        <span className="section-kicker">MODE HORS LIGNE</span>
        <h1>Vous êtes temporairement hors ligne.</h1>
        <p>Vérifiez votre connexion internet. La page se mettra à jour dès votre retour.</p>
        <Button onClick={() => window.location.reload()}>Réessayer</Button>
      </Card>
    </main>
  );
}
