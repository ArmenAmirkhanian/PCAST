import { describe, it, expect } from 'vitest';
import { parseClockHour, sawCutModelHour } from '../time';

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
