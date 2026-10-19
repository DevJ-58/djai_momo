import { formatAmount, formatDate, toTitleCase } from '../format';
import { registrationStatusLabel } from '../registration-status';
import type { RegistrationExportRow } from '../../types/database';

function csvCell(value: string): string {
  const safeValue = /^[=+\-@]/u.test(value) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

export function buildRegistrationsCsv(
  rows: RegistrationExportRow[],
  includePasswords: boolean,
): string {
  const headers = [
    'utilisateur',
    'n°',
    'identifiant',
    'statut',
    'montant',
    'date',
    ...(includePasswords ? ['mot de passe'] : []),
    'numero',
  ];
  const records = rows.map((row) => [
    toTitleCase(row.profiles?.full_name ?? '—'),
    String(row.seq),
    row.email,
    registrationStatusLabel(row.status),
    row.amount === null ? '' : formatAmount(row.amount),
    formatDate(row.created_at),
    ...(includePasswords ? [row.mdp] : []),
    row.numero ?? '',
  ]);

  return `\uFEFF${[headers, ...records]
    .map((record) => record.map(csvCell).join(';'))
    .join('\r\n')}`;
}

function fileDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'utilisateur';
}

export function registrationsCsvFilename(agentName?: string): string {
  const prefix = agentName
    ? `${slug(agentName)}_enregistres`
    : 'djai_momo_enregistres';
  return `${prefix}_${fileDate()}.csv`;
}

export function downloadRegistrationsCsv(
  rows: RegistrationExportRow[],
  includePasswords: boolean,
  filename: string,
): void {
  const blob = new Blob([buildRegistrationsCsv(rows, includePasswords)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
