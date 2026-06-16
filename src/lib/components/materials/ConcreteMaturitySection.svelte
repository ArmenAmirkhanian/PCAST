<script lang="ts">
  import { materials, projectInfo, slabLayout, maturityResultsStore } from '$lib/stores/form';
  import { unitSystem } from '$lib/stores/units';
  import type { TensilePreset } from '$lib/types';
  import {
    runModel,
    type ProjectInputs,
    type HourlyResult,
    type CementType,
    type SCMType,
    type CompressiveStrengthConfig
  } from '$lib/models/hydration/concreteMaturity';

  let results: HourlyResult[] = [];
  let runError = '';
  let hasRun = false;
  let isDirty = false;

  // ── Strength display units (model is psi-canonical; convert for metric) ────
  const PSI_TO_MPA = 0.00689476;
  $: strengthUnit = $unitSystem === 'metric' ? 'MPa' : 'psi';
  /** psi → current display unit */
  $: toStrengthDisp = (psi: number) => ($unitSystem === 'metric' ? psi * PSI_TO_MPA : psi);
  /** current display unit → psi (for storing) */
  function strengthToPsi(displayVal: number): number {
    return $unitSystem === 'metric' ? displayVal / PSI_TO_MPA : displayVal;
  }

  // ── ACI compressive→tensile presets (coefficient is psi-basis) ─────────────
  const TENSILE_PRESETS: { id: TensilePreset; label: string; coeff: number }[] = [
    { id: 'mor',    label: 'Modulus of rupture (7.5)', coeff: 7.5 },
    { id: 'split',  label: 'Splitting tensile (6.7)',  coeff: 6.7 },
    { id: 'custom', label: 'Custom',                   coeff: NaN }
  ];

  function selectPreset(id: TensilePreset) {
    const preset = TENSILE_PRESETS.find((p) => p.id === id)!;
    materials.update((m) => ({
      ...m,
      tensilePreset: id,
      tensileCoeff: id === 'custom' ? m.tensileCoeff : preset.coeff
    }));
  }

  function setCoeff(raw: string) {
    const v = parseFloat(raw);
    materials.update((m) => ({ ...m, tensilePreset: 'custom', tensileCoeff: isNaN(v) ? m.tensileCoeff : v }));
  }

  // ── 28-day f'c field (stored psi, displayed in current unit) ───────────────
  $: fc28Display = typeof $materials.fc28Psi === 'number' ? round2(toStrengthDisp($materials.fc28Psi)) : '';
  function setFc28(raw: string) {
    const v = parseFloat(raw);
    materials.update((m) => ({ ...m, fc28Psi: raw === '' || isNaN(v) ? '' : strengthToPsi(v) }));
  }

  function round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  // ── Strength development curve rows ────────────────────────────────────────
  function setCurveAge(i: number, raw: string) {
    const v = parseFloat(raw);
    const ageDays: number | '' = raw === '' || isNaN(v) ? '' : v;
    materials.update((m) => ({
      ...m,
      strengthCurve: m.strengthCurve.map((p, idx) => (idx === i ? { ...p, ageDays } : p))
    }));
  }
  function setCurveFc(i: number, raw: string) {
    const v = parseFloat(raw);
    const fcPsi: number | '' = raw === '' || isNaN(v) ? '' : strengthToPsi(v);
    materials.update((m) => ({
      ...m,
      strengthCurve: m.strengthCurve.map((p, idx) => (idx === i ? { ...p, fcPsi } : p))
    }));
  }
  function curveFcDisplay(fcPsi: number | ''): number | '' {
    return typeof fcPsi === 'number' ? round2(toStrengthDisp(fcPsi)) : '';
  }
  function addCurveRow() {
    materials.update((m) => ({ ...m, strengthCurve: [...m.strengthCurve, { ageDays: '', fcPsi: '' }] }));
  }
  function removeCurveRow(i: number) {
    materials.update((m) => ({
      ...m,
      strengthCurve: m.strengthCurve.length > 3 ? m.strengthCurve.filter((_, idx) => idx !== i) : m.strengthCurve
    }));
  }

  /** Build the compressive config; the model validates and falls back to KIC if unusable. */
  function buildCompressiveConfig(): CompressiveStrengthConfig {
    const m = $materials;
    return {
      mode: m.strengthInputMode,
      fc28Psi: typeof m.fc28Psi === 'number' ? m.fc28Psi : undefined,
      curve: m.strengthCurve
        .filter((p) => typeof p.ageDays === 'number' && typeof p.fcPsi === 'number')
        .map((p) => ({ ageDays: p.ageDays as number, fcPsi: p.fcPsi as number })),
      tensileCoeff: m.tensileCoeff
    };
  }

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
      sawcutDepth: thicknessIn,
      compressive: buildCompressiveConfig()
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
      $unitSystem,
      $materials.strengthInputMode,
      $materials.fc28Psi,
      $materials.strengthCurve,
      $materials.tensilePreset,
      $materials.tensileCoeff
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
      coefficients. Computes equivalent age, degree of hydration, and heat of hydration rate
      over 72 hours. Curing temperature uses the concrete delivery
      temperature from Project Info (falls back to start temperature, then 73&nbsp;°F).
      Saw-cut depth is derived from slab thickness (Slab Layout tab). The reported
      <strong>tensile strength</strong> is derived from the compressive strength entered below;
      with no input it falls back to a KIC-based early strength. Plots appear on the
      <strong>Hydration</strong> tab.
    </p>
  </div>

  <!-- ── Compressive → tensile strength inputs ──────────────────────────── -->
  <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
    <div>
      <h4 class="text-sm font-medium">Compressive Strength → Tensile Strength</h4>
      <p class="text-xs text-gray-600 mt-0.5">
        Enter a 28-day compressive strength or a development curve. It is scaled to each hour by
        the degree of hydration and converted to tensile strength via f<sub>t</sub> = C·√f′<sub>c</sub>
        (psi basis). Leave blank to use the KIC-based fallback.
      </p>
    </div>

    <!-- mode selector -->
    <div class="flex flex-wrap gap-4">
      <label class="flex items-center gap-2 text-sm">
        <input type="radio" name="strengthMode" value="fc28" bind:group={$materials.strengthInputMode} />
        <span>28-day compressive strength</span>
      </label>
      <label class="flex items-center gap-2 text-sm">
        <input type="radio" name="strengthMode" value="curve" bind:group={$materials.strengthInputMode} />
        <span>Strength development curve</span>
      </label>
    </div>

    {#if $materials.strengthInputMode === 'fc28'}
      <div class="flex flex-col gap-1 max-w-xs">
        <label class="text-xs font-medium text-gray-700">28-day compressive strength f′<sub>c</sub> ({strengthUnit})</label>
        <input
          class="border rounded p-2 text-sm"
          type="number" min="0" step="any" inputmode="decimal"
          placeholder={$unitSystem === 'metric' ? 'e.g., 28' : 'e.g., 4000'}
          value={fc28Display}
          on:input={(e) => setFc28(e.currentTarget.value)} />
      </div>
    {:else}
      <div class="space-y-2">
        <p class="text-xs font-medium text-gray-700">Development curve (≥3 points)</p>
        <div class="overflow-hidden rounded border border-gray-200">
          <table class="min-w-full text-xs">
            <thead class="bg-gray-100">
              <tr>
                <th class="px-3 py-1.5 text-left font-medium text-gray-600">Age (days)</th>
                <th class="px-3 py-1.5 text-left font-medium text-gray-600">f′<sub>c</sub> ({strengthUnit})</th>
                <th class="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {#each $materials.strengthCurve as point, i}
                <tr class="border-t border-gray-100">
                  <td class="px-3 py-1">
                    <input
                      class="border rounded p-1 text-sm w-24"
                      type="number" min="0" step="any" inputmode="decimal"
                      value={point.ageDays}
                      on:input={(e) => setCurveAge(i, e.currentTarget.value)} />
                  </td>
                  <td class="px-3 py-1">
                    <input
                      class="border rounded p-1 text-sm w-28"
                      type="number" min="0" step="any" inputmode="decimal"
                      value={curveFcDisplay(point.fcPsi)}
                      on:input={(e) => setCurveFc(i, e.currentTarget.value)} />
                  </td>
                  <td class="px-2 py-1 text-right">
                    <button
                      type="button"
                      class="text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-400"
                      title="Remove row"
                      disabled={$materials.strengthCurve.length <= 3}
                      on:click={() => removeCurveRow(i)}>✕</button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          class="text-xs text-blue-600 hover:text-blue-800 font-medium"
          on:click={addCurveRow}>+ Add point</button>
      </div>
    {/if}

    <!-- ACI conversion coefficient -->
    <div class="flex flex-col gap-1 max-w-md pt-1 border-t border-gray-200">
      <label class="text-xs font-medium text-gray-700">Tensile conversion (ACI f<sub>t</sub> = C·√f′<sub>c</sub>, psi basis)</label>
      <div class="flex items-center gap-2 flex-wrap">
        <select
          class="border rounded p-1.5 text-sm"
          value={$materials.tensilePreset}
          on:change={(e) => selectPreset(e.currentTarget.value as TensilePreset)}>
          {#each TENSILE_PRESETS as preset}
            <option value={preset.id}>{preset.label}</option>
          {/each}
        </select>
        <span class="text-xs text-gray-500">C =</span>
        <input
          class="border rounded p-1.5 text-sm w-20"
          type="number" min="0" step="0.1" inputmode="decimal"
          value={$materials.tensileCoeff}
          on:input={(e) => setCoeff(e.currentTarget.value)} />
      </div>
    </div>
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
              {#if results.some((r) => r.compressiveStrength !== undefined)}
                <th class="px-3 py-2 text-right font-medium text-gray-600 border-b">Compressive ({strengthUnit})</th>
              {/if}
              <th class="px-3 py-2 text-right font-medium text-gray-600 border-b">Tensile ({strengthUnit})</th>
            </tr>
          </thead>
          <tbody>
            {#each results as row (row.hour)}
              <tr class="border-t border-gray-100 hover:bg-gray-50">
                <td class="px-3 py-1 font-mono">{row.hour}</td>
                <td class="px-3 py-1 font-mono text-right">{fmt(row.equivalentAge)}</td>
                <td class="px-3 py-1 font-mono text-right">{fmt(row.degreeOfHydration)}</td>
                <td class="px-3 py-1 font-mono text-right">{fmt(row.heatOfHydration)}</td>
                {#if results.some((r) => r.compressiveStrength !== undefined)}
                  <td class="px-3 py-1 font-mono text-right">{fmt(toStrengthDisp(row.compressiveStrength ?? 0), 4)}</td>
                {/if}
                <td class="px-3 py-1 font-mono text-right">{fmt(toStrengthDisp(row.strength), 3)}</td>
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
