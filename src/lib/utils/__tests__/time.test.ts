import { describe, it, expect } from 'vitest';
import {
  addDaysISO,
  isForecastEligible,
  isForecastEligibleInZone,
  isPlausibleForecastDate,
  localTodayISO,
  localTomorrowISO,
  parseClockHour,
  sawCutModelHour,
  utcMsToZonedParts,
  zonedTodayISO,
  zonedToUtcMs
} from '../time';

const CHICAGO = 'America/Chicago';
const HONOLULU = 'Pacific/Honolulu'; // UTC−10, no DST
const AUCKLAND = 'Pacific/Auckland'; // UTC+12/+13

describe('localTodayISO / localTomorrowISO', () => {
  it('uses the local calendar date, not the UTC one', () => {
    // 2026-08-11T23:30 local. Whatever the runner's zone, the local date must
    // match the Date's own local fields rather than its UTC slice.
    const d = new Date(2026, 7, 11, 23, 30);
    expect(localTodayISO(d)).toBe('2026-08-11');
    expect(localTomorrowISO(d)).toBe('2026-08-12');
  });

  it('rolls month and year boundaries', () => {
    expect(localTomorrowISO(new Date(2026, 11, 31, 9, 0))).toBe('2027-01-01');
    expect(localTomorrowISO(new Date(2026, 0, 31, 9, 0))).toBe('2026-02-01');
  });
});

describe('isForecastEligible', () => {
  const now = new Date(2026, 7, 11, 14, 0);

  it('accepts today and tomorrow', () => {
    expect(isForecastEligible('2026-08-11', now)).toBe(true);
    expect(isForecastEligible('2026-08-12', now)).toBe(true);
  });

  it('rejects anything further out, and empty input', () => {
    expect(isForecastEligible('2026-08-13', now)).toBe(false);
    expect(isForecastEligible('2026-09-01', now)).toBe(false);
    expect(isForecastEligible('2026-08-10', now)).toBe(false);
    expect(isForecastEligible('', now)).toBe(false);
  });
});

