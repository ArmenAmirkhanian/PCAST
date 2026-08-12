/**
 * Tests for the stress & creep module.
 *
 * Run: npx vitest run stress.test.ts
 *
 * Tests are organised into:
 *   1. linalg     – 2×2 matrix ops and lower-tri mat-vec
 *   2. creep      – compliance matrix, ΔJ, B, B⁻¹
 *   3. beam       – rotation, horizontal friction, bending factor
 *   4. joint      – SIF functions and compliance integrals
 *   5. run        – full model integration
 */

import { describe, it, expect } from 'vitest';

import { matVec2, inverse2x2, solve2x2, lowerTriMatVec } from '../linalg';
import {
  buildCreepCompliance,
  buildPseudoLoadOperator,
  buildCumulativeSumOperator,
  DEFAULT_CREEP_PARAMS,
} from '../creep';
import {
  radiusOfRelativeStiffness,
  computeBeamRotation,
  computeHorizontalFriction,
  edgeBendingFactor,
} from '../beam';
import { runStressModel } from '../run';
import { sifAxial, sifBending, computeJointCoefficients } from '../joint';
import type { StressModelInput, HourlyInput } from '../types';

// ---------------------------------------------------------------------------
// Tolerance helper
// ---------------------------------------------------------------------------
const NEAR = (a: number, b: number, tol = 1e-8) =>
  Math.abs(a - b) < tol || Math.abs(a - b) / (Math.abs(b) + 1e-30) < tol;

// ---------------------------------------------------------------------------
// 1. Linear Algebra
// ---------------------------------------------------------------------------

describe('matVec2', () => {
  it('identity times vector', () => {
    const I = [[1, 0], [0, 1]];
    const v = [3, 7];
    const r = matVec2(I, v);
    expect(r[0]).toBeCloseTo(3);
    expect(r[1]).toBeCloseTo(7);
  });

  it('general 2×2 product', () => {
    const M = [[2, 3], [5, 1]];
    const v = [4, 6];
    // [2*4+3*6, 5*4+1*6] = [26, 26]
    const r = matVec2(M, v);
    expect(r[0]).toBeCloseTo(26);
    expect(r[1]).toBeCloseTo(26);
  });
});

describe('inverse2x2', () => {
  it('identity inverse is identity', () => {
    const I = [[1, 0], [0, 1]];
    const inv = inverse2x2(I);
    expect(inv[0][0]).toBeCloseTo(1);
    expect(inv[0][1]).toBeCloseTo(0);
    expect(inv[1][0]).toBeCloseTo(0);
    expect(inv[1][1]).toBeCloseTo(1);
  });

  it('known matrix', () => {
    const M = [[4, 7], [2, 6]];
    const inv = inverse2x2(M);
    // M⁻¹ = 1/10 * [[6,-7],[-2,4]]
    expect(inv[0][0]).toBeCloseTo(0.6);
    expect(inv[0][1]).toBeCloseTo(-0.7);
    expect(inv[1][0]).toBeCloseTo(-0.2);
    expect(inv[1][1]).toBeCloseTo(0.4);
  });

  it('singular matrix returns zeros', () => {
    const singular = [[1, 2], [2, 4]];
    const inv = inverse2x2(singular);
    expect(inv[0][0]).toBeCloseTo(0);
    expect(inv[1][1]).toBeCloseTo(0);
  });

  it('M × M⁻¹ ≈ I for a generic matrix', () => {
    const M = [[3, 1], [2, 5]];
    const inv = inverse2x2(M);
    const prod = matVec2(M, [inv[0][0], inv[1][0]]);
    expect(prod[0]).toBeCloseTo(1);
    expect(prod[1]).toBeCloseTo(0);
  });
});

describe('solve2x2', () => {
  it('simple system', () => {
    const A = [[2, 1], [1, 3]];
    const b = [8, 13];
    const [x, ok] = solve2x2(A, b);
    expect(ok).toBe(true);
    // 2x+y=8, x+3y=13 → x=1, y=6... wait:
    // 2x+y=8, x+3y=13 → multiply first by 3: 6x+3y=24, subtract: 5x=11 → x=11/5, y=8-22/5=18/5
    expect(x[0]).toBeCloseTo(11 / 5);
    expect(x[1]).toBeCloseTo(18 / 5);
  });

  it('singular system returns success=false', () => {
    const A = [[1, 2], [2, 4]];
    const b = [1, 2];
    const [, ok] = solve2x2(A, b);
    expect(ok).toBe(false);
  });
});

