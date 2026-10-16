import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bell,
  Check,
  CircleDollarSign,
  CreditCard,
  Inbox,
  LockKeyhole,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { formatAmount } from '../lib/format';
import { ToastViewport } from '../components/layout/ToastViewport';
import { Avatar, Badge, Button, Card, EmptyState, Input, Modal, Skeleton, StatCard } from '../components/ui';
import type { StatusKind } from '../types/ui';

const statuses: StatusKind[] = ['en_attente', 'paye', 'refuse', 'probleme'];

export function DesignSystemPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const { toasts, show, dismiss } = useToast();

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <span className="eyebrow"><SparkleMark /> DESIGN SYSTEM</span>
          <h1>Un espace clair,<br className="mobile-break" /> pensé pour vous.</h1>
          <p>Les fondations visuelles de djai_momo, réunies au même endroit.</p>
        </div>
        <Button className="header-action" onClick={() => show('Votre espace est prêt à être personnalisé.', 'success')}>
          <Plus size={19} aria-hidden="true" /><span>Faire un essai</span>
        </Button>
      </header>

      <section className="showcase-section" aria-labelledby="stats-title">
        <div className="section-heading">
          <div><span className="section-kicker">APERÇU</span><h2 id="stats-title">Des repères, tout simplement</h2></div>
          <span className="period-pill"><Activity size={15} aria-hidden="true" /> Cette semaine</span>
        </div>
        <div className="stats-grid">
          <StatCard label="Utilisateurs" value="1284" change="+12,8 %" icon={<Users size={20} />} />
          <StatCard label="Paiements reçus" value={formatAmount(842000)} change="+8,2 %" icon={<CircleDollarSign size={20} />} />
          <StatCard label="En attente" value="24" change="-2,4 %" trend="down" icon={<CreditCard size={20} />} />
        </div>
      </section>

      <section className="showcase-section" aria-labelledby="controls-title">
        <div className="section-heading">
          <div><span className="section-kicker">INTERACTIONS</span><h2 id="controls-title">Tout est à portée de main</h2></div>
        </div>
        <Card className="component-card">
          <div className="component-block">
            <h3>Boutons</h3>
            <div className="button-showcase">
              <Button><Check size={18} aria-hidden="true" /> Primaire</Button>
              <Button variant="secondary">Secondaire</Button>
              <Button variant="ghost">Discret</Button>
              <Button variant="danger">Supprimer</Button>
              <Button loading>Chargement</Button>
              <Button disabled>Indisponible</Button>
            </div>
          </div>
          <div className="component-block">
            <h3>Champ de saisie</h3>
            <div className="input-showcase">
              <Input label="Rechercher" placeholder="Nom ou adresse e-mail" icon={<Search size={18} />} />
              <Input label="Adresse e-mail" placeholder="nom@exemple.fr" type="email" error="Veuillez vérifier cette adresse e-mail." />
              <Input label="Champ désactivé" placeholder="Indisponible pour le moment" disabled />
            </div>
          </div>
          <div className="component-block">
            <h3>États de paiement</h3>
            <div className="badge-showcase">{statuses.map((status) => <Badge key={status} status={status} />)}</div>
          </div>
          <div className="component-block">
            <h3>Profils</h3>
            <div className="avatar-showcase">
              <Avatar name="Marie Dupont" size="small" />
              <Avatar name="Alex Martin" />
              <Avatar name="Sophie Bernard" size="large" />
              <span className="avatar-caption">Marie, Alex, Sophie</span>
            </div>
          </div>
        </Card>
      </section>

      <section className="showcase-section" aria-labelledby="feedback-title">
        <div className="section-heading">
          <div><span className="section-kicker">FEEDBACK</span><h2 id="feedback-title">Les bons retours au bon moment</h2></div>
        </div>
        <div className="feedback-grid">
          <Card className="feedback-card">
            <div className="mini-heading"><h3>Chargement</h3><span className="soft-icon"><Bell size={17} /></span></div>
            <div className="skeleton-demo">
              <Skeleton className="skeleton-avatar" />
              <div className="skeleton-lines"><Skeleton /><Skeleton className="skeleton-short" /></div>
            </div>
          </Card>
          <Card className="feedback-card">
            <div className="mini-heading"><h3>État vide</h3><span className="soft-icon"><Inbox size={17} /></span></div>
            <EmptyState
              icon={<Inbox size={23} />}
              title="Tout est à jour"
              description="Les nouvelles informations apparaîtront ici."
            />
          </Card>
          <Card className="feedback-card toast-demo-card">
            <div className="mini-heading"><h3>Notifications</h3><span className="soft-icon"><Check size={17} /></span></div>
            <p className="helper-copy">Un message bref confirme chaque action.</p>
            <div className="toast-actions">
              <Button variant="secondary" onClick={() => show('Modification enregistrée avec succès.', 'success')}>
                Succès <Check size={17} aria-hidden="true" />
              </Button>
              <Button variant="ghost" onClick={() => show('Une erreur est survenue.', 'error')}>
                Erreur <ArrowRight size={17} aria-hidden="true" />
              </Button>
              <Button variant="ghost" onClick={() => show('Voici une information utile.', 'info')}>
                Information <Bell size={17} aria-hidden="true" />
              </Button>
            </div>
          </Card>
        </div>
      </section>

      <section className="showcase-section" aria-labelledby="surface-title">
        <div className="section-heading">
          <div><span className="section-kicker">SURFACES</span><h2 id="surface-title">Le calme du verre</h2></div>
        </div>
        <Card className="surface-card">
          <div className="surface-copy">
            <span className="surface-symbol"><LockKeyhole size={20} /></span>
            <div><h3>Tout reste lisible, en toute légèreté.</h3><p>Des surfaces translucides, un contraste soigné et juste ce qu’il faut de profondeur.</p></div>
          </div>
          <Button variant="secondary" onClick={() => setModalOpen(true)}>Voir la fenêtre <ArrowRight size={17} aria-hidden="true" /></Button>
        </Card>
      </section>

      <footer className="page-footer"><span>djai_momo</span><span>Une base solide pour la suite.</span></footer>
      <Modal open={modalOpen} title="Une fenêtre tout en douceur" onClose={() => setModalOpen(false)}>
        <p className="modal-description">Sur petit écran, cette fenêtre devient un panneau qui glisse depuis le bas. Sur grand écran, elle reste centrée.</p>
        <Button className="modal-action" onClick={() => setModalOpen(false)}>C’est compris</Button>
      </Modal>
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

function SparkleMark() {
  return <span className="sparkle-mark" aria-hidden="true"><span /></span>;
}
