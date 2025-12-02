import { writable, derived } from 'svelte/store';

export const site = writable([-87.5692, 33.2098]);
export const stations = writable([
  [-86.75, 33.56],
  [-87.62, 33.15],
  [-87.58, 33.27],
]);

export const allPoints = derived([site, stations], ([$site, $stations]) => [$site, ...$stations]);