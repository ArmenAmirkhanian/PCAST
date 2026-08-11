import type { RequestHandler } from './$types';
import { fetchForecast, FORECAST_HOURS, NwsError } from '$lib/server/nws';
import { isPlausibleForecastDate } from '$lib/utils/time';

const asNumber = (value: string | null) => (value === null ? NaN : Number(value));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });

/**
 * 72-hour NOAA/NWS gridded forecast for a project site.
 *
 * Server-side rather than a browser fetch because api.weather.gov requires a
 * contact `User-Agent` and does not need to be exposed to CORS.
 */
export const GET: RequestHandler = async ({ url }) => {
  const lat = asNumber(url.searchParams.get('lat'));
  const lon = asNumber(url.searchParams.get('lon'));
  const date = url.searchParams.get('date') ?? '';
  const startHour = asNumber(url.searchParams.get('startHour') ?? '0');

  if ([lat, lon, startHour].some((v) => Number.isNaN(v))) {
    return json({ error: 'bad params', code: 'bad_request' }, 400);
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return json({ error: 'coordinates out of range', code: 'bad_request' }, 400);
  }
  if (startHour < 0 || startHour > 23) {
    return json({ error: 'startHour must be 0–23', code: 'bad_request' }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: 'date must be yyyy-mm-dd', code: 'bad_request' }, 400);
  }

  // Coarse bound only. The real today/tomorrow window is enforced inside
  // `fetchForecast`, against the *site's* timezone — checking it here would mean
  // checking it against the server's, which for a UTC deployment disagrees with
  // the browser for most of a US evening and rejects the user's own today.
  // This ±2-day guard is wide enough that it can never disagree with that check,
  // and narrow enough that a junk date costs no upstream request.
  if (!isPlausibleForecastDate(date)) {
    return json(
      {
        error: 'The hourly forecast is only available for a start date of today or tomorrow.',
        code: 'ineligible_date'
      },
      400
    );
  }

  try {
    const result = await fetchForecast(lat, lon, date, startHour, FORECAST_HOURS);
    return json(result);
  } catch (err) {
    if (err instanceof NwsError) {
      return json({ error: err.message, code: err.code }, err.status);
    }
    console.error('Forecast lookup failed:', err);
    return json({ error: 'Forecast lookup failed.', code: 'upstream' }, 502);
  }
};
