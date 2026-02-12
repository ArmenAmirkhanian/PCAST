<script lang="ts">
  export let explanationHtml: string;
  import { browser } from '$app/environment';
  import { onMount, tick } from 'svelte';
  import { projectInfo } from '$lib/stores/form';
  import type { CityLocation, PlacesIndex } from '$lib/types';
  import placesIndex from '$lib/data/places-index.json';
  import type { Config, Layout, PlotData } from 'plotly.js';

  const index = placesIndex as PlacesIndex;

  type StationRow = {
    station_id: number;
    ghcn_id: string | null;
    name: string | null;
    latitude: number | null;
    longitude: number | null;
    elevation: number | null;
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
    elevation: number | null;
    distanceKm: number;
    readings: StationRow[];
  };

  type HourlyRow = {
    offsetHr: number;
    month: number;
    day: number;
    hour: number;
    temp: number | null;
    cloud: number | null;
    wind: number | null;
  };

  type StationDisplay = StationGroup & { hourly: HourlyRow[] };
  type MetricKey = 'temp' | 'wind' | 'cloud';

  const TARGET_CODES = {
    temp: 'HLY-TEMP-NORMAL',
    cloud: 'HLY-CLDH-NORMAL',
    wind: 'HLY-WIND-AVGSPD'
  } as const;
  const METRIC_DETAILS: Record<MetricKey, { title: string; unit: string }> = {
    temp: { title: 'Temperature (°C)', unit: '°C' },
    wind: { title: 'Wind Speed (m/s)', unit: 'm/s' },
    cloud: { title: 'Cloud Cover (%)', unit: '%' }
  };
  const metrics: MetricKey[] = ['temp', 'wind', 'cloud'];

  let selectedLocation: CityLocation | null = null;
  let selectedDate: Date | null = null;
  let startMonth: number | null = null;
  let startDay: number | null = null;
  let startHour: number | null = null;
  let lastLookupMessage = '';
  let lastLookupTime = '';
  let sqlProgress: string[] = [];
  let sqlPreviewOpen = false;
  let haverExplaOpen = false;
  let isLoading = false;
  let errorMessage = '';
  let rows: StationRow[] = [];

  // Track previous projectInfo to detect changes and reset state
  let prevProjectInfoJson = '';

  function resetEnvState() {
    lastLookupMessage = '';
    lastLookupTime = '';
    sqlProgress = [];
    sqlPreviewOpen = false;
    haverExplaOpen = false;
    errorMessage = '';
    rows = [];
    clearCharts();
  }

  // Reset environment data when projectInfo changes
  $: {
    const currentJson = JSON.stringify($projectInfo);
    if (prevProjectInfoJson && prevProjectInfoJson !== currentJson) {
      resetEnvState();
    }
    prevProjectInfoJson = currentJson;
  }
  let groupedStations: StationGroup[] = [];
  let stationDisplays: StationDisplay[] = [];
  let Plotly: typeof import('plotly.js-dist-min') | null = null;
  let plotlyReady = false;
  let chartError = '';
  const chartRefs: Record<MetricKey, HTMLDivElement | null> = {
    temp: null,
    wind: null,
    cloud: null
  };

  const formatCoord = (value: number | null) => (value === null ? '' : value.toFixed(4));
  const formatDate = (date: Date | null) =>
    date
      ? `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
      : '';
  const formatTs = (row: { month: number; day: number; hour: number }) =>
    `${String(row.month).padStart(2, '0')}-${String(row.day).padStart(2, '0')} ${String(row.hour).padStart(2, '0')}:00`;
  const formatNumber = (value: number | null, digits = 1) =>
    value === null ? '—' : value.toFixed(digits);
  const formatElevation = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)} m`);
  const getMetricValue = (reading: HourlyRow, metric: MetricKey) =>
    reading[metric] as number | null;

  const normalizeValue = (row: StationRow) => {
    if (row.value_i === null) return null;
    if (
      row.var_code.startsWith('HLY-TEMP') ||
      row.var_code.startsWith('HLY-DEWP') ||
      row.var_code.startsWith('HLY-HIDX') ||
      row.var_code.startsWith('HLY-WCHL')
    ) {
      return row.value_i / 10;
    }
    if (row.var_code === TARGET_CODES.wind) {
      return row.value_i / 10;
    }
    if (row.var_code === TARGET_CODES.cloud) {
      return row.value_i * 100;
    }
    return row.value_i;
  };

  const scrubMissing = (raw: StationRow[]): StationRow[] =>
    raw.map((row) => ({
      ...row,
      // NOAA uses -9999 / -9999.0 for missing; turn into null so charts skip them. Added the -99990 because function calculates prior to normalize
      value_i: row.value_i === -9999 || row.value_i === -9999.0 || row.value_i === -99990 ? null : row.value_i
    }));

  const toHourlyRows = (readings: StationRow[]): HourlyRow[] => {
    const map = new Map<number, HourlyRow>();
    for (const reading of readings) {
      let bucket = map.get(reading.offset_hr);
      if (!bucket) {
        bucket = {
          offsetHr: reading.offset_hr,
          month: reading.month,
          day: reading.day,
          hour: reading.hour,
          temp: null,
          cloud: null,
          wind: null
        };
        map.set(reading.offset_hr, bucket);
      }
      const value = normalizeValue(reading);
      if (reading.var_code === TARGET_CODES.temp) {
        bucket.temp = value;
      } else if (reading.var_code === TARGET_CODES.cloud) {
        bucket.cloud = value;
      } else if (reading.var_code === TARGET_CODES.wind) {
        bucket.wind = value;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.offsetHr - b.offsetHr);
  };

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
          elevation: row.elevation,
          distanceKm: row.distance_km,
          readings: []
        };
        map.set(row.station_id, bucket);
      }
      bucket.readings.push(row);
    }
    return Array.from(map.values()).sort((a, b) => a.distanceKm - b.distanceKm);
  })();

  $: stationDisplays = groupedStations.map((station) => ({
    ...station,
    hourly: toHourlyRows(station.readings)
  }));

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

  onMount(async () => {
    if (!browser) return;
    try {
      // Use the pre-bundled browser build to avoid `global` reference errors in ESM.
      const mod = await import('plotly.js-dist-min');
      Plotly = (mod as any).default ?? (mod as any);
      plotlyReady = true;
    } catch (err) {
      chartError = 'Unable to load Plotly for chart rendering.';
      console.error(err);
    }
  });

  const buildTraces = (metric: MetricKey): PlotData[] => {
    return stationDisplays
      .map((station) => {
        const x: number[] = [];
        const y: number[] = [];
        const stamp: string[] = [];
        for (const reading of station.hourly) {
          const value = getMetricValue(reading, metric);
          if (value === null) continue;
          x.push(reading.offsetHr);
          y.push(value);
          stamp.push(formatTs(reading));
        }
        if (!x.length) return null;
        const stationLabel = station.name ?? station.ghcnId ?? 'Station';
        return {
          x,
          y,
          customdata: stamp,
          mode: 'lines+markers',
          name: `${stationLabel} (${station.distanceKm.toFixed(1)} km)`,
          hovertemplate: `Hr %{x}: %{y:.1f} ${METRIC_DETAILS[metric].unit}<br>%{customdata}<extra></extra>`
        } satisfies PlotData;
      })
      .filter(Boolean) as PlotData[];
  };

  const clearCharts = () => {
    if (!Plotly) return;
    metrics.forEach((metric) => {
      const target = chartRefs[metric];
      if (target) {
        Plotly.purge(target);
        target.innerHTML = '';
      }
    });
  };

  const renderCharts = async () => {
    if (!browser || !Plotly) return;
    chartError = '';
    await tick();

    const config: Partial<Config> = {
      responsive: true,
      displaylogo: false,
      displayModeBar: true,
      toImageButtonOptions: { format: 'png', filename: 'chart' },
      modeBarButtonsToAdd: [
        {
          name: 'Download SVG',
          title: 'Download plot as SVG',
          icon: Plotly?.Icons?.camera,
          click: (gd) => {
            Plotly?.downloadImage(gd, { format: 'svg', filename: 'chart' });
          }
        }
      ]
    };
    const baseLayout: Partial<Layout> = {
      margin: { t: 40, r: 12, b: 50, l: 55 },
      height: 320,
      hovermode: 'x unified',
      xaxis: { title: 'Offset hour (0–71)', dtick: 6, tick0: 0 }
    };

    for (const metric of metrics) {
      const target = chartRefs[metric];
      if (!target) continue;
      const traces = buildTraces(metric);
      if (!traces.length) {
        Plotly.purge(target);
        target.innerHTML =
          '<div class="flex h-full items-center justify-center text-sm text-gray-500">No data to plot.</div>';
        continue;
      }
      await Plotly.react(
        target,
        traces,
        {
          ...baseLayout,
          title: METRIC_DETAILS[metric].title,
          yaxis: { title: METRIC_DETAILS[metric].unit }
        },
        config
      );
    }
  };

  $: if (plotlyReady && stationDisplays.length) {
    renderCharts();
  } else if (plotlyReady && !stationDisplays.length) {
    clearCharts();
  }

  const pushStatus = (msg: string) => {
    sqlProgress = [...sqlProgress, msg];
  };

  function buildSql(lat: number, lon: number, month: number, day: number, hour: number) {
    const sql = `
WITH RECURSIVE
  input AS (
    SELECT
      ${lat} AS lat,
      ${lon} AS lon,
      ${month} AS month,
      ${day} AS day,
      ${hour} AS start_hour
  ),
  windows(win_rank, lat_span, lon_span) AS (
    VALUES
      (1, 0.5, 0.5),
      (2, 1.0, 1.0),
      (3, 2.5, 2.5),
      (4, 5.0, 5.0),
      (5, 90.0, 180.0)
  ),
  window_counts AS (
    SELECT
      w.win_rank,
      w.lat_span,
      w.lon_span,
      COUNT(r.rowid) AS station_count
    FROM windows w
    CROSS JOIN input i
    LEFT JOIN stations_rtree r
      ON r.min_lat <= i.lat + w.lat_span
     AND r.max_lat >= i.lat - w.lat_span
     AND r.min_lon <= i.lon + w.lon_span
     AND r.max_lon >= i.lon - w.lon_span
    GROUP BY w.win_rank, w.lat_span, w.lon_span
  ),
  chosen_window AS (
    SELECT win_rank, lat_span, lon_span
    FROM window_counts
    ORDER BY
      CASE WHEN station_count >= 3 THEN 0 ELSE 1 END,
      win_rank
    LIMIT 1
  ),
  candidate_stations AS (
    SELECT
      s.id,
      s.ghcn_id,
      s.name,
      s.latitude,
      s.longitude,
      s.elevation,
      ((s.latitude - i.lat)*(s.latitude - i.lat) +
       (s.longitude - i.lon)*(s.longitude - i.lon)) AS approx_dist2
    FROM chosen_window w
    JOIN input i
    JOIN stations_rtree r
      ON r.min_lat <= i.lat + w.lat_span
     AND r.max_lat >= i.lat - w.lat_span
     AND r.min_lon <= i.lon + w.lon_span
     AND r.max_lon >= i.lon - w.lon_span
    JOIN stations s ON s.id = r.rowid
    ORDER BY approx_dist2
    LIMIT 50
  ),
  target_vars AS (
    SELECT id, code
    FROM variables
    WHERE code IN ('HLY-TEMP-NORMAL', 'HLY-CLDH-NORMAL', 'HLY-WIND-AVGSPD')
  ),
  nearest AS (
    SELECT
      cs.id,
      cs.ghcn_id,
      cs.name,
      cs.latitude,
      cs.longitude,
      cs.elevation,
      2 * 6371 * ASIN(
        SQRT(
          POW(SIN((cs.latitude - i.lat) * PI() / 180 / 2), 2) +
          COS(i.lat * PI() / 180) * COS(cs.latitude * PI() / 180) *
          POW(SIN((cs.longitude - i.lon) * PI() / 180 / 2), 2)
        )
      ) AS distance_km
    FROM candidate_stations cs
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
JOIN target_vars v ON v.id = h.var_id
ORDER BY n.distance_km ASC, tw.offset_hr ASC, v.code ASC;
`.trim();

    return sql;
  }

  async function runSqlLookup() {
    errorMessage = '';
    rows = [];
    sqlProgress = [];
    pushStatus('Validating selection…');

    if (!selectedLocation) {
      lastLookupMessage = 'Select a city and state in Project Info to enable the lookup.';
      pushStatus('No location selected — stopping.');
      lastLookupTime = '';
      return;
    }
    if (!startMonth || !startDay) {
      lastLookupMessage = 'Choose a start date in Project Info to build the query.';
      pushStatus('No start date provided — stopping.');
      lastLookupTime = '';
      return;
    }

    pushStatus('Building SQL preview…');
    lastLookupMessage = buildSql(
      selectedLocation.latitude ?? 0,
      selectedLocation.longitude ?? 0,
      startMonth,
      startDay,
      startHour ?? 0
    );
    lastLookupTime = new Date().toLocaleString();
    sqlPreviewOpen = false;
    haverExplaOpen = false;

    isLoading = true;
    try {
      pushStatus('Requesting nearest normals from server…');
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
      rows = scrubMissing((await res.json()) as StationRow[]);
      if (!rows.length) {
        errorMessage = 'No rows returned for that location/time.';
        pushStatus('Query returned 0 rows.');
      } else {
        pushStatus(`Query returned ${rows.length} rows across ${new Set(rows.map((r) => r.station_id)).size} station(s).`);
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Lookup failed.';
      pushStatus('Lookup failed.');
    } finally {
      pushStatus('Done.');
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

      {#if sqlProgress.length}
        <div class="rounded border bg-gray-50 p-3 text-sm text-gray-800">
          <div class="flex items-center justify-between">
            <p class="font-medium">Lookup status</p>
            {#if isLoading}
              <span class="text-xs text-blue-600">running…</span>
            {/if}
          </div>
          <ul class="mt-2 space-y-1">
            {#each sqlProgress as msg, idx}
              <li class="flex items-start gap-2">
                <span class="mt-0.5 h-2 w-2 rounded-full {idx === sqlProgress.length - 1 && isLoading ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'}"></span>
                <span>{msg}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if lastLookupMessage}
        <div class="space-y-2 rounded border bg-gray-50 p-3 text-sm text-gray-800">
          <div class="flex items-center justify-between">
            <p class="font-medium">SQL preview</p>
            <button
              class="text-xs text-blue-600 hover:underline"
              type="button"
              on:click={() => (sqlPreviewOpen = !sqlPreviewOpen)}>
              {sqlPreviewOpen ? 'Hide' : 'Show'}
            </button>
          </div>
          {#if sqlPreviewOpen}
            <pre class="overflow-x-auto whitespace-pre-wrap text-xs bg-white border rounded p-3">{lastLookupMessage}</pre>
          {/if}
          {#if lastLookupTime}
            <p class="text-gray-500">Last run: {lastLookupTime}</p>
          {/if}
        </div>
        <div class="space-y-2 rounded border bg-gray-50 p-3 text-gray-800">
          <div class="flex items-center justify-between">
            <p class="font-medium">Explanation of Station Selection</p>
            <button
              class="text-xs text-blue-600 hover:underline"
              type="button"
              on:click={() => (haverExplaOpen = !haverExplaOpen)}>
              {haverExplaOpen ? 'Hide' : 'Show'}
            </button>
          </div>

          {#if haverExplaOpen}
            <div class="prose prose-sm max-w-none">
              {@html explanationHtml}
            </div>
          {/if}
        </div>
      {/if}

      {#if stationDisplays.length}
        <div class="space-y-4">
          <div class="space-y-2">
            <p class="text-sm text-gray-600">
              Returned {rows.length} rows across {stationDisplays.length} station(s) for the next 72 hours.
            </p>
            <div class="overflow-x-auto rounded border bg-white shadow-sm">
              <table class="min-w-full text-left text-sm">
                <thead class="bg-gray-50 text-gray-600">
                  <tr>
                    <th class="px-3 py-2">Station</th>
                    <th class="px-3 py-2">Latitude</th>
                    <th class="px-3 py-2">Longitude</th>
                    <th class="px-3 py-2">Elevation</th>
                    <th class="px-3 py-2">Distance (km)</th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  {#each stationDisplays as station}
                    <tr>
                      <td class="px-3 py-2">
                        <div class="font-semibold">{station.name ?? 'Station'}</div>
                        <div class="text-xs text-gray-600">{station.ghcnId ?? 'N/A'}</div>
                      </td>
                      <td class="px-3 py-2">{formatCoord(station.latitude)}</td>
                      <td class="px-3 py-2">{formatCoord(station.longitude)}</td>
                      <td class="px-3 py-2">{formatElevation(station.elevation)}</td>
                      <td class="px-3 py-2">{station.distanceKm.toFixed(1)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>

          <div class="space-y-3">
            <p class="text-sm font-semibold text-gray-700">72-hour charts (Plotly)</p>
            {#if chartError}
              <div class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {chartError}
              </div>
            {:else if !plotlyReady}
              <p class="text-sm text-gray-600">Loading charts…</p>
            {:else}
              <div class="flex flex-col gap-4">
                <div class="w-full rounded border bg-white p-3 shadow-sm">
                  <p class="text-sm font-semibold text-gray-700">{METRIC_DETAILS.temp.title}</p>
                  <div class="mt-2 h-80 w-full" bind:this={chartRefs.temp}></div>
                </div>
                <div class="w-full rounded border bg-white p-3 shadow-sm">
                  <p class="text-sm font-semibold text-gray-700">{METRIC_DETAILS.wind.title}</p>
                  <div class="mt-2 h-80 w-full" bind:this={chartRefs.wind}></div>
                </div>
                <div class="w-full rounded border bg-white p-3 shadow-sm">
                  <p class="text-sm font-semibold text-gray-700">{METRIC_DETAILS.cloud.title}</p>
                  <div class="mt-2 h-80 w-full" bind:this={chartRefs.cloud}></div>
                </div>
              </div>
            {/if}
          </div>

          <div class="space-y-3">
            <p class="text-sm font-semibold text-gray-700">
              72-hour normals (HLY-TEMP-NORMAL, HLY-CLDH-NORMAL, HLY-WIND-AVGSPD)
            </p>
            {#each stationDisplays as station}
              <div class="rounded border bg-white p-3 shadow-sm">
                <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p class="font-semibold">{station.name ?? 'Station'} ({station.ghcnId ?? 'N/A'})</p>
                    <p class="text-sm text-gray-600">
                      Offset span: 0–71 hrs · Distance {station.distanceKm.toFixed(1)} km
                    </p>
                  </div>
                  <p class="text-xs text-gray-500">
                    Lat/Lon {formatCoord(station.latitude)}, {formatCoord(station.longitude)} · Elev {formatElevation(station.elevation)}
                  </p>
                </div>
                <div class="mt-3 overflow-x-auto">
                  <table class="min-w-full text-left text-xs">
                    <thead class="text-gray-600">
                      <tr>
                        <th class="px-2 py-1">Offset hr</th>
                        <th class="px-2 py-1">Month-Day Hr</th>
                        <th class="px-2 py-1">HLY Temp</th>
                        <th class="px-2 py-1">HLY Cloud</th>
                        <th class="px-2 py-1">HLY Wind</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each station.hourly as reading}
                        <tr class="border-t">
                          <td class="px-2 py-1">{reading.offsetHr}</td>
                          <td class="px-2 py-1">{formatTs(reading)}</td>
                          <td class="px-2 py-1">{formatNumber(reading.temp)}</td>
                          <td class="px-2 py-1">{formatNumber(reading.cloud)}</td>
                          <td class="px-2 py-1">{formatNumber(reading.wind)}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
