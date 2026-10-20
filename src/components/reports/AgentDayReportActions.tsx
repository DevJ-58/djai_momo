import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { Button } from '../ui';
import { supabase } from '../../lib/supabase';
import {
  buildAgentDailyReportText,
  shareReportOrCopy,
  type AgentDailyReportRegistration,
} from '../../lib/day-reports';

export function AgentDayReportActions({
  day,
  agentId,
  agentName,
  total,
  show,
  compact = false,
}: {
  day: string;
  agentId: string;
  agentName: string;
  total: number;
  show: (message: string, tone?: 'success' | 'error' | 'info') => void;
  compact?: boolean;
}) {
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const feedbackTimer = useRef<number | null>(null);
  const unavailable = total === 0;
  const copyLabel = day === getToday() ? 'Copier mon rapport du jour' : 'Copier mon rapport';

  useEffect(() => () => {
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
  }, []);

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => {
      setCopied(false);
      feedbackTimer.current = null;
    }, 1500);
  };

  const generate = async (share: boolean) => {
    if (working || unavailable) return;
    if (!navigator.onLine) {
      show('Pas de connexion. Réessayez une fois en ligne.', 'error');
      return;
    }
    setWorking(true);
    try {
      const { count, error: countError } = await supabase
        .from('registrations')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', agentId)
        .eq('send_day', day);
      if (countError) throw countError;
      const currentTotal = count ?? 0;
      if (currentTotal === 0) {
        show('Aucun enregistré aujourd’hui.', 'info');
        return;
      }
      if (currentTotal > 2000) throw new Error('limit');

      const rows: AgentDailyReportRegistration[] = [];
      for (let offset = 0; offset < currentTotal; offset += 1000) {
        const { data, error } = await supabase
          .from('registrations')
          .select('day_seq, email, status, amount, created_at')
          .eq('agent_id', agentId)
          .eq('send_day', day)
          .order('created_at', { ascending: true })
          .range(offset, Math.min(offset + 999, currentTotal - 1))
          .returns<AgentDailyReportRegistration[]>();
        if (error) throw error;
        rows.push(...data);
      }
      if (rows.length !== currentTotal) throw new Error('incomplete');

      const text = buildAgentDailyReportText(day, agentName, rows);
      if (share) {
        const result = await shareReportOrCopy(
          text,
          typeof navigator.share === 'function' ? navigator.share.bind(navigator) : undefined,
          copyText,
        );
        if (result === 'copied') return;
        return;
      }
      await copyText(text);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError' && share) return;
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
      const offlineFailure = !navigator.onLine
        || errorMessage.includes('network')
        || errorMessage.includes('fetch')
        || errorMessage.includes('load failed');
      show(
        offlineFailure
          ? 'Pas de connexion. Réessayez une fois en ligne.'
          : 'Impossible de générer le rapport. Réessayez.',
        'error',
      );
    } finally {
      setWorking(false);
    }
  };

  const disabled = unavailable || working;
  return (
    <div className={`agent-day-report-actions${compact ? ' agent-day-report-actions-compact' : ''}`}>
      <Button
        variant="secondary"
        className="agent-day-report-action"
        disabled={disabled}
        loading={working}
        onClick={() => void generate(false)}
      >
        {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
        {unavailable ? "Aucun enregistré aujourd'hui" : copied ? 'Copié ✓' : copyLabel}
      </Button>
      <Button
        variant="secondary"
        className="agent-day-report-action"
        disabled={disabled}
        loading={working}
        onClick={() => void generate(true)}
      >
        <Share2 size={18} aria-hidden="true" />
        {unavailable ? "Aucun enregistré aujourd'hui" : 'Partager'}
      </Button>
      <span className="sr-only" aria-live="polite">{copied ? 'Rapport copié.' : ''}</span>
    </div>
  );
}

function getToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Abidjan', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
