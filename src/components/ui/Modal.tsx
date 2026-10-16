import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  backdropClassName?: string;
  descriptionId?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  role?: 'dialog' | 'alertdialog';
  canClose?: boolean;
  icon?: ReactNode;
};

export function Modal({
  open,
  title,
  onClose,
  children,
  className = '',
  backdropClassName = '',
  descriptionId,
  initialFocusRef,
  role = 'dialog',
  canClose = true,
  icon,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    (initialFocusRef?.current ?? panelRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (canClose) onCloseRef.current();
        else event.preventDefault();
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || activeElement === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || activeElement === panelRef.current)) {
        event.preventDefault();
        first.focus();
      } else if (!panelRef.current.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [canClose, initialFocusRef, open]);

  if (!open) return null;

  return (
    <div className={`modal-backdrop ${backdropClassName}`} onMouseDown={(event) => {
      if (canClose && event.target === event.currentTarget) onClose();
    }}>
      <section
        ref={panelRef}
        tabIndex={-1}
        className={`glass modal-panel ${className}`}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="modal-heading">
          <div className="modal-title-group">
            {icon}
            <h2 id={titleId}>{title}</h2>
          </div>
          <Button variant="ghost" className="icon-button" aria-label="Fermer" onClick={onClose} disabled={!canClose}>
            <X size={20} aria-hidden="true" />
          </Button>
        </div>
        <div className="modal-content">{children}</div>
      </section>
    </div>
  );
}
