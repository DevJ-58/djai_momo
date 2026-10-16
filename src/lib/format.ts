export function formatAmount(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new RangeError('Le montant doit être un nombre fini.');
  }

  const formattedAmount = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/[\u00A0\u202F]/g, '\u00A0');

  return `${formattedAmount}\u00A0FCFA`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';

  const parts = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')}`;
}

export function formatRelative(value: string, now = Date.now()): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '—';

  const deltaSeconds = Math.round((timestamp - now) / 1000);
  const absoluteSeconds = Math.abs(deltaSeconds);
  if (absoluteSeconds < 60) return 'à l’instant';

  const units: Array<{ seconds: number; suffix: string }> = [
    { seconds: 60 * 60 * 24 * 7, suffix: 'sem.' },
    { seconds: 60 * 60 * 24, suffix: 'j' },
    { seconds: 60 * 60, suffix: 'h' },
    { seconds: 60, suffix: 'min' },
  ];
  const unit = units.find(({ seconds }) => absoluteSeconds >= seconds) ?? units[units.length - 1];
  const count = Math.floor(absoluteSeconds / unit.seconds);
  const relative = `${count} ${unit.suffix}`;
  return deltaSeconds < 0 ? `il y a ${relative}` : `dans ${relative}`;
}

export function toTitleCase(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('fr-FR')
    .split(/\s+/)
    .map((word) => word
      .split('-')
      .map((part) => part.length === 0 ? part : part[0].toLocaleUpperCase('fr-FR') + part.slice(1))
      .join('-'))
    .join(' ');
}
