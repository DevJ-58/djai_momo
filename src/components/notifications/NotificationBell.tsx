import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  Bell,
  CheckCheck,
  CircleAlert,
  CircleDollarSign,
  MessageSquareText,
  UserRoundPlus,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatRelative } from '../../lib/format';
import type { RegistrationStatus } from '../../types/database';
import { Badge } from '../ui';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationsCount,
} from '../../hooks/useNotifications';
import { Button, Skeleton } from '../ui';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useAuth } from '../../hooks/useAuth';
import { BottomNavItem } from '../layout/BottomNavItem';
import { formatUnreadNotificationCount } from './notification-count';
import type { Notification } from '../../types/database';

const notificationIcons: Record<string, LucideIcon> = {
  receiver_result: CircleDollarSign,
  status_changed: CircleAlert,
  correction_request: MessageSquareText,
  new_registration: UserRoundPlus,
};

function statusFromNotification(notification: Notification): RegistrationStatus | null {
  if (notification.registration?.status) return notification.registration.status;
  const content = `${notification.title} ${notification.body}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
  if (/\bgagne\b/.test(content)) return 'gagne';
  if (/\bechec\b/.test(content)) return 'echec';
  if (/\brenonce\b/.test(content)) return 'renonce';
  if (/\bpaye\b/.test(content)) return 'paye';
  if (/\brefuse\b/.test(content)) return 'refuse';
  if (/\bprobleme\b/.test(content)) return 'probleme';
  if (/\ben attente\b/.test(content)) return 'en_attente';
  return null;
}

type AgentNotificationsProps = {
  placement: 'sidebar' | 'mobile';
};

export function NotificationBell({ placement }: AgentNotificationsProps) {
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [badgeAnimationVersion, setBadgeAnimationVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const { role } = useAuth();
  const notifications = useNotifications();
  const unreadCount = useUnreadNotificationsCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const online = useOnlineStatus();
  const count = unreadCount.data ?? 0;
  const previousCount = useRef(count);

  useEffect(() => {
    if (count > previousCount.current) {
      setBadgeAnimationVersion((version) => version + 1);
    }
    previousCount.current = count;
  }, [count]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [open]);

  const openNotifications = () => {
    setActionError(null);
    setOpen((current) => !current);
  };

  const handleNotificationKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) {
      event.preventDefault();
      panelRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (document.activeElement === panelRef.current) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleNotificationClick = async (notificationId: string, registrationId: string | null, readAt: string | null) => {
    setActionError(null);
    try {
      if (!readAt) await markRead.markRead(notificationId);
      setOpen(false);
      if (registrationId) {
        const destination = role === 'admin' ? '/admin/enregistres' : '/espace';
        navigate(`${destination}?r=${encodeURIComponent(registrationId)}`, { replace: true });
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.');
    }
  };

  const handleMarkAllRead = async () => {
    setActionError(null);
    try {
      await markAllRead.markAllRead();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.');
    }
  };

  const ariaLabel = count === 0
    ? 'Notifications'
    : `Notifications, ${count} non lue${count === 1 ? '' : 's'}`;
  const badgeLabel = formatUnreadNotificationCount(count);
  const icon = (
    <span className="agent-notifications-icon">
      <Bell size={24} aria-hidden="true" />
      {badgeLabel && (
        <span
          key={badgeAnimationVersion}
          className="agent-notifications-badge"
          aria-hidden="true"
        >
          {badgeLabel}
        </span>
      )}
    </span>
  );

  return (
    <div className={`agent-notifications agent-notifications-${placement}`} ref={rootRef}>
      {placement === 'mobile' ? (
        <BottomNavItem
          icon={icon}
          label="Alertes"
          accessibleLabel={ariaLabel}
          title="Notifications"
          active={open}
          onClick={openNotifications}
          ariaHasPopup="dialog"
          ariaExpanded={open}
        />
      ) : (
        <button
          type="button"
          className={`agent-notifications-trigger nav-link ${open ? 'nav-link-active' : ''}`}
          onClick={openNotifications}
          aria-label={ariaLabel}
          title="Notifications"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          {icon}
          <span>Notifications</span>
        </button>
      )}
      {open && (
        <section
          className={`agent-notifications-panel agent-notifications-panel-${placement}`}
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal={placement === 'mobile' ? true : undefined}
          aria-labelledby="agent-notifications-title"
          onKeyDown={handleNotificationKeyDown}
        >
          <header className="agent-notifications-heading">
            <h2 id="agent-notifications-title">Notifications</h2>
            <Button
              variant="ghost"
              className="agent-notifications-mark-all"
              onClick={() => void handleMarkAllRead()}
              disabled={!online || count === 0 || markAllRead.isPending}
              loading={markAllRead.isPending}
            >
              <CheckCheck size={16} aria-hidden="true" /> Tout marquer comme lu
            </Button>
          </header>
          {actionError && <p className="agent-notifications-error" role="alert">{actionError}</p>}
          {unreadCount.isError && (
            <p className="agent-notifications-error" role="alert">
              Impossible de charger le nombre de notifications non lues.
            </p>
          )}
          {notifications.isPending ? (
            <div className="agent-notifications-list" aria-label="Chargement des notifications">
              {Array.from({ length: 3 }, (_, index) => <Skeleton className="agent-notification-skeleton" key={index} />)}
            </div>
          ) : notifications.isError ? (
            <div className="agent-notifications-error" role="alert">
              <span>Impossible de charger les notifications.</span>
              <Button variant="ghost" onClick={() => void notifications.refetch()}>Réessayer</Button>
            </div>
          ) : notifications.data.length === 0 ? (
            <p className="agent-notifications-empty">Aucune notification pour l’instant</p>
          ) : (
            <ul className="agent-notifications-list">
              {notifications.data.map((notification) => (
                <li key={notification.id}>
                  {(() => {
                    const Icon = notificationIcons[notification.type] ?? Bell;
                    const status = statusFromNotification(notification);
                    const accessibleLabel = `${notification.title}. ${notification.body}. ${formatRelative(notification.created_at)}${notification.read_at ? '' : '. Non lue'}`;
                    return (
                  <button
                    type="button"
                    className={`agent-notification-item ${notification.read_at ? '' : 'agent-notification-unread'}`}
                    aria-label={accessibleLabel}
                    disabled={markRead.isPending || (!online && !notification.read_at)}
                    onClick={() => void handleNotificationClick(
                      notification.id,
                      notification.registration_id,
                      notification.read_at,
                    )}
                  >
                    {!notification.read_at && <span className="agent-notification-dot" aria-label="Non lue" />}
                    <Icon className="agent-notification-type-icon" size={18} aria-hidden="true" />
                    <span className="agent-notification-copy">
                      <strong>{notification.title}</strong>
                      <span>{notification.body}</span>
                      {status && <Badge status={status} amount={notification.registration?.amount} />}
                      <time dateTime={notification.created_at}>{formatRelative(notification.created_at)}</time>
                    </span>
                  </button>
                    );
                  })()}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
