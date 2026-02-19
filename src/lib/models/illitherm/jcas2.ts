import { CToK } from './constants';
import type { HydrationParams } from './types';

// VBA: HeatOfHydration_jcas2
export function heatOfHydrationjcas2(t: number, params: HydrationParams, te_avg: number): number {
  const tauteb = Math.pow(params.tau / te_avg, params.beta);
  const alpha = params.alphau * Math.exp(-tauteb);

  const T1 = 1 / (params.Tr + CToK);
  const T2 = 1 / (t + CToK);

  const Qh =
    params.Hu *
    params.cc *
    tauteb *
    (params.beta / te_avg) *
    alpha *
    Math.exp((params.Ea / params.R) * (T1 - T2));

  return Qh / 3600;
}

// VBA: EquivAge_jcas2
export function equivAgejcas2(dt: number, t: number, params: HydrationParams): number {
  const T1 = 1 / (params.Tr + CToK);
  const T2 = 1 / (t + CToK);
  return Math.exp((params.Ea / params.R) * (T1 - T2)) * dt / 3600;
}
