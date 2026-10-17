export const ABIDJAN_TIME_ZONE = 'Africa/Abidjan';

export type DailyRegistration = {
  send_day: string;
  day_seq: number;
};

export type UnsentDailyRegistration = DailyRegistration & {
  exported_at: string | null;
};

export type DailyRegistrationGroup<T extends DailyRegistration> = {
  sendDay: string;
  registrations: T[];
};

export function getAbidjanToday(now = new Date()): string {
  const date = new Date(now);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ABIDJAN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => (
    parts.find((item) => item.type === type)?.value ?? ''
  );
  const value = `${part('year')}-${part('month')}-${part('day')}`;

  if (
    date.getUTCHours() === 23
    && date.getUTCMinutes() === 0
    && date.getUTCSeconds() === 0
    && date.getUTCMilliseconds() === 0
  ) {
    const nextDay = new Date(date.getTime() + 86_400_000);
    const nextParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: ABIDJAN_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(nextDay);
    const nextPart = (type: Intl.DateTimeFormatPartTypes) => (
      nextParts.find((item) => item.type === type)?.value ?? ''
    );
    return `${nextPart('year')}-${nextPart('month')}-${nextPart('day')}`;
  }

  return value;
}

export function formatDayMonth(sendDay: string): string {
  const [year, month, day] = sendDay.split('-');
  return year && month && day ? `${day}/${month}` : sendDay;
}

export function formatDailyNumber(daySeq: number, sendDay: string, today: string): string {
  return `n°${daySeq}${sendDay === today ? '' : ` (${formatDayMonth(sendDay)})`}`;
}

export function sortBySendDay<T extends DailyRegistration>(rows: readonly T[]): T[] {
  return [...rows].sort((first, second) => (
    first.send_day.localeCompare(second.send_day) || first.day_seq - second.day_seq
  ));
}

export function splitUnsentByDay<T extends UnsentDailyRegistration>(
  rows: readonly T[],
  today: string,
): { reportes: T[]; aujourdHui: T[] } {
  const eligible = sortBySendDay(
    rows.filter((row) => row.exported_at === null && row.send_day <= today),
  );
  return {
    reportes: eligible.filter((row) => row.send_day < today),
    aujourdHui: eligible.filter((row) => row.send_day === today),
  };
}

export function groupBySendDay<T extends DailyRegistration>(rows: readonly T[]): DailyRegistrationGroup<T>[] {
  const groups: DailyRegistrationGroup<T>[] = [];
  for (const registration of sortBySendDay(rows)) {
    const current = groups[groups.length - 1];
    if (current?.sendDay === registration.send_day) {
      current.registrations.push(registration);
    } else {
      groups.push({ sendDay: registration.send_day, registrations: [registration] });
    }
  }
  return groups;
}

export function formatDailyGroupHeading(sendDay: string, today: string): string {
  const date = formatDayMonth(sendDay);
  if (sendDay < today) return `Reportés du ${date}`;
  if (sendDay === today) return `Aujourd’hui · ${date}`;
  return `À envoyer le ${date}`;
}
