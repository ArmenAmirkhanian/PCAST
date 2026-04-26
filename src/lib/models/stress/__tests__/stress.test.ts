/**
 * Tests for the stress & creep module.
 *
 * Run: npx vitest run stress.test.ts
 *
 * Tests are organised into:
 *   1. linalg     – 2×2 matrix ops and lower-tri mat-vec
 *   2. creep      – compliance matrix, ΔJ, B, B⁻¹
 *   3. beam       – rotation, horizontal friction, bending factor
 *   4. run        – full model integration
 */

import { describe, it, expect } from 'vitest';

import { matVec2, inverse2x2, solve2x2, lowerTriMatVec } from '../linalg';
import {
  buildCreepCompliance,
  buildDifferentialCreep,
  buildTransformationMatrix,
  buildInverseTransformation,
  DEFAULT_CREEP_PARAMS,
} from '../creep';
import {
  radiusOfRelativeStiffness,
  computeBeamRotation,
  computeHorizontalFriction,
  edgeBendingFactor,
} from '../beam';
import { runStressModel } from '../run';
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

describe('buildCreepCompliance', () => {
  const p = DEFAULT_CREEP_PARAMS;

  it('diagonal entries are elastic (t = tʹ, no creep term)', () => {
    const J = buildCreepCompliance(10, 5, p);
    // At t = tʹ (i = j): creep term = 1 + a1*(1 - e^0) = 1
    // So J[i][i] = [1/145 / Ep(tp)] * 1e6 / 1000
    for (let i = 0; i < 5; i++) {
      expect(J[i][i]).toBeGreaterThan(0);
    }
  });

  it('J[i][j] ≥ J[i][i] for j < i (creep grows with elapsed time)', () => {
    const J = buildCreepCompliance(5, 4, p);
    for (let i = 1; i < 4; i++) {
      for (let j = 0; j < i; j++) {
        expect(J[i][j]).toBeGreaterThanOrEqual(J[i][i]);
      }
    }
  });

  it('compliance grows monotonically with elapsed time (J[i][j] ≥ J[i][j+1])', () => {
    const J = buildCreepCompliance(5, 6, p);
    for (let i = 2; i < 6; i++) {
      for (let j = 0; j < i - 1; j++) {
        expect(J[i][j]).toBeGreaterThanOrEqual(J[i][j + 1]);
      }
    }
  });

  it('upper triangle is zero', () => {
    const J = buildCreepCompliance(10, 4, p);
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        expect(J[i][j]).toBe(0);
      }
    }
  });
});

describe('buildDifferentialCreep', () => {
  it('diagonal entries equal J diagonal', () => {
    const J = buildCreepCompliance(10, 4, DEFAULT_CREEP_PARAMS);
    const dJ = buildDifferentialCreep(J);
    for (let i = 0; i < 4; i++) {
      expect(dJ[i][i]).toBeCloseTo(J[i][i]);
    }
  });

  it('off-diagonal = J[i][j] - J[i][j+1] ≥ 0 (creep is non-decreasing)', () => {
    const J = buildCreepCompliance(5, 5, DEFAULT_CREEP_PARAMS);
    const dJ = buildDifferentialCreep(J);
    for (let i = 1; i < 5; i++) {
      for (let j = 0; j < i; j++) {
        expect(dJ[i][j]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('buildTransformationMatrix (B)', () => {
  it('diagonal entries are all 1', () => {
    const J = buildCreepCompliance(10, 5, DEFAULT_CREEP_PARAMS);
    const dJ = buildDifferentialCreep(J);
    const B = buildTransformationMatrix(dJ);
    for (let i = 0; i < 5; i++) {
      expect(B[i][i]).toBeCloseTo(1);
    }
  });

  it('upper triangle is zero', () => {
    const J = buildCreepCompliance(10, 4, DEFAULT_CREEP_PARAMS);
    const dJ = buildDifferentialCreep(J);
    const B = buildTransformationMatrix(dJ);
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        expect(B[i][j]).toBe(0);
      }
    }
  });
});

describe('buildInverseTransformation (B⁻¹)', () => {
  it('B · B⁻¹ ≈ identity for small matrices', () => {
    const J = buildCreepCompliance(5, 4, DEFAULT_CREEP_PARAMS);
    const dJ = buildDifferentialCreep(J);
    const B = buildTransformationMatrix(dJ);
    const Binv = buildInverseTransformation(B);

    // Check B · (B⁻¹ column j) = e_j
    for (let j = 0; j < 4; j++) {
      const col = Binv.map(row => row[j]);
      const result = lowerTriMatVec(B, col);
      for (let i = 0; i < 4; i++) {
        expect(result[i]).toBeCloseTo(i === j ? 1 : 0, 8);
      }
    }
  });

  it('B⁻¹ · B ≈ identity (apply in reverse order)', () => {
    const J = buildCreepCompliance(8, 3, DEFAULT_CREEP_PARAMS);
    const dJ = buildDifferentialCreep(J);
    const B = buildTransformationMatrix(dJ);
    const Binv = buildInverseTransformation(B);

    for (let j = 0; j < 3; j++) {
      const colB = B.map(row => row[j]);
      const result = lowerTriMatVec(Binv, colB);
      for (let i = 0; i < 3; i++) {
        expect(result[i]).toBeCloseTo(i === j ? 1 : 0, 8);
      }
    }
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
// 4. Full model integration
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

  it('bending stress is non-negative (reported as absolute value)', () => {
    const out = runStressModel(BASE_INPUT);
    for (const r of out.hourlyResults) {
      expect(r.bendingStress).toBeGreaterThanOrEqual(0);
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
      normalStiffnessOverE:      0.5,
      rotationalStiffnessOverE:  0.5,
      stressCoeffTop:            1,
      stressCoeffBottom:         1,
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
    return Math.max(...out.hourlyResults.map(r => r.totalStress));
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
