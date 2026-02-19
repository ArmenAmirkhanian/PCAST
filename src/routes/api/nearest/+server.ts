import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';

export const GET: RequestHandler = ({ url }) => {
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  const k = Number(url.searchParams.get('k') ?? 3);

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return new Response(JSON.stringify({ error: 'lat/lon required' }), { status: 400 });
  }

  // Use a fresh query to avoid prepared statement caching issues
  const rows = db.prepare(`
    SELECT s.id, s.ghcn_id, s.name, s.latitude, s.longitude
    FROM stations s
    ORDER BY (s.latitude - ?) * (s.latitude - ?) + (s.longitude - ?) * (s.longitude - ?)
    LIMIT ?
  `).all(lat, lat, lon, lon, k);

  return new Response(JSON.stringify(rows), { headers: { 'content-type': 'application/json' } });
};