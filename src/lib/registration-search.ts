import { normalizeNumeroForSearch } from './numero';

function filterValue(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[%_]/g, '\\$&');
  return `"%${escaped}%"`;
}

export function registrationSearchFilter(search: string): string {
  const emailValue = filterValue(search);
  const numeroValue = filterValue(normalizeNumeroForSearch(search));
  return `email.ilike.${emailValue},numero.ilike.${numeroValue}`;
}
