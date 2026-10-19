import { z } from 'zod';

export const DESCRIPTION_TOO_LONG_MESSAGE = '300 caractères maximum.';

export function parseDescription(raw: string | null | undefined): string | null {
  if (raw == null) return null;

  const description = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!description) return null;
  if (description.length > 300) throw new Error(DESCRIPTION_TOO_LONG_MESSAGE);
  return description;
}

export const descriptionSchema = z.string().nullable().optional().transform((value, context) => {
  try {
    return value === undefined ? undefined : parseDescription(value);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== DESCRIPTION_TOO_LONG_MESSAGE) throw error;
    context.addIssue({ code: 'custom', message: DESCRIPTION_TOO_LONG_MESSAGE });
    return z.NEVER;
  }
});

export function hasDescription(description: string | null | undefined): description is string {
  return typeof description === 'string' && description.length > 0;
}

function auditDescriptionValue(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : '(vide)';
}

function truncateDescription(value: string): string {
  return value.length > 80 ? `${value.slice(0, 79)}…` : value;
}

export function formatDescriptionChange(changes: Record<string, unknown> | null): {
  text: string;
  title: string;
} | null {
  if (!changes || typeof changes.description !== 'object' || changes.description === null) return null;
  const description = changes.description as Record<string, unknown>;
  const from = auditDescriptionValue(description.de);
  const to = auditDescriptionValue(description.vers);
  const title = `Description modifiée : ${from} -> ${to}`;
  return {
    text: `Description modifiée : ${truncateDescription(from)} -> ${truncateDescription(to)}`,
    title,
  };
}
