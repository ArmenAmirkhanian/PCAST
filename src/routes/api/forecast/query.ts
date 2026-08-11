/** Shared query-string validation for the forecast endpoints. */

export type ForecastQuery = { lat: number; lon: number; date: string; startHour: number };

const asNumber = (value: string | null) => (value === null ? NaN : Number(value));

/**
 * Validate the shape of the request only.
 *
 * Deliberately no calendar window: whether the live forecast can serve a given
 * start is a question about the data NWS has issued, answered downstream by
 * `assessCoverage`. A date bound here would be a guess about the horizon, and
 * would have to be judged against some clock — the server's, which is normally
 * UTC and disagrees with the site's for much of the day.
 */
export function parseForecastQuery(url: URL): ForecastQuery | { error: string } {
  const lat = asNumber(url.searchParams.get('lat'));
  const lon = asNumber(url.searchParams.get('lon'));
  const date = url.searchParams.get('date') ?? '';
  const startHour = asNumber(url.searchParams.get('startHour') ?? '0');

  if ([lat, lon, startHour].some((v) => Number.isNaN(v))) return { error: 'bad params' };
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return { error: 'coordinates out of range' };
  }
  if (startHour < 0 || startHour > 23) return { error: 'startHour must be 0–23' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'date must be yyyy-mm-dd' };

  return { lat, lon, date, startHour };
}
