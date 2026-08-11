<script lang="ts">
  export let stationExplanationHtml: string;
  export let climateNormalsHtml: string;
  export let liveForecastHtml: string = '';
  /**
   * Whether this tab is the visible one. All panels stay mounted, so this is
   * the only signal that the user has actually arrived — it is what schedules
   * the availability probe, rather than probing on every input change.
   */
  export let active = false;
  import { browser } from '$app/environment';
  import { onMount, tick } from 'svelte';
  import {
    projectInfo,
    weatherStations,
    chartImages,
    weatherHourlyData,
    weatherSource,
    forecastMeta,
    type ForecastMetaSnapshot
  } from '$lib/stores/form';
  import type { CityLocation, PlacesIndex } from '$lib/types';
  import { isRainHour, rainPeriods, rainHourCount } from '$lib/utils/precip';
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
    /** Forecast rows carry a real year; normals rows infer one from the form. */
    year?: number;
    /** Forecast rows only: probability of precipitation (%). */
    precipProbPct?: number | null;
    /** Forecast rows only: quantitative precipitation (mm), a block total. */
    precipAmountMm?: number | null;
    /** Forecast rows only: value held over rather than read directly. */
    estimated?: boolean;
  };

  type StationDisplay = StationGroup & { hourly: HourlyRow[] };
  type MetricKey = 'temp' | 'wind' | 'cloud';

  /** Row shape returned by `/api/forecast`. */
  type ForecastApiRow = {
    offsetHr: number;
    year: number;
    month: number;
    day: number;
    hour: number;
    airTempC: number | null;
    windMps: number | null;
    cloudPct: number | null;
    precipProbPct: number | null;
    precipAmountMm: number | null;
    estimated: boolean;
  };

  type ForecastApiResponse = { meta: ForecastMetaSnapshot; rows: ForecastApiRow[] };

  /** Response shape of `/api/forecast/availability`. */
  type ForecastAvailability = {
    status: 'covered' | 'partial' | 'unavailable';
    reason: string | null;
    hours: number;
    estimatedLeadingHours: number;
    gridId: string;
    gridX: number;
    gridY: number;
    timeZone: string;
    updateTime: string | null;
    elevationM: number | null;
    requestedStart: string;
    requestedEnd: string;
    coverageStart: string | null;
    coverageEnd: string | null;
  };

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
  let normalExplaOpen = false;
  let forecastExplaOpen = false;
  let isLoading = false;
  let errorMessage = '';
  let rows: StationRow[] = [];
  /** Single pseudo-station holding the NWS grid-point series, when in use. */
  let forecastDisplay: StationDisplay | null = null;
  /** Non-fatal advisory about the forecast result (e.g. clamped hours). */
  let forecastNotice = '';

  // ---------------------------------------------------------------------------
  // Live-forecast availability
  //
  // Whether NWS can serve this window is a property of the data it has issued,
  // not of the calendar, so it is measured rather than inferred. The measurement
  // costs an upstream request, so it runs when the user arrives on this tab and
  // not on every edit to the location or date — an edit only marks the answer
  // stale, and the next visit re-checks. `probedKey` is what makes that
  // staleness explicit.
  // ---------------------------------------------------------------------------

  let availability: ForecastAvailability | null = null;
  let availabilityState: 'idle' | 'checking' | 'ready' = 'idle';
  let availabilityError = '';
  /** The inputs `availability` describes. Anything else means it is stale. */
  let probedKey = '';

  /**
   * Identity of the window a probe would answer for; empty when there is
   * nothing to ask about. Coordinates must be real — a city row with no
   * latitude would otherwise probe the Gulf of Guinea at 0,0.
   */
  $: probeKey =
    selectedLocation?.latitude != null && selectedLocation?.longitude != null && $projectInfo.date
      ? `${selectedLocation.latitude},${selectedLocation.longitude}|${$projectInfo.date}|${startHour}`
      : '';

  $: availabilityFresh = availabilityState === 'ready' && probedKey === probeKey && probeKey !== '';
  /** The live source is offered only on a positive, current answer. */
  $: forecastOffered = availabilityFresh && !!availability && availability.status !== 'unavailable';

  async function probeAvailability(force = false) {
    if (!browser || !probeKey) return;
    if (availabilityState === 'checking') return;
    if (!force && availabilityFresh) return;

    const key = probeKey;
    availabilityState = 'checking';
    availabilityError = '';
    try {
      const params = new URLSearchParams({
        lat: String(selectedLocation?.latitude),
        lon: String(selectedLocation?.longitude),
        date: $projectInfo.date,
        startHour: String(startHour ?? 0)
      });
      const res = await fetch(`/api/forecast/availability?${params.toString()}`);
      const body = await res.json();
      // An upstream failure still answers the question — it just answers "no".
      if (!body?.status) {
        throw new Error(body?.error ?? body?.reason ?? `Availability check failed (${res.status})`);
      }
      availability = body as ForecastAvailability;
      probedKey = key;
    } catch (err) {
      availability = null;
      probedKey = key;
      availabilityError = err instanceof Error ? err.message : 'Availability check failed.';
    } finally {
      availabilityState = 'ready';
    }
  }

  /** Drop the answer without re-asking; the next visit to the tab re-checks. */
  function invalidateAvailability() {
    availability = null;
    availabilityError = '';
    availabilityState = 'idle';
    probedKey = '';
  }

  // Probe on arrival, not on every input change. All tab panels stay mounted,
  // so `onMount` fires at page load and cannot stand in for this.
  let wasActive = false;
  function onActiveChange(isActive: boolean) {
    if (isActive && !wasActive) void probeAvailability();
    wasActive = isActive;
  }
  $: onActiveChange(active);

  // A definite "no" retires a selection the user can no longer act on. Guarded
  // on a *current* answer so an in-flight or stale check never overrides them.
  // Kept out of `errorMessage` so the reset that follows the source change does
  // not immediately wipe it.
  let sourceNotice = '';
  $: if (
    $weatherSource === 'forecast' &&
    availabilityFresh &&
    availability?.status === 'unavailable'
  ) {
    weatherSource.set('normals');
    sourceNotice =
      'Switched back to climate normals — the live forecast cannot cover this window. ' +
      (availability?.reason ?? '');
  }

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
    forecastDisplay = null;
    forecastNotice = '';
    forecastMeta.set(null);
    clearCharts();
    weatherHourlyData.set([]);
  }

  // Reset environment data when projectInfo changes, and retire the availability
  // answer that described the old inputs — without immediately re-asking, since
  // these edits happen on other tabs and would otherwise fire a request per
  // keystroke. Deliberately does not touch $weatherSource: the user's choice of
  // dataset survives edits to the project inputs, and the guard above handles
  // the one case where it cannot.
  $: {
    const currentJson = JSON.stringify($projectInfo);
    if (prevProjectInfoJson && prevProjectInfoJson !== currentJson) {
      resetEnvState();
      invalidateAvailability();
    }
    prevProjectInfoJson = currentJson;
  }

  // Switching dataset invalidates any results already on screen.
  let prevWeatherSource = $weatherSource;
  $: if ($weatherSource !== prevWeatherSource) {
    prevWeatherSource = $weatherSource;
    resetEnvState();
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
  const formatNumber = (value: number | null | undefined, digits = 1) =>
    value === null || value === undefined ? '—' : value.toFixed(digits);
  const formatElevation = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)} m`);
  /** Render an ISO instant as wall-clock time at the project site. */
  const formatIsoLocal = (iso: string | null, timeZone: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString([], { timeZone, timeStyle: 'short', dateStyle: 'medium' });
    } catch {
      return iso;
    }
  };
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

  // The forecast path yields a single grid point rather than three stations,
  // but wears the same shape so the charts, tables and downstream stores below
  // need no knowledge of which source is active.
  $: stationDisplays =
    $weatherSource === 'forecast'
      ? forecastDisplay
        ? [forecastDisplay]
        : []
      : groupedStations.map((station) => ({
          ...station,
          hourly: toHourlyRows(station.readings)
        }));

  /**
   * Wet spans in the loaded forecast, on the analysis charts' hour axis. Empty
   * on the normals path — `forecastDisplay` is only ever populated by the
   * forecast lookup, and climate normals carry no precipitation series at all.
   */
  $: forecastRain = rainPeriods(forecastDisplay?.hourly ?? []);

  /** Hours rendered in the result table, across all series. */
  $: resultRowCount =
    $weatherSource === 'forecast'
      ? (forecastDisplay?.hourly.length ?? 0)
      : rows.length;

  // Update weatherStations store when station data changes
  $: weatherStations.set(stationDisplays.map((station) => ({
    stationId: station.stationId,
    ghcnId: station.ghcnId,
    name: station.name,
    latitude: station.latitude,
    longitude: station.longitude,
    elevation: station.elevation,
    distanceKm: station.distanceKm
  })));

  // Populate weatherHourlyData from the nearest station (normals) or the grid
  // point (forecast) for use in the thermal model.
  $: {
    const nearest = stationDisplays[0];
    if (nearest) {
      const fallbackYear = $projectInfo.date
        ? parseInt($projectInfo.date.split('-')[0], 10)
        : new Date().getFullYear();
      weatherHourlyData.set(
        nearest.hourly.map((row) => ({
          offsetHr: row.offsetHr,
          // Forecast rows carry the true year, including a rollover across
          // 31 December that the form date alone would not give.
          year:     row.year ?? fallbackYear,
          month:    row.month,
          day:      row.day,
          hour:     row.hour,
          airTempC: row.temp  ?? 20,
          windMps:  row.wind  ?? 3,
          cloudPct: row.cloud,
          // Carried, not consumed: the thermal model has no rainfall term, so
          // these only feed the wet-hour warning on the analysis output.
          precipProbPct:  row.precipProbPct,
          precipAmountMm: row.precipAmountMm,
          estimated: row.estimated
        }))
      );
    }
  }

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
    const plotly = Plotly;
    if (!plotly) return;
    metrics.forEach((metric) => {
      const target = chartRefs[metric];
      if (target) {
        plotly.purge(target);
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
          click: (gd: any) => {
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

    // Layout overrides for PDF capture: legend below chart, larger fonts
    const pdfLayout: Partial<Layout> = {
      margin: { t: 50, r: 20, b: 100, l: 70 },
      height: 540,
      hovermode: 'x unified',
      xaxis: {
        title: { text: 'Offset hour (0–71)', font: { size: 16 } },
        tickfont: { size: 14 },
        dtick: 6,
        tick0: 0
      },
      yaxis: {
        titlefont: { size: 16 },
        tickfont: { size: 14 }
      },
      legend: {
        orientation: 'h',
        y: -0.25,
        x: 0.5,
        xanchor: 'center',
        font: { size: 14 }
      },
      title: { font: { size: 18 } },
      showlegend: true
    };

    const capturedImages: { temp: string; wind: string; cloud: string } = {
      temp: '',
      wind: '',
      cloud: ''
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

      // Capture chart as static image for PDF with legend below
      try {
        // Temporarily re-render with PDF layout for capture
        await Plotly.react(
          target,
          traces,
          {
            ...pdfLayout,
            title: { text: METRIC_DETAILS[metric].title, font: { size: 18 } },
            yaxis: { title: { text: METRIC_DETAILS[metric].unit, font: { size: 16 } }, tickfont: { size: 14 } }
          },
          { ...config, staticPlot: true }
        );
        const imgData = await Plotly.toImage(target, {
          format: 'png',
          width: 1200,
          height: 646
        });
        capturedImages[metric] = imgData;
        // Restore the interactive layout for the webpage
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
      } catch (err) {
        console.error(`Failed to capture ${metric} chart:`, err);
      }
    }

    // Update the chartImages store with captured images
    chartImages.set(capturedImages);
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

  /**
   * Human-readable preview of the two NWS requests, standing in for the SQL
   * preview when the live forecast is the active source.
   */
  function buildForecastPreview(lat: number, lon: number, date: string, hour: number) {
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    return `# Step 1 — resolve the NWS forecast grid cell and site timezone
GET https://api.weather.gov/points/${key}
    -> properties.forecastGridData, properties.timeZone

