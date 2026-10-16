import { toTitleCase } from '../format';
import type { RegistrationExportRow } from '../../types/database';

export type WhatsAppEntry = Pick<RegistrationExportRow, 'seq' | 'email' | 'mdp'> & {
  agentName: string;
};

export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function formatEntry(agentName: string, seq: number, email: string, mdp: string): string {
  return `${toTitleCase(agentName)} (${seq})\n${email}\n${mdp}`;
}

export function buildMessages(entries: WhatsAppEntry[], maxEncodedLength = 1800): string[] {
  if (!Number.isSafeInteger(maxEncodedLength) || maxEncodedLength <= 0) {
    throw new RangeError('La longueur maximale doit être un entier positif.');
  }

  const sorted = [...entries].sort((first, second) => first.seq - second.seq);
  const messages: string[] = [];
  let current = '';

  for (const entry of sorted) {
    const formatted = formatEntry(entry.agentName, entry.seq, entry.email, entry.mdp);
    const candidate = current ? `${current}\n\n${formatted}` : formatted;
    if (current && encodeURIComponent(candidate).length > maxEncodedLength) {
      messages.push(current);
      current = formatted;
    } else {
      current = candidate;
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
