import { Inbox } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Card, EmptyState } from '../components/ui';
import { toTitleCase } from '../lib/format';

export function WorkspacePage({ title }: { title: string }) {
  const { profile } = useAuth();

  return (
    <div className="page-content workspace-page">
      <header className="page-header workspace-header">
        <div>
          <span className="eyebrow">BONJOUR {profile ? toTitleCase(profile.full_name) : ''}</span>
          <h1>{title}</h1>
          <p>Votre espace djai_momo vous attend.</p>
        </div>
      </header>
      <Card className="workspace-card">
        <EmptyState
          icon={<Inbox size={23} aria-hidden="true" />}
          title="Bientôt disponible"
          description="Cette partie de votre espace sera disponible prochainement."
        />
        <p className="workspace-user">Connecté en tant que <strong>{profile ? toTitleCase(profile.full_name) : ''}</strong></p>
      </Card>
    </div>
  );
}
