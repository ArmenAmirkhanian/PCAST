<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import {
    projectInfo,
    materials,
    slabLayout,
    maturityResultsStore,
    thermalGradientResults,
    hydrationModelResults,
    stressParams,
    updateStressParams,
    stressResults
  } from '$lib/stores/form';
  import { unitSystem } from '$lib/stores/units';
  import { runStressModel } from '$lib/models/stress/run';
  import { buildStressInput } from '$lib/models/stress/inputs';
  import {
    resolveCementSystem,
    getSetTimeHours,
    type CementType,
    type SCMType
  } from '$lib/models/hydration/concreteMaturity';
  import type { Layout, Data } from 'plotly.js';

  // ── Display-unit helpers ───────────────────────────────────────────────
  // Module stresses are computed in psi and KI in psi·in^0.5 (US canonical);
  // results are converted for display only.
  let sys: 'us' | 'metric' = 'us';
  $: sys = $unitSystem;

  const PSI_TO_MPA = 0.00689476;
  const KI_US_TO_SI = 0.00109877; // psi·in^0.5 → MPa·m^0.5

  $: stressUnit = sys === 'us' ? 'psi' : 'MPa';
  $: kiUnit     = sys === 'us' ? 'psi·in½' : 'MPa·m½';
  $: tUnit      = sys === 'us' ? '°F' : '°C';

  // Reactive (not const) so table cells calling them re-render on unit toggle.
  $: toStress = (psi: number) => (sys === 'us' ? psi : psi * PSI_TO_MPA);
  $: toKI     = (v: number)   => (sys === 'us' ? v : v * KI_US_TO_SI);
  $: toDeltaT = (dF: number)  => (sys === 'us' ? dF : (dF * 5) / 9);

  // ── Run state ──────────────────────────────────────────────────────────
  let isRunning = false;
  let runError = '';
  let hasRun = false;
  let issues: string[] = [];
  let notes: string[] = [];

  // ── Set time (elapsed hours after placement) — default from maturity model.
  // Pure so the reactive seed below can track its $materials/$projectInfo deps
  // (a function body's store reads are NOT tracked by a `$:` that just calls it).
  function computeSetHour(
    mat: { cementType: string; scm: string },
    proj: { deliveryTempF: number | ''; startTempF: number | '' }
  ): number {
    try {
      const ct: CementType =
        mat.cementType === 'Type I/II with 5% limestone'
          ? 'Type I/II w/ 5% Limestone'
          : (mat.cementType as CementType);
      const scmMap: Record<string, SCMType> = {
        None: 'None',
        '25% C Ash': '25% C Ash',
        '25% F ash': '25% F Ash',
        '25% slag': '25% GGBFS'
      };
      const scmType = scmMap[mat.scm] ?? 'None';
      const systemKey = resolveCementSystem(ct, scmType);
      const curingF =
        typeof proj.deliveryTempF === 'number'
          ? proj.deliveryTempF
          : typeof proj.startTempF === 'number'
            ? proj.startTempF
            : 73;
      const curingC = (curingF - 32) * (5 / 9);
      return getSetTimeHours(systemKey, curingC);
    } catch {
      return 8;
    }
  }
  // Re-seed the set-time default from upstream inputs (since all tabs mount at
  // once, the stores are empty at init) until the user edits the field.
  let userTouchedSetHour = false;
  let setHour = Math.max(5, computeSetHour($materials, $projectInfo));
  $: smartSetHour = Math.max(5, computeSetHour($materials, $projectInfo));
  $: if (!userTouchedSetHour && smartSetHour !== setHour) setHour = smartSetHour;

  // ── Plotly ───────────────────────────────────────────────────────────────
  let Plotly: any = null;
  let plotlyReady = false;
  let chartStress: HTMLDivElement | null = null;
  let chartFibre: HTMLDivElement | null = null;
  let chartKI: HTMLDivElement | null = null;

  // ── Prerequisite checklist ───────────────────────────────────────────────
  $: missingInputs = (() => {
    const m: string[] = [];
    if (!$thermalGradientResults?.results?.length)
      m.push('Run the Temperature Gradient model in the Results tab.');
    if (!$maturityResultsStore?.length)
      m.push('Run the Concrete Maturity model in the Materials tab.');
    if (!$slabLayout.thickness) m.push('Enter slab thickness in the Slab Layout tab.');
    if (!$slabLayout.jointSpacing) m.push('Enter joint spacing in the Slab Layout tab.');
    return m;
  })();

  function alphaUltimate(): number {
    const sf = $hydrationModelResults['schindler-folliard'];
    if (sf && typeof sf.alpha_u === 'number' && sf.alpha_u > 0) return sf.alpha_u;
    // Fall back to the maturity series' own asymptote, else literature value.
    const series = $maturityResultsStore ?? [];
    const maxAlpha = series.reduce((mx, r) => Math.max(mx, r.degreeOfHydration), 0);
    return maxAlpha > 0 ? maxAlpha : 0.87;
  }

  function buildArgs() {
    const p = $stressParams;
    return {
      startHour: setHour,
      endHour: 72,
      slab: {
        thicknessIn: $slabLayout.thickness as number,
        jointSpacingFt: $slabLayout.jointSpacing as number,
        poissonRatio: p.poissonRatio,
        coteF: p.coteF,
        kValue: p.kValue,
        frictionCoefficient: p.frictionCoefficient
      },
      matureModulusPsi: p.matureModulusPsi,
      alphaUltimate: alphaUltimate(),
      sawcutNormalized:
        p.sawcutNormalized === '' ? undefined : (p.sawcutNormalized as number),
      maturity: ($maturityResultsStore ?? []).map((r) => ({
        hour: r.hour,
        degreeOfHydration: r.degreeOfHydration
      })),
      thermal: ($thermalGradientResults?.results ?? []).map((r) => ({ temps: r.temps })),
      creep: { a1: p.creepA1 }
    };
  }

  async function runAnalysis() {
    isRunning = true;
    runError = '';
    issues = [];
    notes = [];
    try {
      const { input, issues: iss, notes: nts } = buildStressInput(buildArgs());
      issues = iss;
      notes = nts;
      if (!input) {
        runError = 'Could not assemble model inputs — see issues below.';
        hasRun = false;
        return;
      }
      const out = runStressModel(input);
      stressResults.set(out);
      hasRun = true;
      await tick();
      await renderCharts();
    } catch (e) {
      runError = e instanceof Error ? e.message : String(e);
      hasRun = false;
    } finally {
      isRunning = false;
    }
  }

  // ── Charts ─────────────────────────────────────────────────────────────
  const baseLayout: Partial<Layout> = {
    height: 360,
    margin: { t: 40, r: 20, b: 50, l: 70 },
    paper_bgcolor: 'white',
    plot_bgcolor: 'white',
    hovermode: 'x unified',
    legend: { orientation: 'h', y: -0.2 }
  };
  const cfg = { responsive: true, displaylogo: false };

  function strengthByHour(): Map<number, number> {
    const m = new Map<number, number>();
    for (const r of $maturityResultsStore ?? []) m.set(r.hour, r.strength);
    return m;
  }

  async function renderCharts() {
    if (!browser || !Plotly || !$stressResults) return;
    const elastic = $stressResults.hourlyResults;
    const creep = $stressResults.creepResults;
    const hours = elastic.map((r) => r.hour);
    const sMap = strengthByHour();

    // ── Chart 1: stress development & cracking risk ──────────────────────
    if (chartStress) {
      const traces: Data[] = [
        {
          x: hours,
          y: elastic.map((r) => toStress(r.totalStress)),
          name: 'Elastic total',
          mode: 'lines',
          line: { color: '#9ca3af', dash: 'dot', width: 1.5 }
        } as Data,
        {
          x: hours,
          y: creep.map((r) => toStress(r.creepTotalStress)),
          name: 'Creep total',
          mode: 'lines',
          line: { color: '#2563eb', width: 2 }
        } as Data,
        {
          x: hours,
          y: creep.map((r) => toStress(r.creepMaxTensile)),
          name: 'Creep max-tensile face',
          mode: 'lines',
          line: { color: '#dc2626', width: 2 }
        } as Data
      ];
      const strengthVals = hours.map((h) => sMap.get(h));
      if (strengthVals.some((v) => typeof v === 'number' && v > 0)) {
        traces.push({
          x: hours,
          y: strengthVals.map((v) => (typeof v === 'number' ? toStress(v) : null)),
          name: 'Tensile strength (maturity)',
          mode: 'lines',
          line: { color: '#16a34a', dash: 'dash', width: 2 }
        } as Data);
      }
      await Plotly.react(
        chartStress,
        traces,
        {
          ...baseLayout,
          title: { text: 'Stress Development & Cracking Risk', font: { size: 15 } },
          xaxis: { title: { text: 'Hour after placement' } },
          yaxis: { title: { text: `Stress (${stressUnit}, tension +)` }, zeroline: true }
        } as Partial<Layout>,
        cfg
      );
    }

    // ── Chart 2: top vs bottom fibre (creep-adjusted) ────────────────────
    if (chartFibre) {
      await Plotly.react(
        chartFibre,
        [
          {
            x: hours,
            y: creep.map((r) => toStress(r.creepStressTop)),
            name: 'Top fibre',
            mode: 'lines',
            line: { color: '#ea580c', width: 2 }
          } as Data,
          {
            x: hours,
            y: creep.map((r) => toStress(r.creepStressBottom)),
            name: 'Bottom fibre',
            mode: 'lines',
            line: { color: '#0891b2', width: 2 }
          } as Data
        ],
        {
          ...baseLayout,
          title: { text: 'Creep-Adjusted Extreme-Fibre Stress', font: { size: 15 } },
          xaxis: { title: { text: 'Hour after placement' } },
          yaxis: { title: { text: `Stress (${stressUnit}, tension +)` }, zeroline: true }
        } as Partial<Layout>,
        cfg
      );
    }

    // ── Chart 3: stress intensity factor ─────────────────────────────────
    if (chartKI) {
      await Plotly.react(
        chartKI,
        [
          {
            x: hours,
            y: elastic.map((r) => toKI(r.stressIntensityKI)),
            name: 'Elastic Kᵢ',
            mode: 'lines',
            line: { color: '#9ca3af', dash: 'dot', width: 1.5 }
          } as Data,
          {
            x: hours,
            y: creep.map((r) => toKI(r.creepKI)),
            name: 'Creep Kᵢ',
            mode: 'lines',
            line: { color: '#7c3aed', width: 2 }
          } as Data
        ],
        {
          ...baseLayout,
          title: { text: 'Mode-I Stress Intensity Factor', font: { size: 15 } },
          xaxis: { title: { text: 'Hour after placement' } },
          yaxis: { title: { text: `Kᵢ (${kiUnit})` }, zeroline: true }
        } as Partial<Layout>,
        cfg
      );
    }
  }

  // Re-render only on unit toggle; runAnalysis() owns the post-run render (it
  // awaits tick() so the chart divs are bound first). Keying on a sys change
  // avoids a redundant second Plotly.react pass on every run.
  let lastRenderedSys = sys;
  $: if (plotlyReady && hasRun && sys !== lastRenderedSys) {
    lastRenderedSys = sys;
    renderCharts();
  }

  onMount(async () => {
    if (!browser) return;
    const mod = await import('plotly.js-dist-min');
    Plotly = (mod as any).default ?? mod;
    plotlyReady = true;
    if (hasRun && $stressResults) await renderCharts();
  });

  // ── Table + CSV ──────────────────────────────────────────────────────────
  function fmt(n: number, dp = 1): string {
    if (!Number.isFinite(n)) return '—';
    if (n === 0) return '0';
    const abs = Math.abs(n);
    if (abs >= 1e5 || abs < 1e-3) return n.toExponential(2);
    return n.toFixed(dp);
  }

  function downloadCsv() {
    if (!$stressResults) return;
    const rows = $stressResults.hourlyResults.map((r, i) => {
      const c = $stressResults!.creepResults[i];
      return [
        r.hour,
        r.elasticModulus.toFixed(0),
        (toDeltaT(r.pseudoUniformTemp)).toFixed(3),
        (toDeltaT(r.pseudoGradientTemp)).toFixed(3),
        toStress(r.totalStress).toFixed(3),
        toStress(c.creepTotalStress).toFixed(3),
        toStress(c.creepStressTop).toFixed(3),
        toStress(c.creepStressBottom).toFixed(3),
        toStress(c.creepMaxTensile).toFixed(3),
        toKI(r.stressIntensityKI).toFixed(4),
        toKI(c.creepKI).toFixed(4)
      ].join(',');
    });
    const header = [
      'hour',
      'E_psi',
      `pseudoUniformDT_${tUnit}`,
      `pseudoGradientDT_${tUnit}`,
      `elasticTotal_${stressUnit}`,
      `creepTotal_${stressUnit}`,
      `creepTop_${stressUnit}`,
      `creepBottom_${stressUnit}`,
      `creepMaxTensile_${stressUnit}`,
      `elasticKI_${kiUnit}`,
      `creepKI_${kiUnit}`
    ].join(',');
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stress-creep-results.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Peak creep tensile demand summary
  $: peak = (() => {
    if (!$stressResults) return null;
    let best = -Infinity;
    let hr = 0;
    for (const c of $stressResults.creepResults) {
      if (c.creepMaxTensile > best) {
        best = c.creepMaxTensile;
        hr = c.hour;
      }
    }
    return Number.isFinite(best) ? { value: best, hour: hr } : null;
  })();
</script>

<div class="space-y-4">
  <div>
    <h2 class="text-xl font-bold">Early-Age Stress &amp; Creep Analysis</h2>
    <p class="mt-1 text-sm text-gray-600">
      Beam-on-Winkler-foundation thermal-stress model with a rate-type creep relaxation
      (Riesz transformation). Elastic modulus develops as E(t) = E<sub>mature</sub> ·
      α(t)/α<sub>u</sub> from the maturity model; uniform and gradient temperature changes
      come from the illitherm thermal model (measured relative to the set-time, stress-free
      state). Tensile demand is compared against the maturity-based strength gain.
    </p>
  </div>

  <!-- Prerequisite warnings -->
  {#if missingInputs.length}
    <div class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      <p class="mb-1 font-medium">Complete these steps before running the analysis:</p>
      <ul class="list-disc space-y-0.5 pl-4">
        {#each missingInputs as msg}
          <li>{msg}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <!-- Parameters -->
  <div class="rounded-lg border bg-white p-4 shadow-sm">
    <h3 class="mb-1 text-lg font-semibold">Analysis Parameters</h3>
    <p class="mb-3 text-xs text-gray-500">
      Values in US engineering units. Slab thickness ({fmt(($slabLayout.thickness as number) || 0, 2)} in)
      and joint spacing ({fmt(($slabLayout.jointSpacing as number) || 0, 1)} ft) are taken from the
      Slab Layout tab.
    </p>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Set time (hr)</span>
        <input type="number" min="5" max="71" step="1" class="rounded-lg border p-2"
          bind:value={setHour} on:input={() => (userTouchedSetHour = true)} />
        <span class="text-xs text-gray-500">Creep loading-age origin (≥ 5 h)</span>
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Mature modulus E (psi)</span>
        <input type="number" min="0" step="100000" class="rounded-lg border p-2"
          value={$stressParams.matureModulusPsi}
          on:change={(e) => updateStressParams({ matureModulusPsi: +(e.currentTarget as HTMLInputElement).value })} />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Poisson's ratio ν</span>
        <input type="number" min="0" max="0.49" step="0.01" class="rounded-lg border p-2"
          value={$stressParams.poissonRatio}
          on:change={(e) => updateStressParams({ poissonRatio: +(e.currentTarget as HTMLInputElement).value })} />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">CTE α (1/°F)</span>
        <input type="number" min="0" step="0.0000001" class="rounded-lg border p-2"
          value={$stressParams.coteF}
          on:change={(e) => updateStressParams({ coteF: +(e.currentTarget as HTMLInputElement).value })} />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Subgrade k (psi/in)</span>
        <input type="number" min="1" step="10" class="rounded-lg border p-2"
          value={$stressParams.kValue}
          on:change={(e) => updateStressParams({ kValue: +(e.currentTarget as HTMLInputElement).value })} />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Friction k<sub>h</sub> (psi/in)</span>
        <input type="number" min="0" step="0.1" class="rounded-lg border p-2"
          value={$stressParams.frictionCoefficient}
          on:change={(e) => updateStressParams({ frictionCoefficient: +(e.currentTarget as HTMLInputElement).value })} />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Sawcut depth α = a/h</span>
        <input type="number" min="0" max="0.7" step="0.01" class="rounded-lg border p-2"
          value={$stressParams.sawcutNormalized}
          on:change={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            updateStressParams({ sawcutNormalized: v === '' ? '' : +v });
          }} />
        <span class="text-xs text-gray-500">Blank = free joint</span>
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Creep coefficient a₁</span>
        <input type="number" min="0" step="0.1" class="rounded-lg border p-2"
          value={$stressParams.creepA1}
          on:change={(e) => updateStressParams({ creepA1: +(e.currentTarget as HTMLInputElement).value })} />
      </label>
    </div>
    <p class="mt-3 text-xs text-gray-500">
      α<sub>u</sub> = {fmt(alphaUltimate(), 3)}
      {#if $hydrationModelResults['schindler-folliard']}
        (from Schindler-Folliard model){:else}(literature/asymptote fallback){/if}
    </p>
  </div>

  <!-- Run -->
  <div class="flex items-center gap-3">
    <button
      class="rounded-lg bg-blue-600 px-5 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
      on:click={runAnalysis}
      disabled={isRunning || !!missingInputs.length}>
      {#if isRunning}Running…{:else}Run Stress &amp; Creep Analysis{/if}
    </button>
    {#if runError}<span class="text-sm text-red-600">{runError}</span>{/if}
  </div>

  {#if issues.length}
    <div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <p class="mb-1 font-medium">Input issues:</p>
      <ul class="list-disc space-y-0.5 pl-4">
        {#each issues as i}<li>{i}</li>{/each}
      </ul>
    </div>
  {/if}

  {#if hasRun && $stressResults}
    {#if notes.length || $stressResults.warnings.length}
      <div class="rounded border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
        {#each notes as n}<p>• {n}</p>{/each}
        {#each $stressResults.warnings.slice(0, 5) as w}<p>• {w}</p>{/each}
        {#if $stressResults.warnings.length > 5}
          <p>• …and {$stressResults.warnings.length - 5} more diagnostic message(s).</p>
        {/if}
      </div>
    {/if}

    {#if peak}
      <div class="rounded-lg border bg-white p-4 shadow-sm">
        <p class="text-sm">
          Peak creep-adjusted tensile demand:
          <strong>{fmt(toStress(peak.value), 1)} {stressUnit}</strong>
          at hour <strong>{peak.hour}</strong>.
        </p>
      </div>
    {/if}

    <div class="rounded-lg border bg-white p-4 shadow-sm">
      <div class="h-[360px] w-full" bind:this={chartStress}></div>
    </div>
    <div class="rounded-lg border bg-white p-4 shadow-sm">
      <div class="h-[360px] w-full" bind:this={chartFibre}></div>
      <p class="mt-2 text-xs text-gray-500">
        Top and bottom extreme-fibre stresses after creep relaxation. Crossing of the two
        curves indicates a diurnal gradient reversal that shifts tension between faces.
      </p>
    </div>
    <div class="rounded-lg border bg-white p-4 shadow-sm">
      <div class="h-[360px] w-full" bind:this={chartKI}></div>
      {#if !$stressParams.sawcutNormalized}
        <p class="mt-2 text-xs text-gray-500">
          Kᵢ is zero without a sawcut. Set a sawcut depth above to engage the joint
          fracture-mechanics coefficients.
        </p>
      {/if}
    </div>

    <!-- Table -->
    <div class="rounded-lg border bg-white p-4 shadow-sm">
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-lg font-semibold">Hourly Results</h3>
        <button class="rounded border px-3 py-1 text-xs hover:bg-gray-50" on:click={downloadCsv}>
          Download CSV
        </button>
      </div>
      <div class="max-h-96 overflow-auto rounded-lg border">
        <table class="min-w-full text-xs">
          <thead class="sticky top-0 z-10 bg-gray-50">
            <tr>
              <th class="border-b px-3 py-2 text-left font-medium text-gray-600">Hour</th>
              <th class="border-b px-3 py-2 text-right font-medium text-gray-600">E (psi)</th>
              <th class="border-b px-3 py-2 text-right font-medium text-gray-600">ΔT*<sub>c</sub> ({tUnit})</th>
              <th class="border-b px-3 py-2 text-right font-medium text-gray-600">ΔT*<sub>g</sub> ({tUnit})</th>
              <th class="border-b px-3 py-2 text-right font-medium text-gray-600">σ elastic ({stressUnit})</th>
              <th class="border-b px-3 py-2 text-right font-medium text-gray-600">σ creep ({stressUnit})</th>
              <th class="border-b px-3 py-2 text-right font-medium text-gray-600">σ top ({stressUnit})</th>
              <th class="border-b px-3 py-2 text-right font-medium text-gray-600">σ bottom ({stressUnit})</th>
              <th class="border-b px-3 py-2 text-right font-medium text-gray-600">σ max-tens ({stressUnit})</th>
              <th class="border-b px-3 py-2 text-right font-medium text-gray-600">Kᵢ creep ({kiUnit})</th>
            </tr>
          </thead>
          <tbody>
            {#each $stressResults.hourlyResults as r, i (r.hour)}
              {@const c = $stressResults.creepResults[i]}
              <tr class="border-t border-gray-100 hover:bg-gray-50">
                <td class="px-3 py-1 font-mono">{r.hour}</td>
                <td class="px-3 py-1 text-right font-mono">{fmt(r.elasticModulus, 0)}</td>
                <td class="px-3 py-1 text-right font-mono">{fmt(toDeltaT(r.pseudoUniformTemp), 2)}</td>
                <td class="px-3 py-1 text-right font-mono">{fmt(toDeltaT(r.pseudoGradientTemp), 2)}</td>
                <td class="px-3 py-1 text-right font-mono">{fmt(toStress(r.totalStress), 1)}</td>
                <td class="px-3 py-1 text-right font-mono">{fmt(toStress(c.creepTotalStress), 1)}</td>
                <td class="px-3 py-1 text-right font-mono">{fmt(toStress(c.creepStressTop), 1)}</td>
                <td class="px-3 py-1 text-right font-mono">{fmt(toStress(c.creepStressBottom), 1)}</td>
                <td class="px-3 py-1 text-right font-mono font-semibold">{fmt(toStress(c.creepMaxTensile), 1)}</td>
                <td class="px-3 py-1 text-right font-mono">{fmt(toKI(c.creepKI), 3)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-xs text-gray-500">
        ΔT* values are the pseudo-temperatures (post B⁻¹ transformation) actually applied to
        the elastic analysis, not the raw thermal differences.
      </p>
    </div>
  {/if}
</div>
