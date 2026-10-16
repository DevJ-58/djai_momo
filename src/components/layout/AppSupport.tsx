import { Component, useEffect, useState, type ReactNode } from 'react';
import { Download, RefreshCw, Share2, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button, Logo } from '../ui';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isAppleMobileDevice() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function LoadingFallback() {
  return (
    <main className="route-loading" role="status" aria-live="polite">
      <Logo variant="full" size={160} className="loading-logo" />
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

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isAppInstalled);
  const [dismissed, setDismissed] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [isAppleMobile] = useState(isAppleMobileDevice);
  const canUsePwa = window.isSecureContext && 'serviceWorker' in navigator;

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallError(null);
      setDismissed(false);
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (outcome === 'accepted') setInstalled(true);
    } catch {
      setInstallPrompt(null);
      setInstallError('L’installation n’a pas pu démarrer. Ouvrez le menu du navigateur pour installer l’application.');
    }
  };

  if (!canUsePwa || installed || dismissed) return null;

  return (
    <div className="glass pwa-install-toast" role={installError ? 'alert' : 'status'}>
      {installError ? (
        <span>{installError}</span>
      ) : !installPrompt && isAppleMobile ? (
        <>
          <Share2 size={19} aria-hidden="true" />
          <span>Pour installer l’application, touchez Partager, puis « Sur l’écran d’accueil ».</span>
        </>
      ) : !installPrompt ? (
        <span>Pour installer l’application, ouvrez le menu du navigateur et choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».</span>
      ) : (
        <>
          <span>Installez l’application sur votre appareil pour y accéder plus facilement.</span>
          <Button onClick={() => void installApp()}>
            <Download size={17} aria-hidden="true" /> Installer
          </Button>
        </>
      )}
      <button
        className="toast-close"
        type="button"
        aria-label="Fermer la notification d’installation"
        onClick={() => setDismissed(true)}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
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
            <Logo variant="full" size={160} className="route-message-logo" />
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
