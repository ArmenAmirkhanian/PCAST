/*
import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH ?? 'normals_full.db';
// immutable=1 is safe if the file never changes in prod; omit while ingesting.
const uri = DB_PATH.startsWith('file:')
  ? DB_PATH
  : `file:${DB_PATH}?immutable=1`;

export const db = new Database(uri, { uri: true, readonly: true });
*/

import Database from 'better-sqlite3';
import { env } from '$env/dynamic/private'; // SvelteKit server-only env

let _db: Database.Database | null = null;

function openDb(): Database.Database {
  if (_db) return _db;

	const rawPath = env.DB_PATH ?? 'normals_full.db';

	_db = new Database(rawPath, { readonly: true });

	console.log('Opened SQLite at:', rawPath);

  _db.pragma('query_only = ON');   // blocks INSERT/UPDATE/DELETE

	return _db;
}

export const db = openDb();

/** Prepared statements */
export const nearestStmt = db.prepare(`
  WITH params(lat, lon, k) AS (VALUES (?1, ?2, ?3))
  SELECT s.id, s.ghcn_id, s.name, s.latitude, s.longitude
  FROM stations s, params
  ORDER BY (s.latitude-params.lat)*(s.latitude-params.lat)
        + (s.longitude-params.lon)*(s.longitude-params.lon)
  LIMIT (SELECT k FROM params);
`);

export const windowStmt = db.prepare(`
  SELECT hn.month, hn.day, hn.hour,
         CASE
           WHEN v.code GLOB 'HLY-TEMP-*'        THEN hn.value_i/10.0
           WHEN v.code GLOB 'HLY-DEWP-*'        THEN hn.value_i/10.0
           WHEN v.code GLOB 'HLY-HIDX-*'        THEN hn.value_i/10.0
           WHEN v.code GLOB 'HLY-WCHL-*'        THEN hn.value_i/10.0
           WHEN v.code = 'HLY-WIND-AVGSPD'      THEN hn.value_i/10.0
           ELSE hn.value_i*1.0
         END AS value
  FROM hourly_normals hn
  JOIN variables v ON v.id = hn.var_id
  WHERE hn.station_id = ? AND v.code = ?
    AND ( (hn.month = ? AND hn.day = ? AND hn.hour BETWEEN ? AND 23)
       OR (hn.month = ? AND hn.day = ? AND hn.hour BETWEEN 0 AND ?) )
  ORDER BY hn.month, hn.day, hn.hour;
`);

export const varIdByCode = db.prepare(`SELECT id FROM variables WHERE code = ?`);

export const nearestNormalsStmt = db.prepare(`
WITH RECURSIVE
  input AS (
    SELECT
      CAST(@lat AS REAL) AS lat,
      CAST(@lon AS REAL) AS lon,
      CAST(@month AS INTEGER) AS month,
      CAST(@day AS INTEGER) AS day,
      CAST(@start_hour AS INTEGER) AS start_hour
  ),
  nearest AS (
    SELECT
      s.id,
      s.ghcn_id,
      s.name,
      s.latitude,
      s.longitude,
      s.elevation,
      2 * 6371 * ASIN(
        SQRT(
          POW(SIN((s.latitude - i.lat) * PI() / 180 / 2), 2) +
          COS(i.lat * PI() / 180) * COS(s.latitude * PI() / 180) *
          POW(SIN((s.longitude - i.lon) * PI() / 180 / 2), 2)
        )
      ) AS distance_km
    FROM stations s
    JOIN input i
    ORDER BY distance_km
    LIMIT 3
  ),
  params AS (
    SELECT
      datetime(
        printf('2024-%02d-%02d %02d:00:00', month, day, start_hour)
      ) AS start_dt
    FROM input
  ),
  offsets(n) AS (
    SELECT 0
    UNION ALL
    SELECT n + 1 FROM offsets WHERE n < 71
  ),
  time_window AS (
    SELECT
      datetime(params.start_dt, '+' || offsets.n || ' hours') AS ts,
      CAST(strftime('%m', datetime(params.start_dt, '+' || offsets.n || ' hours')) AS INTEGER) AS month,
      CAST(strftime('%d', datetime(params.start_dt, '+' || offsets.n || ' hours')) AS INTEGER) AS day,
      CAST(strftime('%H', datetime(params.start_dt, '+' || offsets.n || ' hours')) AS INTEGER) AS hour,
      offsets.n AS offset_hr
    FROM offsets
    CROSS JOIN params
  )
SELECT
  n.id AS station_id,
  n.ghcn_id,
  n.name,
  n.latitude,
  n.longitude,
  n.elevation,
  n.distance_km,
  tw.offset_hr,
  tw.month,
  tw.day,
  tw.hour,
  v.code AS var_code,
  h.value_i,
  h.meas_flag,
  h.comp_flag,
  h.years_used
FROM time_window tw
JOIN nearest n ON 1=1
JOIN hourly_normals h
  ON h.station_id = n.id
  AND h.month = tw.month
  AND h.day = tw.day
  AND h.hour = tw.hour
JOIN variables v ON v.id = h.var_id
ORDER BY n.distance_km ASC, tw.offset_hr ASC, v.code ASC;
`);
