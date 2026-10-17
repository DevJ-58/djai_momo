import { describe, expect, it } from 'vitest';
import {
  formatDailyNumber,
  getAbidjanToday,
  groupBySendDay,
  sortBySendDay,
  splitUnsentByDay,
} from './registration-days';

describe('Africa/Abidjan registration day', () => {
  it('keeps the day at 23:59 and rolls over at 00:00', () => {
    expect(getAbidjanToday(new Date('2026-10-16T22:59:00.000Z'))).toBe('2026-10-16');
    expect(getAbidjanToday(new Date('2026-10-16T23:00:00.000Z'))).toBe('2026-10-17');
  });

  it('uses Abidjan rather than the browser timezone', () => {
    expect(getAbidjanToday(new Date('2026-10-15T23:30:00.000Z'))).toBe('2026-10-15');
  });

  it('labels older day numbers with their send date', () => {
    expect(formatDailyNumber(3, '2026-10-15', '2026-10-16')).toBe('n°3 (15/10)');
    expect(formatDailyNumber(2, '2026-10-16', '2026-10-16')).toBe('n°2');
  });
});

describe('unsent registration ordering and grouping', () => {
  const rows = [
    { id: 'today-two', send_day: '2026-10-16', day_seq: 2, exported_at: null },
    { id: 'old-sent', send_day: '2026-10-14', day_seq: 1, exported_at: '2026-10-14T12:00:00Z' },
    { id: 'tomorrow', send_day: '2026-10-17', day_seq: 1, exported_at: null },
    { id: 'old-two', send_day: '2026-10-15', day_seq: 2, exported_at: null },
    { id: 'today-one', send_day: '2026-10-16', day_seq: 1, exported_at: null },
    { id: 'old-one', send_day: '2026-10-15', day_seq: 1, exported_at: null },
  ];

  it('sorts by send day and then by day sequence', () => {
    expect(sortBySendDay(rows).map((row) => row.id)).toEqual([
      'old-sent', 'old-one', 'old-two', 'today-one', 'today-two', 'tomorrow',
    ]);
  });

  it('splits eligible unsent rows into previous days and today', () => {
    const split = splitUnsentByDay(rows, '2026-10-16');
    expect(split.reportes.map((row) => row.id)).toEqual(['old-one', 'old-two']);
    expect(split.aujourdHui.map((row) => row.id)).toEqual(['today-one', 'today-two']);
  });

  it('groups WhatsApp entries by day while keeping daily order', () => {
    const groups = groupBySendDay(rows);
    expect(groups.map((group) => [group.sendDay, group.registrations.map((row) => row.day_seq)])).toEqual([
      ['2026-10-14', [1]],
      ['2026-10-15', [1, 2]],
      ['2026-10-16', [1, 2]],
      ['2026-10-17', [1]],
    ]);
  });
});
