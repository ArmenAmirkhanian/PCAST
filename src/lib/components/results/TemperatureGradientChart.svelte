<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import {
    projectInfo,
    materials,
    slabLayout,
    weatherHourlyData,
    thermalGradientResults,
    hydrationModelResults,
    type WeatherHourlyRow
  } from '$lib/stores/form';
  import { unitSystem, fToC } from '$lib/stores/units';
  import { runModel } from '$lib/models/illitherm/run';
  import type { ModelInput, WeatherRow } from '$lib/models/illitherm/types';
  import type { Layout, PlotData } from 'plotly.js';

  // Additional thermal model inputs not sourced from other tabs
  let Hu = 375000; // J/kg — total heat of hydration (default: Type I/II)
  let cc = 350;    // kg/m³ — cement content

  // Hours 1–72 available for display
  const ALL_HOURS = Array.from({ length: 72 }, (_, i) => i + 1);
  let selectedHours = new Set<number>([1, 6, 12, 24, 48, 72]);

  // Run state
  let isRunning = false;
  let runError = '';
  let hasRun = false;

  // Plotly
  let Plotly: any = null;
  let plotlyReady = false;
  let chartRef: HTMLDivElement | null = null;

  // Validation — what must be done before the model can run
  $: missingInputs = (() => {
    const issues: string[] = [];
    if (!$weatherHourlyData.length)
      issues.push('Run the SQL lookup in the Environment tab to load weather data.');
    if (!$slabLayout.thickness)
      issues.push('Enter slab thickness in the Slab Layout tab.');
    return issues;
  })();

  function estimateSolarRad(hour: number, cloudPct: number | null): number {
    if (hour < 6 || hour > 20) return 0;
    const sunFraction = Math.sin(Math.PI * (hour - 6) / 14);
    const cloudFactor = cloudPct !== null ? 1 - (cloudPct / 100) * 0.75 : 0.5;
    return Math.max(0, 600 * sunFraction * cloudFactor);
  }

  function toWeatherRows(data: WeatherHourlyRow[]): WeatherRow[] {
    return data.slice(0, 72).map((row) => ({
      year:      row.year,
      month:     row.month,
      day:       row.day,
      hour:      row.hour,
      airTemp:   row.airTempC,
      windSpeed: row.windMps,
      dewPoint:  row.airTempC - 5,
      solarRad:  estimateSolarRad(row.hour, row.cloudPct)
    }));
  }

  function buildModelInput(): ModelInput | null {
    const weather = $weatherHourlyData;
    const slab    = $slabLayout;
    if (!weather.length || !slab.thickness) return null;

    const pi = $projectInfo;
    const deliveryTempC = fToC(
      typeof pi.deliveryTempF === 'number' ? pi.deliveryTempF :
      typeof pi.startTempF    === 'number' ? pi.startTempF    : 73
    );

    const thicknessM = (slab.thickness as number) * 0.0254;

    // Prefer Schindler-Folliard results from Materials tab; fall back to literature defaults
    const sfResults = $hydrationModelResults['schindler-folliard'];
    const sfInputs  = $materials.hydrationModelInputs;
    const alphau    = sfResults?.alpha_u ?? 0.87;
    const tau       = sfResults?.tau     ?? 12.5;
    const beta      = sfResults?.beta    ?? 1.0;
    const EaRaw     = sfInputs['schindler-folliard__E'];
    const Ea        = typeof EaRaw === 'number' ? EaRaw : 33500;

    return {
      controls:  { numStepsPerHour: 4, spinUpReps: 2, numPointsTopLayer: 11 },
      surface:   { albedo: 0.5, emissivity: 0.9 },
      layers: [{
        thickness:           thicknessM,
        thermalConductivity: 1.5,
        heatCapacity:        840,
        density:             2300,
        numLayerElements:    10
      }],
      weather:   toWeatherRows(weather),
      hydration: {
        alphau,
        tau,
        Ea,
        R:         8.3144,
        Hu,
        cc,
        beta,
        Tr:        23,
        Tdelivery: deliveryTempC
      }
    };
  }

  async function runAnalysis() {
    isRunning = true;
    runError  = '';
    try {
      const input = buildModelInput();
      if (!input) {
        runError = 'Missing required inputs. See checklist above.';
        return;
      }
      const output = runModel(input);
      thermalGradientResults.set(output);
      hasRun = true;
      await tick(); // ensure {#if hasRun} renders chartRef into DOM
      await renderChart();
    } catch (e) {
      runError = e instanceof Error ? e.message : String(e);
    } finally {
      isRunning = false;
    }
  }

  // Maps hour 1 (blue) → hour 72 (red) through the standard thermal-gradient spectrum
  function hourColor(hour: number): string {
    const t   = (hour - 1) / 71;          // 0 at hour 1, 1 at hour 72
    const hue = Math.round(240 * (1 - t)); // 240 = blue, 0 = red
    return `hsl(${hue}, 90%, 45%)`;
  }

  function buildTraces(): PlotData[] {
    const results = $thermalGradientResults;
    if (!results || !$slabLayout.thickness) return [];

    const sys        = $unitSystem;
    const thicknessM = ($slabLayout.thickness as number) * 0.0254;
    const numPoints  = results.results[0]?.temps.length ?? 11;

    // Evenly-spaced depth positions from surface (0) to bottom (thickness)
    const depthsM       = Array.from({ length: numPoints }, (_, i) => (thicknessM / (numPoints - 1)) * i);
    const depthsDisplay = sys === 'us'
      ? depthsM.map((d) => d * 39.3701) // m → in
      : depthsM.map((d) => d * 1000);   // m → mm

    const traces: PlotData[] = [];
    for (let i = 0; i < results.results.length; i++) {
      const label = i + 1; // results[0] → "Hour 1", results[71] → "Hour 72"
      if (!selectedHours.has(label)) continue;
      const row   = results.results[i];
      const temps = sys === 'us'
        ? row.temps.map((t) => t * 1.8 + 32)
        : row.temps;
      traces.push({
        x:             temps,
        y:             depthsDisplay,
        mode:          'lines',
        name:          `Hour ${label}`,
        line:          { color: hourColor(label) },
        hovertemplate: sys === 'us'
          ? `%{x:.1f}°F at %{y:.2f} in<extra>Hour ${label}</extra>`
          : `%{x:.1f}°C at %{y:.0f} mm<extra>Hour ${label}</extra>`
      } as PlotData);
    }
    return traces;
  }

  async function renderChart() {
    if (!browser || !Plotly || !chartRef || !$thermalGradientResults) return;
    const sys    = $unitSystem;
    const traces = buildTraces();
    const layout: Partial<Layout> = {
      title:  { text: 'Slab Temperature Gradient Over Time', font: { size: 16 } },
      xaxis:  {
        title: {
          text: sys === 'us' ? 'Temperature (°F)' : 'Temperature (°C)',
          font: { size: 13 }
        },
        tickfont: { size: 12 }
      },
      yaxis:  {
        title: {
          text: sys === 'us' ? 'Depth (in)' : 'Depth (mm)',
          font: { size: 13 }
        },
        tickfont:  { size: 12 },
        autorange: 'reversed'
      },
      legend:    { title: { text: 'Hour' } },
      height:    500,
      margin:    { t: 55, r: 20, b: 70, l: 80 },
      hovermode: 'closest'
    };
    await Plotly.react(chartRef, traces, layout, { responsive: true, displaylogo: false });
  }

  // Re-render whenever selected hours, unit system, or results change
  $: if (plotlyReady && hasRun && $thermalGradientResults && selectedHours && $unitSystem) {
    renderChart();
  }

  onMount(async () => {
    if (!browser) return;
    const mod = await import('plotly.js-dist-min');
    Plotly       = (mod as any).default ?? mod;
    plotlyReady  = true;
    if (hasRun && $thermalGradientResults) await renderChart();
  });

  function toggleHour(h: number) {
    const next = new Set(selectedHours);
    if (next.has(h)) next.delete(h); else next.add(h);
    selectedHours = next;
  }
  function selectAll()         { selectedHours = new Set(ALL_HOURS); }
  function clearAll()          { selectedHours = new Set(); }
  function selectEvery(n: number) {
    selectedHours = new Set(ALL_HOURS.filter((h) => h % n === 0));
  }
