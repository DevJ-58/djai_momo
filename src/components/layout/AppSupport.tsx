import { Component, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../ui';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function LoadingFallback() {
  return (
    <main className="route-loading" role="status" aria-live="polite">
      <span className="brand-mark loading-brand-mark">dm</span>
      <span className="loading-skeleton" aria-hidden="true" />
      <span>Chargement de votre espace…</span>
    </main>
  );
}

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return <div className="offline-banner glass" role="status">Vous êtes hors ligne. Les actions d’écriture sont désactivées.</div>;
}

export function PwaUpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;

  return (
    <div className="glass pwa-update-toast" role="status">
      <span>Une nouvelle version est disponible</span>
      <Button onClick={() => void updateServiceWorker(true)}>
        <RefreshCw size={17} aria-hidden="true" /> Mettre à jour
      </Button>
    </div>
  );
}

type ErrorBoundaryState = { hasError: boolean };

export class GlobalErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="route-message-page">
          <section className="glass error-boundary-card">
            <span className="brand-mark">dm</span>
            <h1>Quelque chose s'est mal passé</h1>
            <p>Vous pouvez recharger l’application ou revenir à l’accueil.</p>
            <div className="error-boundary-actions">
              <Button onClick={() => window.location.reload()}>Recharger</Button>
              <a className="button button-secondary" href="/">Retour à l’accueil</a>
            </div>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
