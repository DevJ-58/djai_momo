import { describe, expect, it } from 'vitest';
import { parseIdentifier } from './parseIdentifier';

describe('parseIdentifier', () => {
  it.each([
    ['valid email', 'jean@example.com', 'jean@example.com'],
    ['simple pseudo', 'jean_test', 'jean_test'],
    ['accented pseudo', 'Élodie.Ça-va+2', 'Élodie.Ça-va+2'],
    ['pseudo beginning with @', '@jean', '@jean'],
    ['uppercase email', 'Jean.Test@Example.COM', 'Jean.Test@Example.COM'],
    ['trimmed identifier', '  jean_test  ', 'jean_test'],
  ])('accepts %s', (_name, raw, value) => {
    expect(parseIdentifier(raw)).toEqual({ success: true, value });
  });

  it.each([
    ['user@', 'Adresse e-mail invalide.'],
    ['a@b', 'Adresse e-mail invalide.'],
    ['one two', "Pas d'espaces dans l'identifiant."],
    ['a', 'Au moins 2 caractères.'],
    ['a'.repeat(255), '254 caractères maximum.'],
    ['', 'Saisissez un e-mail ou un pseudo.'],
  ])('rejects invalid identifier %s with its French reason', (raw, error) => {
    expect(parseIdentifier(raw)).toEqual({ success: false, error });
  });
});
