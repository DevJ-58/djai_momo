import { describe, expect, it } from 'vitest';
import { parseCredentials } from './parseCredentials';

const entry = (text: string) => parseCredentials(text).entries;

describe('parseCredentials', () => {
  it('parses separate email and password lines across blank entries', () => {
    expect(entry('one@example.com\nsecret\n\n two@example.com\nother').map(({ email, password }) => [email, password]))
      .toEqual([['one@example.com', 'secret'], ['two@example.com', 'other']]);
  });

  it.each([
    [':', 'a@example.com: secret'],
    [';', 'a@example.com; secret'],
    [',', 'a@example.com, secret'],
    ['|', 'a@example.com| secret'],
    ['tab', 'a@example.com\tsecret'],
    ['-', 'a@example.com - secret'],
    ['/', 'a@example.com/secret'],
    ['=>', 'a@example.com => secret'],
    ['->', 'a@example.com -> secret'],
    ['spaces', 'a@example.com secret'],
  ])('supports the %s separator', (_name, text) => {
    expect(entry(text)[0]).toMatchObject({ email: 'a@example.com', password: 'secret', status: 'valid' });
  });

  it('parses an optional number after the password', () => {
    expect(entry('a@example.com, secret, 07 01 02 03 04')[0]).toMatchObject({
      email: 'a@example.com',
      password: 'secret',
      numero: '0701020304',
      status: 'valid',
    });
  });

  it('parses tab-separated spreadsheet columns', () => {
    expect(entry('a@example.com\tsecret\t+225 07 01 02 03 04')[0]).toMatchObject({
      email: 'a@example.com',
      password: 'secret',
      numero: '+2250701020304',
      status: 'valid',
    });
  });

  it('keeps rows without a number unchanged and ignores an empty number column', () => {
    expect(entry('a@example.com, secret\nb@example.com, other, ')[0].numero).toBeNull();
    expect(entry('a@example.com, secret\nb@example.com, other, ')[1]).toMatchObject({
      email: 'b@example.com', password: 'other', numero: null, status: 'valid',
    });
  });

  it('marks an invalid number with the shared validation reason', () => {
    expect(entry('a@example.com, secret, 123')[0].issues).toContain('Numéro invalide : chiffres uniquement, 4 à 20.');
  });

  it('marks rows with more than three columns invalid', () => {
    expect(entry('a@example.com, secret, 07010203, extra')[0].issues)
      .toContain('Trop de colonnes (identifiant, mot de passe, numéro).');
  });

  it('does not treat numbers as duplicate criteria', () => {
    expect(entry('a@example.com, secret, 07010203\nA@example.com, other, 07010204')[1].issues)
      .toContain('Doublon dans le texte collé');
  });

  it('parses labelled email followed by a labelled password', () => {
    expect(entry('Email : one@example.com\nMot de passe : secret')[0]).toMatchObject({
      email: 'one@example.com', password: 'secret', status: 'valid',
    });
  });

  it('parses alternate email and password labels on one line', () => {
    expect(entry('mail: one@example.com mdp: secret')[0]).toMatchObject({
      email: 'one@example.com', password: 'secret',
    });
  });

  it('parses the Password label', () => {
    expect(entry('email: one@example.com\nPassword: secret')[0].password).toBe('secret');
  });

  it('ignores a copied spreadsheet column header', () => {
    expect(parseCredentials('Email\tMot de passe\none@example.com\tsecret').ignoredLines).toEqual([]);
  });

  it('ignores a copied spreadsheet header with the optional number column', () => {
    expect(parseCredentials('Email\tMot de passe\tNuméro\none@example.com\tsecret\t0701020304').entries)
      .toHaveLength(1);
  });

  it('ignores WhatsApp names and keeps the credentials', () => {
    expect(entry('Fred Bigflo (1)\nemail\nmotdepasse\n\nFred Bigflo (2)\nsecond@example.com\nsecondpass'))
      .toMatchObject([
        { email: 'email', password: 'motdepasse' },
        { email: 'second@example.com', password: 'secondpass' },
      ]);
  });

  it('removes numbered and bulleted list prefixes', () => {
    expect(entry('1. one@example.com: first\n• two@example.com: second'))
      .toMatchObject([{ password: 'first' }, { password: 'second' }]);
  });

  it('accepts an email wrapped in angle brackets', () => {
    expect(entry('<one@example.com>: secret')[0].email).toBe('one@example.com');
  });

  it('accepts mailto links', () => {
    expect(entry('mailto:one@example.com: secret')[0].email).toBe('one@example.com');
  });

  it('accepts markdown links containing an email', () => {
    expect(entry('[one@example.com](mailto:one@example.com): secret')[0].email).toBe('one@example.com');
  });

  it('extracts the password after a markdown email link', () => {
    expect(entry('[one@example.com](mailto:one@example.com): secret')[0].password).toBe('secret');
  });

  it('keeps colons, at signs, exclamation and hash characters in passwords', () => {
    expect(entry('one@example.com:P@ss:w0rd!#')[0].password).toBe('P@ss:w0rd!#');
  });

  it('removes a pair of straight quotes around passwords', () => {
    expect(entry('one@example.com: "secret"')[0].password).toBe('secret');
  });

  it('removes a pair of French quotes around passwords', () => {
    expect(entry('one@example.com: «secret»')[0].password).toBe('secret');
  });

  it('warns about internal password spaces', () => {
    expect(entry('one@example.com: two words')[0]).toMatchObject({
      status: 'warning', issues: ['Contient des espaces : vérifiez'],
    });
  });

  it('marks a missing password invalid when a new email begins', () => {
    expect(entry('one@example.com\ntwo@example.com: secret')[0]).toMatchObject({
      status: 'invalid', issues: ['Mot de passe manquant'],
    });
  });

  it('marks a missing password invalid at end of input', () => {
    expect(entry('one@example.com')[0].issues).toContain('Mot de passe manquant');
  });

  it('recognizes malformed email-like input as invalid', () => {
    expect(entry('one@invalid: secret')[0]).toMatchObject({ status: 'invalid', email: 'one@invalid' });
  });

  it('marks a repeated email case-insensitively as a duplicate', () => {
    expect(entry('one@example.com: first\nONE@example.com: second')[1].issues)
      .toContain('Doublon dans le texte collé');
  });

  it('normalizes Windows line endings', () => {
    expect(entry('one@example.com\r\nsecret')[0].password).toBe('secret');
  });

  it('removes invisible characters', () => {
    expect(entry('one@\u200bexample.com: se\u200bcret')[0]).toMatchObject({
      email: 'one@example.com', password: 'secret',
    });
  });

  it('parses empty text', () => {
    expect(parseCredentials('')).toEqual({ entries: [], ignoredLines: [], truncated: false });
  });

  it('reports ordinary lines without an email as ignored', () => {
    expect(parseCredentials('some unrelated text')).toMatchObject({
      entries: [], ignoredLines: ['some unrelated text'], truncated: false,
    });
  });

  it('treats a single-word identifier as a pseudo', () => {
    expect(entry('email')[0]).toMatchObject({ email: 'email', status: 'invalid', issues: ['Mot de passe manquant'] });
  });

  it('truncates parsing after 100 entries', () => {
    const text = Array.from({ length: 101 }, (_, index) => `user${index}@example.com: secret`).join('\n');
    expect(parseCredentials(text)).toMatchObject({ truncated: true, entries: { length: 100 } });
  });

  it('truncates input above 20,000 characters', () => {
    expect(parseCredentials(`${'x'.repeat(20_001)}\none@example.com: secret`).truncated).toBe(true);
  });

  it('returns unrecognized lines in their original order', () => {
    expect(parseCredentials('note one\none@example.com: secret\nnote two').ignoredLines)
      .toEqual(['note one', 'note two']);
  });

  it('handles several emails on one line, using text between them as passwords', () => {
    expect(entry('one@example.com:first two@example.com:second'))
      .toMatchObject([{ email: 'one@example.com', password: 'first' }, { email: 'two@example.com', password: 'second' }]);
  });

  it('handles a password label separated by a blank line', () => {
    expect(entry('one@example.com\n\nMot de passe: secret')[0].password).toBe('secret');
  });

  it('treats two blank lines as the end of an incomplete entry', () => {
    expect(entry('one@example.com\n\n\nsecret')[0].issues).toContain('Mot de passe manquant');
  });

  it('does not treat one blank line as the end of a pending password', () => {
    expect(entry('one@example.com\n\nsecret')[0]).toMatchObject({ password: 'secret', status: 'valid' });
  });

  it('accepts Unicode whitespace around credentials', () => {
    expect(entry('\u00a0one@example.com\u202f: secret\u00a0')[0]).toMatchObject({
      email: 'one@example.com', password: 'secret',
    });
  });

  it('keeps the original email casing', () => {
    expect(entry('One@Example.com: secret')[0].email).toBe('One@Example.com');
  });

  it('parses mixed email and pseudo entries and reports invalid identifiers in the preview', () => {
    const entries = entry([
      'jean@example.com: motdepasse1',
      'jean_test: motdepasse2',
      'user@: motdepasse3',
    ].join('\n'));

    expect(entries).toMatchObject([
      { email: 'jean@example.com', password: 'motdepasse1', status: 'valid' },
      { email: 'jean_test', password: 'motdepasse2', status: 'valid' },
      { email: 'user@', password: 'motdepasse3', status: 'invalid', issues: ['Adresse e-mail invalide.'] },
    ]);
  });

  it('parses a pseudo and password on separate lines', () => {
    expect(entry('jean_test\nMotDePasse')[0]).toMatchObject({
      email: 'jean_test',
      password: 'MotDePasse',
      status: 'valid',
    });
  });

  it('reports a whitespace error for an explicitly labelled identifier', () => {
    expect(entry('Identifiant : jean test\nsecret')[0].issues)
      .toContain("Pas d'espaces dans l'identifiant.");
  });

  it('flags an identifier longer than 254 characters', () => {
    const email = `${'a'.repeat(245)}@example.com`;
    expect(entry(`${email}: secret`)[0].issues[0]).toBe('254 caractères maximum.');
  });

  it('flags a password longer than 100 characters', () => {
    expect(entry(`one@example.com: ${'x'.repeat(101)}`)[0].issues)
      .toContain('Le mot de passe ne peut pas dépasser 100 caractères.');
  });

  it('recognizes an email label regardless of accents and case', () => {
    expect(entry('ADRESSE E-MAIL : one@example.com\ncode=secret')[0])
      .toMatchObject({ email: 'one@example.com', password: 'secret' });
  });

  it('ignores a French numbered header', () => {
    expect(parseCredentials('n°1\none@example.com: secret').ignoredLines).toEqual([]);
  });

  it('allows a password label to set the current entry password', () => {
    expect(entry('one@example.com\npwd = secret')[0].password).toBe('secret');
  });

  it('does not mistake a label-only column header for a credential', () => {
    expect(parseCredentials('E-mail Mot de passe').entries).toEqual([]);
  });
});
