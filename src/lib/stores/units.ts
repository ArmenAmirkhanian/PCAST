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