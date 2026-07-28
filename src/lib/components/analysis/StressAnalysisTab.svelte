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
  import type { CreepModel } from '$lib/models/stress/types';
  import { sawCutModelHour } from '$lib/utils/time';
  import {
    resolveCementSystem,
    getSetTimeHours,
    type CementType,
    type SCMType
  } from '$lib/models/hydration/concreteMaturity';
  import type { Layout, Data, Shape, Annotations } from 'plotly.js';

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
  let setHour = Math.max(1, computeSetHour($materials, $projectInfo));
  $: smartSetHour = Math.max(1, computeSetHour($materials, $projectInfo));
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

  // Saw-cut clock time (Slab Layout tab) → stress-model hour index, using the
  // placement clock from Project Info. Drives the infinite-slab → jointed regime
  // switch; undefined when either time is unset (joint then active throughout).
  $: sawCutHourIndex = sawCutModelHour($slabLayout.sawCutHour, $projectInfo.startHour);

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
      sawCutHour: sawCutHourIndex,
      maturity: ($maturityResultsStore ?? []).map((r) => ({
        hour: r.hour,
        degreeOfHydration: r.degreeOfHydration,
        // Cracking capacity: lets the model break the slab (natural crack) once
        // the demand reaches the strength instead of carrying an ever-growing
        // infinite-slab stress to the saw-cut hour.
        strength: r.strength
      })),
      thermal: ($thermalGradientResults?.results ?? []).map((r) => ({ temps: r.temps })),
      creep: {
        a1: p.creepA1,
        creepModel: p.creepModel,
        agingCoefficient: p.agingCoefficient,
        cebFipS: p.cebFipS
      }
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

  // Vertical markers for the two events that define the regime switches: the
  // planned saw-cut and (when it happens first) the natural crack.
  function eventShapes(): { shapes: Partial<Shape>[]; annotations: Partial<Annotations>[] } {
    const shapes: Partial<Shape>[] = [];
    const annotations: Partial<Annotations>[] = [];
    const cut = $stressResults?.cracking?.sawCutHour;
    const crack = $stressResults?.cracking?.naturalCrackHour;
    const mark = (hour: number, color: string, text: string, yAnchor: number) => {
      shapes.push({
        type: 'line',
        x0: hour,
        x1: hour,
        yref: 'paper',
        y0: 0,
        y1: 1,
        line: { color, width: 1.5, dash: 'dash' }
      });
      annotations.push({
        x: hour,
        y: yAnchor,
        yref: 'paper',
        text,
        showarrow: false,
        font: { size: 10, color },
        bgcolor: 'rgba(255,255,255,0.75)',
        xanchor: 'left'
      });
    };
    if (typeof cut === 'number') mark(cut, '#2563eb', `saw-cut (h${cut})`, 1.02);
    if (typeof crack === 'number') mark(crack, '#b91c1c', `natural crack (h${crack})`, 0.94);
    return { shapes, annotations };
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
      const { shapes, annotations } = eventShapes();
      await Plotly.react(
        chartStress,
        traces,
        {
          ...baseLayout,
          title: { text: 'Stress Development & Cracking Risk', font: { size: 15 } },
          xaxis: { title: { text: 'Hour after placement' } },
          yaxis: { title: { text: `Stress (${stressUnit}, tension +)` }, zeroline: true },
          shapes,
          annotations
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
          yaxis: { title: { text: `Stress (${stressUnit}, tension +)` }, zeroline: true },
          ...eventShapes()
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
        c.tensileStrength > 0 ? toStress(c.tensileStrength).toFixed(3) : '',
        c.tensileStrength > 0 ? c.demandCapacityRatio.toFixed(3) : '',
        r.regime,
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
      `tensileStrength_${stressUnit}`,
      'demandCapacityRatio',
      'regime',
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

  // ── Saw-cut timing verdict ─────────────────────────────────────────────
  $: cracking = $stressResults?.cracking ?? null;
  $: lastHour = $stressResults?.hourlyResults?.at(-1)?.hour ?? null;
  // Regime label for the hourly table.
  const regimeLabel: Record<string, string> = {
    continuous: 'continuous',
    jointed: 'jointed',
    cracked: 'CRACKED'
  };
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
      {#if sawCutHourIndex !== undefined}
        The slab is modelled as continuous (infinite, fully restrained) until the saw-cut
        (clock {$slabLayout.sawCutHour}) at <strong>hour {sawCutHourIndex}</strong>, then jointed —
        joint spacing only affects the result once the joint exists. If the creep-adjusted tensile
        demand reaches the maturity-based tensile strength first, the slab cracks naturally at that
        hour and is analysed as a cracked (finite) panel from then on.
      {:else}
        Set the placement time (Project Info) and saw-cut time (Slab Layout) to model the
        continuous-until-cut behaviour; otherwise the joint is treated as active throughout.
      {/if}
    </p>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Set time (hr)</span>
        <input type="number" min="1" max="71" step="1" class="rounded-lg border p-2"
          bind:value={setHour} on:input={() => (userTouchedSetHour = true)} />
        <span class="text-xs text-gray-500">Creep loading-age origin (≥ 1 h)</span>
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
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Creep model</span>
        <select class="rounded-lg border p-2"
          value={$stressParams.creepModel}
          on:change={(e) => updateStressParams({ creepModel: (e.currentTarget as HTMLSelectElement).value as CreepModel })}>
          <option value="hydration">Hydration E(t) — consistent (default)</option>
          <option value="cebFip">CEB-FIP / EC2 β_cc(t)</option>
          <option value="aemm">Age-adjusted EMM (χ)</option>
        </select>
        <span class="text-xs text-gray-500">How the bounded aging modulus feeds the creep compliance</span>
      </label>
      {#if $stressParams.creepModel === 'cebFip'}
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium">Cement type (s)</span>
          <select class="rounded-lg border p-2"
            value={$stressParams.cebFipS}
            on:change={(e) => updateStressParams({ cebFipS: +(e.currentTarget as HTMLSelectElement).value })}>
            <option value={0.2}>Rapid-hardening (s = 0.20)</option>
            <option value={0.25}>Normal (s = 0.25)</option>
            <option value={0.38}>Slow-hardening (s = 0.38)</option>
          </select>
          <span class="text-xs text-gray-500">β<sub>cc</sub>(t) = exp[s·(1 − √(28/t))]</span>
        </label>
      {/if}
      {#if $stressParams.creepModel === 'aemm'}
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium">Aging coefficient χ</span>
          <input type="number" min="0.5" max="1" step="0.05" class="rounded-lg border p-2"
            value={$stressParams.agingCoefficient}
            on:change={(e) => updateStressParams({ agingCoefficient: +(e.currentTarget as HTMLInputElement).value })} />
          <span class="text-xs text-gray-500">Trost/Bažant; 0.8 typical (χ = 1 → standard EMM)</span>
        </label>
      {/if}
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

    <!-- Saw-cut timing verdict: does the cut happen before the slab breaks? -->
    {#if cracking}
      {#if cracking.verdict === 'crackedBeforeSawCut'}
        <div class="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p class="font-semibold">
            Saw-cut too late — the slab cracks on its own at hour {cracking.naturalCrackHour}.
          </p>
          <p class="mt-1">
            The creep-adjusted tensile demand reached the concrete's tensile strength
            ({fmt(toStress(cracking.crackDemand ?? 0), 1)} vs
            {fmt(toStress(cracking.crackStrength ?? 0), 1)} {stressUnit}) at hour
            <strong>{cracking.naturalCrackHour}</strong>{#if cracking.sawCutHour !== undefined},
              <strong
                >{cracking.sawCutHour - (cracking.naturalCrackHour ?? 0)} h before the planned
                saw-cut at hour {cracking.sawCutHour}</strong
              >{/if}. An uncontrolled transverse crack forms there: from that hour the slab is
            analysed as a cracked, finite panel (axial restraint released, K<sub>ᵢ</sub> = 0), not as
            a continuous infinite slab. Saw-cut earlier, shorten the joint spacing, or reduce the
            early-age temperature drop.
          </p>
        </div>
      {:else if cracking.verdict === 'ok'}
        <div class="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900">
          <p class="font-semibold">
            Saw-cut timing works — no natural cracking predicted before hour {cracking.sawCutHour}.
          </p>
          <p class="mt-1">
            The slab reaches at most
            <strong>{fmt((cracking.preCutPeakRatio ?? 0) * 100, 0)}%</strong>
            of its tensile strength while still continuous (hour
            {cracking.preCutPeakRatioHour}), so the joint is cut before the concrete breaks on its
            own.
            {#if cracking.sawCutHour !== undefined && lastHour !== null && cracking.sawCutHour > lastHour}
              Note the saw-cut hour falls outside the {lastHour}-hour analysis window — no cracking
              occurs within the window analysed.
            {/if}
          </p>
        </div>
      {:else if cracking.verdict === 'noStrengthData'}
        <div class="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p class="font-semibold">Cracking check disabled — no tensile-strength history.</p>
          <p class="mt-1">
            Without a strength curve the slab is carried as a continuous (infinite) panel until the
            saw-cut no matter how high the stress climbs, so the saw-cut time cannot be assessed.
            Enter a compressive strength on the Materials tab (or a saw-cut depth for the K<sub
              >IC</sub
            >-based estimate) and re-run the maturity model.
          </p>
        </div>
      {:else}
        <div class="rounded-lg border border-sky-300 bg-sky-50 p-4 text-sm text-sky-900">
          <p class="font-semibold">No pre-cut window to assess.</p>
          <p class="mt-1">
            The joint is modelled as active for the whole window (no saw-cut time, or it falls at or
            before the set time), so there is no continuous phase in which the slab could crack
            naturally. Set the placement time (Project Info) and saw-cut time (Slab Layout) to test
            the saw-cut timing.
          </p>
        </div>
      {/if}
      {#if cracking.exceedanceHoursAfterRelief.length}
        <div class="rounded border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
          Demand still reaches the tensile strength at
          {cracking.exceedanceHoursAfterRelief.length} hour(s) after the joint/crack relieved the
          slab (first: hour {cracking.exceedanceHoursAfterRelief[0]}) — expect additional cracking.
          The model forms one crack and does not subdivide the panel further.
        </div>
      {/if}
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
              <th class="border-b px-3 py-2 text-right font-medium text-gray-600">f<sub>t</sub> ({stressUnit})</th>
              <th class="border-b px-3 py-2 text-right font-medium text-gray-600">σ/f<sub>t</sub></th>
              <th class="border-b px-3 py-2 text-left font-medium text-gray-600">Regime</th>
              <th class="border-b px-3 py-2 text-right font-medium text-gray-600">Kᵢ creep ({kiUnit})</th>
            </tr>
          </thead>
          <tbody>
            {#each $stressResults.hourlyResults as r, i (r.hour)}
              {@const c = $stressResults.creepResults[i]}
              <tr
                class="border-t border-gray-100 hover:bg-gray-50 {r.hour ===
                cracking?.naturalCrackHour
                  ? 'bg-red-50'
                  : ''}"
              >
                <td class="px-3 py-1 font-mono">{r.hour}</td>
                <td class="px-3 py-1 text-right font-mono">{fmt(r.elasticModulus, 0)}</td>
                <td class="px-3 py-1 text-right font-mono">{fmt(toDeltaT(r.pseudoUniformTemp), 2)}</td>
                <td class="px-3 py-1 text-right font-mono">{fmt(toDeltaT(r.pseudoGradientTemp), 2)}</td>
                <td class="px-3 py-1 text-right font-mono">{fmt(toStress(r.totalStress), 1)}</td>
                <td class="px-3 py-1 text-right font-mono">{fmt(toStress(c.creepTotalStress), 1)}</td>
                <td class="px-3 py-1 text-right font-mono">{fmt(toStress(c.creepStressTop), 1)}</td>
                <td class="px-3 py-1 text-right font-mono">{fmt(toStress(c.creepStressBottom), 1)}</td>
                <td class="px-3 py-1 text-right font-mono font-semibold">{fmt(toStress(c.creepMaxTensile), 1)}</td>
                <td class="px-3 py-1 text-right font-mono">
                  {c.tensileStrength > 0 ? fmt(toStress(c.tensileStrength), 1) : '—'}
                </td>
                <td
                  class="px-3 py-1 text-right font-mono {c.demandCapacityRatio >= 1
                    ? 'font-semibold text-red-700'
                    : ''}"
                >
                  {c.tensileStrength > 0 ? fmt(c.demandCapacityRatio, 2) : '—'}
                </td>
                <td class="px-3 py-1 {r.regime === 'cracked' ? 'font-semibold text-red-700' : 'text-gray-600'}">
                  {regimeLabel[r.regime]}
                </td>
                <td class="px-3 py-1 text-right font-mono">{fmt(toKI(c.creepKI), 3)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-xs text-gray-500">
        ΔT* values are the pseudo-temperatures (post B⁻¹ transformation) actually applied to
        the elastic analysis, not the raw thermal differences. σ/f<sub>t</sub> is the creep-adjusted
        demand over the maturity-based tensile strength; the regime column shows whether the slab was
        continuous (infinite), jointed by the saw-cut, or broken by a natural crack. At the crack
        hour the tabulated stress is the relieved post-crack value — the demand that broke the slab
        is quoted in the verdict above.
      </p>
    </div>
  {/if}
</div>
