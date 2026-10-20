import { describe, expect, it } from 'vitest';
import {
  computeGains,
  formatGain,
  gainsPeriodFromSearch,
  gainsRpcParameters,
  normalizeGainsDaily,
  normalizeGainsSummary,
} from './gains';
import type { GainsSummaryRow } from './gains';

describe('gains calculations and RPC data', () => {
  it.each([
    [0, { net: 0, vp: 0, recu: 0 }],
    [1000, { net: 1000, vp: 500, recu: 250 }],
    [7500, { net: 7500, vp: 3750, recu: 1875 }],
    [12501, { net: 12501, vp: 6250.5, recu: 3125.25 }],
  ])('computes unrounded amounts from net %i', (net, expected) => {
    expect(computeGains(net)).toEqual(expected);
  });

  it('formats rounded amounts using FCFA and rounds half values to the nearest franc', () => {
    expect(formatGain(3125.25)).toBe('3 125 FCFA');
    expect(formatGain(3125.5)).toBe('3 126 FCFA');
  });

  it('converts numeric strings and handles null or invalid values', () => {
    expect(normalizeGainsSummary([{
      agent_id: 'agent-1',
      full_name: 'Agent Test',
      nb_recus: '3',
      montant_net: '12501.25',
      dernier_gain: null,
    }])).toEqual([{
      agent_id: 'agent-1',
      full_name: 'Agent Test',
      nb_recus: 3,
      montant_net: 12501.25,
      dernier_gain: null,
    }]);
    expect(normalizeGainsSummary(null)).toEqual([]);
    expect(normalizeGainsDaily([{ jour: '2026-10-20', nb_recus: '2', montant_net: '7500' }])).toEqual([
      { jour: '2026-10-20', nb_recus: 2, montant_net: 7500 },
    ]);
  });

  it('sends exact named RPC parameters with nulls for absent date and agent filters', () => {
    expect(gainsRpcParameters({})).toEqual({ p_from: null, p_to: null, p_agent_ids: null });
    expect(gainsRpcParameters({ from: '', to: '2026-10-20', agentIds: [] })).toEqual({
      p_from: null,
      p_to: '2026-10-20',
      p_agent_ids: null,
    });
    expect(gainsRpcParameters({
      from: '2026-10-01',
      to: '2026-10-20',
      agentIds: ['agent-1'],
    })).toEqual({
      p_from: '2026-10-01',
      p_to: '2026-10-20',
      p_agent_ids: ['agent-1'],
    });
  });

  it('restores both preset and custom date periods from the URL', () => {
    expect(gainsPeriodFromSearch('?periode=7', '2026-10-20')).toMatchObject({
      id: '7',
      from: '2026-10-14',
      to: '2026-10-20',
    });
    expect(gainsPeriodFromSearch('?du=2026-10-02&au=2026-10-19', '2026-10-20')).toMatchObject({
      id: 'custom',
      from: '2026-10-02',
      to: '2026-10-19',
    });
    expect(gainsPeriodFromSearch('?du=2026-10-22&au=2026-10-23', '2026-10-20').id).toBe('all');
  });

  it('computes overall shares from summed unrounded nets, not rounded display amounts', () => {
    const rows: GainsSummaryRow[] = [
      { agent_id: 'a', full_name: 'A', nb_recus: 1, montant_net: 1.25, dernier_gain: null },
      { agent_id: 'b', full_name: 'B', nb_recus: 1, montant_net: 1.25, dernier_gain: null },
    ];
    const grandTotal = rows.reduce((sum, row) => sum + row.montant_net, 0);
    expect(computeGains(grandTotal)).toEqual({ net: 2.5, vp: 1.25, recu: 0.625 });
    const roundedIndividualAmounts = rows.reduce((sum, row) => sum + Math.round(computeGains(row.montant_net).recu), 0);
    expect(roundedIndividualAmounts).toBe(0);
    expect(Math.round(computeGains(grandTotal).recu)).toBe(1);
  });
});
