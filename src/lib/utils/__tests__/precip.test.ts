import { describe, it, expect } from 'vitest';
import {
  isRainHour,
  rainPeriods,
  firstRainHour,
  rainHourCount,
  RAIN_PROB_PCT,
  RAIN_AMOUNT_MM,
  type PrecipRow
} from '../precip';

/** A forecast hour at `offsetHr` with the given probability / accumulation. */
const row = (
  offsetHr: number,
  precipProbPct: number | null = 0,
  precipAmountMm: number | null = 0
): PrecipRow => ({ offsetHr, precipProbPct, precipAmountMm });

describe('isRainHour', () => {
  it('fires on probability at or above the threshold', () => {
    expect(isRainHour({ precipProbPct: RAIN_PROB_PCT })).toBe(true);
    expect(isRainHour({ precipProbPct: RAIN_PROB_PCT - 1 })).toBe(false);
  });

  it('fires on measurable accumulation regardless of probability', () => {
    // The forecast can carry a lot of water at a low stated probability.
    expect(isRainHour({ precipProbPct: 10, precipAmountMm: 5 })).toBe(true);
    expect(isRainHour({ precipAmountMm: RAIN_AMOUNT_MM })).toBe(false); // at, not above
    expect(isRainHour({ precipAmountMm: RAIN_AMOUNT_MM + 0.01 })).toBe(true);
  });

  it('ignores a single-tick trace at a low probability', () => {
    // 0.254 mm (0.01 in) is the smallest amount the NWS grid can report and
    // appears against probabilities as low as 15 %. Treating that as rain would
    // red-flag an otherwise dry forecast.
    expect(isRainHour({ precipProbPct: 15, precipAmountMm: 0.254 })).toBe(false);
    // The same trace under a better-than-even probability still counts.
    expect(isRainHour({ precipProbPct: 60, precipAmountMm: 0.254 })).toBe(true);
  });

  it('fires on a high-probability drizzle carrying no accumulation', () => {
    expect(isRainHour({ precipProbPct: 70, precipAmountMm: 0 })).toBe(true);
  });

  it('treats absent or non-finite values as dry', () => {
    expect(isRainHour({})).toBe(false);
    expect(isRainHour({ precipProbPct: null, precipAmountMm: null })).toBe(false);
    expect(isRainHour({ precipProbPct: undefined })).toBe(false);
    expect(isRainHour({ precipProbPct: NaN, precipAmountMm: NaN })).toBe(false);
  });
});

describe('rainPeriods', () => {
  it('returns nothing for a dry window', () => {
    const rows = Array.from({ length: 72 }, (_, i) => row(i, 10, 0));
    expect(rainPeriods(rows)).toEqual([]);
    expect(firstRainHour([])).toBeNull();
    expect(rainHourCount([])).toBe(0);
  });

  it('shifts offsets onto the model-hour axis (offset 0 is hour 1)', () => {
    const rows = [row(0, 90), row(1, 10), row(2, 10)];
    expect(rainPeriods(rows)).toEqual([
      { startHour: 1, endHour: 1, peakProbPct: 90, peakAmountMm: 0 }
    ]);
  });

  it('merges consecutive wet hours into one span', () => {
    const rows = [row(4, 10), row(5, 60), row(6, 80, 2), row(7, 55), row(8, 10)];
    const periods = rainPeriods(rows);
    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({ startHour: 6, endHour: 8, peakProbPct: 80, peakAmountMm: 2 });
    expect(rainHourCount(periods)).toBe(3);
  });

  it('keeps a dry hour between two showers as a break, not a merge', () => {
    const rows = [row(0, 90), row(1, 10), row(2, 90)];
    const periods = rainPeriods(rows);
    expect(periods.map((p) => [p.startHour, p.endHour])).toEqual([
      [1, 1],
      [3, 3]
    ]);
    expect(firstRainHour(periods)).toBe(1);
    expect(rainHourCount(periods)).toBe(2);
  });

  it('breaks a span across a hole in the offsets rather than shading over it', () => {
    // Offset 2 is absent from the series entirely — not a dry hour, an unknown
    // one. Bridging it would claim knowledge the forecast did not supply.
    const rows = [row(0, 90), row(1, 90), row(3, 90)];
    expect(rainPeriods(rows).map((p) => [p.startHour, p.endHour])).toEqual([
      [1, 2],
      [4, 4]
    ]);
  });

  it('sorts before grouping, so out-of-order rows still merge', () => {
    const rows = [row(6, 90), row(4, 90), row(5, 90)];
    expect(rainPeriods(rows)).toEqual([
      { startHour: 5, endHour: 7, peakProbPct: 90, peakAmountMm: 0 }
    ]);
  });

  it('reports null peaks when a span was flagged by the other signal alone', () => {
    const rows = [{ offsetHr: 0, precipAmountMm: 3 }];
    expect(rainPeriods(rows)).toEqual([
      { startHour: 1, endHour: 1, peakProbPct: null, peakAmountMm: 3 }
    ]);
  });

  it('carries the peak across a span, not the first or last value', () => {
    const rows = [row(0, 55, 0.5), row(1, 95, 0.3), row(2, 60, 8)];
    expect(rainPeriods(rows)[0]).toMatchObject({ peakProbPct: 95, peakAmountMm: 8 });
  });
});
