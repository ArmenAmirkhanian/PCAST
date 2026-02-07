// VBA: TriDiagSolve
export function triDiagSolve(A: number[], b: number[], c: number[], d: number[]): number[] {
  const n = d.length;
  const cprime = new Array<number>(n);
  const dprime = new Array<number>(n);

  cprime[0] = c[0] / b[0];
  dprime[0] = d[0] / b[0];

  for (let i = 1; i < n; i += 1) {
    const m = 1 / (b[i] - A[i] * cprime[i - 1]);
    cprime[i] = c[i] * m;
    dprime[i] = (d[i] - A[i] * dprime[i - 1]) * m;
  }

  const x = new Array<number>(n);
  x[n - 1] = dprime[n - 1];
  for (let i = n - 2; i >= 0; i -= 1) {
    x[i] = dprime[i] - cprime[i] * x[i + 1];
  }

  return x;
}