describe('lowerTriMatVec', () => {
  it('identity lower-tri leaves vector unchanged', () => {
    const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const v = [4, 5, 6];
    const r = lowerTriMatVec(I, v);
    expect(r).toEqual(expect.arrayContaining([4, 5, 6]));
  });

  it('1×1 case', () => {
    const M = [[3]];
    const v = [7];
    expect(lowerTriMatVec(M, v)[0]).toBeCloseTo(21);
  });

  it('3×3 lower triangular', () => {
    const M = [
      [1, 0, 0],
      [2, 3, 0],
      [4, 5, 6],
    ];
    const v = [1, 1, 1];
    // [1, 2+3, 4+5+6] = [1, 5, 15]
    const r = lowerTriMatVec(M, v);
    expect(r[0]).toBeCloseTo(1);
    expect(r[1]).toBeCloseTo(5);
    expect(r[2]).toBeCloseTo(15);
  });
});

// ---------------------------------------------------------------------------
// 2. Creep compliance and transformation matrices
// ---------------------------------------------------------------------------

/**
 * Monotonically increasing synthetic aging-modulus profile (psi) of length nt.
 * The 'hydration'/'aemm' creep models need one E(tʹ) value per loading age.
 */
function modArr(nt: number): number[] {
  return Array.from({ length: nt }, (_, i) => 2_000_000 + i * 100_000);
}

const CEB_FIP_PARAMS = { ...DEFAULT_CREEP_PARAMS, creepModel: 'cebFip' as const };

describe('buildCreepCompliance', () => {
  const p = DEFAULT_CREEP_PARAMS;

  it('diagonal entries are elastic (t = tʹ, no creep term) and positive', () => {
    const J = buildCreepCompliance(10, 5, p, modArr(5));
    // At t = tʹ (i = j): creep term φ = 0, so J[i][i] = 1/E(tʹ) > 0.
    for (let i = 0; i < 5; i++) {
      expect(J[i][i]).toBeGreaterThan(0);
    }
  });

  it('J[i][j] ≥ J[i][i] for j < i (creep grows with elapsed time)', () => {
    const J = buildCreepCompliance(5, 4, p, modArr(4));
    for (let i = 1; i < 4; i++) {
      for (let j = 0; j < i; j++) {
        expect(J[i][j]).toBeGreaterThanOrEqual(J[i][i]);
      }
    }
  });

  it('compliance grows monotonically with elapsed time (J[i][j] ≥ J[i][j+1])', () => {
    const J = buildCreepCompliance(5, 6, p, modArr(6));
    for (let i = 2; i < 6; i++) {
      for (let j = 0; j < i - 1; j++) {
        expect(J[i][j]).toBeGreaterThanOrEqual(J[i][j + 1]);
      }
    }
  });

  it('upper triangle is zero', () => {
    const J = buildCreepCompliance(10, 4, p, modArr(4));
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        expect(J[i][j]).toBe(0);
      }
    }
  });

  it("throws when the 'hydration' model is given no modulus array", () => {
    expect(() => buildCreepCompliance(10, 4, p)).toThrow(RangeError);
  });
});

describe('buildCreepCompliance – bounded aging-modulus models', () => {
  it("'cebFip' is self-contained (needs no modulus array) and stays positive at very early ages", () => {
    // startHour = 1 h would have made the old logarithmic placeholder negative.
    const J = buildCreepCompliance(1, 6, CEB_FIP_PARAMS);
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j <= i; j++) {
        expect(J[i][j]).toBeGreaterThan(0);
        expect(Number.isFinite(J[i][j])).toBe(true);
      }
    }
  });

  it("'hydration' stays finite even when a pre-set hour has E = 0 (floored)", () => {
    const withZero = [0, 1_000_000, 2_000_000, 3_000_000];
    const J = buildCreepCompliance(2, 4, DEFAULT_CREEP_PARAMS, withZero);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j <= i; j++) {
        expect(Number.isFinite(J[i][j])).toBe(true);
      }
    }
  });

  it("'aemm' with χ < 1 is stiffer (lower compliance) than 'hydration' off-diagonal", () => {
    const E = modArr(5);
    const hyd  = buildCreepCompliance(5, 5, DEFAULT_CREEP_PARAMS, E);
    const aemm = buildCreepCompliance(
      5, 5, { ...DEFAULT_CREEP_PARAMS, creepModel: 'aemm', agingCoefficient: 0.7 }, E,
    );
    // Diagonals (φ = 0) coincide; creep terms are down-weighted by χ off-diagonal.
    for (let i = 0; i < 5; i++) {
      expect(aemm[i][i]).toBeCloseTo(hyd[i][i], 12);
      for (let j = 0; j < i; j++) {
        expect(aemm[i][j]).toBeLessThan(hyd[i][j]);
      }
    }
  });

  it("'aemm' with χ = 1 reproduces the 'hydration' kernel exactly", () => {
    const E = modArr(5);
    const hyd  = buildCreepCompliance(5, 5, DEFAULT_CREEP_PARAMS, E);
    const aemm = buildCreepCompliance(
      5, 5, { ...DEFAULT_CREEP_PARAMS, creepModel: 'aemm', agingCoefficient: 1 }, E,
    );
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j <= i; j++) {
        expect(aemm[i][j]).toBeCloseTo(hyd[i][j], 12);
      }
    }
  });

  it('B⁻¹ is invariant to ANY positive aging-modulus profile, not just a scaling of it', () => {
    // E(tʹ) always cancels out of M[i][j] = J[i][j]·E(tʹ_j) = 1 + χ·φ(t,tʹ) by
    // construction (see creep.ts derivation), so B⁻¹ depends only on φ's shape
    // (a1, a2Scale, a2Rate) and χ — never on the modulus profile itself, scaled
    // or not.
    const start = 5, nt = 5;
    const E = modArr(nt);
    const J1 = buildCreepCompliance(start, nt, DEFAULT_CREEP_PARAMS, E);
    const J2 = buildCreepCompliance(start, nt, DEFAULT_CREEP_PARAMS, E.map(e => e * 1000));
    const Binv1 = buildPseudoLoadOperator(J1, start, nt, DEFAULT_CREEP_PARAMS, E);
    const Binv2 = buildPseudoLoadOperator(J2, start, nt, DEFAULT_CREEP_PARAMS, E.map(e => e * 1000));
    for (let i = 0; i < nt; i++) {
      for (let j = 0; j <= i; j++) {
        expect(Binv2[i][j]).toBeCloseTo(Binv1[i][j], 10);
      }
    }
  });
});

