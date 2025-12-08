import type { RequestHandler } from './$types';
import { nearestStmt } from '$lib/server/db';

export const GET: RequestHandler = ({ url }) => {
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  const k = Number(url.searchParams.get('k') ?? 3);

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return new Response(JSON.stringify({ error: 'lat/lon required' }), { status: 400 });
  }
  const rows = nearestStmt.all(lat, lon, k);
  return new Response(JSON.stringify(rows), { headers: { 'content-type': 'application/json' } });
};