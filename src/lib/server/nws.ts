/**
 * NOAA / National Weather Service gridded forecast — network layer.
 *
 * Two hops against api.weather.gov:
 *   1. `/points/{lat},{lon}`  → the grid cell for the site, plus its IANA
 *      timezone (needed to resolve the user's wall-clock start to an instant).
 *   2. `/gridpoints/{wfo}/{x},{y}` → the raw forecast series.
 *
 * Parsing lives in `nws-parse.ts`; this module only fetches, caches and
 * assembles metadata.
 */

import { env } from '$env/dynamic/private';
import { isForecastEligibleInZone, zonedToUtcMs } from '$lib/utils/time';
import {
  buildForecastRows,
  FORECAST_HOURS,
  NwsError,
  type ForecastRow,
  type GridpointProps
} from './nws-parse';

export { FORECAST_HOURS, NwsError };
export type { ForecastRow };

/**
 * Contact string sent to api.weather.gov. NWS asks for a real point of contact
 * and may throttle generic agents. Change it here, or override without a code
 * change by setting `NWS_USER_AGENT` in the environment.
 */
export const DEFAULT_CONTACT = 'aamirkhanian@ua.edu';
export const DEFAULT_USER_AGENT = `(PCAST Pavement Cracking Tool, ${DEFAULT_CONTACT})`;

export const userAgent = () => env.NWS_USER_AGENT || DEFAULT_USER_AGENT;

const NWS_BASE = 'https://api.weather.gov';
const REQUEST_TIMEOUT_MS = 8_000;

export type ForecastMeta = {
  gridId: string;
  gridX: number;
  gridY: number;
  timeZone: string;
  /** ISO timestamp of the forecast issuance. */
  updateTime: string | null;
  elevationM: number | null;
  latitude: number;
  longitude: number;
  /** Requested start instant, ISO. */
  requestedStart: string;
  /** First hour actually covered by the forecast, ISO. */
  forecastStart: string;
  /** How many leading rows were clamped to the first available forecast hour. */
  estimatedLeadingHours: number;
  sourceUrls: { points: string; gridpoint: string };
};

export type ForecastResult = { meta: ForecastMeta; rows: ForecastRow[] };

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

type CacheEntry<T> = { value: T; expiresAt: number };
const pointsCache = new Map<string, CacheEntry<PointsInfo>>();
const gridCache = new Map<string, CacheEntry<GridpointProps>>();

const POINTS_TTL_MS = 24 * 60 * 60 * 1000; // grid mapping is stable
const GRID_TTL_MS = 10 * 60 * 1000; // NWS reissues roughly hourly

function cacheGet<T>(cache: Map<string, CacheEntry<T>>, key: string, nowMs: number): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= nowMs) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function getJson(url: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': userAgent(), Accept: 'application/geo+json' },
      signal: controller.signal
    });
    if (res.status === 404) {
      throw new NwsError(
        'This location is outside the National Weather Service forecast grid.',
        404,
        'out_of_coverage'
      );
    }
    if (!res.ok) {
      throw new NwsError(`NWS request failed (${res.status}).`, 502, 'upstream');
    }
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof NwsError) throw err;
    const reason = err instanceof Error ? err.message : String(err);
    throw new NwsError(`Could not reach the NWS API: ${reason}`, 502, 'upstream');
  } finally {
    clearTimeout(timer);
  }
}

/** One retry, since NWS 5xx responses are frequently transient. */
async function getJsonWithRetry(url: string): Promise<Record<string, unknown>> {
  try {
    return await getJson(url);
  } catch (err) {
    if (err instanceof NwsError && err.code === 'out_of_coverage') throw err;
    return await getJson(url);
  }
}

type PointsInfo = {
  gridpointUrl: string;
  gridId: string;
  gridX: number;
  gridY: number;
  timeZone: string;
  pointsUrl: string;
};

async function resolvePoint(lat: number, lon: number, nowMs: number): Promise<PointsInfo> {
  // NWS rejects more than 4 decimals, and rounding widens the cache hit rate.
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = cacheGet(pointsCache, key, nowMs);
  if (cached) return cached;

  const pointsUrl = `${NWS_BASE}/points/${key}`;
  const json = await getJsonWithRetry(pointsUrl);
  const props = (json.properties ?? {}) as Record<string, unknown>;
  const gridpointUrl = props.forecastGridData as string | undefined;
  const timeZone = props.timeZone as string | undefined;
  if (!gridpointUrl || !timeZone) {
    throw new NwsError('NWS point lookup returned no forecast grid.', 502, 'incomplete');
  }

  const info: PointsInfo = {
    gridpointUrl,
    gridId: String(props.gridId ?? ''),
    gridX: Number(props.gridX ?? 0),
    gridY: Number(props.gridY ?? 0),
    timeZone,
    pointsUrl
  };
  pointsCache.set(key, { value: info, expiresAt: nowMs + POINTS_TTL_MS });
  return info;
}

/**
 * Fetch and assemble the 72-hour forecast for a site.
 *
 * @param dateISO   `yyyy-mm-dd` construction start date (site-local)
 * @param startHour 0–23 site-local wall-clock start hour
 */
export async function fetchForecast(
  lat: number,
  lon: number,
  dateISO: string,
  startHour: number,
  hours: number = FORECAST_HOURS,
  nowMs: number = Date.now()
): Promise<ForecastResult> {
  const point = await resolvePoint(lat, lon, nowMs);

  // "Today or tomorrow" is only meaningful at the site, so the window is judged
  // here rather than in the route handler: the server's own clock is normally
  // UTC and would reject the user's today for most of a US evening. The /points
  // hop above is what makes the site's zone known; it is cached for a day, so
  // this costs nothing on the common path.
  if (!isForecastEligibleInZone(dateISO, point.timeZone, nowMs)) {
    throw new NwsError(
      'The hourly forecast is only available for a start date of today or tomorrow ' +
        'at the project site.',
      400,
      'ineligible_date'
    );
  }

  // The start instant can only be resolved once the site's timezone is known —
  // the date and hour the user entered are wall-clock at the *site*, not at the
  // browser or the server.
  const startMs = zonedToUtcMs(dateISO, startHour, point.timeZone);

  let props = cacheGet(gridCache, point.gridpointUrl, nowMs);
  if (!props) {
    const json = await getJsonWithRetry(point.gridpointUrl);
    props = (json.properties ?? {}) as GridpointProps;
    gridCache.set(point.gridpointUrl, { value: props, expiresAt: nowMs + GRID_TTL_MS });
  }

  const { rows, firstAvailableMs, estimatedLeadingHours } = buildForecastRows(
    props,
    startMs,
    point.timeZone,
    hours
  );

  return {
    meta: {
      gridId: point.gridId,
      gridX: point.gridX,
      gridY: point.gridY,
      timeZone: point.timeZone,
      updateTime: props.updateTime ?? null,
      elevationM: props.elevation?.value ?? null,
      latitude: lat,
      longitude: lon,
      requestedStart: new Date(startMs).toISOString(),
      forecastStart: new Date(Math.max(startMs, firstAvailableMs)).toISOString(),
      estimatedLeadingHours,
      sourceUrls: { points: point.pointsUrl, gridpoint: point.gridpointUrl }
    },
    rows
  };
}

/** Test seam — drops both caches. */
export function __clearForecastCaches() {
  pointsCache.clear();
  gridCache.clear();
}
