import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { fetchForecast, probeForecast, NwsError, __clearForecastCaches } from '../nws';

const HOUR = 3_600_000;
const LAT = 33.2098;
const LON = -87.5692;
const POINTS_URL = `https://api.weather.gov/points/${LAT.toFixed(4)},${LON.toFixed(4)}`;
const GRID_URL = 'https://api.weather.gov/gridpoints/BMX/32,69';

/** 23:00 CDT on 2026-08-11 — already the 12th in UTC. */
const US_EVENING = Date.parse('2026-08-12T04:00:00Z');

function series(startISO: string, hours: number, value: number) {
  const startMs = Date.parse(startISO);
  return {
    values: Array.from({ length: hours }, (_, i) => ({
      validTime: `${new Date(startMs + i * HOUR).toISOString()}/PT1H`,
      value
    }))
  };
}

/**
 * Stubs both hops and records the URLs requested. `gridStart`/`gridHours` set
 * how far ahead the fake office has issued data — the only thing availability
 * depends on.
 */
function stubNws(opts: { timeZone?: string; gridStart?: string; gridHours?: number } = {}) {
  const { timeZone = 'America/Chicago', gridStart = '2026-08-12T00:00:00Z', gridHours = 200 } = opts;
  const requested: string[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    requested.push(url);
    const body =
      url === POINTS_URL
        ? {
            properties: {
              forecastGridData: GRID_URL,
              timeZone,
              gridId: 'BMX',
              gridX: 32,
              gridY: 69
            }
          }
        : {
            properties: {
              updateTime: gridStart,
              elevation: { value: 71.0184 },
              temperature: series(gridStart, gridHours, 28),
              windSpeed: series(gridStart, gridHours, 18),
              skyCover: series(gridStart, gridHours, 40)
            }
          };
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return requested;
}

beforeEach(() => {
  __clearForecastCaches();
  vi.unstubAllGlobals();
});

describe('probeForecast', () => {
  it('reports full coverage when the issued grid spans the window', async () => {
    stubNws();
    const a = await probeForecast(LAT, LON, '2026-08-12', 9, 72, US_EVENING);
    expect(a.status).toBe('covered');
    expect(a.estimatedLeadingHours).toBe(0);
    expect(a.reason).toBeNull();
    expect(a.timeZone).toBe('America/Chicago');
    expect(a.coverageStart).toBe('2026-08-12T00:00:00.000Z');
  });

  // The window is judged on data, not on the calendar. The server's clock has
  // already rolled over to the 12th here; a Central-time placement on the 11th
  // is still offered, because the grid reaches over it.
  it("offers a start the server's own date has passed", async () => {
    stubNws({ gridStart: '2026-08-11T00:00:00Z' });
    const a = await probeForecast(LAT, LON, '2026-08-11', 9, 72, US_EVENING);
    expect(a.status).toBe('covered');
  });

  it('reports partial coverage when the start precedes the issued data', async () => {
    // Grid begins 2026-08-12T00:00Z; the placement is 09:00 CDT on the 11th.
    stubNws();
    const a = await probeForecast(LAT, LON, '2026-08-11', 9, 72, US_EVENING);
    expect(a.status).toBe('partial');
    expect(a.estimatedLeadingHours).toBe(10);
    expect(a.reason).toMatch(/already passed/);
  });

  // The heart of the change: a start four days out is offered when the office
  // has published that far, and withheld when it has not. Same date either way.
  it('follows the horizon rather than a fixed number of days', async () => {
    stubNws({ gridHours: 400 });
    expect((await probeForecast(LAT, LON, '2026-08-16', 9, 72, US_EVENING)).status).toBe('covered');

    __clearForecastCaches();
    stubNws({ gridHours: 72 });
    const tight = await probeForecast(LAT, LON, '2026-08-16', 9, 72, US_EVENING);
    expect(tight.status).toBe('unavailable');
    expect(tight.reason).toMatch(/hour\(s\) before/);
  });

  it('reports unavailable for a placement in the past', async () => {
    stubNws();
    const a = await probeForecast(LAT, LON, '2020-06-01', 9, 72, US_EVENING);
    expect(a.status).toBe('unavailable');
    expect(a.reason).toMatch(/before the current forecast begins/);
  });

  it('answers rather than throwing when the window cannot be served', async () => {
    stubNws({ gridHours: 24 });
    await expect(probeForecast(LAT, LON, '2026-08-12', 9, 72, US_EVENING)).resolves.toMatchObject({
      status: 'unavailable'
    });
  });

  // Why the tab can afford to probe on entry: the follow-up fetch is free.
  it('warms the caches so a following fetch issues no further requests', async () => {
    const requested = stubNws();
    await probeForecast(LAT, LON, '2026-08-12', 9, 72, US_EVENING);
    expect(requested).toEqual([POINTS_URL, GRID_URL]);

    requested.length = 0;
    const result = await fetchForecast(LAT, LON, '2026-08-12', 9, 72, US_EVENING);
    expect(result.rows).toHaveLength(72);
    expect(requested).toEqual([]);
  });

  it('surfaces an out-of-grid location as an NwsError for the route to translate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }) as unknown as Response)
    );
    await expect(probeForecast(LAT, LON, '2026-08-12', 9, 72, US_EVENING)).rejects.toMatchObject({
      name: 'NwsError',
      code: 'out_of_coverage'
    });
  });
});

describe('fetchForecast', () => {
  it('builds the window the probe said was covered', async () => {
    stubNws();
    const result = await fetchForecast(LAT, LON, '2026-08-12', 9, 72, US_EVENING);
    expect(result.rows).toHaveLength(72);
    expect(result.meta.requestedStart).toBe('2026-08-12T14:00:00.000Z');
    expect(result.meta.estimatedLeadingHours).toBe(0);
  });

  it('carries the leading clamp through on a partial window', async () => {
    stubNws();
    const result = await fetchForecast(LAT, LON, '2026-08-11', 9, 72, US_EVENING);
    expect(result.meta.estimatedLeadingHours).toBe(10);
    expect(result.rows.slice(0, 10).every((r) => r.estimated)).toBe(true);
    expect(result.rows[10].estimated).toBe(false);
  });

  it('refuses a window the issued forecast cannot span', async () => {
    stubNws({ gridHours: 24 });
    await expect(fetchForecast(LAT, LON, '2026-08-12', 9, 72, US_EVENING)).rejects.toBeInstanceOf(
      NwsError
    );
  });
});
