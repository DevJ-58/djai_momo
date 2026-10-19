import { parseIdentifier } from './parseIdentifier';
import { parseNumero, NUMERO_INVALID_MESSAGE } from './numero';

export type ParsedEntry = {
  id: string;
  email: string;
  password: string;
  numero: string | null;
  parseError?: string;
  status: 'valid' | 'warning' | 'invalid';
  issues: string[];
  sourceLine: number;
};

export type ParseCredentialsResult = {
  entries: ParsedEntry[];
  ignoredLines: string[];
  truncated: boolean;
};

type DraftEntry = Pick<ParsedEntry, 'id' | 'email' | 'password' | 'numero' | 'sourceLine' | 'parseError'>;
type EmailMatch = { email: string; start: number; end: number };

const MAX_TEXT_LENGTH = 20_000;
const MAX_ENTRIES = 100;
const EMAIL_LABEL = /^(?:adresse\s+e[\s-]?mail|e[\s-]?mail|mail|identifiant|pseudo|username|login|id)\s*[:=\-]\s*/i;
const PASSWORD_LABEL = /^(?:mot[\s-]+de[\s-]+passe|mdp|password|pass|pwd|code)\s*[:=\-]\s*/i;

function normalizeText(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '');
}

function normalizeLabel(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function removeLinePrefix(value: string) {
  return value.replace(/^\s*(?:(?:\(\d+\)|\d+[.)]|n[°º]\s*\d+|[-•*])\s*)+/iu, '');
}

