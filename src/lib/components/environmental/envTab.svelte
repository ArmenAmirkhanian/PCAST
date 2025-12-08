<script lang="ts">
  import { projectInfo } from '$lib/stores/form';
  import type { CityLocation, PlacesIndex } from '$lib/types';
  import placesIndex from '$lib/data/places-index.json';

  const index = placesIndex as PlacesIndex;

  type StationRow = {
    station_id: number;
    ghcn_id: string | null;
    name: string | null;
    latitude: number | null;
    longitude: number | null;
    distance_km: number;
    offset_hr: number;
    month: number;
    day: number;
    hour: number;
    var_code: string;
    value_i: number | null;
    meas_flag: string | null;
    comp_flag: string | null;
    years_used: number | null;
  };

  type StationGroup = {
    stationId: number;
    ghcnId: string | null;
    name: string | null;
    latitude: number | null;
    longitude: number | null;
    distanceKm: number;
    readings: StationRow[];
  };

  let selectedLocation: CityLocation | null = null;
  let selectedDate: Date | null = null;
  let startMonth: number | null = null;
  let startDay: number | null = null;
  let startHour: number | null = null;
  let lastLookupMessage = '';
  let lastLookupTime = '';
  let isLoading = false;
  let errorMessage = '';
  let rows: StationRow[] = [];
  let groupedStations: StationGroup[] = [];

  const formatCoord = (value: number | null) => (value === null ? '' : value.toFixed(4));
  const formatDate = (date: Date | null) =>
    date
      ? `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
      : '';
  const formatTs = (row: Pick<StationRow, 'month' | 'day' | 'hour'>) =>
    `${String(row.month).padStart(2, '0')}-${String(row.day).padStart(2, '0')} ${String(row.hour).padStart(2, '0')}:00`;
  const formatVal = (value: number | null) => (value === null ? '—' : value.toString());

  $: selectedLocation = (() => {
    const state = $projectInfo.state;
    const city = $projectInfo.city;
    if (!state || !city) return null;
    return (index[state] || []).find(
      (place) => place.city.toLowerCase() === city.toLowerCase()
    ) || null;
  })();

  $: groupedStations = (() => {
    const map = new Map<number, StationGroup>();
    for (const row of rows) {
      let bucket = map.get(row.station_id);
      if (!bucket) {
        bucket = {
          stationId: row.station_id,
          ghcnId: row.ghcn_id,
          name: row.name,
          latitude: row.latitude,
          longitude: row.longitude,
          distanceKm: row.distance_km,
          readings: []
        };
        map.set(row.station_id, bucket);
      }
      bucket.readings.push(row);
    }
    return Array.from(map.values()).sort((a, b) => a.distanceKm - b.distanceKm);
  })();

  $: selectedDate = $projectInfo.date
    ? new Date(`${$projectInfo.date}T00:00:00Z`)
    : null;

  $: startMonth = selectedDate ? selectedDate.getUTCMonth() + 1 : null;
  $: startDay = selectedDate ? selectedDate.getUTCDate() : null;
  $: startHour = (() => {
    if (!$projectInfo.startHour) return 0;
    const parts = $projectInfo.startHour.split(':');
    const hour = parseInt(parts[0] ?? '0', 10);
    return Number.isFinite(hour) ? hour : 0;
  })();

  function buildSql(lat: number, lon: number, month: number, day: number, hour: number) {
    const sql = `
