import type { RequestHandler } from './$types';
import { windowStmt, varIdByCode } from '$lib/server/db';

export const GET: RequestHandler = ({ url }) => {
  const stationId = Number(url.searchParams.get('stationId'));
  const varCode = url.searchParams.get('varCode') ?? 'HLY-TEMP-NORMAL';
  const startMonth = Number(url.searchParams.get('startMonth') ?? 7);
  const startDay   = Number(url.searchParams.get('startDay') ?? 10);
  const startHour  = Number(url.searchParams.get('startHour') ?? 0);
  const hours      = Number(url.searchParams.get('hours') ?? 48); // span two days in example

  if ([stationId, startMonth, startDay, startHour, hours].some(Number.isNaN)) {
    return new Response(JSON.stringify({ error: 'bad params' }), { status: 400 });
  }

  // simple 2-day span (today startHour..23, next day 0..(startHour+hours-24))
  const endHourDay2 = Math.max(0, (startHour + hours - 24));
  const rows = windowStmt.all(
    stationId, varCode,
    startMonth, startDay, startHour,               // day 1
    startMonth, startDay + 1, endHourDay2          // naive +1 day (ok for testing; swap in a date-roll helper later)
  );

  return new Response(JSON.stringify(rows), { headers: { 'content-type': 'application/json' } });
};