import type { RequestHandler } from './$types';
import { probeForecast, FORECAST_HOURS, NwsError } from '$lib/server/nws';
import { parseForecastQuery } from '../query';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });

/**
 * Whether the live NWS forecast can span the project's 72-hour window.
 *
 * Split out from `/api/forecast` so the Environment tab can decide what to
 * offer without pulling 72 rows it may not use. Both hops are cached upstream,
 * so a probe followed by a real fetch is one round of NWS traffic — which is
 * why the tab probes on entry rather than on every input change.
 */
export const GET: RequestHandler = async ({ url }) => {
  const parsed = parseForecastQuery(url);
  if ('error' in parsed) return json({ error: parsed.error, code: 'bad_request' }, 400);

  const { lat, lon, date, startHour } = parsed;
  try {
    return json(await probeForecast(lat, lon, date, startHour, FORECAST_HOURS));
  } catch (err) {
    if (err instanceof NwsError) {
      // Out-of-grid and upstream failures are availability answers, not errors:
      // the tab shows them as "live forecast unavailable" and stays on normals.
      return json(
        { status: 'unavailable', reason: err.message, code: err.code },
        err.code === 'upstream' ? 502 : 200
      );
    }
    console.error('Forecast availability probe failed:', err);
    return json({ status: 'unavailable', reason: 'Availability check failed.', code: 'upstream' }, 502);
  }
};
