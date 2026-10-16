import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { ToastMessage } from '../../hooks/use-toast';

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const Icon = icons[toast.tone];

  return (
    <div className={`glass toast toast-${toast.tone}`} role="status">
      <Icon size={20} aria-hidden="true" />
      <span>{toast.message}</span>
      <button className="toast-close" onClick={onDismiss} aria-label="Fermer la notification">
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
