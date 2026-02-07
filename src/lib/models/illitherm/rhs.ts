import type { HydrationParams, Layer } from './types';
import { equivAgejcas2, heatOfHydrationjcas2 } from './jcas2';

// VBA: AssembleGlobalRHS
export function assembleGlobalRHS(Told: number[], dx: number[], numElements: number): number[] {
  const numNodes = numElements + 1;
  const rhsd = new Array<number>(numNodes).fill(0);

  const cl11 = 2 / 6;
  const cl12 = 1 / 6;
  const cl21 = 1 / 6;
  const cl22 = 2 / 6;

  for (let i = 0; i < numElements; i += 1) {
    rhsd[i] = rhsd[i] + (cl11 * dx[i] * Told[i] + cl12 * dx[i] * Told[i + 1]);
    rhsd[i + 1] = rhsd[i + 1] + (cl21 * dx[i] * Told[i] + cl22 * dx[i] * Told[i + 1]);
  }

  return rhsd;
}

// VBA: AssembleGlobalSourceRHS
export function assembleGlobalSourceRHS(
  Told: number[],
  dt: number,
  numElements: number,
  surfaceLayer: Layer,
  params: HydrationParams,
  te_avg: number[]
): number[] {
  const numNodes = numElements + 1;
  const rhsq = new Array<number>(numNodes).fill(0);

  const dxlayer = surfaceLayer.thickness / surfaceLayer.numLayerElements;

  for (let i = 0; i < surfaceLayer.numLayerElements; i += 1) {
    const Tavg = 0.5 * (Told[i] + Told[i + 1]);

    te_avg[i] = te_avg[i] + equivAgejcas2(dt, Tavg, params);
    const Qhavg = heatOfHydrationjcas2(Tavg, params, te_avg[i]);

    rhsq[i] = rhsq[i] + Qhavg * dxlayer * 0.25;
    rhsq[i + 1] = rhsq[i + 1] + Qhavg * dxlayer * 0.25;
  }

  return rhsq;
}
