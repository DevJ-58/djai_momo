import { describe, expect, it } from 'vitest';
import { buildMessages, buildWaLink, formatEntry, normalizePhone, type WhatsAppEntry } from './whatsapp';
import { sanitizePdfText } from './pdf';

const agentName = 'fred bigflo';

function entry(seq: number, suffix = 'a'): WhatsAppEntry {
  return {
    agentName,
    seq,
    email: `${suffix}@exemple.com`,
    mdp: `motdepasse-${suffix}`,
  };
}

describe('WhatsApp export formatting', () => {
  it('formats each entry as exactly three lines', () => {
    expect(formatEntry(agentName, 1, 'test@exemple.com', 'motdepasse'))
      .toBe('Fred Bigflo (1)\ntest@exemple.com\nmotdepasse');
  });

  it('separates entries with one blank line', () => {
    expect(buildMessages([entry(1, 'un'), entry(2, 'deux')])[0])
      .toBe('Fred Bigflo (1)\nun@exemple.com\nmotdepasse-un\n\nFred Bigflo (2)\ndeux@exemple.com\nmotdepasse-deux');
  });

  it('splits long messages without splitting an entry', () => {
    const messages = buildMessages([entry(1, 'first'), entry(2, 'second'), entry(3, 'third')], 72);
    expect(messages.length).toBeGreaterThan(1);
    for (const message of messages) {
      for (const part of message.split('\n\n')) expect(part.split('\n')).toHaveLength(3);
    }
  });

  it('splits a 40-entry WhatsApp export within the encoded-length limit', () => {
    const messages = buildMessages(Array.from({ length: 40 }, (_, index) => entry(index + 1, `agent${index}`)));
    const exportedEntries = messages.flatMap((message) => message.split('\n\n'));
    expect(exportedEntries).toHaveLength(40);
    expect(messages.every((message) => encodeURIComponent(message).length <= 1800)).toBe(true);
  });

  it('sorts entries by sequence number', () => {
    const messages = buildMessages([entry(3, 'three'), entry(1, 'one'), entry(2, 'two')]);
    expect(messages[0].indexOf('(1)')).toBeLessThan(messages[0].indexOf('(2)'));
    expect(messages[0].indexOf('(2)')).toBeLessThan(messages[0].indexOf('(3)'));
  });

  it('normalizes valid phones and rejects invalid phones', () => {
    expect(normalizePhone('+225 01 70 38 38 70')).toBe('2250170383870');
    expect(normalizePhone('123-456')).toBeNull();
    expect(normalizePhone('1234567890123456')).toBeNull();
  });

  it('creates a WhatsApp link with encoded message text', () => {
    expect(buildWaLink('+225 01 23 45 67 89', 'Bonjour\nagent'))
      .toBe('https://wa.me/2250123456789?text=Bonjour%0Aagent');
  });

  it('sanitizes narrow spaces and unsupported PDF characters', () => {
    expect(sanitizePdfText('25\u202f000\u00a0FCFA → payé é ç'))
      .toBe('25 000 FCFA -> payé é ç');
  });
});
