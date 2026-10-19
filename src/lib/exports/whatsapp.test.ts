import { describe, expect, it } from 'vitest';
import { buildMessages, buildWaLink, formatEntry, normalizePhone, type WhatsAppEntry } from './whatsapp';
import { sanitizePdfText } from './pdf';

const agentName = 'fred bigflo';

function entry(daySeq: number, suffix = 'a', sendDay = '2026-10-16'): WhatsAppEntry {
  return {
    agentName,
    day_seq: daySeq,
    send_day: sendDay,
    email: `${suffix}@exemple.com`,
    mdp: `motdepasse-${suffix}`,
    numero: null,
  };
}

describe('WhatsApp export formatting', () => {
  it('formats each entry as exactly three lines with its daily number', () => {
    expect(formatEntry(agentName, 1, 'test@exemple.com', 'motdepasse', '2026-10-16', '2026-10-16'))
      .toBe('Fred Bigflo (n°1)\ntest@exemple.com\nmotdepasse');
  });

  it('adds a normalized phone after the password and leaves entries without one unchanged', () => {
    expect(formatEntry(agentName, 1, 'test@exemple.com', 'motdepasse', '2026-10-16', '2026-10-16', '0701020304'))
      .toBe('Fred Bigflo (n°1)\ntest@exemple.com\nmotdepasse\n0701020304');
    expect(formatEntry(agentName, 1, 'test@exemple.com', 'motdepasse', '2026-10-16', '2026-10-16', null))
      .toBe('Fred Bigflo (n°1)\ntest@exemple.com\nmotdepasse');
  });

  it('separates entries with one blank line', () => {
    expect(buildMessages([entry(1, 'un'), entry(2, 'deux')], 1800, '2026-10-16')[0])
      .toBe('Aujourd’hui · 16/10\nFred Bigflo (n°1)\nun@exemple.com\nmotdepasse-un\n\nFred Bigflo (n°2)\ndeux@exemple.com\nmotdepasse-deux');
  });

  it('splits long messages without splitting an entry', () => {
    const messages = buildMessages([entry(1, 'first'), entry(2, 'second'), entry(3, 'third')], 160, '2026-10-16');
    expect(messages.length).toBeGreaterThan(1);
    for (const message of messages) {
      expect(message).toContain('Aujourd’hui · 16/10');
      expect(message.split('\n').filter((line) => line.includes('@exemple.com'))).toHaveLength(1);
    }
  });

  it('splits a 40-entry WhatsApp export within the encoded-length limit', () => {
    const messages = buildMessages(
      Array.from({ length: 40 }, (_, index) => entry(index + 1, `agent${index}`)),
      1800,
      '2026-10-16',
    );
    const exportedEntries = messages.flatMap((message) => message.split('\n').filter((line) => line.includes('@exemple.com')));
    expect(exportedEntries).toHaveLength(40);
    expect(messages.every((message) => encodeURIComponent(message).length <= 1800)).toBe(true);
  });

  it('sorts entries by sequence number', () => {
    const messages = buildMessages([entry(3, 'three'), entry(1, 'one'), entry(2, 'two')], 1800, '2026-10-16');
    expect(messages[0].indexOf('(n°1)')).toBeLessThan(messages[0].indexOf('(n°2)'));
    expect(messages[0].indexOf('(n°2)')).toBeLessThan(messages[0].indexOf('(n°3)'));
  });

  it('groups reported and current days, adding the old day to each daily number', () => {
    const messages = buildMessages([
      entry(2, 'today-two', '2026-10-16'),
      entry(2, 'yesterday-two', '2026-10-15'),
      entry(1, 'yesterday-one', '2026-10-15'),
      entry(1, 'today-one', '2026-10-16'),
    ], 1800, '2026-10-16');
    expect(messages[0]).toContain('Reportés du 15/10');
    expect(messages[0]).toContain('Fred Bigflo (n°1 (15/10))');
    expect(messages[0]).toContain('Fred Bigflo (n°2 (15/10))');
    expect(messages[0]).toContain('Aujourd’hui · 16/10');
    expect(messages[0]).toContain('Fred Bigflo (n°1)');
  });

  it('repeats a day heading when a long report continues in another message', () => {
    const messages = buildMessages([
      entry(1, 'first', '2026-10-15'),
      entry(2, 'second', '2026-10-15'),
    ], 120, '2026-10-16');
    expect(messages.length).toBe(2);
    expect(messages.every((message) => message.startsWith('Reportés du 15/10\n'))).toBe(true);
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
