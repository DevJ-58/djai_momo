import React, { lazy, Suspense, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import '@fontsource-variable/plus-jakarta-sans';
import './styles.css';
import { GuestOnly, RequireAuth, RequireRole } from './components/auth/RouteGuards';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LoadingFallback, GlobalErrorBoundary, OfflineBanner, PwaInstallPrompt, PwaUpdatePrompt } from './components/layout/AppSupport';
import { Card } from './components/ui';
import { APP_NAME } from './lib/brand';

const AppShell = lazy(() => import('./components/layout/AppShell').then((module) => ({ default: module.AppShell })));
const AddRegistrationPage = lazy(() => import('./pages/AddRegistrationPage').then((module) => ({ default: module.AddRegistrationPage })));
const AgentRegistrationsPage = lazy(() => import('./pages/AgentRegistrationsPage').then((module) => ({ default: module.AgentRegistrationsPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const SignupPage = lazy(() => import('./pages/SignupPage').then((module) => ({ default: module.SignupPage })));
const ForgotPasswordPage = lazy(() => import('./pages/PasswordRecoveryPages').then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/PasswordRecoveryPages').then((module) => ({ default: module.ResetPasswordPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
const OfflinePage = lazy(() => import('./pages/OfflinePage').then((module) => ({ default: module.OfflinePage })));
const SuspendedPage = lazy(() => import('./pages/SuspendedPage').then((module) => ({ default: module.SuspendedPage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminDashboardPage })));
const AdminAgentDetailPage = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminAgentDetailPage })));
const AdminRegistrationsPlaceholderPage = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminRegistrationsPlaceholderPage })));
const DayReportsPage = lazy(() => import('./pages/DayReportsPage').then((module) => ({ default: module.DayReportsPage })));
const AdminGainsPage = lazy(() => import('./pages/GainsPages').then((module) => ({ default: module.AdminGainsPage })));
const AgentGainsPage = lazy(() => import('./pages/GainsPages').then((module) => ({ default: module.AgentGainsPage })));
const AdminUsersPage = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminUsersPage })));
const ReceiverDashboardPage = lazy(() => import('./pages/ReceiverPages').then((module) => ({ default: module.ReceiverDashboardPage })));
const ReceiverUserPage = lazy(() => import('./pages/ReceiverPages').then((module) => ({ default: module.ReceiverUserPage })));
const DesignSystemPage = import.meta.env.DEV
  ? lazy(() => import('./pages/DesignSystemPage').then((module) => ({ default: module.DesignSystemPage })))
  : null;

const queryClient = new QueryClient();
const root = (import.meta.hot?.data.root as Root | undefined)
  ?? ReactDOM.createRoot(document.getElementById('root')!);

function DocumentTitle() {
  const { pathname } = useLocation();
  const pageName = pathname === '/connexion' ? 'Connexion'
    : pathname === '/inscription' ? 'Inscription'
      : pathname === '/mot-de-passe-oublie' ? 'Mot de passe oublié'
        : pathname === '/reinitialiser-mot-de-passe' ? 'Réinitialiser le mot de passe'
          : pathname === '/suspendu' ? 'Compte suspendu'
            : pathname === '/hors-ligne' ? 'Hors ligne'
              : pathname === '/espace' ? 'Mes enregistrés'
                : pathname === '/espace/ajouter' ? 'Ajouter un enregistré'
                  : pathname === '/espace/jours' || pathname.startsWith('/espace/jours/') ? 'Mes jours'
                  : pathname === '/espace/gains' ? 'Mes gains'
                  : pathname === '/receveur' ? 'Receveur'
                    : pathname.startsWith('/receveur/u/') ? 'Agent receveur'
                      : pathname === '/admin' ? 'Tableau de bord'
                        : pathname === '/admin/utilisateurs' ? 'Utilisateurs'
                          : pathname.startsWith('/admin/utilisateurs/') ? 'Détail utilisateur'
                            : pathname === '/admin/enregistres' ? 'Enregistrés'
                              : pathname === '/admin/jours' || pathname.startsWith('/admin/jours/') ? 'Jours'
                              : pathname === '/admin/gains' ? 'Gains'
                              : pathname === '/design-system' ? 'Design system'
                                : pathname === '/' ? 'Accueil'
                                  : 'Page introuvable';

  useEffect(() => {
    document.title = `${pageName} · ${APP_NAME}`;
  }, [pageName]);

  return null;
}

function HomeRedirect() {
  const { session, loading, role, profileError } = useAuth();

  if (loading) return <LoadingFallback />;
  if (!session) return <Navigate to="/connexion" replace />;
  if (role) return <Navigate to={role === 'admin' ? '/admin' : role === 'agent' ? '/espace' : role === 'receveur' ? '/receveur' : '/connexion'} replace />;
  return (
    <main className="route-message-page">
      <Card className="route-message-card">
        <h1>Profil indisponible</h1>
        <p role="alert">{profileError ?? 'Votre profil ne peut pas être chargé pour le moment.'}</p>
      </Card>
    </main>
  );
}

root.render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <DocumentTitle />
          <AuthProvider>
            <OfflineBanner />
            <PwaInstallPrompt />
            <PwaUpdatePrompt />
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<HomeRedirect />} />
                <Route element={<GuestOnly />}>
                  <Route path="/connexion" element={<LoginPage />} />
                  <Route path="/inscription" element={<SignupPage />} />
                </Route>
                <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} />
                <Route path="/reinitialiser-mot-de-passe" element={<ResetPasswordPage />} />
                <Route path="/suspendu" element={<SuspendedPage />} />
                <Route element={<RequireAuth />}>
                  <Route element={<AppShell />}>
                    <Route element={<RequireRole role="agent" />}>
                      <Route path="/espace" element={<AgentRegistrationsPage />} />
                      <Route path="/espace/ajouter" element={<AddRegistrationPage />} />
                      <Route path="/espace/jours" element={<DayReportsPage />} />
                      <Route path="/espace/jours/:date" element={<DayReportsPage />} />
                      <Route path="/espace/gains" element={<AgentGainsPage />} />
                    </Route>
                    <Route element={<RequireRole role="receveur" />}>
                      <Route path="/receveur" element={<ReceiverDashboardPage />} />
                      <Route path="/receveur/u/:agentId" element={<ReceiverUserPage />} />
                    </Route>
                    <Route element={<RequireRole role="admin" />}>
                      <Route path="/admin" element={<AdminDashboardPage />} />
                      <Route path="/admin/utilisateurs" element={<AdminUsersPage />} />
                      <Route path="/admin/utilisateurs/:id" element={<AdminAgentDetailPage />} />
                      <Route path="/admin/enregistres" element={<AdminRegistrationsPlaceholderPage />} />
                      <Route path="/admin/jours" element={<DayReportsPage />} />
                      <Route path="/admin/jours/:date" element={<DayReportsPage />} />
                      <Route path="/admin/gains" element={<AdminGainsPage />} />
                    </Route>
                  </Route>
                </Route>
                {DesignSystemPage && <Route element={<AppShell />}><Route path="/design-system" element={<DesignSystemPage />} /></Route>}
                <Route path="/hors-ligne" element={<OfflinePage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>,
);

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.root = root;
  });
}
