<script lang="ts">
  import { materials, hydrationModelResults } from '$lib/stores/form';
  import type { HydrationModel } from '$lib/types';
  import {
    HYDRATION_MODELS,
    MODEL_VARIABLES,
    WC_NOTE_MODELS,
    MODEL_RESULT_LABELS
  } from '$lib/hydration-models';

  export let hydrationModelEquations: Record<string, string>;

  const CEMENT_TYPES = ['Type I/II', 'Type I/II with 5% limestone'] as const;
  const SCM_OPTIONS = ['None', '25% C Ash', '25% F ash', '25% slag'] as const;
  const CURING_OPTIONS = ['Curing Compound', 'No Curing Compound'] as const;

  // ── result state ──────────────────────────────────────────────────────────
  let modelResults: Partial<Record<HydrationModel, Record<string, number>>> = {};
  let modelDirty:   Partial<Record<HydrationModel, boolean>>                = {};
  let calcError:    Partial<Record<HydrationModel, string>>                  = {};

  function setHydrationInput(modelId: HydrationModel, varKey: string, raw: string) {
    const value = raw === '' ? '' : parseFloat(raw);
    materials.update(m => ({
      ...m,
      hydrationModelInputs: { ...m.hydrationModelInputs, [`${modelId}__${varKey}`]: value }
    }));
    if (modelResults[modelId] !== undefined) {
      modelDirty = { ...modelDirty, [modelId]: true };
    }
  }

  // Mark w/c-dependent models dirty when w/c changes
  let _prevWC: number | '' | undefined;
  $: {
    const wc = $materials.waterCementRatio;
    if (_prevWC !== undefined && wc !== _prevWC) {
      const updated = { ...modelDirty };
      for (const model of WC_NOTE_MODELS) {
        if (modelResults[model] !== undefined) updated[model] = true;
      }
      modelDirty = updated;
    }
    _prevWC = wc;
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  function isValid(v: number | '' | undefined): v is number {
    return typeof v === 'number' && !isNaN(v);
  }

  function inp(modelId: HydrationModel, key: string): number | null {
    const val = $materials.hydrationModelInputs[`${modelId}__${key}`];
    return isValid(val) ? val : null;
  }

  function fmt(n: number): string {
    const abs = Math.abs(n);
    if (abs === 0) return '0';
    if (abs >= 0.001 && abs < 100000) return parseFloat(n.toPrecision(4)).toString();
    return n.toExponential(3);
  }

  // ── calculation functions ─────────────────────────────────────────────────
  function calculateBentz(): Record<string, number> | null {
    const wc  = $materials.waterCementRatio;
    const rho = inp('bentz', 'rho_cem');
    const fe  = inp('bentz', 'f_exp');
    const CS  = inp('bentz', 'CS');
    const m   = inp('bentz', 'm');
    const t   = inp('bentz', 't');
    if (!isValid(wc) || rho === null || fe === null || CS === null || m === null || t === null) return null;
    const wcn = wc;
    const p   = rho * wcn / (fe + rho * CS);
    const R   = m * (fe + rho * CS) / Math.pow(1 + rho * wcn, 2);
    const ex  = Math.exp(R * (1 - p) * t);
    return { p, R, alpha: p * (ex - 1) / (ex - p) };
  }

  function calculateSchindlerFolliard(): Record<string, number> | null {
    const wc     = $materials.waterCementRatio;
    const pC3A   = inp('schindler-folliard', 'p_C3A');
    const pC3S   = inp('schindler-folliard', 'p_C3S');
    const pSO3   = inp('schindler-folliard', 'p_SO3');
    const Blaine = inp('schindler-folliard', 'Blaine');
    const pFA    = inp('schindler-folliard', 'p_FA');
    const pSLAG  = inp('schindler-folliard', 'p_SLAG');
    const pFACaO = inp('schindler-folliard', 'p_FA_CaO');
    const E      = inp('schindler-folliard', 'E');
    const T      = inp('schindler-folliard', 'T');
    const t      = inp('schindler-folliard', 't');
    if (!isValid(wc) || pC3A === null || pC3S === null || pSO3 === null || Blaine === null ||
        pFA === null || pSLAG === null || pFACaO === null || E === null || T === null || t === null) return null;
    const wcn   = wc;
    const tau   = 66.78 * Math.pow(pC3A, -0.154) * Math.pow(pC3S, -0.401) *
                  Math.pow(Blaine, -0.804) * Math.pow(pSO3, -0.758) *
                  Math.exp(2.187 * pSLAG + 9.5 * pFA * pFACaO);
    const beta  = 181.4 * Math.pow(pC3A, 0.146) * Math.pow(pC3S, 0.227) *
                  Math.pow(Blaine, -0.535) * Math.pow(pSO3, -0.558) *
                  Math.exp(-0.647 * pSLAG);
    const au    = Math.min(1.031 * wcn / (0.194 + wcn) + 0.50 * pFA + 0.30 * pSLAG, 1.0);
    const T_K   = T + 273.15;
    const t_e   = t * Math.exp(-(E / 8.3144) * (1 / T_K - 1 / 293.15));
    const alpha = au * Math.exp(-Math.pow(tau / t_e, beta));
    return { alpha_u: au, tau, beta, t_e, alpha };
  }

  function calculateKnudsenLinear(): Record<string, number> | null {
    const au = inp('knudsen-linear', 'alpha_u');
    const m  = inp('knudsen-linear', 'm');
    const t  = inp('knudsen-linear', 't');
    const t0 = inp('knudsen-linear', 't_0');
    if (au === null || m === null || t === null || t0 === null) return null;
    const dt = t - t0;
    if (dt <= 0) return null;
    return { alpha: au * m * dt / (1 + m * dt) };
  }

  function calculateKnudsenParabolic(): Record<string, number> | null {
    const au = inp('knudsen-parabolic', 'alpha_u');
    const m  = inp('knudsen-parabolic', 'm');
    const t  = inp('knudsen-parabolic', 't');
    const t0 = inp('knudsen-parabolic', 't_0');
    if (au === null || m === null || t === null || t0 === null) return null;
    const dt = t - t0;
    if (dt <= 0) return null;
    const s = Math.sqrt(dt);
    return { alpha: au * m * s / (1 + m * s) };
  }

  function calculateLam(): Record<string, number> | null {
    const wc = $materials.waterCementRatio;
    const m1 = inp('lam', 'm1');
    const m2 = inp('lam', 'm2');
    if (!isValid(wc) || m1 === null || m2 === null) return null;
    return { alpha: m1 * Math.exp(-m2 / wc) };
  }

  const CALC_FNS: Record<HydrationModel, () => Record<string, number> | null> = {
    'bentz':              calculateBentz,
    'schindler-folliard': calculateSchindlerFolliard,
    'knudsen-linear':     calculateKnudsenLinear,
    'knudsen-parabolic':  calculateKnudsenParabolic,
    'lam':                calculateLam
  };

  function calculate(modelId: HydrationModel) {
    if (WC_NOTE_MODELS.includes(modelId) && !isValid($materials.waterCementRatio)) {
      calcError = { ...calcError, [modelId]: 'Fill in the w/c field above first.' };
      return;
    }
    const result = CALC_FNS[modelId]();
    if (result !== null) {
      modelResults = { ...modelResults, [modelId]: result };
      modelDirty   = { ...modelDirty,   [modelId]: false };
      calcError    = { ...calcError,    [modelId]: '' };
      hydrationModelResults.update(r => ({ ...r, [modelId]: result as Record<string, number> }));
    } else {
      calcError = { ...calcError, [modelId]: 'Please fill in all required inputs.' };
    }
  }
</script>

<div class="space-y-4">
  <div class="flex flex-col gap-1">
    <label class="font-medium">Cement Type</label>
    <select
      class="border rounded-lg p-2"
      bind:value={$materials.cementType}>
      {#each CEMENT_TYPES as option}
        <option value={option}>{option}</option>
      {/each}
    </select>
  </div>

  <div class="flex flex-col gap-1">
    <label class="font-medium">SCM</label>
    <select
      class="border rounded-lg p-2"
      bind:value={$materials.scm}>
      {#each SCM_OPTIONS as option}
        <option value={option}>{option}</option>
      {/each}
    </select>
  </div>

  <div class="flex flex-col gap-1">
    <label class="font-medium">w/c (m)</label>
    <input
      class="border rounded-lg p-2"
      type="number"
      min="0.37"
      max="0.45"
      step="0.01"
      placeholder="e.g., 0.40"
      bind:value={$materials.waterCementRatio}
      inputmode="decimal" />
    <p class="text-xs text-gray-600">Allowed range: 0.37 - 0.45</p>
  </div>

  <div class="flex flex-col gap-2">
    <label class="font-medium">Curing</label>
    <div class="flex flex-wrap gap-4">
      {#each CURING_OPTIONS as option}
        <label class="flex items-center gap-2">
          <input
            type="radio"
            name="curing"
            value={option}
            bind:group={$materials.curing} />
          <span>{option}</span>
        </label>
      {/each}
    </div>
  </div>

  <div class="flex flex-col gap-3">
    <div>
      <h3 class="font-medium">Cement Hydration Model</h3>
      <p class="text-xs text-gray-600 mt-1">
        Choose the cement hydration model you would like to use for your pavement design.
        Design inputs needed may vary between models. Models from Magazine of Concrete Research,
        Volume 65 Issue 9 (May 2013).
      </p>
    </div>

    <div class="flex flex-col gap-2">
      {#each HYDRATION_MODELS as model (model.id)}
        <label
          class="flex items-start gap-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 transition-colors"
          class:border-blue-500={$materials.hydrationModel === model.id}
          class:bg-blue-50={$materials.hydrationModel === model.id}>
          <input
            type="radio"
            name="hydrationModel"
            value={model.id}
            bind:group={$materials.hydrationModel}
            class="mt-1 shrink-0" />
          <div class="min-w-0 w-full">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-medium text-sm">{model.name}</span>
              {#if model.recommended}
                <span class="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                  Recommended
                </span>
              {/if}
            </div>
            <div class="prose prose-sm max-w-none mt-1">
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html hydrationModelEquations[model.id]}
            </div>

            {#if $materials.hydrationModel === model.id}
              <div class="mt-3 pt-3 border-t border-gray-200 flex flex-col gap-2">
                {#if WC_NOTE_MODELS.includes(model.id)}
                  <p class="text-xs text-gray-500 italic">
                    Note: water/cement ratio (w/c) is taken from the field above.
                  </p>
                {/if}

                {#each MODEL_VARIABLES[model.id].filter(v => !v.isConstant) as v (v.key)}
                  <div class="flex items-start gap-3">
                    <span class="font-mono text-sm font-semibold w-20 shrink-0 pt-1">{v.symbol}</span>
                    <span class="text-xs text-gray-600 flex-1 pt-1">
                      {v.definition}{v.unit ? ` (${v.unit})` : ''}
                    </span>
                    <input
                      type="number"
                      class="border rounded p-1 text-sm w-28 shrink-0"
                      step={v.step}
                      min={v.min}
                      max={v.max}
                      value={$materials.hydrationModelInputs[`${model.id}__${v.key}`] ?? ''}
                      on:input={(e) => setHydrationInput(model.id, v.key, e.currentTarget.value)}
                      inputmode="decimal" />
                  </div>
                {/each}

                {#if MODEL_VARIABLES[model.id].some(v => v.isConstant)}
                  <div class="mt-1 pt-2 border-t border-gray-100">
                    <p class="text-xs font-medium text-gray-500 mb-2">Constants</p>
                    {#each MODEL_VARIABLES[model.id].filter(v => v.isConstant) as v (v.key)}
                      <div class="flex items-center gap-3">
                        <span class="font-mono text-sm font-semibold w-20 shrink-0">{v.symbol}</span>
                        <span class="text-xs text-gray-600 flex-1">
                          {v.definition}{v.unit ? ` (${v.unit})` : ''}
                        </span>
                        <div class="border rounded p-1 text-sm w-28 shrink-0 bg-gray-100 text-gray-600 font-mono text-right">
                          {v.constantValue}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}

                <!-- Calculate button -->
                <div class="mt-3 pt-3 border-t border-gray-200 flex items-center gap-3 flex-wrap">
                  <button
                    class="calc-btn"
                    class:dirty={modelDirty[model.id]}
                    on:click={() => calculate(model.id)}>
                    Calculate
                  </button>
                  {#if calcError[model.id]}
                    <span class="text-xs text-red-500">{calcError[model.id]}</span>
                  {/if}
                </div>

                <!-- Results -->
                {#if modelResults[model.id] !== undefined}
                  <div class="mt-2 pt-2 border-t border-gray-100">
                    <p class="text-xs font-medium text-gray-500 mb-2">Results</p>
                    {#each MODEL_RESULT_LABELS[model.id] as r (r.key)}
                      <div class="flex items-center gap-3 py-0.5">
                        <span class="font-mono text-sm font-semibold w-20 shrink-0">{r.symbol}</span>
                        <span class="text-xs text-gray-600 flex-1">{r.definition}{r.unit ? ` (${r.unit})` : ''}</span>
                        <div class="border rounded p-1 text-sm w-28 shrink-0 bg-blue-50 text-blue-800 font-mono text-right">
                          {fmt((modelResults[model.id] as Record<string, number>)[r.key])}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </label>
      {/each}
    </div>
  </div>
</div>

<style>
  .calc-btn {
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

  .calc-btn:hover {
    background-color: #eff6ff;
  }

  .calc-btn:active {
    background-color: #dbeafe;
  }

  .calc-btn.dirty {
    animation: calc-pulse 1.8s ease-in-out infinite;
  }

  @keyframes calc-pulse {
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