function findEmails(line: string): EmailMatch[] {
  if (!line.includes('@')) return [];
  const find = (pattern: RegExp) => {
    const matches: EmailMatch[] = [];
    for (const match of line.matchAll(pattern)) {
      const rawEmail = match[1].replace(/[.,;]+$/g, '');
      if (!rawEmail) continue;
      const groupOffset = match[0].indexOf(match[1]);
      const start = (match.index ?? 0) + groupOffset;
      matches.push({ email: rawEmail, start, end: start + rawEmail.length });
    }
    return matches;
  };

  const validPattern = /(?<![A-Z0-9.!#$%&'*+/=?^_`{|}~@-])(?:mailto:)?<?\[?([A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Z0-9-]+\.)+[A-Z]{2,})\]?>?/giu;
  const validMatches = find(validPattern);
  if (validMatches.length) {
    const markdownLinks = [...line.matchAll(/\[([^\]]+)\]\(mailto:[^)]+\)/giu)];
    const withoutDuplicateTargets = validMatches.filter((email) => !markdownLinks.some((link) => {
      if (!link[1].includes('@')) return false;
      const linkStart = link.index ?? 0;
      const targetStart = linkStart + link[0].indexOf('mailto:') + 'mailto:'.length;
      const targetEnd = linkStart + link[0].length - 1;
      return email.start >= targetStart && email.start < targetEnd;
    }));
    return withoutDuplicateTargets.length ? withoutDuplicateTargets : validMatches;
  }
  const malformedPattern = /(?<![A-Z0-9.!#$%&'*+/=?^_`{|}~@-])(?:mailto:)?<?\[?([A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+)\]?>?/giu;
  return find(malformedPattern);
}

function cleanPassword(value: string) {
  let password = value.trim();
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['«', '»'],
    ['“', '”'],
    ['‘', '’'],
  ];
  for (const [open, close] of pairs) {
    if (password.startsWith(open) && password.endsWith(close) && password.length >= 2) {
      password = password.slice(open.length, -close.length).trim();
      break;
    }
  }
  return password;
}

function removePasswordLabel(value: string) {
  const normalized = normalizeLabel(value);
  const match = normalized.match(PASSWORD_LABEL);
  return match ? value.slice(match[0].length) : value;
}

function removeEmailSeparator(value: string) {
  let result = value.replace(/^\s+/, '');
  const separator = result.match(/^(?:=>|->|[:;,|/\t-])/);
  if (separator) result = result.slice(separator[0].length);
  return cleanPassword(removePasswordLabel(result));
}

function isHeader(value: string) {
  const normalized = normalizeLabel(value).trim().toLocaleLowerCase('fr');
  if (/^(?:[\p{L} .'-]+\s+\(\d+\))$/u.test(value.trim())) return true;

  const fields = normalized.split(/[,;|\t]/u).map((field) => field.trim());
  const identifierHeader = /^(?:e-?mail|mail|adresse e-?mail|identifiant|pseudo)$/u;
  const passwordHeader = /^(?:mot de passe|mdp|password|pass|pwd)$/u;
  const numeroHeader = /^(?:numero|telephone|phone)$/u;
  if (
    fields.length >= 2
    && fields.length <= 3
    && identifierHeader.test(fields[0] ?? '')
    && passwordHeader.test(fields[1] ?? '')
    && (fields.length === 2 || numeroHeader.test(fields[2] ?? ''))
  ) return true;

  return /^(?:e-?mail|mail|adresse e-?mail|identifiant|pseudo)\s+(?:mot de passe|mdp|password|pass|pwd)(?:\s+(?:numero|telephone|phone))?$/u.test(normalized);
}

export function validateParsedEntries(entries: ParsedEntry[]): ParsedEntry[] {
  const identifiers = new Set<string>();
  return entries.map((entry) => {
    const issues: string[] = entry.parseError ? [entry.parseError] : [];
    const parsedIdentifier = parseIdentifier(entry.email);
    const email = parsedIdentifier.success ? parsedIdentifier.value : entry.email.trim();
    const password = cleanPassword(entry.password);
    const normalizedIdentifier = email.toLocaleLowerCase('fr');
    let numero = entry.numero;
    try {
      numero = parseNumero(numero);
    } catch {
      issues.push(NUMERO_INVALID_MESSAGE);
    }

    if (!parsedIdentifier.success) issues.push(parsedIdentifier.error);
    if (parsedIdentifier.success && identifiers.has(normalizedIdentifier)) issues.push('Doublon dans le texte collé');
    if (parsedIdentifier.success) identifiers.add(normalizedIdentifier);
    if (!password) issues.push('Mot de passe manquant');
    else if (password.length > 100) issues.push('Le mot de passe ne peut pas dépasser 100 caractères.');
    else if (/\s/.test(password)) issues.push('Contient des espaces : vérifiez');

    const invalid = issues.some((issue) => issue !== 'Contient des espaces : vérifiez');
    return {
      ...entry,
      email,
      password,
      numero,
      status: invalid ? 'invalid' : issues.length ? 'warning' : 'valid',
      issues,
    };
  });
}

export function parseCredentials(text: string): ParseCredentialsResult {
  const normalized = normalizeText(text);
  const truncatedByText = normalized.length > MAX_TEXT_LENGTH;
  const lines = normalized.slice(0, MAX_TEXT_LENGTH).split('\n');
  const drafts: DraftEntry[] = [];
  const ignoredLines: string[] = [];
  let current: DraftEntry | undefined;
  let pendingPassword = false;
  let pendingBlankLines = 0;
  let afterEntryHeader = false;
  let truncated = truncatedByText;
  let stopped = false;

  const addDraft = (identifier: string, sourceLine: number, password = '', numero: string | null = null, parseError?: string) => {
    if (drafts.length >= MAX_ENTRIES) {
      truncated = true;
      stopped = true;
      return undefined;
    }
    const entry: DraftEntry = {
      id: `credential-${sourceLine}-${drafts.length + 1}`,
      email: identifier.trim(),
      password,
      numero,
      sourceLine,
      ...(parseError ? { parseError } : {}),
    };
    drafts.push(entry);
    current = entry;
    pendingPassword = !password;
    pendingBlankLines = 0;
    return entry;
  };

  const markMissingPassword = () => {
    if (current && pendingPassword) {
      current.password = '';
      pendingPassword = false;
    }
  };

  const splitCredentialTail = (value: string, separator: string) => {
    const values = value.split(separator);
    const phoneColumns = separator === ',' || separator === ';' || separator === '|' || separator === '\t' || separator === '/';
    const phoneValue = values.at(-1) ?? '';
    const hasPhoneColumn = values.length > 1 && (
      phoneColumns || /^[+\d][+\d ().\-\u00a0\u202f]*$/u.test(phoneValue)
    );
    if (!hasPhoneColumn) return { password: cleanPassword(value), numero: null, parseError: undefined };
    if (values.length > 2) {
      return {
        password: cleanPassword(values[0]),
        numero: values[1]?.trim() || null,
        parseError: 'Trop de colonnes (identifiant, mot de passe, numéro).',
      };
    }
    return { password: cleanPassword(values[0]), numero: values[1]?.trim() || null, parseError: undefined };
  };

  const splitIdentifierAndPassword = (value: string) => {
    const delimited = value.match(/^(.*?)\s*(=>|->|[:;,|/\t])\s*(.*)$/u);
    if (delimited) {
      const tail = splitCredentialTail(delimited[3], delimited[2]);
      return { identifier: delimited[1].trim(), ...tail };
    }
    const hyphenated = value.match(/^(.+?)\s+-\s+(.+)$/u);
    if (hyphenated) return { identifier: hyphenated[1].trim(), password: cleanPassword(hyphenated[2]), numero: null, parseError: undefined };
    const spaced = value.match(/^(\S+)\s+(.+)$/u);
    if (spaced && /[_+.@-]|\d/u.test(spaced[1])) {
      const phoneSuffix = spaced[2].match(/^(.*?)\s+([+()\d][+()\d .\-\u00a0\u202f]*)$/u);
      return phoneSuffix
        ? { identifier: spaced[1], password: cleanPassword(phoneSuffix[1]), numero: phoneSuffix[2].trim() || null, parseError: undefined }
        : { identifier: spaced[1], password: cleanPassword(spaced[2]), numero: null, parseError: undefined };
    }
    return null;
  };

  for (const [lineIndex, rawLine] of lines.entries()) {
    if (stopped) break;
    const lineNumber = lineIndex + 1;
    const line = removeLinePrefix(rawLine);
    const detectionLine = line.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    const labelNormalized = normalizeLabel(detectionLine);
    const emailLabel = labelNormalized.match(EMAIL_LABEL);
    const content = emailLabel ? detectionLine.slice(emailLabel[0].length) : detectionLine;
    const sourceContent = emailLabel ? line.slice(emailLabel[0].length) : line;
    const emailMatches = findEmails(content);

    if (emailMatches.length) {
      afterEntryHeader = false;
      if (pendingPassword) markMissingPassword();
      for (let index = 0; index < emailMatches.length; index += 1) {
        const match = emailMatches[index];
        const nextMatch = emailMatches[index + 1];
        const trailing = sourceContent.slice(match.end, nextMatch?.start ?? sourceContent.length);
        const cleanedTrailing = trailing.replace(/^\s*(?:\](?:\([^)]*\))?|>)+/, '');
        const delimiter = cleanedTrailing.match(/^\s*(=>|->|[:;,|/\t])\s*(.*)$/u);
        const fields = delimiter
          ? splitCredentialTail(delimiter[2], delimiter[1])
          : { password: removeEmailSeparator(cleanedTrailing), numero: null, parseError: undefined };
        const entry = addDraft(match.email, lineNumber, fields.password, fields.numero, fields.parseError);
        if (!entry) break;
        if (nextMatch && pendingPassword) markMissingPassword();
      }
      continue;
    }

    if (emailLabel) {
      afterEntryHeader = false;
      if (pendingPassword) markMissingPassword();
      const split = splitIdentifierAndPassword(sourceContent);
      const identifier = split?.identifier ?? sourceContent.trim();
      addDraft(identifier, lineNumber, split?.password ?? '', split?.numero ?? null, split?.parseError);
      continue;
    }

    if (afterEntryHeader && normalizeLabel(line).trim().toLocaleLowerCase('fr') === 'email') {
      addDraft(line.trim(), lineNumber);
      afterEntryHeader = false;
      continue;
    }

    const passwordLabel = labelNormalized.match(PASSWORD_LABEL);
    if (passwordLabel && current) {
      afterEntryHeader = false;
      current.password = cleanPassword(line.slice(passwordLabel[0].length));
      pendingPassword = !current.password;
      pendingBlankLines = 0;
      continue;
    }

    if (!line.trim()) {
      if (pendingPassword) {
        pendingBlankLines += 1;
        if (pendingBlankLines >= 2) {
          markMissingPassword();
          current = undefined;
          pendingBlankLines = 0;
        }
      }
      continue;
    }

    if (pendingPassword && current) {
      afterEntryHeader = false;
      current.password = cleanPassword(removePasswordLabel(line));
      pendingPassword = !current.password;
      pendingBlankLines = 0;
      continue;
    }

    if (isHeader(line)) {
      afterEntryHeader = true;
      continue;
    }

    const split = splitIdentifierAndPassword(detectionLine);
    if (split) {
      afterEntryHeader = false;
      if (pendingPassword) markMissingPassword();
      addDraft(split.identifier, lineNumber, split.password);
      continue;
    }

    const standaloneIdentifier = parseIdentifier(detectionLine);
    if (!/\s/u.test(detectionLine)) {
      afterEntryHeader = false;
      addDraft(standaloneIdentifier.success ? standaloneIdentifier.value : detectionLine, lineNumber);
      continue;
    }

    afterEntryHeader = false;
    ignoredLines.push(rawLine);
  }

  if (pendingPassword) markMissingPassword();
  const entries = validateParsedEntries(drafts.map((entry) => ({
    ...entry,
    status: 'valid',
    issues: [],
  })));

  return { entries, ignoredLines, truncated };
}