# Step 2 — read the raw gridded forecast for that cell
GET {properties.forecastGridData}
    -> properties.temperature   (degC)
    -> properties.windSpeed     (km/h -> m/s)
    -> properties.skyCover      (percent)

# Window
start   = ${date} ${String(hour).padStart(2, '0')}:00 site-local
hours   = 72 (offset 0-71)

# Notes
ISO-8601 intervals (PT1H / PT3H / PT6H) are expanded to whole hours.
Hours preceding the first issued forecast hour are held at the earliest
issued value and flagged as estimated.`;
  }

  /** Shared preamble; returns the validated inputs or null after reporting. */
  function validateSelection() {
    errorMessage = '';
    sourceNotice = '';
    rows = [];
    forecastDisplay = null;
    forecastNotice = '';
    forecastMeta.set(null);
    sqlProgress = [];
    pushStatus('Validating selection…');

    if (!selectedLocation) {
      lastLookupMessage = 'Select a city and state in Project Info to enable the lookup.';
      pushStatus('No location selected — stopping.');
      lastLookupTime = '';
      return null;
    }
    if (!startMonth || !startDay) {
      lastLookupMessage = 'Choose a start date in Project Info to build the query.';
      pushStatus('No start date provided — stopping.');
      lastLookupTime = '';
      return null;
    }
    return {
      lat: selectedLocation.latitude ?? 0,
      lon: selectedLocation.longitude ?? 0,
      month: startMonth,
      day: startDay,
      hour: startHour ?? 0
    };
  }

  /** Dispatch to whichever dataset the user selected. */
  async function runLookup() {
    if ($weatherSource === 'forecast') await runForecastLookup();
    else await runNormalsLookup();
  }

  async function runForecastLookup() {
    const input = validateSelection();
    if (!input) return;

    pushStatus('Building NWS request preview…');
    lastLookupMessage = buildForecastPreview(
      input.lat,
      input.lon,
      $projectInfo.date,
      input.hour
    );
    lastLookupTime = new Date().toLocaleString();
    sqlPreviewOpen = false;
    haverExplaOpen = false;
    normalExplaOpen = false;
    forecastExplaOpen = false;

    isLoading = true;
    try {
      pushStatus('Requesting 72-hour NOAA forecast from server…');
      const params = new URLSearchParams({
        lat: String(input.lat),
        lon: String(input.lon),
        date: $projectInfo.date,
        startHour: String(input.hour)
      });
      const res = await fetch(`/api/forecast?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error ?? `Forecast lookup failed (${res.status})`);
      }

      const { meta, rows: apiRows } = body as ForecastApiResponse;
      forecastMeta.set(meta);
      pushStatus(`Grid cell ${meta.gridId} ${meta.gridX},${meta.gridY} (${meta.timeZone}).`);

      forecastDisplay = {
        stationId: -1,
        ghcnId: null,
        name: `NWS Forecast Grid ${meta.gridId} ${meta.gridX},${meta.gridY}`,
        latitude: input.lat,
        longitude: input.lon,
        elevation: meta.elevationM,
        distanceKm: 0,
        readings: [],
        hourly: apiRows.map((row) => ({
          offsetHr: row.offsetHr,
          year: row.year,
          month: row.month,
          day: row.day,
          hour: row.hour,
          temp: row.airTempC,
          wind: row.windMps,
          cloud: row.cloudPct,
          precipProbPct: row.precipProbPct,
          precipAmountMm: row.precipAmountMm,
          estimated: row.estimated
        }))
      };

      if (meta.estimatedLeadingHours > 0) {
        forecastNotice =
          `The construction start time has already passed. The first ` +
          `${meta.estimatedLeadingHours} hour(s) are held at the earliest issued ` +
          `forecast value (forecast begins ${formatIsoLocal(meta.forecastStart, meta.timeZone)}) ` +
          `and are flagged in the table below.`;
        pushStatus(`Clamped ${meta.estimatedLeadingHours} leading hour(s).`);
      }

      pushStatus(`Received ${apiRows.length} forecast hours.`);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Forecast lookup failed.';
      pushStatus('Lookup failed.');
    } finally {
      pushStatus('Done.');
      isLoading = false;
    }
  }

  async function runNormalsLookup() {
    const input = validateSelection();
    if (!input) return;

    pushStatus('Building SQL preview…');
    lastLookupMessage = buildSql(input.lat, input.lon, input.month, input.day, input.hour);
    lastLookupTime = new Date().toLocaleString();
    sqlPreviewOpen = false;
    haverExplaOpen = false;
    normalExplaOpen = false;
    forecastExplaOpen = false;

    isLoading = true;
    try {
      pushStatus('Requesting nearest normals from server…');
      const params = new URLSearchParams({
        lat: String(input.lat),
        lon: String(input.lon),
        month: String(input.month),
        day: String(input.day),
        startHour: String(input.hour)
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
        <h3 class="text-lg font-semibold">
          {$weatherSource === 'forecast' ? 'Live NOAA Forecast' : 'Nearest Weather Stations'}
        </h3>
        <p class="text-sm text-gray-600">Lookup runs only when you click the button.</p>
      </div>
      <button
        class="w-full md:w-auto rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        on:click={runLookup}
        disabled={!selectedLocation ||
          isLoading ||
          ($weatherSource === 'forecast' && !forecastOffered)}>
        {#if isLoading}
          Running…
        {:else if $weatherSource === 'forecast'}
          Fetch 72-hour Forecast
        {:else}
          Run SQL Lookup
        {/if}
      </button>
    </div>

    <fieldset class="mt-4 rounded border bg-gray-50 p-3">
      <legend class="px-1 text-sm font-medium text-gray-700">Weather data source</legend>
      <div class="flex flex-col gap-2">
        <label class="flex items-start gap-2 text-sm">
          <input
            type="radio"
            class="mt-1"
            value="normals"
            checked={$weatherSource === 'normals'}
            on:change={() => weatherSource.set('normals')} />
          <span>
            <span class="font-medium">Climate Normals (NOAA, 1991–2020)</span>
            <span class="block text-xs text-gray-600">
              30-year hourly expectation for this location and calendar date. Available for any
              start date.
            </span>
          </span>
        </label>
        <label class="flex items-start gap-2 text-sm {forecastOffered ? '' : 'opacity-60'}">
          <input
            type="radio"
            class="mt-1"
            value="forecast"
            disabled={!forecastOffered}
            checked={$weatherSource === 'forecast'}
            on:change={() => weatherSource.set('forecast')} />
          <span>
            <span class="font-medium">Live 72-hour Forecast (NOAA/NWS)</span>
            <span class="block text-xs text-gray-600">
              Predicted hourly conditions at the project coordinates, from the National Weather
              Service grid. Offered whenever NWS has issued data covering the whole window.
            </span>
          </span>
        </label>
      </div>

      <!-- One measured answer, plus the means to ask again. The user chooses;
           nothing switches source on their behalf except a definite "no". -->
      <div class="mt-3 border-t pt-3 text-xs">
        {#if !probeKey}
          <p class="text-gray-500">
            Pick a city and start date in Project Info to check whether live forecast data covers
            this window.
          </p>
        {:else if availabilityState === 'checking'}
          <p class="flex items-center gap-2 text-gray-600">
            <span class="h-2 w-2 animate-pulse rounded-full bg-blue-500"></span>
            Checking whether NWS has forecast data for this window…
          </p>
        {:else if availabilityState === 'idle' || !availabilityFresh}
          <div class="flex flex-wrap items-center gap-2 text-gray-600">
            <span>Live forecast availability has not been checked for the current inputs.</span>
            <button
              type="button"
              class="rounded border border-blue-200 bg-white px-2 py-1 text-blue-700 hover:bg-blue-50"
              on:click={() => probeAvailability(true)}>Check now</button>
          </div>
        {:else if availabilityError}
          <div class="flex flex-wrap items-center gap-2 text-amber-800">
            <span>Could not check live forecast availability: {availabilityError}</span>
            <button
              type="button"
              class="rounded border border-amber-300 bg-white px-2 py-1 hover:bg-amber-50"
              on:click={() => probeAvailability(true)}>Retry</button>
          </div>
        {:else if availability}
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="space-y-1">
              {#if availability.status === 'covered'}
                <p class="font-medium text-green-700">
                  Live forecast available — NWS covers all {availability.hours} hours of this
                  window.
                </p>
                <p class="text-gray-600">
                  Grid {availability.gridId}
                  {availability.gridX},{availability.gridY} · issued
                  {formatIsoLocal(availability.updateTime, availability.timeZone)} · select it above
                  to use it instead of climate normals.
                </p>
              {:else if availability.status === 'partial'}
                <p class="font-medium text-amber-800">
                  Live forecast partly available — {availability.estimatedLeadingHours} of
                  {availability.hours} hours would be estimated.
                </p>
                <p class="text-gray-600">{availability.reason}</p>
                <p class="text-gray-600">
                  Usable, but climate normals may be the better choice. Your call.
                </p>
              {:else}
                <p class="font-medium text-gray-700">
                  Live forecast unavailable for this window — climate normals will be used.
                </p>
                <p class="text-gray-600">{availability.reason}</p>
              {/if}
              {#if availability.coverageStart && availability.coverageEnd}
                <p class="text-gray-500">
                  NWS currently forecasts
                  {formatIsoLocal(availability.coverageStart, availability.timeZone)} through
                  {formatIsoLocal(availability.coverageEnd, availability.timeZone)} (site time).
                </p>
              {/if}
            </div>
            <button
              type="button"
              class="shrink-0 rounded border border-gray-300 bg-white px-2 py-1 text-gray-700 hover:bg-gray-50"
              on:click={() => probeAvailability(true)}>Check again</button>
          </div>
        {/if}
      </div>
    </fieldset>

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
              {#if $weatherSource === 'forecast'}
                Start for forecast: <span class="font-medium">{$projectInfo.date}</span>
              {:else}
                Start date for lookup (month-day only):
                <span class="font-medium">{formatDate(selectedDate)}</span>
              {/if}
              at hour <span class="font-medium">{String(startHour ?? 0).padStart(2, '0')}:00</span>
            </p>
          {/if}
        </div>
      {:else}
        <p class="text-gray-500">Pick a city in Project Info to enable the lookup.</p>
      {/if}
    </div>

    <div class="mt-4 space-y-3">
      {#if sourceNotice}
        <div class="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {sourceNotice}
        </div>
      {/if}

      {#if errorMessage}
        <div class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorMessage}
        </div>
      {/if}

      {#if forecastNotice}
        <div class="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {forecastNotice}
        </div>
      {/if}

      {#if forecastRain.length}
        <div class="rounded border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <p class="font-semibold">
            Rain forecast in {rainHourCount(forecastRain)} of the 72 hours — from hour
            {forecastRain[0].startHour} after placement.
          </p>
          <p class="mt-1 text-xs">
            The thermal model has no rainfall term, so it cannot reproduce the surface cooling a
            wetted slab undergoes. Temperature, stress and cracking results are not reliable from
            the first wet hour onward; the affected hours are shaded on the analysis charts.
          </p>
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
            <p class="font-medium">
              {$weatherSource === 'forecast' ? 'NWS request preview' : 'SQL preview'}
            </p>
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
        {#if $weatherSource === 'forecast'}
          {#if $forecastMeta}
            <div class="space-y-1 rounded border bg-gray-50 p-3 text-sm text-gray-800">
              <p class="font-medium">Forecast provenance</p>
              <p>
                Grid cell <span class="font-medium">{$forecastMeta.gridId}
                  {$forecastMeta.gridX},{$forecastMeta.gridY}</span>
                · timezone {$forecastMeta.timeZone}
              </p>
              <p>
                Issued <span class="font-medium"
                  >{formatIsoLocal($forecastMeta.updateTime, $forecastMeta.timeZone)}</span>
                · window begins {formatIsoLocal($forecastMeta.forecastStart, $forecastMeta.timeZone)}
              </p>
              <p class="text-xs text-gray-500">
                NOAA reissues these grids roughly hourly. Re-run the lookup before relying on the
                result if significant time has passed.
              </p>
            </div>
          {/if}

          <div class="space-y-2 rounded border bg-gray-50 p-3 text-gray-800">
            <div class="flex items-center justify-between">
              <p class="font-medium">Explanation of the Live Forecast</p>
              <button
                class="text-xs text-blue-600 hover:underline"
                type="button"
                on:click={() => (forecastExplaOpen = !forecastExplaOpen)}>
                {forecastExplaOpen ? 'Hide' : 'Show'}
              </button>
            </div>

            {#if forecastExplaOpen}
              <div class="prose prose-sm max-w-none">
                {@html liveForecastHtml}
              </div>
            {/if}
          </div>
        {:else}
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
                {@html stationExplanationHtml}
              </div>
            {/if}
          </div>

          <div class="space-y-2 rounded border bg-gray-50 p-3 text-gray-800">
            <div class="flex items-center justify-between">
              <p class="font-medium">Explanation of Climate Normals</p>
              <button
                class="text-xs text-blue-600 hover:underline"
                type="button"
                on:click={() => (normalExplaOpen = !normalExplaOpen)}>
                {normalExplaOpen ? 'Hide' : 'Show'}
              </button>
            </div>

            {#if normalExplaOpen}
              <div class="prose prose-sm max-w-none">
                {@html climateNormalsHtml}
              </div>
            {/if}
          </div>
        {/if}
      {/if}

      {#if stationDisplays.length}
        <div class="space-y-4">
          <div class="space-y-2">
            <p class="text-sm text-gray-600">
              {#if $weatherSource === 'forecast'}
                Returned {resultRowCount} forecast hours for one grid point covering the next 72
                hours.
              {:else}
                Returned {resultRowCount} rows across {stationDisplays.length} station(s) for the next
                72 hours.
              {/if}
            </p>
            <div class="overflow-x-auto rounded border bg-white shadow-sm">
              <table class="min-w-full text-left text-sm">
                <thead class="bg-gray-50 text-gray-600">
                  <tr>
                    <th class="px-3 py-2"
                      >{$weatherSource === 'forecast' ? 'Forecast grid point' : 'Station'}</th>
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
                        <div class="text-xs text-gray-600">
                          {station.ghcnId ??
                            ($weatherSource === 'forecast'
                              ? 'NWS gridded forecast at the project coordinates'
                              : 'N/A')}
                        </div>
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
              {#if $weatherSource === 'forecast'}
                72-hour NWS forecast (temperature, sky cover, wind speed, precipitation)
              {:else}
                72-hour normals (HLY-TEMP-NORMAL, HLY-CLDH-NORMAL, HLY-WIND-AVGSPD)
              {/if}
            </p>
            {#each stationDisplays as station}
              <div class="rounded border bg-white p-3 shadow-sm">
                <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p class="font-semibold">
                      {station.name ?? 'Station'}{station.ghcnId ? ` (${station.ghcnId})` : ''}
                    </p>
                    <p class="text-sm text-gray-600">
                      Offset span: 0–71 hrs{$weatherSource === 'forecast'
                        ? ''
                        : ` · Distance ${station.distanceKm.toFixed(1)} km`}
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
                        <th class="px-2 py-1">
                          {$weatherSource === 'forecast' ? 'Temp (°C)' : 'HLY Temp'}
                        </th>
                        <th class="px-2 py-1">
                          {$weatherSource === 'forecast' ? 'Sky cover (%)' : 'HLY Cloud'}
                        </th>
                        <th class="px-2 py-1">
                          {$weatherSource === 'forecast' ? 'Wind (m/s)' : 'HLY Wind'}
                        </th>
                        {#if $weatherSource === 'forecast'}
                          <th class="px-2 py-1">Precip (%)</th>
                          <th class="px-2 py-1">QPF (mm)</th>
                          <th class="px-2 py-1">Source</th>
                        {/if}
                      </tr>
                    </thead>
                    <tbody>
                      {#each station.hourly as reading}
                        <tr class="border-t {reading.estimated ? 'bg-amber-50' : ''}">
                          <td class="px-2 py-1">{reading.offsetHr}</td>
                          <td class="px-2 py-1">{formatTs(reading)}</td>
                          <td class="px-2 py-1">{formatNumber(reading.temp)}</td>
                          <td class="px-2 py-1">{formatNumber(reading.cloud)}</td>
                          <td class="px-2 py-1">{formatNumber(reading.wind)}</td>
                          {#if $weatherSource === 'forecast'}
                            {@const wet = isRainHour(reading)}
                            <td class="px-2 py-1 {wet ? 'font-semibold text-sky-800' : ''}">
                              {formatNumber(reading.precipProbPct)}
                            </td>
                            <td class="px-2 py-1 {wet ? 'font-semibold text-sky-800' : ''}">
                              {formatNumber(reading.precipAmountMm)}
                            </td>
                            <td class="px-2 py-1 {reading.estimated ? 'text-amber-800' : 'text-gray-500'}">
                              {reading.estimated ? 'estimated' : 'forecast'}
                            </td>
                          {/if}
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
