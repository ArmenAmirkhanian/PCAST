import type { RequestHandler } from './$types';
import { nearestNormalsStmt } from '$lib/server/db';

const asNumber = (value: string | null) => (value === null ? NaN : Number(value));

export const GET: RequestHandler = ({ url }) => {
  const lat = asNumber(url.searchParams.get('lat'));
  const lon = asNumber(url.searchParams.get('lon'));
  const month = asNumber(url.searchParams.get('month'));
  const day = asNumber(url.searchParams.get('day'));
  const startHour = asNumber(url.searchParams.get('startHour') ?? '0');

  const hasNaN = [lat, lon, month, day, startHour].some((v) => Number.isNaN(v));
  const monthValid = month >= 1 && month <= 12;
  const dayValid = day >= 1 && day <= 31;
  const hourValid = startHour >= 0 && startHour <= 23;

  if (hasNaN || !monthValid || !dayValid || !hourValid) {
    return new Response(JSON.stringify({ error: 'bad params' }), { status: 400 });
  }

  const rows = nearestNormalsStmt.all({
    lat,
    lon,
    month,
    day,
    start_hour: startHour
  });
  return new Response(JSON.stringify(rows), { headers: { 'content-type': 'application/json' } });
};
