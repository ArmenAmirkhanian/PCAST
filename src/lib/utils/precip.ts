/**
 * Rainfall detection for the live-forecast path.
 *
 * Why this exists: the illitherm thermal model has no rainfall term. It carries
 * air temperature, wind and sky cover, so it cannot see evaporative cooling from
 * a wetted surface, the latent-heat sink of standing water, or the drop in
 * incoming radiation under a rain shaft. Once precipitation begins the modelled
 * slab temperatures — and therefore every stress, creep and cracking result
 * derived from them — stop tracking reality.
 *
 * The tool cannot model that, so it labels it instead: these helpers turn the
 * NWS precipitation series into the hour spans the UI shades and warns about.
 * Climate normals carry no precipitation series at all, so nothing here fires
 * on the normals path.
 */

/**
 * Probability of precipitation (%) at or above which an hour is treated as wet.
 * 50 % is "more likely than not" — the point past which quoting a dry-weather
 * result without comment would be misleading.
 */
export const RAIN_PROB_PCT = 50;

/**
 * Quantitative precipitation (mm) above which an hour is treated as wet
 * regardless of probability.
 *
 * NWS quantises QPF to 0.254 mm (0.01 in) — that value is the smallest non-zero
 * amount the grid can report, and it shows up against probabilities as low as
 * 15 %. Anything at or below one tick is therefore a trace, not a forecast of
 * rain, so the bar sits above it: 0.5 mm means the grid expects at least two
 * ticks (0.02 in) of accumulation.
 */
export const RAIN_AMOUNT_MM = 0.5;

/** The precipitation fields a forecast hour carries; both null on normals rows. */
export type PrecipLike = {
  precipProbPct?: number | null;
  precipAmountMm?: number | null;
};

/**
 * Is this hour wet enough that the dry-weather thermal model no longer applies?
 *
 * Either signal alone is enough. They fail in opposite directions — a
 * high-probability drizzle carries almost no accumulation, and a low-probability
 * thunderstorm carries a lot — and under-flagging is the costlier error here,
 * since the whole point is to stop a user trusting a result they shouldn't.
 */
export function isRainHour(row: PrecipLike): boolean {
  const prob = row.precipProbPct;
  const amount = row.precipAmountMm;
  if (typeof prob === 'number' && Number.isFinite(prob) && prob >= RAIN_PROB_PCT) return true;
  if (typeof amount === 'number' && Number.isFinite(amount) && amount > RAIN_AMOUNT_MM) return true;
  return false;
}

/** A contiguous run of wet hours, in *model hours* (1 = placement hour). */
export type RainPeriod = {
  /** First model hour of the run. */
  startHour: number;
  /** Last model hour of the run (equal to `startHour` for a single wet hour). */
  endHour: number;
  /** Highest probability of precipitation across the run (%), null if none reported. */
  peakProbPct: number | null;
  /** Largest quantitative precipitation across the run (mm), null if none reported. */
  peakAmountMm: number | null;
};

/** A weather row as the form store holds it: an offset plus the precip fields. */
export type PrecipRow = PrecipLike & { offsetHr: number };

/**
 * Collapse wet hours into contiguous periods, expressed on the analysis charts'
 * "hour after placement" axis.
 *
 * The offset convention shifts by one: `offsetHr` 0 is the placement hour, which
 * the thermal and stress models both index as hour 1 (`results[i]` is hour
 * `i + 1`). So model hour = `offsetHr + 1`.
 *
 * Rows are sorted defensively — the store is built from an API response whose
 * ordering is not guaranteed — and a gap in `offsetHr` breaks the run, so a
 * dry hour between two showers is not shaded over.
 */
export function rainPeriods(rows: PrecipRow[]): RainPeriod[] {
  const wet = rows.filter(isRainHour).sort((a, b) => a.offsetHr - b.offsetHr);
  const periods: RainPeriod[] = [];

  for (const row of wet) {
    const hour = row.offsetHr + 1;
    const last = periods[periods.length - 1];
    if (last && hour === last.endHour + 1) {
      last.endHour = hour;
      last.peakProbPct = maxOrNull(last.peakProbPct, row.precipProbPct);
      last.peakAmountMm = maxOrNull(last.peakAmountMm, row.precipAmountMm);
    } else {
      periods.push({
        startHour: hour,
        endHour: hour,
        peakProbPct: maxOrNull(null, row.precipProbPct),
        peakAmountMm: maxOrNull(null, row.precipAmountMm)
      });
    }
  }

  return periods;
}

function maxOrNull(a: number | null, b: number | null | undefined): number | null {
  if (typeof b !== 'number' || !Number.isFinite(b)) return a;
  return a === null ? b : Math.max(a, b);
}

/**
 * The first model hour at which results become unreliable, i.e. the start of the
 * earliest wet period. Null when the window stays dry.
 *
 * Everything from here on is suspect, not just the wet hours themselves: the
 * thermal model integrates forward, so a temperature error introduced by the
 * first shower persists through every later hour.
 */
export function firstRainHour(periods: RainPeriod[]): number | null {
  return periods.length ? periods[0].startHour : null;
}

/** Total number of wet hours across all periods. */
export function rainHourCount(periods: RainPeriod[]): number {
  return periods.reduce((n, p) => n + (p.endHour - p.startHour + 1), 0);
}
