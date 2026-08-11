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
 *
 * Precipitation is carried alongside but is *not* a model input — the thermal
 * model has no rainfall term. It is read so the analysis can tell the user
 * which hours its results stop being trustworthy in; see `$lib/utils/precip`.
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
  /** Probability of precipitation (%), null when the grid carries no series. */
  precipProbPct: number | null;
  /**
   * Quantitative precipitation (mm). NWS issues this as a multi-hour block
   * total, so every hour of a block reports that block's total — it is a
   * "precipitation is expected in this hour" signal, not an hourly rate.
   */
  precipAmountMm: number | null;
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
    readonly code:
      | 'out_of_coverage'
      | 'upstream'
      | 'incomplete'
      | 'bad_request'
      | 'ineligible_date'
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
  probabilityOfPrecipitation?: NwsSeries;
  quantitativePrecipitation?: NwsSeries;
};

/**
 * Whether the issued forecast reaches over the requested window.
 *
 * `covered`     — every hour comes from the forecast itself.
 * `partial`     — the start precedes the first issued hour, so `estimatedLeadingHours`
 *                 rows are held at the earliest issued value. Usable, but the
 *                 user should be told before choosing it.
 * `unavailable` — the window ends past the forecast horizon, or ends before the
 *                 forecast even begins (a past placement).
 */
export type CoverageStatus = 'covered' | 'partial' | 'unavailable';

export type ForecastCoverage = {
  status: CoverageStatus;
  /** First and last hours the forecast actually carries, epoch ms. */
  firstAvailableMs: number;
  lastAvailableMs: number;
  requestedStartMs: number;
  requestedEndMs: number;
  /** Leading rows that would be held at the earliest issued value. */
  estimatedLeadingHours: number;
  /** Why the window is not fully covered; null when it is. User-facing. */
  reason: string | null;
};

/** Hours in `ms`, rounded up — a partial hour still needs a row. */
const hoursBetween = (ms: number) => Math.ceil(ms / MS_PER_HOUR);

/**
 * Compare a requested window against what the issued forecast actually spans.
 *
 * Total by construction: this is the availability question the Environment tab
 * asks before offering the live source, so it answers rather than throws.
 * `buildForecastRows` is the one that refuses to build on an `unavailable`
 * verdict.
 *
 * There is no calendar rule here on purpose. "Can we model this window?" is a
 * question about the data NWS actually issued, which runs a few days out and
 * moves every hour — not about whether the date reads as today or tomorrow.
 */
export function assessCoverage(
  props: GridpointProps,
  startMs: number,
  hours: number = FORECAST_HOURS
): ForecastCoverage {
  const temp = expandSeries(props.temperature);
  const requestedEndMs = startMs + (hours - 1) * MS_PER_HOUR;

  if (!temp.size) {
    return {
      status: 'unavailable',
      firstAvailableMs: NaN,
      lastAvailableMs: NaN,
      requestedStartMs: startMs,
      requestedEndMs,
      estimatedLeadingHours: 0,
      reason: 'The forecast for this location carries no temperature series.'
    };
  }

  const keys = [...temp.keys()].sort((a, b) => a - b);
  const firstAvailableMs = keys[0];
  const lastAvailableMs = keys[keys.length - 1];
  const base = {
    firstAvailableMs,
    lastAvailableMs,
    requestedStartMs: startMs,
    requestedEndMs
  };

  if (requestedEndMs > lastAvailableMs) {
    const short = hoursBetween(requestedEndMs - lastAvailableMs);
    return {
      ...base,
      status: 'unavailable',
      estimatedLeadingHours: 0,
      reason:
        `The issued forecast ends ${short} hour(s) before this ${hours}-hour window does. ` +
        `NWS publishes only a few days ahead, so a start this far out is not yet forecast.`
    };
  }

  if (requestedEndMs < firstAvailableMs) {
    return {
      ...base,
      status: 'unavailable',
      estimatedLeadingHours: 0,
      reason:
        'This window ends before the current forecast begins. Live forecast data ' +
        'exists only from now forward; use climate normals for a past placement.'
    };
  }

  if (startMs < firstAvailableMs) {
    const estimatedLeadingHours = Math.min(hours, hoursBetween(firstAvailableMs - startMs));
    return {
      ...base,
      status: 'partial',
      estimatedLeadingHours,
      reason:
        `The start time has already passed. The first ${estimatedLeadingHours} hour(s) would ` +
        `be held at the earliest issued forecast value rather than forecast directly.`
    };
  }

  return { ...base, status: 'covered', estimatedLeadingHours: 0, reason: null };
}

/**
 * Turn a raw gridpoint payload into `hours` consecutive hourly rows starting at
 * `startMs`.
 *
 * Clamp-and-flag: a start earlier than the forecast's first hour is legal —
 * the leading rows hold the earliest forecast value and are marked
 * `estimated`. A window the forecast cannot span at all throws; `assessCoverage`
 * is the non-throwing form of the same question.
 */
export function buildForecastRows(
  props: GridpointProps,
  startMs: number,
  timeZone: string,
  hours: number = FORECAST_HOURS
): { rows: ForecastRow[]; firstAvailableMs: number; estimatedLeadingHours: number } {
  const coverage = assessCoverage(props, startMs, hours);
  if (coverage.status === 'unavailable') {
    throw new NwsError(coverage.reason ?? 'Forecast does not cover this window.', 502, 'incomplete');
  }

  const temp = expandSeries(props.temperature);
  const wind = expandSeries(props.windSpeed, kmhToMps);
  const sky = expandSeries(props.skyCover);
  const pop = expandSeries(props.probabilityOfPrecipitation);
  const qpf = expandSeries(props.quantitativePrecipitation);

  const tempKeys = [...temp.keys()].sort((a, b) => a - b);
  const windKeys = [...wind.keys()].sort((a, b) => a - b);
  const skyKeys = [...sky.keys()].sort((a, b) => a - b);
  const popKeys = [...pop.keys()].sort((a, b) => a - b);
  const qpfKeys = [...qpf.keys()].sort((a, b) => a - b);

  const { firstAvailableMs, estimatedLeadingHours } = coverage;
  const rows: ForecastRow[] = [];
  for (let i = 0; i < hours; i++) {
    const ms = startMs + i * MS_PER_HOUR;
    const t = sampleAt(temp, ms, tempKeys);
    const w = sampleAt(wind, ms, windKeys);
    const c = sampleAt(sky, ms, skyKeys);
    // Precipitation never drives `estimated` — that flag is about the inputs the
    // thermal model actually consumes (temperature and wind).
    const pp = sampleAt(pop, ms, popKeys);
    const qp = sampleAt(qpf, ms, qpfKeys);
    const estimated = !t.hit || !w.hit;
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
      precipProbPct: pp.value,
      precipAmountMm: qp.value,
      estimated
    });
  }

  return { rows, firstAvailableMs, estimatedLeadingHours };
}