WITH
  input AS (
    SELECT
      ${lat} AS lat,
      ${lon} AS lon,
      ${month} AS month,
      ${day} AS day,
      ${hour} AS start_hour
  ),
  nearest AS (
    SELECT
      s.id,
      s.ghcn_id,
      s.name,
      s.latitude,
      s.longitude,
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
  RECURSIVE offsets(n) AS (
    SELECT 0
    UNION ALL
    SELECT n + 1 FROM offsets WHERE n < 71
  ),
  time_window AS (
    SELECT
      datetime(params.start_dt, '+' || offsets.n || ' hours') AS ts,
      CAST(strftime('%m', ts) AS INTEGER) AS month,
      CAST(strftime('%d', ts) AS INTEGER) AS day,
      CAST(strftime('%H', ts) AS INTEGER) AS hour,
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
`.trim();

    return sql;
  }

  async function runSqlLookup() {
    errorMessage = '';
    rows = [];

    if (!selectedLocation) {
      lastLookupMessage = 'Select a city and state in Project Info to enable the lookup.';
      lastLookupTime = '';
      return;
    }
    if (!startMonth || !startDay) {
      lastLookupMessage = 'Choose a start date in Project Info to build the query.';
      lastLookupTime = '';
      return;
    }

    lastLookupMessage = buildSql(
      selectedLocation.latitude ?? 0,
      selectedLocation.longitude ?? 0,
      startMonth,
      startDay,
      startHour ?? 0
    );
    lastLookupTime = new Date().toLocaleString();

    isLoading = true;
    try {
      const params = new URLSearchParams({
        lat: String(selectedLocation.latitude ?? 0),
        lon: String(selectedLocation.longitude ?? 0),
        month: String(startMonth),
        day: String(startDay),
        startHour: String(startHour ?? 0)
      });
      const res = await fetch(`/api/nearest-normals?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Lookup failed (${res.status})`);
      }
      rows = (await res.json()) as StationRow[];
      if (!rows.length) {
        errorMessage = 'No rows returned for that location/time.';
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Lookup failed.';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="space-y-4">
  <div class="rounded-lg border bg-white p-4 shadow-sm">
    <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 class="text-lg font-semibold">Nearest Weather Stations</h3>
        <p class="text-sm text-gray-600">Lookup runs only when you click the button.</p>
      </div>
      <button
        class="w-full md:w-auto rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        on:click={runSqlLookup}
        disabled={!selectedLocation || isLoading}>
        {#if isLoading}
          Running…
        {:else}
          Run SQL Lookup
        {/if}
      </button>
    </div>

    <div class="mt-3 text-sm text-gray-700">
      {#if selectedLocation}
        <div class="space-y-1">
          <p>
            Selected location:
            <span class="font-medium">{selectedLocation.city}, {$projectInfo.state}</span>
            ({formatCoord(selectedLocation.latitude)}, {formatCoord(selectedLocation.longitude)})
          </p>
          {#if selectedDate}
            <p>
              Start date for lookup (month-day only): <span class="font-medium">{formatDate(selectedDate)}</span>
              at hour <span class="font-medium">{String(startHour ?? 0).padStart(2, '0')}:00</span>
            </p>
          {/if}
        </div>
      {:else}
        <p class="text-gray-500">Pick a city in Project Info to enable the lookup.</p>
      {/if}
    </div>

    <div class="mt-4 space-y-3">
      {#if errorMessage}
        <div class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorMessage}
        </div>
      {/if}

      {#if lastLookupMessage}
        <div class="space-y-2 rounded border bg-gray-50 p-3 text-sm text-gray-800">
          <p class="font-medium">SQL preview</p>
          <pre class="overflow-x-auto whitespace-pre-wrap text-xs bg-white border rounded p-3">{lastLookupMessage}</pre>
          {#if lastLookupTime}
            <p class="text-gray-500">Last run: {lastLookupTime}</p>
          {/if}
        </div>
      {/if}

      {#if groupedStations.length}
        <div class="space-y-3">
          <p class="text-sm text-gray-600">
            Returned {rows.length} rows across {groupedStations.length} station(s) for the next 72 hours.
          </p>
          {#each groupedStations as station}
            <div class="rounded border bg-white p-3">
              <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <p class="font-semibold">{station.name ?? 'Station'} ({station.ghcnId ?? 'N/A'})</p>
                  <p class="text-sm text-gray-600">
                    Distance: {station.distanceKm.toFixed(1)} km ·
                    Lat/Lon: {formatCoord(station.latitude)} , {formatCoord(station.longitude)}
                  </p>
                  <p class="text-sm text-gray-600">Readings: {station.readings.length}</p>
                </div>
              </div>
              <div class="mt-3 overflow-x-auto">
                <table class="min-w-full text-left text-xs">
                  <thead>
                    <tr class="text-gray-600">
                      <th class="px-2 py-1">Offset hr</th>
                      <th class="px-2 py-1">Month-Day Hr</th>
                      <th class="px-2 py-1">Var</th>
                      <th class="px-2 py-1">Value</th>
                      <th class="px-2 py-1">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each station.readings.slice(0, 24) as reading}
                      <tr class="border-t">
                        <td class="px-2 py-1">{reading.offset_hr}</td>
                        <td class="px-2 py-1">{formatTs(reading)}</td>
                        <td class="px-2 py-1">{reading.var_code}</td>
                        <td class="px-2 py-1">{formatVal(reading.value_i)}</td>
                        <td class="px-2 py-1 text-gray-600">
                          {reading.meas_flag ?? '·'} / {reading.comp_flag ?? '·'}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
                {#if station.readings.length > 24}
                  <p class="mt-2 text-[11px] text-gray-500">
                    Showing first 24 rows of {station.readings.length}.
                  </p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