describe('addDaysISO', () => {
  it('rolls month, year and leap-day boundaries', () => {
    expect(addDaysISO('2026-08-11', 1)).toBe('2026-08-12');
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('is unaffected by DST, unlike adding a fixed 24 hours', () => {
    // 2026-03-08 is the US spring-forward date; the local day is only 23h long.
    expect(addDaysISO('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDaysISO('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('rejects a malformed date', () => {
    expect(() => addDaysISO('08/11/2026', 1)).toThrow(/Invalid date/);
  });
});

describe('zonedTodayISO', () => {
  it('reads the calendar date at the site, not at the runner', () => {
    // 2026-08-12T04:00Z: already the 12th in UTC, still the 11th in the US.
    const ms = Date.parse('2026-08-12T04:00:00Z');
    expect(zonedTodayISO('UTC', ms)).toBe('2026-08-12');
    expect(zonedTodayISO(CHICAGO, ms)).toBe('2026-08-11');
    expect(zonedTodayISO(HONOLULU, ms)).toBe('2026-08-11');
    expect(zonedTodayISO(AUCKLAND, ms)).toBe('2026-08-12');
  });
});

describe('isForecastEligibleInZone', () => {
  // The regression this exists for: a UTC server judging a US placement in the
  // evening. The user's own "today" must stay eligible.
  const evening = Date.parse('2026-08-12T04:00:00Z'); // 23:00 CDT on the 11th

  it("accepts the site's today and tomorrow", () => {
    expect(isForecastEligibleInZone('2026-08-11', CHICAGO, evening)).toBe(true);
    expect(isForecastEligibleInZone('2026-08-12', CHICAGO, evening)).toBe(true);
  });

  it('rejects dates outside the window at the site', () => {
    expect(isForecastEligibleInZone('2026-08-13', CHICAGO, evening)).toBe(false);
    expect(isForecastEligibleInZone('2026-08-10', CHICAGO, evening)).toBe(false);
    expect(isForecastEligibleInZone('', CHICAGO, evening)).toBe(false);
  });

  it('disagrees with a UTC reading of the same instant', () => {
    // Exactly the live-site bug: eligible at the site, ineligible in UTC.
    expect(isForecastEligibleInZone('2026-08-11', CHICAGO, evening)).toBe(true);
    expect(isForecastEligibleInZone('2026-08-11', 'UTC', evening)).toBe(false);
  });

  it('rolls the window across a year boundary at the site', () => {
    const ms = Date.parse('2027-01-01T04:00:00Z'); // 22:00 CST on 2026-12-31
    expect(isForecastEligibleInZone('2026-12-31', CHICAGO, ms)).toBe(true);
    expect(isForecastEligibleInZone('2027-01-01', CHICAGO, ms)).toBe(true);
    expect(isForecastEligibleInZone('2027-01-02', CHICAGO, ms)).toBe(false);
  });
});

describe('isPlausibleForecastDate', () => {
  const now = new Date(2026, 7, 11, 14, 0);

  it('admits everything the site-timezone check could accept', () => {
    // Max spread between any two zones is 26h, so the site's today/tomorrow is
    // always within one day of the server's today. ±2 days covers it with room.
    for (const d of ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13']) {
      expect(isPlausibleForecastDate(d, 2, now)).toBe(true);
    }
  });

  it('rejects dates no timezone could bring into the window', () => {
    expect(isPlausibleForecastDate('2026-08-14', 2, now)).toBe(false);
    expect(isPlausibleForecastDate('2026-08-08', 2, now)).toBe(false);
    expect(isPlausibleForecastDate('2027-08-11', 2, now)).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isPlausibleForecastDate('', 2, now)).toBe(false);
    expect(isPlausibleForecastDate('08/11/2026', 2, now)).toBe(false);
  });
});

describe('zonedToUtcMs', () => {
  it('resolves a wall-clock hour against the site timezone', () => {
    // CDT (UTC−5) in August.
    expect(zonedToUtcMs('2026-08-11', 12, CHICAGO)).toBe(Date.parse('2026-08-11T17:00:00Z'));
    // CST (UTC−6) in December.
    expect(zonedToUtcMs('2026-12-31', 12, CHICAGO)).toBe(Date.parse('2026-12-31T18:00:00Z'));
    expect(zonedToUtcMs('2026-08-11', 0, CHICAGO)).toBe(Date.parse('2026-08-11T05:00:00Z'));
  });

  it('lands on the right side of both DST transitions', () => {
    // Spring forward 2026-03-08: 01:00 is CST, 03:00 is CDT.
    expect(zonedToUtcMs('2026-03-08', 1, CHICAGO)).toBe(Date.parse('2026-03-08T07:00:00Z'));
    expect(zonedToUtcMs('2026-03-08', 3, CHICAGO)).toBe(Date.parse('2026-03-08T08:00:00Z'));
    // Fall back 2026-11-01: 00:00 is CDT, 02:00 is CST.
    expect(zonedToUtcMs('2026-11-01', 0, CHICAGO)).toBe(Date.parse('2026-11-01T05:00:00Z'));
    expect(zonedToUtcMs('2026-11-01', 2, CHICAGO)).toBe(Date.parse('2026-11-01T08:00:00Z'));
  });

  it('resolves DST gap and repeat hours deterministically', () => {
    // 02:00 on 2026-03-08 does not exist locally → the hour before the jump.
    expect(zonedToUtcMs('2026-03-08', 2, CHICAGO)).toBe(Date.parse('2026-03-08T07:00:00Z'));
    // 01:00 on 2026-11-01 happens twice → the first (CDT) occurrence.
    expect(zonedToUtcMs('2026-11-01', 1, CHICAGO)).toBe(Date.parse('2026-11-01T06:00:00Z'));
  });

  it('round-trips through utcMsToZonedParts', () => {
    const ms = zonedToUtcMs('2026-08-11', 7, CHICAGO);
    expect(utcMsToZonedParts(ms, CHICAGO)).toMatchObject({
      year: 2026,
      month: 8,
      day: 11,
      hour: 7
    });
  });

  it('renders midnight as hour 0, not 24', () => {
    expect(utcMsToZonedParts(Date.parse('2026-08-11T05:00:00Z'), CHICAGO).hour).toBe(0);
  });

  it('rejects a malformed date', () => {
    expect(() => zonedToUtcMs('08/11/2026', 12, CHICAGO)).toThrow(/Invalid date/);
  });
});

describe('parseClockHour', () => {
  it('parses whole-hour clock strings', () => {
    expect(parseClockHour('00:00')).toBe(0);
    expect(parseClockHour('05:00')).toBe(5);
    expect(parseClockHour('17:00')).toBe(17);
    expect(parseClockHour('23:00')).toBe(23);
  });

  it('returns null for empty / malformed / out-of-range values', () => {
    expect(parseClockHour('')).toBeNull();
    expect(parseClockHour('abc')).toBeNull();
    expect(parseClockHour('24:00')).toBeNull();
    expect(parseClockHour('99:00')).toBeNull();
  });
});

describe('sawCutModelHour', () => {
  it('maps a same-day saw-cut to the elapsed-hour index (hour 1 = placement)', () => {
    // Placed 05:00, cut 17:00 → 12 h later → model hour 13.
    expect(sawCutModelHour('17:00', '05:00')).toBe(13);
    // Placed 06:00, cut 10:00 → 4 h later → model hour 5.
    expect(sawCutModelHour('10:00', '06:00')).toBe(5);
  });

  it('wraps past midnight (cut clock earlier than placement → next day)', () => {
    // Placed 22:00, cut 06:00 → 8 h later → model hour 9.
    expect(sawCutModelHour('06:00', '22:00')).toBe(9);
  });

  it('treats a saw-cut at the placement clock as the next day, not instant', () => {
    // Same clock → 24 h later → model hour 25 (you cannot cut fresh concrete).
    expect(sawCutModelHour('05:00', '05:00')).toBe(25);
  });

  it('returns undefined when either time is missing/unparseable', () => {
    expect(sawCutModelHour('', '05:00')).toBeUndefined();
    expect(sawCutModelHour('17:00', '')).toBeUndefined();
    expect(sawCutModelHour('nope', '05:00')).toBeUndefined();
  });
});
