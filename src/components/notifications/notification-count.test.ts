import { describe, expect, it } from 'vitest';
import { formatUnreadNotificationCount } from './notification-count';

describe('formatUnreadNotificationCount', () => {
  it.each([
    [0, null],
    [1, '1'],
    [9, '9'],
    [10, '10'],
    [99, '99'],
    [120, '99+'],
  ])('formats %i unread notifications as %s', (count, expected) => {
    expect(formatUnreadNotificationCount(count)).toBe(expected);
  });
});
