<script lang="ts">
  import { materials, projectInfo, slabLayout, maturityResultsStore } from '$lib/stores/form';
  import { unitSystem } from '$lib/stores/units';
  import {
    runModel,
    type ProjectInputs,
    type HourlyResult,
    type CementType,
    type SCMType
  } from '$lib/models/hydration/concreteMaturity';

  let results: HourlyResult[] = [];
  let runError = '';
  let hasRun = false;
  let isDirty = false;

  function mapCementType(ct: string): CementType {
    if (ct === 'Type I/II with 5% limestone') return 'Type I/II w/ 5% Limestone';
    return ct as CementType;
  }

  function mapSCMType(scm: string): SCMType {
    if (scm === '25% F ash') return '25% F Ash';
    if (scm === '25% slag') return '25% GGBFS';
    return scm as SCMType;
  }

  function buildInputs(): ProjectInputs | null {
    const wc = $materials.waterCementRatio;
    if (typeof wc !== 'number' || isNaN(wc)) return null;

    const curingTempF =
      typeof $projectInfo.deliveryTempF === 'number' ? $projectInfo.deliveryTempF :
      typeof $projectInfo.startTempF    === 'number' ? $projectInfo.startTempF    :
      73;

    const t = $slabLayout.thickness;
    const thicknessIn =
      typeof t === 'number' && !isNaN(t) && t > 0
        ? ($unitSystem === 'metric' ? t / 25.4 : t)
        : 8;

    return {
      cementType: mapCementType($materials.cementType),
      scmType:    mapSCMType($materials.scm),
      wcm:        wc,
      curingTempF,
      sawcutDepth: thicknessIn
    };
  }

  async function runMaturityModel() {
    runError = '';
    const inputs = buildInputs();
    if (!inputs) {
      runError = 'Enter a valid w/cm ratio in the Materials section above.';
      return;
    }
    try {
      results = runModel(inputs, 72);
      hasRun  = true;
      isDirty = false;
      maturityResultsStore.set(results);
    } catch (e) {
      runError = `Calculation error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  function fmt(n: number, sig = 4): string {
    if (n === 0) return '0';
    const abs = Math.abs(n);
    if (abs >= 0.001 && abs < 100000) return parseFloat(n.toPrecision(sig)).toString();
    return n.toExponential(3);
  }

  let _snap = '';
  $: {
    const snap = JSON.stringify([
      $materials.cementType,
      $materials.scm,
      $materials.waterCementRatio,
      $projectInfo.deliveryTempF,
      $projectInfo.startTempF,
      $slabLayout.thickness,
      $unitSystem
    ]);
    if (_snap && snap !== _snap && hasRun) isDirty = true;
    _snap = snap;
  }
</script>

<div class="space-y-4">
  <div>
    <h3 class="font-medium">Concrete Maturity &amp; Early Strength</h3>
    <p class="text-xs text-gray-600 mt-1">
      Exponential hydration model (Schindler &amp; Folliard) with cement-system-specific
      coefficients. Computes equivalent age, degree of hydration, heat of hydration rate, and
      KIC-based early strength over 72 hours. Curing temperature uses the concrete delivery
      temperature from Project Info (falls back to start temperature, then 73&nbsp;°F).
      Saw-cut depth is derived from slab thickness (Slab Layout tab). Plots appear on the
      <strong>Hydration</strong> tab.
    </p>
  </div>

  <div class="flex items-center gap-3 flex-wrap">
    <button
      class="run-btn"
      class:dirty={isDirty}
      on:click={runMaturityModel}>
      Run Maturity Model
    </button>
    {#if runError}
      <span class="text-xs text-red-500">{runError}</span>
    {/if}
  </div>

  {#if hasRun && results.length}
    <div class="mt-2">
      <p class="text-xs font-medium text-gray-500 mb-2">Hourly Results Table</p>
      <div class="overflow-auto max-h-64 border rounded-lg">
        <table class="min-w-full text-xs">
          <thead class="sticky top-0 bg-gray-50 z-10">
            <tr>
              <th class="px-3 py-2 text-left font-medium text-gray-600 border-b">Hour</th>
              <th class="px-3 py-2 text-right font-medium text-gray-600 border-b">Equiv. Age (hr)</th>
              <th class="px-3 py-2 text-right font-medium text-gray-600 border-b">Hydration (α)</th>
              <th class="px-3 py-2 text-right font-medium text-gray-600 border-b">Heat Rate (J/g/hr)</th>
              <th class="px-3 py-2 text-right font-medium text-gray-600 border-b">Strength (psi)</th>
            </tr>
          </thead>
          <tbody>
            {#each results as row (row.hour)}
              <tr class="border-t border-gray-100 hover:bg-gray-50">
                <td class="px-3 py-1 font-mono">{row.hour}</td>
                <td class="px-3 py-1 font-mono text-right">{fmt(row.equivalentAge)}</td>
                <td class="px-3 py-1 font-mono text-right">{fmt(row.degreeOfHydration)}</td>
                <td class="px-3 py-1 font-mono text-right">{fmt(row.heatOfHydration)}</td>
                <td class="px-3 py-1 font-mono text-right">{fmt(row.strength, 3)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<style>
  .run-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: white;
    color: #2563eb;
    border: 1.5px solid #2563eb;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background-color 0.2s, color 0.2s;
  }
  .run-btn:hover  { background-color: #eff6ff; }
  .run-btn:active { background-color: #dbeafe; }
  .run-btn.dirty  { animation: run-pulse 1.8s ease-in-out infinite; }

  @keyframes run-pulse {
    0%, 100% {
      background-color: white;
      color: #2563eb;
      border-color: #2563eb;
      box-shadow: none;
    }
    50% {
      background-color: #dbeafe;
      color: #1d4ed8;
      border-color: #1d4ed8;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
    }
  }
</style>
