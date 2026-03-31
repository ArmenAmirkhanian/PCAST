/** Earth mean radius in miles */
const R_MILES = 3958.8;

/**
 * If the nearest station is within this distance (inclusive), only that
 * station's data is used — weight = 1, all others = 0.
 */
export const PROXIMITY_THRESHOLD_MILES = 3;

/**
 * If at least two stations are within this distance but the next station is
 * farther, only the stations within this threshold are used.
 */
export const NEARBY_THRESHOLD_MILES = 10;

/** Haversine distance between two lat/lon points, result in miles. */
export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) ** 2;
  return R_MILES * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Compute normalised IDW (inverse-distance²) weights for stations sorted by
 * ascending distance. Priority rules applied in order:
 *
 * 1. Nearest station ≤ PROXIMITY_THRESHOLD_MILES (3 mi): use only that station
 *    (weight = 1, all others = 0).
 * 2. Two or more stations ≤ NEARBY_THRESHOLD_MILES (10 mi) but the next
 *    station is farther: use only the stations within the threshold.
 * 3. Otherwise: standard IDW power-2 across all stations.
 *
 * @param distancesMiles - Haversine distances in miles, sorted ascending.
 * @returns Normalised weights that sum to 1.
 */
export function computeIdwWeights(distancesMiles: readonly number[]): number[] {
  if (distancesMiles.length === 0) return [];

  // Rule 1: single nearest station within 3 miles
  if (distancesMiles[0] <= PROXIMITY_THRESHOLD_MILES) {
    return distancesMiles.map((_, i) => (i === 0 ? 1 : 0));
  }

  // Rule 2: determine which stations are within the 10-mile threshold
  const withinCount = distancesMiles.filter(d => d <= NEARBY_THRESHOLD_MILES).length;
  const activeCount = withinCount >= 2 && withinCount < distancesMiles.length
    ? withinCount
    : distancesMiles.length;

  // Compute IDW over the active stations only; zero out the rest
  const raw = distancesMiles.map((d, i) => (i < activeCount ? 1 / d ** 2 : 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(w => w / sum);
}
