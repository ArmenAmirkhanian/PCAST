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
