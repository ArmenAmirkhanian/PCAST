/**
 * Pure parsing layer for the NOAA / National Weather Service gridded forecast.
 *
 * Deliberately free of `$env`, `fetch` and SvelteKit imports so it can be unit
 * tested directly against a captured payload. Network concerns live in
 * `nws.ts`.
 *
 * Why the *raw* `/gridpoints/{wfo}/{x},{y}` product and not `/forecast/hourly`:
 * the hourly product omits sky cover, and the illitherm radiation term needs
 * cloud fraction. The raw product carries temperature, wind speed and sky
 * cover together, at the cost of having to expand ISO-8601 interval notation
 * into whole hours.
 */

import { MS_PER_HOUR, utcMsToZonedParts } from '$lib/utils/time';

/** Number of hours the environment tab models. */
export const FORECAST_HOURS = 72;

/** One forecast hour, shaped to match `WeatherHourlyRow` in the form store. */
export type ForecastRow = {
  offsetHr: number;
  /** Site-local wall clock, matching the normals convention. */
  year: number;
  month: number;
  day: number;
  hour: number;
  airTempC: number | null;
  windMps: number | null;
  cloudPct: number | null;
  /**
   * True when the value was held over rather than read directly from the
   * forecast — either the requested start precedes the first forecast hour
   * (clamped) or the series has an interior gap.
   */
  estimated: boolean;
};

/** Upstream failure with a status we can map onto an HTTP response. */
export class NwsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: 'out_of_coverage' | 'upstream' | 'incomplete' | 'bad_request'
  ) {
    super(message);
    this.name = 'NwsError';
  }
}

// ---------------------------------------------------------------------------
// ISO-8601 interval parsing
// ---------------------------------------------------------------------------

const DURATION_RE = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?)?$/;

/**
 * Parse an ISO-8601 duration into whole hours, rounding up so a partial hour
 * still claims its slot.
 */
export function durationToHours(duration: string): number {
  const m = DURATION_RE.exec(duration);
  if (!m) throw new Error(`Unparseable ISO-8601 duration: ${duration}`);
  const [, w, d, h, min, s] = m;
  const minutes =
    Number(w ?? 0) * 7 * 24 * 60 +
    Number(d ?? 0) * 24 * 60 +
    Number(h ?? 0) * 60 +
    Number(min ?? 0) +
    Number(s ?? 0) / 60;
  return Math.max(1, Math.ceil(minutes / 60));
}

/** Split `"2026-08-11T18:00:00+00:00/PT3H"` into a start instant and a span. */
export function parseValidTime(validTime: string): { startMs: number; hours: number } {
  const slash = validTime.lastIndexOf('/');
  if (slash < 0) throw new Error(`Unparseable validTime: ${validTime}`);
  const startMs = Date.parse(validTime.slice(0, slash));
  if (Number.isNaN(startMs)) throw new Error(`Unparseable validTime start: ${validTime}`);
  return { startMs, hours: durationToHours(validTime.slice(slash + 1)) };
}

export type NwsSeries = { values?: { validTime: string; value: number | null }[] } | undefined;

/**
 * Flatten one gridpoint series into a lookup of hour-start epoch ms → value.
 * `convert` maps the upstream unit onto ours; it is skipped for nulls.
 */
export function expandSeries(
  series: NwsSeries,
  convert: (v: number) => number = (v) => v
): Map<number, number | null> {
  const out = new Map<number, number | null>();
  for (const entry of series?.values ?? []) {
    const { startMs, hours } = parseValidTime(entry.validTime);
    const value = entry.value === null || entry.value === undefined ? null : convert(entry.value);
    for (let k = 0; k < hours; k++) out.set(startMs + k * MS_PER_HOUR, value);
  }
  return out;
}

/** NWS reports wind speed in km/h; the thermal model wants m/s. */
export const kmhToMps = (v: number) => v / 3.6;

// ---------------------------------------------------------------------------
// Row assembly
// ---------------------------------------------------------------------------

/**
 * Look up `ms` in an expanded series, falling back to the nearest earlier
 * sample and then the nearest later one. `hit` is false whenever a fallback
 * was used, which is what drives the `estimated` flag on the row.
 */
function sampleAt(
  map: Map<number, number | null>,
  ms: number,
  sortedKeys: number[]
): { value: number | null; hit: boolean } {
  if (map.has(ms)) return { value: map.get(ms) ?? null, hit: true };
  let earlier: number | null = null;
  let later: number | null = null;
  for (const k of sortedKeys) {
    if (k < ms) earlier = k;
    else {
      later = k;
      break;
    }
  }
  const key = earlier ?? later;
  if (key === null) return { value: null, hit: false };
  return { value: map.get(key) ?? null, hit: false };
}

export type GridpointProps = {
  gridId?: string;
  gridX?: number | string;
  gridY?: number | string;
  updateTime?: string;
  elevation?: { value?: number | null };
  temperature?: NwsSeries;
  windSpeed?: NwsSeries;
  skyCover?: NwsSeries;
};

/**
 * Turn a raw gridpoint payload into `hours` consecutive hourly rows starting at
 * `startMs`.
 *
 * Clamp-and-flag: a start earlier than the forecast's first hour is legal —
 * the leading rows hold the earliest forecast value and are marked
 * `estimated`, and `estimatedLeadingHours` reports how many. A start beyond
 * the end of the grid is not recoverable and throws.
 */
export function buildForecastRows(
  props: GridpointProps,
  startMs: number,
  timeZone: string,
  hours: number = FORECAST_HOURS
): { rows: ForecastRow[]; firstAvailableMs: number; estimatedLeadingHours: number } {
  const temp = expandSeries(props.temperature);
  const wind = expandSeries(props.windSpeed, kmhToMps);
  const sky = expandSeries(props.skyCover);

  if (!temp.size) {
    throw new NwsError('Forecast contained no temperature series.', 502, 'incomplete');
  }

  const tempKeys = [...temp.keys()].sort((a, b) => a - b);
  const windKeys = [...wind.keys()].sort((a, b) => a - b);
  const skyKeys = [...sky.keys()].sort((a, b) => a - b);

  const firstAvailableMs = tempKeys[0];
  const lastAvailableMs = tempKeys[tempKeys.length - 1];
  const endMs = startMs + (hours - 1) * MS_PER_HOUR;
  if (endMs > lastAvailableMs) {
    throw new NwsError(
      `Forecast covers only through ${new Date(lastAvailableMs).toISOString()}, ` +
        `short of the ${hours}-hour window ending ${new Date(endMs).toISOString()}.`,
      502,
      'incomplete'
    );
  }

  let estimatedLeadingHours = 0;
  const rows: ForecastRow[] = [];
  for (let i = 0; i < hours; i++) {
    const ms = startMs + i * MS_PER_HOUR;
    const t = sampleAt(temp, ms, tempKeys);
    const w = sampleAt(wind, ms, windKeys);
    const c = sampleAt(sky, ms, skyKeys);
    const estimated = !t.hit || !w.hit;
    if (estimated && ms < firstAvailableMs) estimatedLeadingHours++;
    const p = utcMsToZonedParts(ms, timeZone);
    rows.push({
      offsetHr: i,
      year: p.year,
      month: p.month,
      day: p.day,
      hour: p.hour,
      airTempC: t.value,
      windMps: w.value,
      cloudPct: c.value,
      estimated
    });
  }

  return { rows, firstAvailableMs, estimatedLeadingHours };
}
