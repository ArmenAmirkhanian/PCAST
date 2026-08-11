import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { fetchForecast, NwsError, __clearForecastCaches } from '../nws';

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

/** Stubs both hops, and records which URLs were actually requested. */
function stubNws(timeZone = 'America/Chicago') {
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
              updateTime: '2026-08-11T11:06:39+00:00',
              elevation: { value: 71.0184 },
              temperature: series('2026-08-11T00:00:00Z', 200, 28),
              windSpeed: series('2026-08-11T00:00:00Z', 200, 18),
              skyCover: series('2026-08-11T00:00:00Z', 200, 40)
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

describe('fetchForecast eligibility window', () => {
  // The live-site regression: the server clock is UTC and has already rolled
  // over to the 12th, but the placement is at a Central-time site where it is
  // still the 11th. The site's calendar is the one that decides.
  it("accepts the site's today even when UTC has moved on", async () => {
    stubNws();
    const result = await fetchForecast(LAT, LON, '2026-08-11', 9, 72, US_EVENING);
    expect(result.rows).toHaveLength(72);
    expect(result.meta.timeZone).toBe('America/Chicago');
    expect(result.meta.requestedStart).toBe('2026-08-11T14:00:00.000Z');
  });

  it("accepts the site's tomorrow", async () => {
    stubNws();
    const result = await fetchForecast(LAT, LON, '2026-08-12', 9, 72, US_EVENING);
    expect(result.rows).toHaveLength(72);
  });

  it('rejects a date beyond the window at the site', async () => {
    stubNws();
    await expect(fetchForecast(LAT, LON, '2026-08-13', 9, 72, US_EVENING)).rejects.toMatchObject({
      name: 'NwsError',
      code: 'ineligible_date',
      status: 400
    });
  });

  it('rejects before spending the gridpoint request', async () => {
    const requested = stubNws();
    await expect(fetchForecast(LAT, LON, '2026-08-13', 9, 72, US_EVENING)).rejects.toBeInstanceOf(
      NwsError
    );
    expect(requested).toEqual([POINTS_URL]);
  });

  // Same instant, a site on the other side of the dateline: there it really is
  // the 12th, so the 11th is yesterday and the 13th is tomorrow.
  it('shifts the window with the site, not with the server', async () => {
    stubNws('Pacific/Auckland');
    await expect(fetchForecast(LAT, LON, '2026-08-11', 9, 72, US_EVENING)).rejects.toMatchObject({
      code: 'ineligible_date'
    });

    __clearForecastCaches();
    stubNws('Pacific/Auckland');
    const result = await fetchForecast(LAT, LON, '2026-08-13', 9, 72, US_EVENING);
    expect(result.rows).toHaveLength(72);
  });
});
