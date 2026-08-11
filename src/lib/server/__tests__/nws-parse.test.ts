import { describe, it, expect } from 'vitest';
import {
  buildForecastRows,
  durationToHours,
  expandSeries,
  kmhToMps,
  NwsError,
  parseValidTime,
  type GridpointProps,
  type NwsSeries
} from '../nws-parse';

const HOUR = 3_600_000;
const CHICAGO = 'America/Chicago';

/**
 * Build a gridpoint series: `count` entries of `stepHours` each, starting at
 * `startISO`. `valueFn` receives the entry index.
 */
function series(
  startISO: string,
  count: number,
  stepHours: number,
  valueFn: (i: number) => number | null
): NwsSeries {
  const startMs = Date.parse(startISO);
  return {
    values: Array.from({ length: count }, (_, i) => ({
      validTime: `${new Date(startMs + i * stepHours * HOUR).toISOString()}/PT${stepHours}H`,
      value: valueFn(i)
    }))
  };
}

/** A grid payload covering `hours` from `startISO` at 1-hour resolution. */
function grid(startISO: string, hours = 200): GridpointProps {
  return {
    gridId: 'BMX',
    gridX: 62,
    gridY: 88,
    updateTime: startISO,
    elevation: { value: 152.4 },
    temperature: series(startISO, hours, 1, (i) => 20 + (i % 24) * 0.5),
    windSpeed: series(startISO, hours, 1, () => 18), // km/h → 5 m/s
    skyCover: series(startISO, hours, 1, (i) => (i % 10) * 10)
  };
}

describe('durationToHours', () => {
  it('parses the spans NWS actually emits', () => {
    expect(durationToHours('PT1H')).toBe(1);
    expect(durationToHours('PT3H')).toBe(3);
    expect(durationToHours('PT6H')).toBe(6);
    expect(durationToHours('P1D')).toBe(24);
    expect(durationToHours('P1DT6H')).toBe(30);
  });

  it('rounds partial hours up so the slot is still claimed', () => {
    expect(durationToHours('PT30M')).toBe(1);
    expect(durationToHours('PT90M')).toBe(2);
  });

  it('rejects garbage', () => {
    expect(() => durationToHours('3 hours')).toThrow(/Unparseable/);
  });
});

describe('parseValidTime', () => {
  it('splits instant from span', () => {
    const { startMs, hours } = parseValidTime('2026-08-11T18:00:00+00:00/PT3H');
    expect(startMs).toBe(Date.parse('2026-08-11T18:00:00Z'));
    expect(hours).toBe(3);
  });

  it('rejects a value with no span', () => {
    expect(() => parseValidTime('2026-08-11T18:00:00Z')).toThrow(/Unparseable/);
  });
});

describe('expandSeries', () => {
  it('expands multi-hour intervals into one key per hour', () => {
    const map = expandSeries({
      values: [
        { validTime: '2026-08-11T18:00:00+00:00/PT1H', value: 1 },
        { validTime: '2026-08-11T19:00:00+00:00/PT3H', value: 2 },
        { validTime: '2026-08-11T22:00:00+00:00/PT6H', value: 3 }
      ]
    });
    expect(map.size).toBe(10);
    expect(map.get(Date.parse('2026-08-11T18:00:00Z'))).toBe(1);
    expect(map.get(Date.parse('2026-08-11T21:00:00Z'))).toBe(2);
    expect(map.get(Date.parse('2026-08-12T03:00:00Z'))).toBe(3);
    expect(map.has(Date.parse('2026-08-12T04:00:00Z'))).toBe(false);
  });

  it('applies the unit conversion but preserves nulls', () => {
    const map = expandSeries(
      {
        values: [
          { validTime: '2026-08-11T18:00:00+00:00/PT1H', value: 18 },
          { validTime: '2026-08-11T19:00:00+00:00/PT1H', value: null }
        ]
      },
      kmhToMps
    );
    expect(map.get(Date.parse('2026-08-11T18:00:00Z'))).toBeCloseTo(5, 10);
    expect(map.get(Date.parse('2026-08-11T19:00:00Z'))).toBeNull();
  });

  it('treats a missing series as empty rather than throwing', () => {
    expect(expandSeries(undefined).size).toBe(0);
  });
});

