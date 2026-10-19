import { describe, expect, it } from 'vitest';
import {
  chooseReceiverAmountMutation,
  formatReceiverPrize,
  formatReceiverAmount,
  getAddedReceiverIds,
  getReceiverStartIndex,
  normalizeReceiverPrize,
  parseReceiverAmount,
  sortReceiverRegistrations,
  shouldSubmitReceiverAmount,
  type ReceiverRegistration,
} from './receiver-workflow';

describe('receiver amount parsing', () => {
  it.each([
    ['5 000', 5000],
    ['5\u00a0000', 5000],
    ['999999999', 999999999],
  ])('parses %s', (value, expected) => {
    expect(parseReceiverAmount(value)).toBe(expected);
  });

  it.each(['', '0', '-5', '1.5', '1,5', '1 000 000 000', 'abc'])(
    'rejects %s',
    (value) => expect(parseReceiverAmount(value)).toBeNull(),
  );

  it('formats thousands as the user types', () => {
    expect(formatReceiverAmount('5000')).toBe('5 000');
    expect(formatReceiverAmount('5 000')).toBe('5 000');
  });
});

describe('receiver prize display', () => {
  it.each([
    [5000, 5000, '5 000'],
    ['5000', 5000, '5 000'],
    [null, null, null],
    [0, null, null],
  ])('normalizes and formats %s without inventing a zero amount', (value, expectedAmount, expectedDisplay) => {
    expect(normalizeReceiverPrize(value)).toBe(expectedAmount);
    expect(formatReceiverPrize(value)?.replace(/\s/g, ' ') ?? null).toBe(expectedDisplay);
  });
});

describe('new receiver registrations', () => {
  it('does not count the initial load and counts only IDs added afterward', () => {
    expect(getAddedReceiverIds(null, ['existing'])).toEqual([]);
    expect(getAddedReceiverIds(new Set(['existing']), ['existing', 'new'])).toEqual(['new']);
  });
});

describe('receiver amount validation', () => {
  it('does not submit an empty or invalid value', () => {
    expect(chooseReceiverAmountMutation(null, null)).toBeNull();
  });

  it('uses set_result for unfinished registrations and update_prize for a gain', () => {
    expect(chooseReceiverAmountMutation(null, 5000)).toBe('set_result');
    expect(chooseReceiverAmountMutation('echec', 5000)).toBe('set_result');
    expect(chooseReceiverAmountMutation('gagne', 6000)).toBe('update_prize');
  });

  it('submits only on completed validation events and blocks duplicate submissions', () => {
    expect(shouldSubmitReceiverAmount('input', 5000, false, undefined)).toBe(false);
    expect(shouldSubmitReceiverAmount('ok', 5000, false, undefined)).toBe(true);
    expect(shouldSubmitReceiverAmount('blur', 5000, true, undefined)).toBe(false);
    expect(shouldSubmitReceiverAmount('leave', 5000, false, 5000)).toBe(false);
  });
});

describe('receiver registration order and start position', () => {
  const registration = (
    id: string,
    send_day: string,
    day_seq: number,
    progress_status: ReceiverRegistration['progress_status'],
  ): ReceiverRegistration => ({
    id,
    agent_id: 'agent',
    send_day,
    day_seq,
    email: `${id}@example.test`,
    mdp: 'fictional',
    numero: null,
    description: null,
    progress_status,
    result: null,
    prize: null,
  });

  it('sorts oldest first, then by daily sequence', () => {
    expect(sortReceiverRegistrations([
      registration('c', '2026-10-16', 2, 'nouveau'),
      registration('a', '2026-10-15', 4, 'nouveau'),
      registration('b', '2026-10-15', 1, 'nouveau'),
    ]).map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });

  it('starts on the first unfinished registration, or the last when all are complete', () => {
    expect(getReceiverStartIndex([
      { progress_status: 'termine' },
      { progress_status: 'nouveau' },
      { progress_status: 'en_cours' },
    ])).toBe(1);
    expect(getReceiverStartIndex([
      { progress_status: 'termine' },
      { progress_status: 'termine' },
    ])).toBe(1);
    expect(getReceiverStartIndex([])).toBe(0);
  });
});
