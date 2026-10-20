import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '../ui';
import { GainsQueryError } from '../../hooks/useGains';

export function GainsErrorMessage({
  error,
  isAdmin,
  onRetry,
}: {
  error: unknown;
  isAdmin: boolean;
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const technical = error instanceof GainsQueryError ? error.technical : null;
  if (!(error instanceof Error)) return <p className="gains-error" role="alert">Impossible de charger les gains. Réessayez.</p>;
  const text = technical ? [
    `Code : ${technical.code ?? '—'}`,
    `Message : ${technical.message}`,
    `p_from : ${technical.parameters.p_from ?? 'null'}`,
    `p_to : ${technical.parameters.p_to ?? 'null'}`,
    `p_agent_ids : ${technical.parameters.p_agent_ids === null ? 'null' : JSON.stringify(technical.parameters.p_agent_ids)}`,
  ].join('\n') : '';
  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyFailed(true);
    }
  };
  return <>
    <div className="gains-error" role="alert"><p>{error.message}</p>{onRetry && <Button variant="secondary" onClick={onRetry}>Réessayer</Button>}</div>
    {isAdmin && technical && <details className="report-diagnostics">
      <summary>Détails techniques</summary>
      <pre>{text}</pre>
      <Button variant="secondary" className="report-diagnostics-copy" onClick={() => void copyDetails()}>
        {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
        {copied ? 'Copié ✓' : 'Copier'}
      </Button>
      <span className="sr-only" aria-live="polite">{copyFailed ? 'Copie impossible. Réessayez.' : copied ? 'Détails copiés.' : ''}</span>
    </details>}
  </>;
}