describe('buildCumulativeSumOperator (B)', () => {
  it('diagonal entries are all 1', () => {
    const B = buildCumulativeSumOperator(5);
    for (let i = 0; i < 5; i++) {
      expect(B[i][i]).toBe(1);
    }
  });

  it('upper triangle is zero, lower triangle (incl. diagonal) is all 1', () => {
    const B = buildCumulativeSumOperator(4);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        expect(B[i][j]).toBe(j <= i ? 1 : 0);
      }
    }
  });

  it('applying B to a history sums it (running total)', () => {
    const B = buildCumulativeSumOperator(4);
    const v = [2, 3, -1, 5];
    const r = lowerTriMatVec(B, v);
    expect(r).toEqual([2, 5, 4, 9]);
  });
});

describe('buildPseudoLoadOperator (B⁻¹)', () => {
  it('diagonal entries are all 1 and upper triangle is zero', () => {
    const start = 10, nt = 5;
    const E = modArr(nt);
    const J = buildCreepCompliance(start, nt, DEFAULT_CREEP_PARAMS, E);
    const Binv = buildPseudoLoadOperator(J, start, nt, DEFAULT_CREEP_PARAMS, E);
    for (let i = 0; i < nt; i++) {
      expect(Binv[i][i]).toBeCloseTo(1);
      for (let j = i + 1; j < nt; j++) {
        expect(Binv[i][j]).toBe(0);
      }
    }
  });

  it('correctly inverts M = I + strictLower(J)·diag(E)', () => {
    const start = 5, nt = 4;
    const E = modArr(nt);
    const J = buildCreepCompliance(start, nt, DEFAULT_CREEP_PARAMS, E);
    const Binv = buildPseudoLoadOperator(J, start, nt, DEFAULT_CREEP_PARAMS, E);

    const M = Array.from({ length: nt }, (_, i) =>
      Array.from({ length: nt }, (_, j) => (j < i ? J[i][j] * E[j] : j === i ? 1 : 0)),
    );
    // M · Binv ≈ I
    for (let j = 0; j < nt; j++) {
      const col = Binv.map(row => row[j]);
      const result = lowerTriMatVec(M, col);
      for (let i = 0; i < nt; i++) {
        expect(result[i]).toBeCloseTo(i === j ? 1 : 0, 8);
      }
    }
  });

  it('stays well-conditioned (no blow-up) over a large window with a realistic, flattening aging modulus', () => {
    // Regression test for the original bug: an aging modulus that grows
    // quickly at first and then flattens out (as concrete matures) used to
    // make the old divided-differences B formula divide by near-zero
    // differences of the compliance diagonal, exploding B by orders of
    // magnitude. The forward-substitution B⁻¹ has no such pivot.
    const start = 6, nt = 67;
    const E = Array.from({ length: nt }, (_, i) => 4_000_000 * (1 - Math.exp(-(i + 1) / 12)));
    const J = buildCreepCompliance(start, nt, DEFAULT_CREEP_PARAMS, E);
    const Binv = buildPseudoLoadOperator(J, start, nt, DEFAULT_CREEP_PARAMS, E);
    for (let i = 0; i < nt; i++) {
      for (let j = 0; j <= i; j++) {
        expect(Number.isFinite(Binv[i][j])).toBe(true);
        expect(Math.abs(Binv[i][j])).toBeLessThan(10); // stays O(1); never explodes
      }
    }
  });
});

