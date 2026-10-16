import { Toast } from '../ui/Toast';
import type { ToastMessage } from '../../hooks/use-toast';

export function ToastViewport({
  toasts,
  dismiss,
}: {
  toasts: ToastMessage[];
  dismiss: (id: number) => void;
}) {
  return (
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />)}
    </div>
  );
}