describe('buildForecastRows', () => {
  const start = Date.parse('2026-08-11T17:00:00Z'); // 12:00 CDT

  it('produces 72 contiguous rows in site-local wall clock', () => {
    const { rows } = buildForecastRows(grid('2026-08-11T17:00:00Z'), start, CHICAGO);
    expect(rows).toHaveLength(72);
    expect(rows.map((r) => r.offsetHr)).toEqual(Array.from({ length: 72 }, (_, i) => i));
    expect(rows[0]).toMatchObject({ year: 2026, month: 8, day: 11, hour: 12, estimated: false });
    expect(rows[12]).toMatchObject({ day: 12, hour: 0 });
    expect(rows[71]).toMatchObject({ day: 14, hour: 11 });
  });

  it('converts units onto the thermal model contract', () => {
    const { rows } = buildForecastRows(grid('2026-08-11T17:00:00Z'), start, CHICAGO);
    expect(rows[0].airTempC).toBe(20);
    expect(rows[0].windMps).toBeCloseTo(5, 10);
    expect(rows[0].cloudPct).toBe(0);
    expect(rows[3].cloudPct).toBe(30);
  });

  it('carries a null sky cover through instead of substituting a number', () => {
    const g = grid('2026-08-11T17:00:00Z');
    g.skyCover = series('2026-08-11T17:00:00Z', 200, 1, () => null);
    const { rows } = buildForecastRows(g, start, CHICAGO);
    expect(rows.every((r) => r.cloudPct === null)).toBe(true);
    // A null cloud value is data, not a gap — the row is still a direct hit.
    expect(rows.every((r) => r.estimated === false)).toBe(true);
  });

  it('rolls the month and year over correctly', () => {
    const nye = Date.parse('2026-12-31T18:00:00Z'); // 12:00 CST
    const { rows } = buildForecastRows(grid('2026-12-31T18:00:00Z'), nye, CHICAGO);
    expect(rows[0]).toMatchObject({ year: 2026, month: 12, day: 31, hour: 12 });
    expect(rows[12]).toMatchObject({ year: 2027, month: 1, day: 1, hour: 0 });
  });

  it('repeats the local hour across the fall-back DST transition', () => {
    // 2026-11-01: 02:00 CDT → 01:00 CST, so local 01:00 occurs twice.
    const s = Date.parse('2026-11-01T04:00:00Z'); // 23:00 CDT on 10-31
    const { rows } = buildForecastRows(grid('2026-11-01T04:00:00Z'), s, CHICAGO);
    expect(rows.slice(0, 5).map((r) => r.hour)).toEqual([23, 0, 1, 1, 2]);
  });

  it('skips the local hour across the spring-forward DST transition', () => {
    // 2026-03-08: 02:00 CST → 03:00 CDT, so local 02:00 never occurs.
    const s = Date.parse('2026-03-08T06:00:00Z'); // 00:00 CST
    const { rows } = buildForecastRows(grid('2026-03-08T06:00:00Z'), s, CHICAGO);
    expect(rows.slice(0, 4).map((r) => r.hour)).toEqual([0, 1, 3, 4]);
  });

  describe('clamp-and-flag', () => {
    it('holds the earliest value for hours before the forecast begins', () => {
      // Forecast starts 3 h after the requested placement time.
      const g = grid('2026-08-11T20:00:00Z');
      const { rows, estimatedLeadingHours } = buildForecastRows(g, start, CHICAGO);
      expect(estimatedLeadingHours).toBe(3);
      expect(rows.slice(0, 3).every((r) => r.estimated)).toBe(true);
      expect(rows[3].estimated).toBe(false);
      // The clamped rows hold the first real forecast value.
      expect(rows[0].airTempC).toBe(rows[3].airTempC);
      expect(rows[0].windMps).toBe(rows[3].windMps);
      // Wall-clock labelling is unaffected by the clamp.
      expect(rows[0]).toMatchObject({ day: 11, hour: 12 });
    });

    it('flags an interior gap without shifting any offsets', () => {
      const g = grid('2026-08-11T17:00:00Z');
      // Drop the entry covering offset 5.
      const dropped = Date.parse('2026-08-11T22:00:00Z');
      g.temperature = {
        values: (g.temperature?.values ?? []).filter(
          (v) => Date.parse(v.validTime.split('/')[0]) !== dropped
        )
      };
      const { rows, estimatedLeadingHours } = buildForecastRows(g, start, CHICAGO);
      expect(estimatedLeadingHours).toBe(0); // a gap is not a leading clamp
      expect(rows[5].estimated).toBe(true);
      expect(rows[5].airTempC).toBe(rows[4].airTempC); // held from the hour before
      expect(rows[4].estimated).toBe(false);
      expect(rows[6].estimated).toBe(false);
      expect(rows).toHaveLength(72);
    });
  });

  it('refuses a window that runs past the end of the grid', () => {
    const g = grid('2026-08-11T17:00:00Z', 48); // only 48 h available
    expect(() => buildForecastRows(g, start, CHICAGO)).toThrow(NwsError);
    expect(() => buildForecastRows(g, start, CHICAGO)).toThrow(/covers only through/);
  });

  it('refuses a payload with no temperature series', () => {
    const g = grid('2026-08-11T17:00:00Z');
    delete g.temperature;
    expect(() => buildForecastRows(g, start, CHICAGO)).toThrow(/no temperature series/);
  });
});