</script>

<div class="space-y-4">

  <!-- Prerequisite warnings -->
  {#if missingInputs.length}
    <div class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      <p class="font-medium mb-1">Complete these steps before running the analysis:</p>
      <ul class="list-disc pl-4 space-y-0.5">
        {#each missingInputs as msg}
          <li>{msg}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <!-- Thermal model parameter inputs -->
  <div class="rounded-lg border bg-white p-4 shadow-sm">
    <h3 class="text-lg font-semibold mb-3">Thermal Model Parameters</h3>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-lg">
      <div class="flex flex-col gap-1">
        <label for="input-hu" class="text-sm font-medium">
          Total Heat of Hydration, H<sub>u</sub> (J/kg)
        </label>
        <input
          id="input-hu"
          type="number"
          class="border rounded-lg p-2 text-sm"
          bind:value={Hu}
          min="0"
          step="1000" />
        <p class="text-xs text-gray-500">Default: 375,000 J/kg (Type I/II)</p>
      </div>
      <div class="flex flex-col gap-1">
        <label for="input-cc" class="text-sm font-medium">
          Cement Content, c<sub>c</sub> (kg/m³)
        </label>
        <input
          id="input-cc"
          type="number"
          class="border rounded-lg p-2 text-sm"
          bind:value={cc}
          min="0"
          step="10" />
        <p class="text-xs text-gray-500">Default: 350 kg/m³</p>
      </div>
    </div>
    {#if $hydrationModelResults['schindler-folliard']}
      <p class="text-xs text-green-700 mt-3">
        Using α<sub>u</sub>, τ, β, and E<sub>a</sub> from the Schindler-Folliard model in the
        Materials tab.
      </p>
    {:else}
      <p class="text-xs text-gray-500 mt-3">
        Hydration shape parameters (α<sub>u</sub>, τ, β) using literature defaults for Type I/II
        cement. Run the Schindler-Folliard model in the Materials tab to use project-specific
        values.
      </p>
    {/if}
  </div>

  <!-- Hour selector -->
  <div class="rounded-lg border bg-white p-4 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h3 class="text-lg font-semibold">Hours to Display</h3>
      <div class="flex flex-wrap gap-2">
        <button
          class="rounded border px-2 py-1 text-xs hover:bg-gray-50"
          on:click={selectAll}>All</button>
        <button
          class="rounded border px-2 py-1 text-xs hover:bg-gray-50"
          on:click={clearAll}>None</button>
        <button
          class="rounded border px-2 py-1 text-xs hover:bg-gray-50"
          on:click={() => selectEvery(6)}>Every 6 hrs</button>
        <button
          class="rounded border px-2 py-1 text-xs hover:bg-gray-50"
          on:click={() => selectEvery(12)}>Every 12 hrs</button>
        <button
          class="rounded border px-2 py-1 text-xs hover:bg-gray-50"
          on:click={() => selectEvery(24)}>Every 24 hrs</button>
      </div>
    </div>

    <!-- 12-column compact checkbox grid -->
    <div class="grid grid-cols-12 gap-0.5">
      {#each ALL_HOURS as h}
        <label
          class="flex cursor-pointer flex-col items-center gap-0.5 rounded p-1 text-xs hover:bg-blue-50
                 {selectedHours.has(h) ? 'bg-blue-50' : ''}">
          <input
            type="checkbox"
            class="h-3 w-3"
            checked={selectedHours.has(h)}
            on:change={() => toggleHour(h)} />
          <span class="text-gray-600 leading-none">{h}</span>
        </label>
      {/each}
    </div>
    <p class="mt-2 text-xs text-gray-500">{selectedHours.size} of 72 hours selected</p>
  </div>

  <!-- Calculate button -->
  <div class="flex items-center gap-3">
    <button
      class="rounded-lg bg-blue-600 px-5 py-2 text-white transition hover:bg-blue-700
             disabled:cursor-not-allowed disabled:bg-gray-400"
      on:click={runAnalysis}
      disabled={isRunning || !!missingInputs.length}>
      {#if isRunning}Running…{:else}Calculate Temperature Gradient{/if}
    </button>
    {#if runError}
      <span class="text-sm text-red-600">{runError}</span>
    {/if}
  </div>

  <!-- Chart + description -->
  {#if hasRun}
    <div class="rounded-lg border bg-white p-4 shadow-sm">
      <h3 class="text-lg font-semibold mb-1">Slab Temperature Gradient Over Time</h3>
      <div class="h-[500px] w-full" bind:this={chartRef}></div>
      <p class="mt-3 text-xs text-gray-500 leading-relaxed">
        Temperature profiles through the slab depth computed using the illitherm finite-element
        thermal model (JCAS2 hydration kinetics). Each plotted line represents the temperature
        distribution at a specific hour after concrete placement. Ambient temperature, wind
        speed, and cloud cover are sourced from the nearest weather station in the
        <strong>Environment</strong> tab (72-hour climate normals). Slab thickness is taken from
        the <strong>Slab Layout</strong> tab. Hydration parameters
        (α<sub>u</sub>, τ, β, E<sub>a</sub>) are
        {#if $hydrationModelResults['schindler-folliard']}
          taken from the Schindler-Folliard model in the <strong>Materials</strong> tab.
        {:else}
          using literature defaults for Type I/II cement; run the Schindler-Folliard model in
          the <strong>Materials</strong> tab for project-specific values.
        {/if}
        The y-axis runs from slab surface (top) to slab bottom.
      </p>
    </div>
  {/if}

</div>
