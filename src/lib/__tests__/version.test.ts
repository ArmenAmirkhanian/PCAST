/**
 * Guardrails for the version metadata in $lib/version.ts.
 *
 * These do not test behaviour — they test that a version bump was finished.
 * The failure mode this file exists to prevent is a calculation change that
 * ships with a stale version number, because a report stamped with the wrong
 * methodology version is worse than one stamped with none.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  APP_VERSION,
  CALC_VERSION,
  CALC_VERSION_DATE,
  CALC_MODULES,
  CALC_MODULE_LIST,
  CALC_CHANGELOG,
  CALC_STAMP,
  VERSION_STAMP,
  formatVersionDate,
  moduleStamp,
  type CalcModuleId
} from '../version';

const SEMVER = /^\d+\.\d+\.\d+$/;
const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Semver compare: negative when a < b. */
function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

describe('version metadata', () => {
  it('uses semver everywhere', () => {
    expect(APP_VERSION).toMatch(SEMVER);
    expect(CALC_VERSION).toMatch(SEMVER);
    for (const m of CALC_MODULE_LIST) expect(m.version, m.id).toMatch(SEMVER);
    for (const e of CALC_CHANGELOG) expect(e.version, e.version).toMatch(SEMVER);
  });

  it('uses ISO dates everywhere', () => {
    expect(CALC_VERSION_DATE).toMatch(ISO_DATE);
    for (const m of CALC_MODULE_LIST) expect(m.date, m.id).toMatch(ISO_DATE);
    for (const e of CALC_CHANGELOG) expect(e.date, e.version).toMatch(ISO_DATE);
  });

  it('keeps APP_VERSION and package.json in step', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
    expect(pkg.version).toBe(APP_VERSION);
  });

  it('exposes every module in the registry through the display list', () => {
    const ids = Object.keys(CALC_MODULES) as CalcModuleId[];
    expect(CALC_MODULE_LIST.map((m) => m.id).sort()).toEqual([...ids].sort());
    for (const id of ids) expect(CALC_MODULES[id].id).toBe(id);
  });

  it('names a source path for every module', () => {
    for (const m of CALC_MODULE_LIST) {
      expect(m.source, m.id).toMatch(/^src\/lib\/models\//);
      expect(m.label.length, m.id).toBeGreaterThan(0);
      expect(m.basis.length, m.id).toBeGreaterThan(0);
    }
  });
});

describe('calculation changelog', () => {
  it('is not empty and is ordered newest first', () => {
    expect(CALC_CHANGELOG.length).toBeGreaterThan(0);
    for (let i = 1; i < CALC_CHANGELOG.length; i += 1) {
      const newer = CALC_CHANGELOG[i - 1];
      const older = CALC_CHANGELOG[i];
      expect(cmpVersion(newer.version, older.version), `${newer.version} after ${older.version}`)
        .toBeGreaterThan(0);
      expect(newer.date >= older.date, `${newer.version} dated before ${older.version}`).toBe(true);
    }
  });

  it('has no duplicate versions', () => {
    const versions = CALC_CHANGELOG.map((e) => e.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('leads with the current calculation version and date', () => {
    expect(CALC_CHANGELOG[0].version).toBe(CALC_VERSION);
    expect(CALC_CHANGELOG[0].date).toBe(CALC_VERSION_DATE);
  });

  it('describes every entry', () => {
    for (const e of CALC_CHANGELOG) {
      expect(e.summary.length, e.version).toBeGreaterThan(0);
      expect(e.changes.length, e.version).toBeGreaterThan(0);
      for (const id of e.modules) expect(CALC_MODULES[id], `${e.version} → ${id}`).toBeDefined();
    }
  });

  it('records a changelog entry for every module version in use', () => {
    for (const m of CALC_MODULE_LIST) {
      const entry = CALC_CHANGELOG.find(
        (e) => e.version === m.version || e.modules.includes(m.id)
      );
      expect(entry, `${m.id} v${m.version} has no changelog entry`).toBeDefined();
    }
  });
});

describe('version consistency', () => {
  it('never lets a module lead the overall calculation version', () => {
    for (const m of CALC_MODULE_LIST) {
      expect(
        cmpVersion(m.version, CALC_VERSION),
        `${m.id} v${m.version} is ahead of CALC_VERSION ${CALC_VERSION}`
      ).toBeLessThanOrEqual(0);
      expect(m.date <= CALC_VERSION_DATE, `${m.id} dated after CALC_VERSION_DATE`).toBe(true);
    }
  });

  it('bumps CALC_VERSION with the modules it covers', () => {
    // The current calculation version must be justified by at least one module
    // sitting at it, otherwise CALC_VERSION moved without any module moving.
    const latest = CALC_MODULE_LIST.map((m) => m.version).sort(cmpVersion).at(-1)!;
    expect(latest).toBe(CALC_VERSION);
  });
});

describe('display helpers', () => {
  it('formats dates without timezone drift', () => {
    expect(formatVersionDate('2026-08-12')).toBe('12 August 2026');
    expect(formatVersionDate('2026-01-01')).toBe('1 January 2026');
    expect(formatVersionDate('2026-12-31')).toBe('31 December 2026');
  });

  it('stamps carry the numbers a reader needs', () => {
    expect(CALC_STAMP).toContain(CALC_VERSION);
    expect(CALC_STAMP).toContain(formatVersionDate(CALC_VERSION_DATE));
    expect(VERSION_STAMP).toContain(APP_VERSION);
    expect(VERSION_STAMP).toContain(CALC_STAMP);

    const stamp = moduleStamp('stress');
    expect(stamp).toContain(CALC_MODULES.stress.label);
    expect(stamp).toContain(CALC_MODULES.stress.version);
  });
});
