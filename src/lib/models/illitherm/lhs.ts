// VBA: AssembleGlobalLHS
export function assembleGlobalLHS(
  dt: number,
  numElements: number,
  alpha: number[],
  dx: number[]
): { lhsa: number[]; lhsb: number[]; lhsc: number[] } {
  const numNodes = numElements + 1;
  const lhsa = new Array<number>(numNodes).fill(0);
  const lhsb = new Array<number>(numNodes).fill(0);
  const lhsc = new Array<number>(numNodes).fill(0);

  const cl11 = 2 / 6;
  const cl12 = 1 / 6;
  const cl21 = 1 / 6;
  const cl22 = 2 / 6;

  for (let iel = 0; iel < numElements; iel += 1) {
    lhsb[iel] = lhsb[iel] + dx[iel] * cl11 + (alpha[iel] / dx[iel]) * 1 * dt;
    lhsb[iel + 1] = lhsb[iel + 1] + dx[iel] * cl22 + (alpha[iel] / dx[iel]) * 1 * dt;

    lhsc[iel] = lhsc[iel] + dx[iel] * cl12 + (alpha[iel] / dx[iel]) * -1 * dt;
    lhsa[iel + 1] = lhsa[iel + 1] + dx[iel] * cl21 + (alpha[iel] / dx[iel]) * -1 * dt;
  }

  return { lhsa, lhsb, lhsc };
}
