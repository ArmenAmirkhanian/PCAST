<script lang="ts">
  import { tick } from 'svelte';
  import { maturityResultsStore, bentzSeries } from '$lib/stores/form';
  import type { Layout } from 'plotly.js';

  let Plotly: typeof import('plotly.js-dist-min') | null = null;
  let chartDoh:      HTMLDivElement;
  let chartHeat:     HTMLDivElement;
  let chartStrength: HTMLDivElement;

  async function ensurePlotly() {
    if (!Plotly) {
      const mod = await import('plotly.js-dist-min');
      Plotly = mod;
    }
    return Plotly;
  }

  const baseLayout: Partial<Layout> = {
    margin:        { t: 10, r: 20, b: 50, l: 60 },
    height:        280,
    paper_bgcolor: 'white',
    plot_bgcolor:  'white',
    xaxis:         { title: { text: 'Time (hr)' } }
  };
  const cfg = { displayModeBar: false, responsive: true };

  async function renderCharts() {
    if (!chartDoh) return;
    const plt = await ensurePlotly();

    // ── Degree of Hydration: overlay all models with data ────────────────
    const dohTraces: object[] = [];
    if ($maturityResultsStore?.length) {
      dohTraces.push({
        x: $maturityResultsStore.map((r) => r.hour),
        y: $maturityResultsStore.map((r) => r.degreeOfHydration),
        type: 'scatter', mode: 'lines', name: 'Concrete Maturity',
        line: { color: '#2563eb', width: 2 }
      });
    }
    if ($bentzSeries?.length) {
      dohTraces.push({
        x: $bentzSeries.map((r) => r.t),
        y: $bentzSeries.map((r) => r.alpha),
        type: 'scatter', mode: 'lines', name: 'Bentz (2006)',
        line: { color: '#d97706', width: 2 }
      });
    }
    if (dohTraces.length) {
      await plt.react(
        chartDoh, dohTraces as Plotly.Data[],
        { ...baseLayout, yaxis: { title: { text: 'Degree of Hydration (α)' }, range: [0, 1] } } as Partial<Layout>,
        cfg
      );
    }

    // ── Heat rate & Strength: Concrete Maturity only ──────────────────────
    if ($maturityResultsStore?.length && chartHeat && chartStrength) {
      await plt.react(
        chartHeat,
        [{ x: $maturityResultsStore.map((r) => r.hour),
           y: $maturityResultsStore.map((r) => r.heatOfHydration),
           type: 'scatter', mode: 'lines', name: 'q (J/g/hr)',
           line: { color: '#dc2626', width: 2 } }] as Plotly.Data[],
        { ...baseLayout, yaxis: { title: { text: 'Heat Rate (J/g/hr)' } } } as Partial<Layout>,
        cfg
      );
      const strengthTraces: object[] = [
        { x: $maturityResultsStore.map((r) => r.hour),
          y: $maturityResultsStore.map((r) => r.strength),
          type: 'scatter', mode: 'lines', name: 'Tensile strength (psi)',
          line: { color: '#16a34a', width: 2 } }
      ];
      if ($maturityResultsStore.some((r) => r.compressiveStrength !== undefined)) {
        strengthTraces.push({
          x: $maturityResultsStore.map((r) => r.hour),
          y: $maturityResultsStore.map((r) => r.compressiveStrength ?? null),
          type: 'scatter', mode: 'lines', name: 'Compressive strength (psi)',
          line: { color: '#9ca3af', dash: 'dot', width: 1.5 }, yaxis: 'y2'
        });
      }
      await plt.react(
        chartStrength,
        strengthTraces as Plotly.Data[],
        {
          ...baseLayout,
          showlegend: true,
          legend: { orientation: 'h', y: -0.25 },
          yaxis: { title: { text: 'Tensile strength (psi)' } },
          ...($maturityResultsStore.some((r) => r.compressiveStrength !== undefined)
            ? { yaxis2: { title: { text: 'Compressive strength (psi)' }, overlaying: 'y', side: 'right' } }
            : {})
        } as Partial<Layout>,
        cfg
      );
    }
  }

  // Re-render whenever either data store changes.
  $: {
    const _deps = [$maturityResultsStore, $bentzSeries];
    void _deps; // suppress unused-variable warning
    tick().then(() => renderCharts());
  }

  const hasAny      = () => !!($maturityResultsStore?.length || $bentzSeries?.length);
  const hasMaturity = () => !!$maturityResultsStore?.length;
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-lg font-semibold">Hydration Model Plots</h2>
    <p class="text-sm text-gray-600 mt-1">
      Charts update automatically whenever a model is run from the
      <strong>Materials</strong> tab. The degree-of-hydration plot overlays all
      models that have been calculated.
    </p>
  </div>

  {#if !$maturityResultsStore?.length && !$bentzSeries?.length}
    <p class="text-sm text-gray-500 italic">
      No data yet — run a model from the <strong>Materials</strong> tab to populate these plots.
    </p>
  {/if}

  {#if $maturityResultsStore?.length || $bentzSeries?.length}
    <div>
      <p class="text-xs font-medium text-gray-500 mb-1">Degree of Hydration (α) vs Time</p>
      <div bind:this={chartDoh} class="w-full rounded border border-gray-100"></div>
    </div>
  {/if}

  {#if $maturityResultsStore?.length}
    <div>
      <p class="text-xs font-medium text-gray-500 mb-1">Heat of Hydration Rate (J/g/hr) vs Time</p>
      <div bind:this={chartHeat} class="w-full rounded border border-gray-100"></div>
    </div>
    <div>
      <p class="text-xs font-medium text-gray-500 mb-1">Tensile Strength (psi) vs Time</p>
      <div bind:this={chartStrength} class="w-full rounded border border-gray-100"></div>
    </div>
  {/if}
</div>
