import { toTitleCase } from '../format';
import {
  formatDailyGroupHeading,
  formatDailyNumber,
  getAbidjanToday,
  groupBySendDay,
} from '../registration-days';
import type { RegistrationExportRow } from '../../types/database';

export type WhatsAppEntry = Pick<RegistrationExportRow, 'day_seq' | 'send_day' | 'email' | 'mdp' | 'numero'> & {
  agentName: string;
};

export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function formatEntry(
  agentName: string,
  daySeq: number,
  email: string,
  mdp: string,
  sendDay: string,
  today = getAbidjanToday(),
  numero: string | null = null,
): string {
  const entry = `${toTitleCase(agentName)} (${formatDailyNumber(daySeq, sendDay, today)})\n${email}\n${mdp}`;
  return numero === null ? entry : `${entry}\n${numero}`;
}

export function buildMessages(
  entries: WhatsAppEntry[],
  maxEncodedLength = 1800,
  today = getAbidjanToday(),
): string[] {
  if (!Number.isSafeInteger(maxEncodedLength) || maxEncodedLength <= 0) {
    throw new RangeError('La longueur maximale doit être un entier positif.');
  }

  const groups = groupBySendDay(entries);
  const messages: string[] = [];
  let current = '';
  let currentDay = '';

  for (const group of groups) {
    const heading = formatDailyGroupHeading(group.sendDay, today);
    for (const entry of group.registrations) {
      const formatted = formatEntry(
        entry.agentName,
        entry.day_seq,
        entry.email,
        entry.mdp,
        entry.send_day,
        today,
        entry.numero,
      );
      const candidate = current
        ? `${current}\n\n${currentDay === group.sendDay ? '' : `${heading}\n`}${formatted}`
        : `${heading}\n${formatted}`;

      if (current && encodeURIComponent(candidate).length > maxEncodedLength) {
        messages.push(current);
        current = `${heading}\n${formatted}`;
      } else {
        current = candidate;
      }
      currentDay = group.sendDay;
    }
  }

  if (current) messages.push(current);
  return messages;
}

export function buildWaLink(phone: string, text: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error('Numéro WhatsApp invalide ou absent.');
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}
