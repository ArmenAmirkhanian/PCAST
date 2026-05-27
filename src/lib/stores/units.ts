import { writable, derived } from 'svelte/store';
import type { UnitSystem } from '$lib/types';

const DEFAULT: UnitSystem = 'us';
export const unitSystem = writable<UnitSystem>(
  (typeof localStorage !== 'undefined' && (localStorage.getItem('unitSystem') as UnitSystem)) || DEFAULT
);

unitSystem.subscribe((v) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('unitSystem', v);
});

export const tempUnit = derived(unitSystem, (s) => (s === 'us' ? '°F' : '°C'));

export function fToC(f: number) { return (f - 32) * (5/9); }
export function cToF(c: number) { return c * (9/5) + 32; }

// Canonical storage is °F
export function toDisplayTemp(valueF: number, sys: UnitSystem) { return sys === 'us' ? valueF : fToC(valueF); }
export function fromDisplayTemp(value: number, sys: UnitSystem) { return sys === 'us' ? value : cToF(value); }

export function tempMin(sys: UnitSystem) { return sys === 'us' ? -40 : -40; }
export function tempMax(sys: UnitSystem) { return sys === 'us' ? 140 : 60; }
export function tempStep(_sys: UnitSystem) { return 1; }

/** Count decimal places from a raw numeric input string ("4.5" → 1, "8" → 0). */
export function inputDp(raw: string): number {
  const dot = raw.indexOf('.');
  return dot === -1 ? 0 : raw.length - dot - 1;
}

/** Count decimal places in a stored number, stripping floating-point noise, capped at maxDp.
 *  Use this to infer the precision of a canonical value when no raw string is available. */
export function valueDp(n: number, maxDp = 4): number {
  if (!Number.isFinite(n) || Math.floor(n) === n) return 0;
  const s = parseFloat(n.toPrecision(10)).toString();
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : Math.min(s.length - dot - 1, maxDp);
}

// Canonical unit for thickness: inches.
// toDisplayThickness returns the raw converted value; callers apply decimal formatting via inputDp/valueDp.
export function inToMm(inches: number) { return inches * 25.4; }
export function mmToIn(mm: number) { return mm / 25.4; }
export function toDisplayThickness(valueIn: number, sys: UnitSystem) {
  return sys === 'us' ? valueIn : inToMm(valueIn);
}
export function fromDisplayThickness(value: number, sys: UnitSystem) {
  return sys === 'us' ? value : mmToIn(value);
}
export function thicknessUnit(sys: UnitSystem) { return sys === 'us' ? 'in' : 'mm'; }
export function thicknessStep(sys: UnitSystem) { return sys === 'us' ? 0.1 : 1; }
export function thicknessPlaceholder(sys: UnitSystem) { return sys === 'us' ? 'e.g., 8' : 'e.g., 200'; }

// Canonical unit for joint spacing: feet.
// toDisplaySpacing returns the raw converted value; callers apply decimal formatting via inputDp/valueDp.
export function ftToM(ft: number) { return ft * 0.3048; }
export function mToFt(m: number) { return m / 0.3048; }
export function toDisplaySpacing(valueFt: number, sys: UnitSystem) {
  return sys === 'us' ? valueFt : ftToM(valueFt);
}
export function fromDisplaySpacing(value: number, sys: UnitSystem) {
  return sys === 'us' ? value : mToFt(value);
}
export function spacingUnit(sys: UnitSystem) { return sys === 'us' ? 'ft' : 'm'; }
export function spacingStep(sys: UnitSystem) { return sys === 'us' ? 0.1 : 0.01; }
export function spacingPlaceholder(sys: UnitSystem) { return sys === 'us' ? 'e.g., 15' : 'e.g., 4.5'; }