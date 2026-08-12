/**
 * PCAST version and calculation provenance — the single source of truth.
 *
 * A report leaves the building and gets filed. Years later someone has to be
 * able to answer "which calculations produced this number, and when did they
 * become the calculations?" — so every version string shown on screen or
 * printed in a PDF is read from this file and nowhere else.
 *
 * ---------------------------------------------------------------------------
 * HOW TO BUMP A VERSION
 * ---------------------------------------------------------------------------
 * 1. Did the change alter a computed result — a formula, a coefficient, a
 *    default, an integration scheme, a convergence criterion, a unit
 *    conversion in the numerics? If not, only APP_VERSION moves (step 5).
 *
 * 2. Bump the `version` and `date` of every module in CALC_MODULES that
 *    changed. Use semver against the *numbers the module returns*:
 *      major — results change for essentially every project (new model,
 *              re-derived governing equation, changed sign convention)
 *      minor — results change for some projects, or a new capability is added
 *              (new cement system, new boundary condition, new output)
 *      patch — a bug fix that corrects results in a narrow case, or a change
 *              that cannot alter results at all (refactor, added test)
 *
 * 3. Bump CALC_VERSION to the largest step taken by any module in step 2, and
 *    set CALC_VERSION_DATE to today (ISO, yyyy-mm-dd).
 *
 * 4. Add a new entry at the TOP of CALC_CHANGELOG describing the change. This
 *    entry is what a reviewer reads to decide whether an old report is still
 *    valid, so write it for them and not for the next developer: say what
 *    changed about the answer, not what changed about the code.
 *
 * 5. Bump APP_VERSION for any release, and keep the `version` field in
 *    package.json equal to it.
 *
 * `src/lib/__tests__/version.test.ts` enforces the mechanical half of the
 * above (formats, ordering, package.json agreement, changelog completeness),
 * so a half-finished bump fails `npm run test` rather than shipping.
 */

/** Release version of the web application as a whole. Mirrors package.json. */
export const APP_VERSION = '1.0.0';

/**
 * Version of the design-calculation methodology — the number that makes a
 * printed report reproducible. Changes only when computed results can change.
 */
export const CALC_VERSION = '1.0.0';

/** ISO date (yyyy-mm-dd) on which CALC_VERSION took effect. */
export const CALC_VERSION_DATE = '2026-08-12';

// ---------------------------------------------------------------------------
// Calculation modules
// ---------------------------------------------------------------------------

export type CalcModuleId = 'maturity' | 'thermal' | 'stress';

export interface CalcModule {
  id: CalcModuleId;
  /** Name used in the report and on the About tab. */
  label: string;
  /** Semver of this module's results. */
  version: string;
  /** ISO date (yyyy-mm-dd) this module version took effect. */
  date: string;
  /** Where the methodology comes from, for the reader checking it. */
  basis: string;
  /** Path of the implementation, for the reader checking the code. */
  source: string;
}

/**
 * One entry per independently versioned calculation. A report cites the
 * modules it actually used, so a project that never ran the stress analysis is
 * not implicitly claiming a stress-model version.
 */
export const CALC_MODULES: Record<CalcModuleId, CalcModule> = {
  maturity: {
    id: 'maturity',
    label: 'Concrete Maturity & Early Strength',
    version: '1.0.0',
    date: '2026-08-12',
    basis:
      'Exponential hydration model (Schindler & Folliard) with cement-system coefficients, ' +
      'equivalent-age maturity, and ACI compressive-to-tensile strength development.',
    source: 'src/lib/models/hydration/concreteMaturity.ts'
  },
  thermal: {
    id: 'thermal',
    label: 'Thermal Gradient (ILLITHERM)',
    version: '1.0.0',
    date: '2026-08-12',
    basis:
      'One-dimensional finite-element heat transfer through the slab and supporting layers ' +
      'with a hydration heat source and a radiative/convective surface boundary, converted ' +
      'from the ILLITHERM procedure of the original spreadsheet methodology.',
    source: 'src/lib/models/illitherm/'
  },
  stress: {
    id: 'stress',
    label: 'Early-Age Stress & Creep',
    version: '1.0.0',
    date: '2026-08-12',
    basis:
      'Beam-on-elastic-foundation stress analysis with a creep-compliance pseudo-load ' +
      'transform, joint restraint, mode-I stress intensity, and an hour-by-hour cracking ' +
      'and saw-cut-timing check.',
    source: 'src/lib/models/stress/'
  }
};

/** Fixed display order: the order the analyses run and are reported in. */
export const CALC_MODULE_LIST: CalcModule[] = [
  CALC_MODULES.maturity,
  CALC_MODULES.thermal,
  CALC_MODULES.stress
];

// ---------------------------------------------------------------------------
// Changelog
// ---------------------------------------------------------------------------

export interface CalcChangelogEntry {
  version: string;
  /** ISO date (yyyy-mm-dd) the version took effect. */
  date: string;
  /** Modules whose results this entry moved. Empty for provenance-only releases. */
  modules: CalcModuleId[];
  /** One line, for the table on the About tab and in the report. */
  summary: string;
  /** What a reviewer needs to know to judge whether an older report still holds. */
  changes: string[];
}

/**
 * Newest first. CALC_CHANGELOG[0] must match CALC_VERSION / CALC_VERSION_DATE.
 */
export const CALC_CHANGELOG: CalcChangelogEntry[] = [
  {
    version: '1.0.0',
    date: '2026-08-12',
    modules: ['maturity', 'thermal', 'stress'],
    summary: 'First tracked version of the design calculations.',
    changes: [
      'Baseline for calculation versioning. All three analyses — maturity and early ' +
        'strength, thermal gradient, and early-age stress and creep — are recorded at ' +
        'version 1.0.0 as of this date.',
      'Reports generated before this date carry no calculation version. Their provenance ' +
        'can only be established from the repository history at github.com/ArmenAmirkhanian/PCAST ' +
        'and they should not be assumed to match current results.'
    ]
  }
];

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * 'yyyy-mm-dd' → '12 August 2026'. Built from the parts rather than parsed, so
 * a date never slips a day depending on the reader's timezone.
 */
export function formatVersionDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const monthName = new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    timeZone: 'UTC'
  });
  return `${day} ${monthName} ${year}`;
}

/** "Calculations v1.0.0 (12 August 2026)" — the short form used in footers. */
export const CALC_STAMP = `Calculations v${CALC_VERSION} (${formatVersionDate(CALC_VERSION_DATE)})`;

/** "PCAST v1.0.0 · Calculations v1.0.0 (12 August 2026)" — headers and covers. */
export const VERSION_STAMP = `PCAST v${APP_VERSION} · ${CALC_STAMP}`;

/** "Concrete Maturity & Early Strength v1.0.0 (12 August 2026)" — section tags. */
export function moduleStamp(id: CalcModuleId): string {
  const m = CALC_MODULES[id];
  return `${m.label} v${m.version} (${formatVersionDate(m.date)})`;
}