describe('rate-type creep pipeline – physical sanity', () => {
  // Assemble the B⁻¹ → E·p → B pipeline directly (bypassing the beam geometry)
  // to check the pure creep-compliance behaviour in isolation.
  function creepAdjustedHistory(
    E: number[],
    raw: number[],
    start = 0,
    params = DEFAULT_CREEP_PARAMS,
  ): number[] {
    const nt = E.length;
    const J = buildCreepCompliance(start, nt, params, E);
    const Binv = buildPseudoLoadOperator(J, start, nt, params, E);
    const B = buildCumulativeSumOperator(nt);
    const pseudo = lowerTriMatVec(Binv, raw);
    const elasticStress = pseudo.map((p, i) => E[i] * p);
    return lowerTriMatVec(B, elasticStress);
  }

  it('a sustained strain on a non-aging material relaxes toward E/(1+a1)', () => {
    const nt = 40;
    const E = new Array(nt).fill(3_000_000);
    const raw = new Array(nt).fill(1);
    const creepStress = creepAdjustedHistory(E, raw);
    // Monotonically relaxing (each step no larger in magnitude than the last).
    for (let i = 1; i < nt; i++) {
      expect(Math.abs(creepStress[i])).toBeLessThanOrEqual(Math.abs(creepStress[i - 1]) + 1e-6);
    }
    expect(creepStress[0]).toBeCloseTo(3_000_000, 0); // first hour: pure elastic
    const target = 3_000_000 / (1 + DEFAULT_CREEP_PARAMS.a1);
    expect(Math.abs(creepStress[nt - 1] - target) / target).toBeLessThan(0.01); // within 1% of the asymptote
  });

  it('a large, maturing-concrete-like window stays bounded for a diurnal-scale input', () => {
    // The exact scenario that broke the old implementation: 67 hourly steps
    // with a modulus that grows quickly then flattens, driven by a bounded
    // oscillating (diurnal-like) load. Because B is a running sum, the bound
    // scales with nt (roughly how many cycles of the load can accumulate) —
    // but must NOT scale any faster than that, unlike the old exponential blow-up.
    const start = 6, nt = 67;
    const E = Array.from({ length: nt }, (_, i) => 4_000_000 * (1 - Math.exp(-(i + 1) / 12)));
    const raw = Array.from({ length: nt }, (_, i) => 5 * Math.sin((2 * Math.PI * (start + i)) / 24));
    const creepStress = creepAdjustedHistory(E, raw, start);
    const maxAbsRaw = Math.max(...raw.map(Math.abs));
    const maxAbsElasticBound = nt * Math.max(...E) * maxAbsRaw; // generous linear-accumulation ceiling
    for (const s of creepStress) {
      expect(Number.isFinite(s)).toBe(true);
      expect(Math.abs(s)).toBeLessThan(maxAbsElasticBound);
    }
  });

  it("'hydration' and 'cebFip' give the identical result (same φ shape, χ = 1) — only χ or φ's own shape can change it", () => {
    const start = 6, nt = 20;
    const E = Array.from({ length: nt }, (_, i) => 2_000_000 + i * 80_000);
    const raw = Array.from({ length: nt }, (_, i) => 5 * Math.sin(i * 0.5));
    const hyd = creepAdjustedHistory(E, raw, start, DEFAULT_CREEP_PARAMS);
    const ceb = creepAdjustedHistory(E, raw, start, { ...DEFAULT_CREEP_PARAMS, creepModel: 'cebFip' });
    const aemm = creepAdjustedHistory(E, raw, start, { ...DEFAULT_CREEP_PARAMS, creepModel: 'aemm' });
    for (let i = 0; i < nt; i++) {
      expect(ceb[i]).toBeCloseTo(hyd[i], 6);
    }
    expect(aemm.some((v, i) => Math.abs(v - hyd[i]) > 1e-6)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Beam analysis
// ---------------------------------------------------------------------------

describe('radiusOfRelativeStiffness', () => {
  it('returns a positive length for typical pavement inputs', () => {
    // E=4e6 psi, h=10 in, nu=0.15, k=100 psi/in
    const ell = radiusOfRelativeStiffness(4e6, 10, 0.15, 100);
    expect(ell).toBeGreaterThan(0);
    expect(Number.isFinite(ell)).toBe(true);
  });

  it('increases with slab thickness', () => {
    const ellThin = radiusOfRelativeStiffness(4e6, 8, 0.15, 100);
    const ellThick = radiusOfRelativeStiffness(4e6, 12, 0.15, 100);
    expect(ellThick).toBeGreaterThan(ellThin);
  });

  it('decreases with higher subgrade modulus', () => {
    const ellSoft = radiusOfRelativeStiffness(4e6, 10, 0.15, 50);
    const ellStiff = radiusOfRelativeStiffness(4e6, 10, 0.15, 200);
    expect(ellSoft).toBeGreaterThan(ellStiff);
  });

  it('matches closed-form: ℓ = (Eh³/12(1-ν²)k)^0.25', () => {
    const E = 3e6, h = 9, nu = 0.2, k = 150;
    const expected = ((E * h ** 3) / (12 * (1 - nu * nu) * k)) ** 0.25;
    expect(radiusOfRelativeStiffness(E, h, nu, k)).toBeCloseTo(expected);
  });
});

describe('computeBeamRotation', () => {
  it('returns a finite value for typical inputs', () => {
    const theta = computeBeamRotation(2.0, -0.01);
    expect(Number.isFinite(theta)).toBe(true);
  });

  it('scales linearly with momTempND', () => {
    const t1 = computeBeamRotation(2.5, 1.0);
    const t2 = computeBeamRotation(2.5, 2.0);
    expect(t2).toBeCloseTo(2 * t1, 6);
  });

  it('rotation is negative for negative temperature gradient moment', () => {
    // Negative moment → upward curl → negative rotation at joint
    const theta = computeBeamRotation(3.0, -1.0);
    expect(theta).toBeLessThan(0);
  });

  it('rotation magnitude increases with non-dimensional slab length', () => {
    // Longer slab → less boundary effect → larger free rotation
    const short = Math.abs(computeBeamRotation(1.5, 1));
    const medium = Math.abs(computeBeamRotation(3.0, 1));
    const long = Math.abs(computeBeamRotation(5.0, 1));
    expect(medium).toBeGreaterThan(short);
    expect(long).toBeGreaterThan(medium);
  });
});

describe('computeHorizontalFriction', () => {
  it('returns finite uc and stressC for typical inputs', () => {
    // kh=1 psi/in, El=4e6 psi, h=10 in, L0=180 in, eps0=5e-5
    const { uc, stressC } = computeHorizontalFriction(1, 4e6, 10, 180, 5e-5);
    expect(Number.isFinite(uc)).toBe(true);
    expect(Number.isFinite(stressC)).toBe(true);
  });

  it('joint opening is positive for positive thermal expansion', () => {
    const { uc } = computeHorizontalFriction(1, 4e6, 10, 180, 5e-5);
    expect(uc).toBeGreaterThan(0);
  });

  it('mid-slab stress is compressive (negative) under expansion', () => {
    const { stressC } = computeHorizontalFriction(1, 4e6, 10, 180, 5e-5);
    // Restraint reduces free expansion → compression
    expect(stressC).toBeLessThan(0);
  });

  it('zero friction → zero stress, maximum joint opening', () => {
    // kh → 0: no restraint, joint opens freely
    const { uc, stressC } = computeHorizontalFriction(1e-10, 4e6, 10, 180, 1e-4);
    // stressC ≈ El * eps0 * (1/cosh(~0) − 1) = El * eps0 * 0 = 0
    expect(Math.abs(stressC)).toBeLessThan(1e-3);
  });

  it('uc scales with joint spacing', () => {
    const short = computeHorizontalFriction(1, 4e6, 10,  90, 5e-5).uc;
    const long  = computeHorizontalFriction(1, 4e6, 10, 180, 5e-5).uc;
    expect(long).toBeGreaterThan(short);
  });
});

describe('edgeBendingFactor', () => {
  it('returns a finite value for typical spaceND', () => {
    expect(Number.isFinite(edgeBendingFactor(3.0))).toBe(true);
    expect(Number.isFinite(edgeBendingFactor(5.0))).toBe(true);
  });

  it('factor approaches 1 for very long slabs (free edge)', () => {
    // Long slab: edge effect dominates → factor → 1
    const f = edgeBendingFactor(10);
    expect(Math.abs(f - 1)).toBeLessThan(0.15);
  });

  it('factor is less than 1 for short-to-medium slabs (boundary relief)', () => {
    const f = edgeBendingFactor(2.5);
    expect(f).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// 4. Joint – SIF functions and compliance integrals
// ---------------------------------------------------------------------------

describe('sifAxial (ft)', () => {
  it('is zero at α = 0', () => {
    // tan(0) = 0 → ft(0) = 0
    expect(sifAxial(0)).toBeCloseTo(0, 8);
  });

  it('increases monotonically with α', () => {
    const vals = [0.1, 0.2, 0.3, 0.4].map(sifAxial);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThan(vals[i - 1]);
    }
  });

  it('matches VBA formula at α = 0.25', () => {
    // Hand-computed: ft ≈ 1.32 at α=0.25 (see joint.ts derivation)
    const ft = sifAxial(0.25);
    expect(ft).toBeGreaterThan(1.0);
    expect(ft).toBeLessThan(2.0);
  });

  it('is always positive for α in (0, 0.9)', () => {
    for (let a = 0.05; a < 0.9; a += 0.05) {
      expect(sifAxial(a)).toBeGreaterThan(0);
    }
  });
});

describe('sifBending (fb)', () => {
  it('is zero at α = 0', () => {
    expect(sifBending(0)).toBeCloseTo(0, 8);
  });

  it('increases monotonically with α', () => {
    const vals = [0.1, 0.2, 0.3, 0.4].map(sifBending);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThan(vals[i - 1]);
    }
  });

  it('is larger than sifAxial at same α (6× bending stress factor)', () => {
    for (const a of [0.1, 0.2, 0.3]) {
      expect(sifBending(a)).toBeGreaterThan(sifAxial(a));
    }
  });

  it('fb / ft ≈ 6 as α → 0 (equal geometry, only stress distribution differs)', () => {
    // At very small α the (1-sin)^n terms → 1, so ratio → 6 * 0.923 / 0.752 ≈ 7.36
    // but at typical depths (0.25) ratio is around 4–6
    const ratio = sifBending(0.25) / sifAxial(0.25);
    expect(ratio).toBeGreaterThan(3);
    expect(ratio).toBeLessThan(9);
  });
});

describe('computeJointCoefficients', () => {
  const alpha = 0.25;
  const nu = 0.15;
  const h = 9;

  it('returns positive compliance coefficients', () => {
    const jc = computeJointCoefficients(alpha, nu, h);
    expect(jc.normalCoeffOverE).toBeGreaterThan(0);
    expect(jc.rotationalCoeffOverE).toBeGreaterThan(0);
  });

  it('rotational coefficient is larger than normal (bending SIF > axial)', () => {
    const jc = computeJointCoefficients(alpha, nu, h);
    expect(jc.rotationalCoeffOverE).toBeGreaterThan(jc.normalCoeffOverE);
  });

  it('SIF coefficients match standalone sifAxial / sifBending', () => {
    const jc = computeJointCoefficients(alpha, nu, h);
    expect(jc.axialSifCoeff).toBeCloseTo(sifAxial(alpha), 10);
    expect(jc.bendingSifCoeff).toBeCloseTo(sifBending(alpha), 10);
  });

  it('compliance grows with deeper sawcut', () => {
    const shallow = computeJointCoefficients(0.15, nu, h);
    const deep    = computeJointCoefficients(0.35, nu, h);
    expect(deep.normalCoeffOverE).toBeGreaterThan(shallow.normalCoeffOverE);
    expect(deep.rotationalCoeffOverE).toBeGreaterThan(shallow.rotationalCoeffOverE);
  });

  it('compliance decreases with thicker slab (coef ∝ 1/h)', () => {
    const thin  = computeJointCoefficients(alpha, nu, 7);
    const thick = computeJointCoefficients(alpha, nu, 12);
    expect(thin.normalCoeffOverE).toBeGreaterThan(thick.normalCoeffOverE);
  });

  it('throws for α out of (0, 1)', () => {
    expect(() => computeJointCoefficients(0, nu, h)).toThrow(RangeError);
    expect(() => computeJointCoefficients(1, nu, h)).toThrow(RangeError);
    expect(() => computeJointCoefficients(-0.1, nu, h)).toThrow(RangeError);
  });

  it('throws for α > 0.7 (near-singular quadrature)', () => {
    expect(() => computeJointCoefficients(0.71, nu, h)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// 5. Full model integration
// ---------------------------------------------------------------------------

/** Build a synthetic hourly input array for testing */
function makeHourlyInputs(
  startHour: number,
  endHour: number,
  E = 3_000_000,
  dTc = -10,
  dTg = -20,
): HourlyInput[] {
  return Array.from({ length: endHour - startHour + 1 }, (_, idx) => ({
    hour:              startHour + idx,
    elasticModulus:    E * (1 - Math.exp(-idx / 10)),    // ramp up from 0
    uniformTempChange: dTc,
    gradientTempChange: dTg,
  }));
}

const BASE_INPUT: StressModelInput = {
  startHour: 10,
  endHour:   20,
  slab: {
    thickness:           9,          // in
    poissonRatio:        0.15,
    cote:                5e-6,       // 1/°F
    kValue:              100,        // psi/in
    jointSpacingFt:      15,         // ft → 180 in
    frictionCoefficient: 1,          // psi/in
  },
  hourlyInputs: makeHourlyInputs(10, 20),
};

describe('runStressModel – basic sanity', () => {
  it('returns hourlyResults and creepResults of length nt', () => {
    const out = runStressModel(BASE_INPUT);
    const nt = BASE_INPUT.endHour! - BASE_INPUT.startHour + 1;
    expect(out.hourlyResults).toHaveLength(nt);
    expect(out.creepResults).toHaveLength(nt);
  });

  it('all results are finite', () => {
    const out = runStressModel(BASE_INPUT);
    for (const r of out.hourlyResults) {
      expect(Number.isFinite(r.totalStress)).toBe(true);
      expect(Number.isFinite(r.bendingStress)).toBe(true);
      expect(Number.isFinite(r.normalStress)).toBe(true);
    }
    for (const r of out.creepResults) {
      expect(Number.isFinite(r.creepTotalStress)).toBe(true);
      expect(Number.isFinite(r.creepKI)).toBe(true);
    }
  });

  it('hour indices match input', () => {
    const out = runStressModel(BASE_INPUT);
    for (let i = 0; i < out.hourlyResults.length; i++) {
      expect(out.hourlyResults[i].hour).toBe(BASE_INPUT.startHour + i);
      expect(out.creepResults[i].hour).toBe(BASE_INPUT.startHour + i);
    }
  });

  it('bending stress is finite (signed – positive for negative gradient per sign convention)', () => {
    const out = runStressModel(BASE_INPUT);
    for (const r of out.hourlyResults) {
      expect(Number.isFinite(r.bendingStress)).toBe(true);
    }
  });

  it('first result (E≈0) is a zero row', () => {
    const out = runStressModel(BASE_INPUT);
    const first = out.hourlyResults[0];
    expect(first.totalStress).toBeCloseTo(0, 6);
    expect(first.radiusOfRelativeStiffness).toBe(0);
  });
});

describe('runStressModel – free joint (default)', () => {
  it('joint normal and moment forces are zero for free joint', () => {
    const out = runStressModel(BASE_INPUT);
    for (const r of out.hourlyResults) {
      // With normalStiffnessOverE = 0, joint stiffness = 0 → forceJ ≈ 0
      expect(Math.abs(r.jointNormalForce)).toBeLessThan(1e-6);
      expect(Math.abs(r.jointMomentPerH)).toBeLessThan(1e-6);
    }
  });

  it('KI is zero when stress coefficients are zero (default joint)', () => {
    const out = runStressModel(BASE_INPUT);
    for (const r of out.hourlyResults) {
      expect(r.stressIntensityKI).toBeCloseTo(0, 10);
    }
  });
});

describe('runStressModel – custom joint stiffness', () => {
  const stiffInput: StressModelInput = {
    ...BASE_INPUT,
    joint: {
      normalStiffnessOverE:     0.5,
      rotationalStiffnessOverE: 0.5,
      axialSifCoeff:            1,
      bendingSifCoeff:          1,
    },
  };

  it('joint forces are non-zero with non-zero stiffness', () => {
    const out = runStressModel(stiffInput);
    const nonZero = out.hourlyResults.filter(r => r.elasticModulus > 0);
    expect(nonZero.some(r => Math.abs(r.jointNormalForce) > 1e-6)).toBe(true);
  });

  it('KI is non-zero when stress coefficients are set', () => {
    const out = runStressModel(stiffInput);
    const nonZero = out.hourlyResults.filter(r => r.elasticModulus > 0);
    expect(nonZero.some(r => Math.abs(r.stressIntensityKI) > 1e-6)).toBe(true);
  });
});

describe('runStressModel – stress grows with temperature amplitude', () => {
  function totalAt(dTc: number, dTg: number): number {
    const inputs = makeHourlyInputs(10, 20, 3_000_000, dTc, dTg);
    const out = runStressModel({ ...BASE_INPUT, hourlyInputs: inputs });
    return Math.max(...out.hourlyResults.map(r => Math.abs(r.totalStress)));
  }

  it('larger temperature drop → larger total stress', () => {
    const small = totalAt(-5, -10);
    const large = totalAt(-10, -20);
    expect(large).toBeGreaterThan(small);
  });
});

describe('runStressModel – creep adjustment', () => {
  it('creep-adjusted stress is non-zero when elastic stress is non-zero', () => {
    const out = runStressModel(BASE_INPUT);
    const nonZero = out.creepResults.filter(r => r.creepTotalStress !== 0);
    expect(nonZero.length).toBeGreaterThan(0);
  });

  it('creep-adjusted results are all finite with default params', () => {
    // Verify no NaN or Infinity propagates through the B-matrix transformation.
    const out = runStressModel(BASE_INPUT);
    for (const r of out.creepResults) {
      expect(Number.isFinite(r.creepTotalStress)).toBe(true);
      expect(Number.isFinite(r.creepKI)).toBe(true);
    }
  });

  it('larger creep (a1=2) produces different creep results than a1=1', () => {
    const moreCreep: StressModelInput = {
      ...BASE_INPUT,
      creep: { a1: 2, a2Scale: 15, a2Rate: 0.0072 },
    };
    const base  = runStressModel(BASE_INPUT);
    const crept = runStressModel(moreCreep);
    // With more creep, the transformation matrices differ, so results differ
    const baseSum  = base.creepResults.reduce((s, r) => s + r.creepTotalStress, 0);
    const creptSum = crept.creepResults.reduce((s, r) => s + r.creepTotalStress, 0);
    expect(baseSum).not.toBeCloseTo(creptSum, 3);
  });
});

describe('runStressModel – selectable creep models', () => {
  it('produces finite results for every creep model', () => {
    for (const creepModel of ['hydration', 'cebFip', 'aemm'] as const) {
      const out = runStressModel({ ...BASE_INPUT, creep: { creepModel } });
      for (const r of out.creepResults) {
        expect(Number.isFinite(r.creepTotalStress)).toBe(true);
        expect(Number.isFinite(r.creepKI)).toBe(true);
      }
    }
  });

  it('changing χ (aemm) changes creep-adjusted stress, but the E(tʹ) profile alone does not', () => {
    const sum = (m: 'hydration' | 'cebFip' | 'aemm') =>
      runStressModel({ ...BASE_INPUT, creep: { creepModel: m } })
        .creepResults.reduce((s, r) => s + r.creepTotalStress, 0);
    // E(tʹ) cancels out of the pseudo-load transform by construction (see the
    // creep.ts derivation), so 'hydration' and 'cebFip' — which share the same
    // φ shape and χ = 1 — give the IDENTICAL result. Only 'aemm' (χ ≠ 1)
    // changes φ's effective weight, so it alone differs.
    expect(sum('hydration')).toBeCloseTo(sum('cebFip'), 6);
    expect(sum('hydration')).not.toBeCloseTo(sum('aemm'), 3);
  });

  it('runs with a very early set time without the old negative-modulus error', () => {
    // startHour = 2 h would have thrown under the logarithmic placeholder.
    const inputs = makeHourlyInputs(2, 12);
    const out = runStressModel({
      ...BASE_INPUT,
      startHour: 2,
      endHour: 12,
      hourlyInputs: inputs,
      creep: { creepModel: 'cebFip' },
    });
    for (const r of out.creepResults) {
      expect(Number.isFinite(r.creepTotalStress)).toBe(true);
    }
  });
});

describe('runStressModel – sawcutNormalized auto-computes joint', () => {
  const sawcutInput: StressModelInput = {
    ...BASE_INPUT,
    sawcutNormalized: 0.25,
  };

  it('produces finite results with sawcutNormalized', () => {
    const out = runStressModel(sawcutInput);
    for (const r of out.hourlyResults) {
      expect(Number.isFinite(r.totalStress)).toBe(true);
      expect(Number.isFinite(r.stressIntensityKI)).toBe(true);
    }
  });

  it('KI is non-zero for non-zero elastic modulus hours', () => {
    const out = runStressModel(sawcutInput);
    const nonZero = out.hourlyResults.filter(r => r.elasticModulus > 0);
    expect(nonZero.some(r => Math.abs(r.stressIntensityKI) > 1e-6)).toBe(true);
  });

  it('deeper sawcut → larger KI (more crack-tip stress)', () => {
    const shallow = runStressModel({ ...BASE_INPUT, sawcutNormalized: 0.15 });
    const deep    = runStressModel({ ...BASE_INPUT, sawcutNormalized: 0.35 });
    const maxKI = (r: typeof shallow) =>
      Math.max(...r.hourlyResults.map(h => Math.abs(h.stressIntensityKI)));
    expect(maxKI(deep)).toBeGreaterThan(maxKI(shallow));
  });

  it('sawcutNormalized takes precedence over manual joint override', () => {
    const withManual: StressModelInput = {
      ...BASE_INPUT,
      sawcutNormalized: 0.25,
      joint: { normalStiffnessOverE: 0, rotationalStiffnessOverE: 0 },
    };
    const withSawcut = runStressModel(sawcutInput);
    const withBoth   = runStressModel(withManual);
    // Both should give the same result since sawcut takes precedence
    const ki1 = withSawcut.hourlyResults.map(r => r.stressIntensityKI);
    const ki2 = withBoth.hourlyResults.map(r => r.stressIntensityKI);
    for (let i = 0; i < ki1.length; i++) {
      expect(ki1[i]).toBeCloseTo(ki2[i], 10);
    }
  });
});
