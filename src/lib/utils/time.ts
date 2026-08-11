const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/**
 * Today's date as `yyyy-mm-dd` in the **browser's local** timezone.
 *
 * `new Date().toISOString().slice(0,10)` returns the *UTC* date, which for a
 * US user in the evening is already tomorrow. Anything that compares against
 * what the user thinks "today" means must use this instead.
 */
export function localTodayISO(now: Date = new Date()): string {
  return toLocalISODate(now);
}

/** Tomorrow's date as `yyyy-mm-dd` in the browser's local timezone. */
export function localTomorrowISO(now: Date = new Date()): string {
  return addDaysISO(toLocalISODate(now), 1);
}

function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Shift a `yyyy-mm-dd` calendar date by whole days.
 *
 * Calendar arithmetic, not `+ 86_400_000` on an instant: adding a fixed day of
 * milliseconds and re-reading the local date skips or repeats a date when the
 * shift crosses a DST transition late in the evening.
 */
export function addDaysISO(dateISO: string, days: number): string {
  const m = ISO_DATE_RE.exec(dateISO);
  if (!m) throw new Error(`Invalid date: ${dateISO}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * Whether a `yyyy-mm-dd` start date is close enough for the NOAA/NWS hourly
 * forecast to be meaningful. Hour-by-hour skill degrades quickly, so the live
 * forecast source is offered only for a start of today or tomorrow.
 *
 * Judged against the **browser's** clock, which makes this right for enabling
 * the UI and wrong as an authority: the window that actually matters is the one
 * at the project site. The server decides with `isForecastEligibleInZone`.
 */
export function isForecastEligible(dateISO: string, now: Date = new Date()): boolean {
  if (!dateISO) return false;
  return dateISO === localTodayISO(now) || dateISO === localTomorrowISO(now);
}

/** Today's date as `yyyy-mm-dd` as it reads in `timeZone`. */
export function zonedTodayISO(timeZone: string, nowMs: number = Date.now()): string {
  const p = utcMsToZonedParts(nowMs, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/**
 * Forecast eligibility judged at the **project site**, which is the only frame
 * in which "today or tomorrow" means anything.
 *
 * Neither the browser's timezone nor the server's is a usable authority: a
 * production server normally runs UTC, so from late afternoon onward in the US
 * its "today" is already the user's "tomorrow" and it rejects the very date the
 * UI just offered. The site's IANA zone comes back from the NWS `/points`
 * lookup, so this check runs once that hop has resolved.
 */
export function isForecastEligibleInZone(
  dateISO: string,
  timeZone: string,
  nowMs: number = Date.now()
): boolean {
  if (!dateISO) return false;
  const today = zonedTodayISO(timeZone, nowMs);
  return dateISO === today || dateISO === addDaysISO(today, 1);
}

/**
 * Coarse pre-network guard: is `dateISO` within `days` of the server's own
 * calendar date, in either direction?
 *
 * Lets the endpoint reject junk before spending an upstream request, without
 * re-introducing the timezone disagreement it used to have. No two timezones
 * are more than 26 hours apart, so at the default ±2 days this can never
 * reject a date that `isForecastEligibleInZone` would go on to accept.
 */
export function isPlausibleForecastDate(
  dateISO: string,
  days = 2,
  now: Date = new Date()
): boolean {
  const m = ISO_DATE_RE.exec(dateISO);
  if (!m) return false;
  const target = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const here = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.abs(target - here) <= days * MS_PER_DAY;
}

/** Wall-clock fields of an instant, rendered in an IANA timezone. */
export type ZonedParts = {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number; // 0–23
  minute: number;
  second: number;
};

const zonedFormatters = new Map<string, Intl.DateTimeFormat>();

function zonedFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = zonedFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23', // not hour12:false — that yields "24" for midnight
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    zonedFormatters.set(timeZone, fmt);
  }
  return fmt;
}

/** Break an epoch-millisecond instant into wall-clock fields in `timeZone`. */
export function utcMsToZonedParts(ms: number, timeZone: string): ZonedParts {
  const parts = zonedFormatter(timeZone).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second')
  };
}

/** Offset of `timeZone` from UTC at instant `ms`, in milliseconds (east positive). */
function zoneOffsetMs(ms: number, timeZone: string): number {
  const p = utcMsToZonedParts(ms, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms;
}

/**
 * Resolve a wall-clock date/hour in an IANA timezone to an epoch-millisecond
 * instant.
 *
 * Two passes: the first offset guess is taken at the naive UTC instant, the
 * second re-reads the offset at the corrected instant so DST transitions land
 * on the right side. Times that do not exist (the spring-forward gap) resolve
 * to the instant one hour before the jump; ambiguous times (the fall-back
 * repeat) resolve to the first occurrence. Both are deterministic, which is
 * what matters here — a placement scheduled inside a DST gap is pathological
 * either way.
 *
 * @param dateISO `yyyy-mm-dd`
 * @param hour    0–23 local wall-clock hour
 */
export function zonedToUtcMs(dateISO: string, hour: number, timeZone: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!m) throw new Error(`Invalid date: ${dateISO}`);
  const naive = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour);
  const firstPass = naive - zoneOffsetMs(naive, timeZone);
  return naive - zoneOffsetMs(firstPass, timeZone);
}

export { MS_PER_HOUR, MS_PER_DAY };

export function buildWholeHours(): {label: string; value: string}[] {
  return Array.from({ length: 24 }, (_, h) => {
    const label = new Date(0, 0, 0, h).toLocaleTimeString([], { hour: 'numeric' });
    const value = `${String(h).padStart(2, '0')}:00`;
    return { label, value };
  });
}

/**
 * Parse a 24-hour "HH:MM" clock string to its integer hour (0–23), or null
 * when missing/unparseable.
 */
export function parseClockHour(value: string): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : null;
}

/**
 * Map a saw-cut clock time to the stress-model hour index.
 *
 * The thermal/stress grid is 1-indexed with hour 1 = the placement instant
 * (`offset_hr = 0`, clock = placement time); model hour H is therefore
 * (H − 1) whole hours after placement. A saw-cut clock equal to or earlier than
 * the placement clock is taken to occur the following day — you cannot saw-cut
 * before the concrete is poured.
 *
 * @param sawCutClock   Expected saw-cut time, "HH:MM" (e.g. "17:00")
 * @param placementClock Concrete placement time, "HH:MM" (projectInfo.startHour)
 * @returns Model hour index at which the joint is created, or undefined when
 *          either time is missing/unparseable.
 */
export function sawCutModelHour(
  sawCutClock: string,
  placementClock: string,
): number | undefined {
  const c = parseClockHour(sawCutClock);
  const s = parseClockHour(placementClock);
  if (c === null || s === null) return undefined;
  let elapsed = (((c - s) % 24) + 24) % 24; // whole hours after placement, 0–23
  if (elapsed === 0) elapsed = 24;          // same clock as placement → next day
  return elapsed + 1;                       // hour index (hour 1 = placement)
}
