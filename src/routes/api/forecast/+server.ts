import type { RequestHandler } from './$types';
import { fetchForecast, FORECAST_HOURS, NwsError } from '$lib/server/nws';
import { parseForecastQuery } from './query';

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
 *
 * No date window is enforced here. A window the issued forecast cannot span is
 * refused by `buildForecastRows` on the evidence, which is the same check
 * `/api/forecast/availability` reports non-fatally.
 */
export const GET: RequestHandler = async ({ url }) => {
  const parsed = parseForecastQuery(url);
  if ('error' in parsed) return json({ error: parsed.error, code: 'bad_request' }, 400);

  const { lat, lon, date, startHour } = parsed;
  try {
    return json(await fetchForecast(lat, lon, date, startHour, FORECAST_HOURS));
  } catch (err) {
    if (err instanceof NwsError) {
      return json({ error: err.message, code: err.code }, err.status);
    }
    console.error('Forecast lookup failed:', err);
    return json({ error: 'Forecast lookup failed.', code: 'upstream' }, 502);
  }
};
