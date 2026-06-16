<script lang="ts">
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import {
    projectInfo,
    materials,
    slabLayout,
    weatherStations,
    chartImages,
    hydrationModelResults,
    maturityResultsStore,
    bentzSeries,
    thermalGradientResults,
    stressResults,
    stressParams
  } from '$lib/stores/form';
  import { site, allPoints } from '$lib/stores/stations';
  import { HYDRATION_MODEL_NAMES, MODEL_VARIABLES, WC_NOTE_MODELS, MODEL_RESULT_LABELS } from '$lib/hydration-models';
  import type { HydrationModel } from '$lib/types';
  import { unitSystem, valueDp } from '$lib/stores/units';
  import StaticMapView from '$lib/components/report/StaticMapView.svelte';
  import placesIndex from '$lib/data/places-index.json';
  import type { PlacesIndex } from '$lib/types';

  export let hydrationModelEquations: Record<string, string>;
  export let analysisNarratives: Record<string, string>;

  let paperPreview: HTMLDivElement;
  let isGenerating = false;

  const index = placesIndex as PlacesIndex;

  // Unit conversion constants (results are computed in US canonical units)
  const PSI_TO_MPA = 0.00689476;
  const KI_US_TO_SI = 0.00109877; // psi·in^0.5 → MPa·m^0.5

  // Helper to format values or show "Not specified"
  function formatValue(value: string | number | ''): string {
    if (value === '' || value === null || value === undefined) {
      return 'Not specified';
    }
    return String(value);
  }

  function formatCoord(value: number | null): string {
    return value === null ? 'Not specified' : value.toFixed(4);
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return 'Not specified';
    try {
      // Parse date components to avoid timezone issues
      const [year, month, day] = dateStr.split('-').map(Number);
      // Create date in local timezone (month is 0-indexed)
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  function formatHour(hourStr: string): string {
    if (!hourStr) return 'Not specified';
    // Convert from 24-hour format (e.g., "14:00") to 12-hour format with AM/PM
    const [hours, minutes] = hourStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12; // Convert 0 to 12 for midnight
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  function formatTemp(temp: number | ''): string {
    if (temp === '') return 'Not specified';
    if (snap.unitSystem !== 'us') {
      return `${Math.round((temp as number - 32) * 5 / 9)}°C`;
    }
    return `${temp}°F`;
  }

  function formatWaterCementRatio(ratio: number | ''): string {
    if (ratio === '') return 'Not specified';
    return String(ratio);
  }

  function formatCuring(curing: string): string {
    if (curing === 'Curing Compound') {
      return 'Curing compound in use.';
    } else if (curing === 'No Curing Compound') {
      return 'Curing compound not in use.';
    }
    return curing;
  }

  function formatElevation(elevation: number | null): string {
    if (elevation === null) return '—';
    if (snap.unitSystem === 'us') {
      return `${(elevation * 3.28084).toFixed(1)} ft`;
    }
    return `${elevation.toFixed(1)} m`;
  }

  function formatDistance(distance: number): string {
    if (snap.unitSystem === 'us') {
      return `${(distance * 0.621371).toFixed(1)} mi`;
    }
    return `${distance.toFixed(1)} km`;
  }

  // Get current date formatted
  function getFormattedDate(): string {
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Snapshot of all store values — only updated when the user clicks "Update PDF".
  // The preview renders from this snapshot so it never changes on its own.
  function buildSnapshot() {
    const pi = get(projectInfo);
    const loc = (index[pi.state] || []).find(
      (p) => p.city.toLowerCase() === pi.city.toLowerCase()
    ) || null;
    const ap = get(allPoints);
    return {
      projectInfo: { ...pi },
      materials: { ...get(materials) },
      slabLayout: { ...get(slabLayout) },
      weatherStations: [...get(weatherStations)],
      chartImages: { ...get(chartImages) },
      hydrationModelResults: { ...get(hydrationModelResults) },
      maturity: get(maturityResultsStore),
      bentz: get(bentzSeries),
      thermal: get(thermalGradientResults),
      stress: get(stressResults),
      stressParams: { ...get(stressParams) },
      site: get(site),
      allPoints: ap ? [...ap] : [],
      unitSystem: get(unitSystem),
      selectedLocation: loc
    };
  }

  let snap = buildSnapshot();
  let isDirty = false;

  // Captured PNG data URLs for the analysis charts (rendered offscreen, see
  // generateCharts). Empty string until the matching model has been run and the
  // user has clicked "Update PDF".
  let analysisCharts = {
    doh: '',
    heat: '',
    strength: '',
    thermal: '',
    stressDev: '',
    stressFibre: '',
    stressKI: ''
  };

  // Offscreen Plotly render targets (kept out of the printed paper-preview).
  let offDoh: HTMLDivElement;
  let offHeat: HTMLDivElement;
  let offStrength: HTMLDivElement;
  let offThermal: HTMLDivElement;
  let offStressDev: HTMLDivElement;
  let offStressFibre: HTMLDivElement;
  let offStressKI: HTMLDivElement;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Plotly: any = null;

  // Mark the button dirty whenever any input store changes after mount.
  onMount(() => {
    const stores = [
      projectInfo, materials, slabLayout, weatherStations, chartImages,
      hydrationModelResults, maturityResultsStore, bentzSeries,
      thermalGradientResults, stressResults, stressParams,
      unitSystem, site, allPoints
    ];
    const unsubs = stores.map((s) => s.subscribe(() => { isDirty = true; }));
    // Each subscribe fires immediately with the current value — reset so we
    // only flash after the user actually changes something.
    isDirty = false;
    // Render any analysis charts that already have data on mount.
    generateCharts();
    return () => unsubs.forEach((u) => u());
  });

  async function updatePdf() {
    snap = buildSnapshot();
    isDirty = false;
    await generateCharts();
  }

  // These depend on snap.unitSystem so must come after snap is declared.
  // thickness is canonical inches; spacing is canonical feet.
  // valueDp infers the user's intended precision from the canonical value.
  function formatThickness(thickness: number | ''): string {
    if (thickness === '') return 'Not specified';
    if (snap.unitSystem === 'us') return `${thickness} in`;
    const dp = valueDp(thickness as number);
    return `${parseFloat(((thickness as number) * 25.4).toFixed(dp))} mm`;
  }

  function formatJointSpacing(spacing: number | ''): string {
    if (spacing === '') return 'Not specified';
    if (snap.unitSystem === 'us') return `${spacing} ft`;
    const dp = valueDp(spacing as number);
    return `${parseFloat(((spacing as number) * 0.3048).toFixed(dp))} m`;
  }

  function fmt(n: number): string {
    const abs = Math.abs(n);
    if (abs === 0) return '0';
    if (abs >= 0.001 && abs < 100000) return parseFloat(n.toPrecision(4)).toString();
    return n.toExponential(3);
  }

  // Fixed-decimal formatter for the analysis result tables.
  function fmtFixed(n: number, dp = 1): string {
    if (!Number.isFinite(n)) return '—';
    if (n === 0) return '0';
    const abs = Math.abs(n);
    if (abs >= 1e5 || abs < 1e-3) return n.toExponential(2);
    return n.toFixed(dp);
  }

  function fmtInput(modelId: HydrationModel, key: string): string {
    const val = snap.materials.hydrationModelInputs[`${modelId}__${key}`];
    if (val === '' || val === undefined) return 'Not specified';
    return String(val);
  }

  // ── Unit-aware display helpers for the analysis sections ──────────────────
  $: us = snap.unitSystem === 'us';
  $: stressUnit = us ? 'psi' : 'MPa';
  $: kiUnit = us ? 'psi·in½' : 'MPa·m½';
  $: tUnit = us ? '°F' : '°C';
  $: strengthUnit = us ? 'psi' : 'MPa';
  const toStress = (psi: number) => (us ? psi : psi * PSI_TO_MPA);
  const toKI = (v: number) => (us ? v : v * KI_US_TO_SI);
  const toDeltaT = (dF: number) => (us ? dF : (dF * 5) / 9);
  const tempDisplay = (c: number) => (us ? c * 1.8 + 32 : c);

  // Sample an hourly series so the printed table fits one page.
  function sampleEvery<T extends { hour: number }>(rows: T[] | null | undefined, step: number): T[] {
    if (!rows) return [];
    return rows.filter((r) => r.hour > 0 && r.hour % step === 0);
  }

  // ── Thermal-gradient profile summary (surface / mid / bottom + gradient) ──
  type GradientRow = { hour: number; surface: number; mid: number; bottom: number; gradient: number };
  function thermalSummaryRows(): GradientRow[] {
    const res = snap.thermal?.results ?? [];
    if (!res.length) return [];
    const hours = [1, 6, 12, 24, 48, 72].filter((h) => h <= res.length);
    return hours.map((h) => {
      const temps = res[h - 1].temps; // results[0] → hour 1
      const n = temps.length;
      const surfaceC = temps[0];
      const bottomC = temps[n - 1];
      const midC = temps[Math.floor((n - 1) / 2)];
      return {
        hour: h,
        surface: tempDisplay(surfaceC),
        mid: tempDisplay(midC),
        bottom: tempDisplay(bottomC),
        gradient: tempDisplay(surfaceC) - tempDisplay(bottomC)
      };
    });
  }

  // ── Stress analysis derived summaries ────────────────────────────────────
  $: stressStartHour = snap.stress?.hourlyResults?.[0]?.hour ?? null;
  $: alphaUltimate = (() => {
    const sf = snap.hydrationModelResults['schindler-folliard'];
    if (sf && typeof sf.alpha_u === 'number' && sf.alpha_u > 0) return sf.alpha_u;
    const series = snap.maturity ?? [];
    const maxAlpha = series.reduce((mx, r) => Math.max(mx, r.degreeOfHydration), 0);
    return maxAlpha > 0 ? maxAlpha : 0.87;
  })();
  $: peakTensile = (() => {
    const cr = snap.stress?.creepResults ?? [];
    let best = -Infinity;
    let hr = 0;
    for (const c of cr) {
      if (c.creepMaxTensile > best) { best = c.creepMaxTensile; hr = c.hour; }
    }
    return Number.isFinite(best) && cr.length ? { value: best, hour: hr } : null;
  })();

  // ── Section availability + dynamic page numbering ────────────────────────
  $: hasMaturity = (snap.maturity?.length ?? 0) > 0;
  $: hasThermal = (snap.thermal?.results?.length ?? 0) > 0;
  $: hasStress = (snap.stress?.hourlyResults?.length ?? 0) > 0;
  $: hasWindCloud = !!(snap.chartImages.wind || snap.chartImages.cloud);

  // Physical page order (one entry = one printed page). Drives both the
  // running page numbers and the table of contents.
  $: pageOrder = (() => {
    const o: string[] = [
      'cover', 'disclaimer', 'toc', 'projectInfo', 'materials',
      'materialsCont', 'slabLayout', 'environment'
    ];
    if (hasWindCloud) o.push('environmentCharts');
    if (hasMaturity) o.push('maturityTheory', 'maturityCharts', 'maturityTable');
    if (hasThermal) o.push('thermalTheory', 'thermalResults');
    if (hasStress) o.push('stressTheory', 'stressParams', 'stressCharts', 'stressTable');
    o.push('appendicesDivider', 'appendixA');
    return o;
  })();
  $: pageNum = Object.fromEntries(pageOrder.map((k, i) => [k, i + 1])) as Record<string, number>;

  $: tocSections = (() => {
    const s: { title: string; page: number; indent: boolean }[] = [
      { title: 'Project Information', page: pageNum.projectInfo, indent: false },
      { title: 'Materials', page: pageNum.materials, indent: false },
      { title: 'Slab Layout', page: pageNum.slabLayout, indent: false },
      { title: 'Environment', page: pageNum.environment, indent: false }
    ];
    if (hasMaturity) s.push({ title: 'Concrete Maturity & Strength', page: pageNum.maturityTheory, indent: false });
    if (hasThermal) s.push({ title: 'Thermal Gradient', page: pageNum.thermalTheory, indent: false });
    if (hasStress) s.push({ title: 'Stress & Creep Analysis', page: pageNum.stressTheory, indent: false });
    s.push({ title: 'Appendices', page: pageNum.appendicesDivider, indent: false });
    s.push({ title: 'Appendix A', page: pageNum.appendixA, indent: true });
    return s;
  })();

  // ── Offscreen Plotly chart capture ───────────────────────────────────────
  // Maps hour 1 (blue) → hour 72 (red) across the thermal-gradient spectrum.
  function hourColor(hour: number): string {
    const t = (hour - 1) / 71;
    const hue = Math.round(240 * (1 - t));
    return `hsl(${hue}, 90%, 45%)`;
  }

  async function ensurePlotly() {
    if (!Plotly) {
      const mod = await import('plotly.js-dist-min');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Plotly = (mod as any).default ?? mod;
    }
    return Plotly;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function capture(el: HTMLDivElement | null, traces: any[], layout: any, w: number, h: number): Promise<string> {
    if (!el || !traces.length || !Plotly) return '';
    await Plotly.react(el, traces, { ...layout, width: w, height: h }, { staticPlot: true, responsive: false });
    try {
      return await Plotly.toImage(el, { format: 'png', width: w, height: h });
    } catch {
      return '';
    }
  }

  const chartFont = { family: 'Calibri, Carlito, sans-serif', size: 14 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseLayout: any = {
    paper_bgcolor: 'white',
    plot_bgcolor: 'white',
    font: chartFont,
    margin: { t: 50, r: 24, b: 56, l: 78 }
  };

  async function generateCharts() {
    if (!browser) return;
    await ensurePlotly();
    const next = { doh: '', heat: '', strength: '', thermal: '', stressDev: '', stressFibre: '', stressKI: '' };

    // Read units straight off the frozen snapshot — the reactive `us`/label
    // vars are updated by Svelte's scheduler and may be stale during this
    // synchronous call (which runs immediately after `snap` is reassigned).
    const us = snap.unitSystem === 'us';
    const stressUnit = us ? 'psi' : 'MPa';
    const kiUnit = us ? 'psi·in½' : 'MPa·m½';
    const tUnit = us ? '°F' : '°C';
    const strengthUnit = us ? 'psi' : 'MPa';
    const toStress = (psi: number) => (us ? psi : psi * PSI_TO_MPA);
    const toKI = (v: number) => (us ? v : v * KI_US_TO_SI);
    const tempDisplay = (c: number) => (us ? c * 1.8 + 32 : c);

    // ── Maturity charts ───────────────────────────────────────────────────
    const mat = snap.maturity ?? [];
    if (mat.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dohTraces: any[] = [{
        x: mat.map((r) => r.hour),
        y: mat.map((r) => r.degreeOfHydration),
        type: 'scatter', mode: 'lines', name: 'Concrete Maturity',
        line: { color: '#2563eb', width: 2.5 }
      }];
      if (snap.bentz?.length) {
        dohTraces.push({
          x: snap.bentz.map((r) => r.t),
          y: snap.bentz.map((r) => r.alpha),
          type: 'scatter', mode: 'lines', name: 'Bentz (2006)',
          line: { color: '#d97706', width: 2.5 }
        });
      }
      next.doh = await capture(offDoh, dohTraces, {
        ...baseLayout,
        title: { text: 'Degree of Hydration vs Time', font: { size: 16 } },
        xaxis: { title: { text: 'Time (hr)' } },
        yaxis: { title: { text: 'Degree of Hydration (α)' }, range: [0, 1] },
        legend: { orientation: 'h', y: -0.2 }
      }, 1000, 360);

      next.heat = await capture(offHeat, [{
        x: mat.map((r) => r.hour),
        y: mat.map((r) => r.heatOfHydration),
        type: 'scatter', mode: 'lines', name: 'q',
        line: { color: '#dc2626', width: 2.5 }
      }], {
        ...baseLayout,
        title: { text: 'Heat of Hydration Rate vs Time', font: { size: 16 } },
        xaxis: { title: { text: 'Time (hr)' } },
        yaxis: { title: { text: 'Heat Rate (J/g/hr)' } }
      }, 1000, 360);

      next.strength = await capture(offStrength, [{
        x: mat.map((r) => r.hour),
        y: mat.map((r) => toStress(r.strength)),
        type: 'scatter', mode: 'lines', name: 'Tensile strength',
        line: { color: '#16a34a', width: 2.5 }
      }], {
        ...baseLayout,
        title: { text: 'Tensile Strength vs Time', font: { size: 16 } },
        xaxis: { title: { text: 'Time (hr)' } },
        yaxis: { title: { text: `Tensile strength (${strengthUnit})` } }
      }, 1000, 360);
    }

    // ── Thermal gradient profile ──────────────────────────────────────────
    const res = snap.thermal?.results ?? [];
    if (res.length && typeof snap.slabLayout.thickness === 'number') {
      const thicknessM = (snap.slabLayout.thickness as number) * 0.0254;
      const numPoints = res[0]?.temps.length ?? 11;
      const depthsM = Array.from({ length: numPoints }, (_, i) => (thicknessM / (numPoints - 1)) * i);
      const depthsDisplay = us ? depthsM.map((d) => d * 39.3701) : depthsM.map((d) => d * 1000);
      const hours = [1, 6, 12, 24, 48, 72].filter((h) => h <= res.length);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const traces: any[] = hours.map((h) => ({
        x: res[h - 1].temps.map((t) => tempDisplay(t)),
        y: depthsDisplay,
        type: 'scatter', mode: 'lines', name: `Hour ${h}`,
        line: { color: hourColor(h) }
      }));
      next.thermal = await capture(offThermal, traces, {
        ...baseLayout,
        title: { text: 'Slab Temperature Gradient Over Time', font: { size: 16 } },
        xaxis: { title: { text: `Temperature (${tUnit})` } },
        yaxis: { title: { text: us ? 'Depth (in)' : 'Depth (mm)' }, autorange: 'reversed' },
        legend: { title: { text: 'Hour' } }
      }, 1000, 480);
    }

    // ── Stress charts ─────────────────────────────────────────────────────
    if (snap.stress?.hourlyResults?.length) {
      const elastic = snap.stress.hourlyResults;
      const creep = snap.stress.creepResults;
      const hours = elastic.map((r) => r.hour);
      const sMap = new Map<number, number>();
      for (const r of snap.maturity ?? []) sMap.set(r.hour, r.strength);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const devTraces: any[] = [
        { x: hours, y: elastic.map((r) => toStress(r.totalStress)), name: 'Elastic total', mode: 'lines', line: { color: '#9ca3af', dash: 'dot', width: 1.5 } },
        { x: hours, y: creep.map((r) => toStress(r.creepTotalStress)), name: 'Creep total', mode: 'lines', line: { color: '#2563eb', width: 2.5 } },
        { x: hours, y: creep.map((r) => toStress(r.creepMaxTensile)), name: 'Creep max-tensile face', mode: 'lines', line: { color: '#dc2626', width: 2.5 } }
      ];
      const strengthVals = hours.map((h) => sMap.get(h));
      if (strengthVals.some((v) => typeof v === 'number' && v > 0)) {
        devTraces.push({
          x: hours,
          y: strengthVals.map((v) => (typeof v === 'number' ? toStress(v) : null)),
          name: 'Tensile strength (maturity)', mode: 'lines', line: { color: '#16a34a', dash: 'dash', width: 2.5 }
        });
      }
      next.stressDev = await capture(offStressDev, devTraces, {
        ...baseLayout,
        title: { text: 'Stress Development & Cracking Risk', font: { size: 16 } },
        xaxis: { title: { text: 'Hour after placement' } },
        yaxis: { title: { text: `Stress (${stressUnit}, tension +)` }, zeroline: true },
        legend: { orientation: 'h', y: -0.2 }
      }, 1000, 400);

      next.stressFibre = await capture(offStressFibre, [
        { x: hours, y: creep.map((r) => toStress(r.creepStressTop)), name: 'Top fibre', mode: 'lines', line: { color: '#ea580c', width: 2.5 } },
        { x: hours, y: creep.map((r) => toStress(r.creepStressBottom)), name: 'Bottom fibre', mode: 'lines', line: { color: '#0891b2', width: 2.5 } }
      ], {
        ...baseLayout,
        title: { text: 'Creep-Adjusted Extreme-Fibre Stress', font: { size: 16 } },
        xaxis: { title: { text: 'Hour after placement' } },
        yaxis: { title: { text: `Stress (${stressUnit}, tension +)` }, zeroline: true },
        legend: { orientation: 'h', y: -0.2 }
      }, 1000, 360);

      next.stressKI = await capture(offStressKI, [
        { x: hours, y: elastic.map((r) => toKI(r.stressIntensityKI)), name: 'Elastic Kᵢ', mode: 'lines', line: { color: '#9ca3af', dash: 'dot', width: 1.5 } },
        { x: hours, y: creep.map((r) => toKI(r.creepKI)), name: 'Creep Kᵢ', mode: 'lines', line: { color: '#7c3aed', width: 2.5 } }
      ], {
        ...baseLayout,
        title: { text: 'Mode-I Stress Intensity Factor', font: { size: 16 } },
        xaxis: { title: { text: 'Hour after placement' } },
        yaxis: { title: { text: `Kᵢ (${kiUnit})` }, zeroline: true },
        legend: { orientation: 'h', y: -0.2 }
      }, 1000, 360);
    }

    analysisCharts = next;
  }

  async function downloadPdf() {
    if (isGenerating) return;
    isGenerating = true;

    try {
      const html2pdf = (await import('html2pdf.js')).default;

      // Temporarily adjust styles for PDF generation
      paperPreview.style.zoom = '1';
      const pages = paperPreview.querySelectorAll<HTMLElement>('.page');
      pages.forEach((page) => {
        page.style.marginBottom = '0';
        page.style.boxShadow = 'none';
        page.style.borderRadius = '0';
      });

      // Wait for all images (including map) to be fully loaded
      const images = paperPreview.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = () => resolve(null);
            img.onerror = () => resolve(null);
          });
        })
      );

      const options = {
        margin: 0,
        filename: 'pavement-cracking-report.pdf',
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          letterRendering: true
        },
        jsPDF: {
          unit: 'in',
          format: 'letter',
          orientation: 'portrait' as const
        }
      };

      await html2pdf().set(options).from(paperPreview).save();

      // Restore styles after PDF generation
      paperPreview.style.zoom = '';
      pages.forEach((page) => {
        page.style.marginBottom = '';
        page.style.boxShadow = '';
        page.style.borderRadius = '';
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      isGenerating = false;
    }
  }
</script>

<div class="toolbar">
  <button class="update-btn" class:dirty={isDirty} on:click={updatePdf} disabled={isGenerating}>
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"></polyline>
      <polyline points="1 20 1 14 7 14"></polyline>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
    </svg>
    Update PDF
  </button>
  <button class="download-btn" on:click={downloadPdf} disabled={isGenerating}>
    {#if isGenerating}
      <svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
      </svg>
      Generating...
    {:else}
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      Download PDF
    {/if}
  </button>
</div>

<div class="report-container">
  <div class="paper-preview" bind:this={paperPreview}>

    <!-- PAGE 1: Cover Page -->
    <div class="page cover-page">
      <div class="cover-content">
        <div class="cover-title-block">
          <h1 class="cover-title">Pavement Cracking<br/>Analysis Report</h1>
          <div class="cover-divider"></div>
          <p class="cover-location">
            {#if snap.projectInfo.city && snap.projectInfo.state}
              {snap.projectInfo.city}, {snap.projectInfo.state}
            {:else}
              Location not specified
            {/if}
          </p>
          <p class="cover-date">{getFormattedDate()}</p>
        </div>
      </div>
      <div class="cover-footer">
        <p>Report generated using Pavement Cracking Tool website, developed by the Civil, Construction and Environmental Engineering Department at The University of Alabama. Roll Tide.</p>
      </div>
    </div>

    <!-- Disclaimer -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Disclaimer</h2>
        <div class="title-rule"></div>
        <p>Armen, you gotta say something official here so they know that if something goes wrong it's not our fault.</p>
      </div>
      <div class="page-number"><p>{pageNum.disclaimer}</p></div>
    </div>

    <!-- Table of Contents -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Table of Contents</h2>
        <div class="title-rule"></div>
        <div class="toc-list">
          {#each tocSections as section}
            <div class="toc-entry" class:toc-entry-indent={section.indent}>
              <span class="toc-label">{section.title}</span>
              <span class="toc-dots"> .................................................................................................................................................... </span>
              <span class="toc-page">{section.page}</span>
            </div>
          {/each}
        </div>
      </div>
      <div class="page-number"><p>{pageNum.toc}</p></div>
    </div>

    <!-- Project Information -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Project Information</h2>
        <div class="title-rule"></div>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">State:</span>
            <span class="info-value">{formatValue(snap.projectInfo.state)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">City:</span>
            <span class="info-value">{formatValue(snap.projectInfo.city)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Latitude:</span>
            <span class="info-value">{formatCoord(snap.selectedLocation?.latitude ?? null)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Longitude:</span>
            <span class="info-value">{formatCoord(snap.selectedLocation?.longitude ?? null)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date:</span>
            <span class="info-value">{formatDate(snap.projectInfo.date)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Start Hour:</span>
            <span class="info-value">{formatHour(snap.projectInfo.startHour)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Construction Start Temperature:</span>
            <span class="info-value">{formatTemp(snap.projectInfo.startTempF)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Concrete Delivery Temperature:</span>
            <span class="info-value">{formatTemp(snap.projectInfo.deliveryTempF)}</span>
          </div>
        </div>

        {#if snap.site && snap.site.length === 2}
          <div class="map-section">
            <h3 class="map-title">Project Location Map</h3>
            <div class="map-container">
              <StaticMapView center={snap.site as [number, number]} points={snap.allPoints as [number, number][]} />
            </div>
          </div>
        {/if}
      </div>
      <div class="page-number"><p>{pageNum.projectInfo}</p></div>
    </div>

    <!-- Materials -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Materials</h2>
        <div class="title-rule"></div>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Cement Type:</span>
            <span class="info-value">{formatValue(snap.materials.cementType)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">SCM:</span>
            <span class="info-value">{formatValue(snap.materials.scm)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">
              w/c (m):
              <div style="font-size: 10pt; color: #666; font-weight: normal; margin-top: 2pt;">Allowed range: 0.37 - 0.45</div>
            </span>
            <span class="info-value">{formatWaterCementRatio(snap.materials.waterCementRatio)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Curing:</span>
            <span class="info-value">{formatCuring(snap.materials.curing)}</span>
          </div>
        </div>

        {#if snap.materials.hydrationModel}
          {@const modelId = snap.materials.hydrationModel as HydrationModel}
          <h3 class="section-subheading">Cement Hydration Model</h3>
          <div class="info-grid">
            <div class="info-row">
              <span class="info-label">Model:</span>
              <span class="info-value">{HYDRATION_MODEL_NAMES[modelId]}</span>
            </div>
          </div>
          <div class="hydration-equation prose prose-sm max-w-none">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html hydrationModelEquations[modelId]}
          </div>
        {:else}
          <p class="no-data-message" style="margin-top: 12pt;">No hydration model selected.</p>
        {/if}
      </div>
      <div class="page-number"><p>{pageNum.materials}</p></div>
    </div>

    <!-- Hydration Model Variables & Results -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Materials (cont'd)</h2>
        <div class="title-rule"></div>

        {#if snap.materials.hydrationModel}
          {@const modelId = snap.materials.hydrationModel as HydrationModel}
          {@const results = snap.hydrationModelResults[modelId]}

          <h3 class="section-subheading">Input Variables — {HYDRATION_MODEL_NAMES[modelId]}</h3>

          <table class="hydration-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Description</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {#if WC_NOTE_MODELS.includes(modelId)}
                <tr>
                  <td class="mono">w/c</td>
                  <td>Water-cement ratio</td>
                  <td class="mono">{formatWaterCementRatio(snap.materials.waterCementRatio)}</td>
                </tr>
              {/if}
              {#each MODEL_VARIABLES[modelId].filter(v => !v.isConstant) as v (v.key)}
                <tr>
                  <td class="mono">{v.symbol}</td>
                  <td>{v.definition}{v.unit ? ` (${v.unit})` : ''}</td>
                  <td class="mono">{fmtInput(modelId, v.key)}</td>
                </tr>
              {/each}
              {#each MODEL_VARIABLES[modelId].filter(v => v.isConstant) as v (v.key)}
                <tr class="constant-row">
                  <td class="mono">{v.symbol}</td>
                  <td>{v.definition}{v.unit ? ` (${v.unit})` : ''} <em>(constant)</em></td>
                  <td class="mono">{v.constantValue}</td>
                </tr>
              {/each}
            </tbody>
          </table>

          {#if results !== undefined}
            <h3 class="section-subheading" style="margin-top: 14pt;">Results</h3>
            <table class="hydration-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Description</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {#each MODEL_RESULT_LABELS[modelId] as r (r.key)}
                  <tr class:result-final={r.key === 'alpha'}>
                    <td class="mono">{r.symbol}</td>
                    <td>{r.definition}{r.unit ? ` (${r.unit})` : ''}</td>
                    <td class="mono">{fmt((results as Record<string, number>)[r.key])}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {:else}
            <p class="no-data-message">Calculate the model in the Materials tab to show results here.</p>
          {/if}
        {:else}
          <p class="no-data-message">No hydration model selected.</p>
        {/if}
      </div>
      <div class="page-number"><p>{pageNum.materialsCont}</p></div>
    </div>

    <!-- Slab Layout -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Slab Layout</h2>
        <div class="title-rule"></div>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Slab Thickness:</span>
            <span class="info-value">{formatThickness(snap.slabLayout.thickness)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Joint Spacing:</span>
            <span class="info-value">{formatJointSpacing(snap.slabLayout.jointSpacing)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Expected Saw Cutting Time:</span>
            <span class="info-value">{formatHour(snap.slabLayout.sawCutHour)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Joint Type:</span>
            <span class="info-value">{formatValue(snap.slabLayout.jointType)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Base Type:</span>
            <span class="info-value">{formatValue(snap.slabLayout.baseType)}</span>
          </div>
        </div>
      </div>
      <div class="page-number"><p>{pageNum.slabLayout}</p></div>
    </div>

    <!-- Environment -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Environment</h2>
        <div class="title-rule"></div>

        <h3 class="section-subheading">Nearest Weather Stations</h3>

        {#if snap.selectedLocation}
          <div class="env-info">
            <p>
              <span class="env-label">Selected location:</span>
              <span class="env-value">{snap.selectedLocation.city}, {snap.projectInfo.state}</span>
              <span class="env-coords">({formatCoord(snap.selectedLocation.latitude)}, {formatCoord(snap.selectedLocation.longitude)})</span>
            </p>
            <p>
              <span class="env-label">Start date:</span>
              <span class="env-value">{formatDate(snap.projectInfo.date)}</span>
              <span class="env-label">at hour</span>
              <span class="env-value">{formatHour(snap.projectInfo.startHour)}</span>
            </p>
          </div>
        {/if}

        {#if snap.weatherStations.length > 0}
          <div class="weather-table-wrapper">
            <table class="weather-table">
              <thead>
                <tr>
                  <th>Station</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Elevation</th>
                  <th>Distance</th>
                </tr>
              </thead>
              <tbody>
                {#each snap.weatherStations as station}
                  <tr>
                    <td>
                      <div class="station-name">{station.name ?? 'Station'}</div>
                      <div class="station-id">{station.ghcnId ?? 'N/A'}</div>
                    </td>
                    <td>{formatCoord(station.latitude)}</td>
                    <td>{formatCoord(station.longitude)}</td>
                    <td>{formatElevation(station.elevation)}</td>
                    <td>{formatDistance(station.distanceKm)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="no-data-message">No weather station data available. Run the SQL lookup in the Environment tab to populate this section.</p>
        {/if}

        {#if snap.chartImages.temp}
          <h3 class="section-subheading">72-Hour Charts (Plotly)</h3>
          <div class="charts-container">
            <div class="chart-wrapper">
              <img src={snap.chartImages.temp} alt="Temperature Chart" class="chart-image" />
            </div>
          </div>
        {/if}
      </div>
      <div class="page-number"><p>{pageNum.environment}</p></div>
    </div>

    <!-- Environment - Remaining Charts -->
    {#if hasWindCloud}
      <div class="page">
        <div class="page-content">
          <h2 class="page-title">Environment</h2>
          <div class="title-rule"></div>

          <div class="charts-container">
            {#if snap.chartImages.wind}
              <div class="chart-wrapper">
                <img src={snap.chartImages.wind} alt="Wind Speed Chart" class="chart-image" />
              </div>
            {/if}
            {#if snap.chartImages.cloud}
              <div class="chart-wrapper">
                <img src={snap.chartImages.cloud} alt="Cloud Cover Chart" class="chart-image" />
              </div>
            {/if}
          </div>
        </div>
        <div class="page-number"><p>{pageNum.environmentCharts}</p></div>
      </div>
    {/if}

    <!-- ===================== CONCRETE MATURITY ===================== -->
    {#if hasMaturity}
      <!-- Maturity theory -->
      <div class="page">
        <div class="page-content">
          <h2 class="page-title">Concrete Maturity &amp; Early Strength</h2>
          <div class="title-rule"></div>
          <div class="narrative">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html analysisNarratives.maturityTheory}
          </div>
        </div>
        <div class="page-number"><p>{pageNum.maturityTheory}</p></div>
      </div>

      <!-- Maturity charts -->
      <div class="page">
        <div class="page-content">
          <h2 class="page-title">Concrete Maturity — Plots</h2>
          <div class="title-rule"></div>
          {#if analysisCharts.doh}
            <div class="chart-block">
              <img src={analysisCharts.doh} alt="Degree of Hydration vs Time" class="chart-image" />
            </div>
          {/if}
          {#if analysisCharts.heat}
            <div class="chart-block">
              <img src={analysisCharts.heat} alt="Heat of Hydration Rate vs Time" class="chart-image" />
            </div>
          {/if}
          {#if analysisCharts.strength}
            <div class="chart-block">
              <img src={analysisCharts.strength} alt="Tensile Strength vs Time" class="chart-image" />
            </div>
          {/if}
        </div>
        <div class="page-number"><p>{pageNum.maturityCharts}</p></div>
      </div>

      <!-- Maturity table -->
      <div class="page">
        <div class="page-content">
          <h2 class="page-title">Concrete Maturity — Hourly Results</h2>
          <div class="title-rule"></div>
          <p class="table-caption">Values sampled at 6-hour intervals over the 72-hour analysis. Equivalent age is the Arrhenius-adjusted maturity at the reference temperature.</p>
          <table class="data-table">
            <thead>
              <tr>
                <th>Hour</th>
                <th class="num">Equiv. Age (hr)</th>
                <th class="num">Hydration (α)</th>
                <th class="num">Heat Rate (J/g/hr)</th>
                <th class="num">Tensile strength ({strengthUnit})</th>
              </tr>
            </thead>
            <tbody>
              {#each sampleEvery(snap.maturity, 6) as row (row.hour)}
                <tr>
                  <td class="mono">{row.hour}</td>
                  <td class="mono num">{fmt(row.equivalentAge)}</td>
                  <td class="mono num">{fmt(row.degreeOfHydration)}</td>
                  <td class="mono num">{fmt(row.heatOfHydration)}</td>
                  <td class="mono num">{fmtFixed(toStress(row.strength), us ? 0 : 2)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="page-number"><p>{pageNum.maturityTable}</p></div>
      </div>
    {/if}

    <!-- ===================== THERMAL GRADIENT ===================== -->
    {#if hasThermal}
      <!-- Thermal theory -->
      <div class="page">
        <div class="page-content">
          <h2 class="page-title">Thermal Gradient Analysis</h2>
          <div class="title-rule"></div>
          <div class="narrative">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html analysisNarratives.thermalGradientTheory}
          </div>
        </div>
        <div class="page-number"><p>{pageNum.thermalTheory}</p></div>
      </div>

      <!-- Thermal chart + table -->
      <div class="page">
        <div class="page-content">
          <h2 class="page-title">Thermal Gradient — Results</h2>
          <div class="title-rule"></div>
          {#if analysisCharts.thermal}
            <div class="chart-block">
              <img src={analysisCharts.thermal} alt="Slab Temperature Gradient Over Time" class="chart-image" />
            </div>
          {/if}
          <h3 class="section-subheading">Profile Summary</h3>
          <p class="table-caption">Temperature at the slab surface, mid-depth, and bottom for representative hours, with the top-minus-bottom gradient that loads the stress analysis.</p>
          <table class="data-table">
            <thead>
              <tr>
                <th>Hour</th>
                <th class="num">Surface ({tUnit})</th>
                <th class="num">Mid-depth ({tUnit})</th>
                <th class="num">Bottom ({tUnit})</th>
                <th class="num">Gradient ({tUnit})</th>
              </tr>
            </thead>
            <tbody>
              {#each thermalSummaryRows() as row (row.hour)}
                <tr>
                  <td class="mono">{row.hour}</td>
                  <td class="mono num">{fmtFixed(row.surface, 1)}</td>
                  <td class="mono num">{fmtFixed(row.mid, 1)}</td>
                  <td class="mono num">{fmtFixed(row.bottom, 1)}</td>
                  <td class="mono num">{fmtFixed(row.gradient, 1)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="page-number"><p>{pageNum.thermalResults}</p></div>
      </div>
    {/if}

    <!-- ===================== STRESS & CREEP ===================== -->
    {#if hasStress}
      <!-- Stress theory -->
      <div class="page">
        <div class="page-content">
          <h2 class="page-title">Early-Age Stress &amp; Creep Analysis</h2>
          <div class="title-rule"></div>
          <div class="narrative">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html analysisNarratives.stressCreepTheory}
          </div>
        </div>
        <div class="page-number"><p>{pageNum.stressTheory}</p></div>
      </div>

      <!-- Stress parameters + first chart -->
      <div class="page">
        <div class="page-content">
          <h2 class="page-title">Stress Analysis — Parameters</h2>
          <div class="title-rule"></div>
          <p class="table-caption">Analysis inputs in US engineering units. Slab geometry is taken from the Slab Layout tab; modulus develops from the maturity result toward the mature value below.</p>
          <table class="data-table">
            <thead>
              <tr><th>Parameter</th><th>Symbol</th><th class="num">Value</th></tr>
            </thead>
            <tbody>
              <tr><td>Slab thickness</td><td class="mono">h</td><td class="mono num">{fmtFixed((snap.slabLayout.thickness as number) || 0, 2)} in</td></tr>
              <tr><td>Joint spacing</td><td class="mono">L</td><td class="mono num">{fmtFixed((snap.slabLayout.jointSpacing as number) || 0, 1)} ft</td></tr>
              <tr><td>Analysis start (set time)</td><td class="mono">n₀</td><td class="mono num">{stressStartHour ?? '—'} hr</td></tr>
              <tr><td>Mature elastic modulus</td><td class="mono">E</td><td class="mono num">{fmtFixed(snap.stressParams.matureModulusPsi, 0)} psi</td></tr>
              <tr><td>Ultimate degree of hydration</td><td class="mono">α<sub>u</sub></td><td class="mono num">{fmt(alphaUltimate)}</td></tr>
              <tr><td>Poisson's ratio</td><td class="mono">ν</td><td class="mono num">{fmt(snap.stressParams.poissonRatio)}</td></tr>
              <tr><td>Coefficient of thermal expansion</td><td class="mono">α</td><td class="mono num">{snap.stressParams.coteF.toExponential(2)} /°F</td></tr>
              <tr><td>Modulus of subgrade reaction</td><td class="mono">k</td><td class="mono num">{fmtFixed(snap.stressParams.kValue, 0)} psi/in</td></tr>
              <tr><td>Slab–base friction</td><td class="mono">k<sub>h</sub></td><td class="mono num">{fmt(snap.stressParams.frictionCoefficient)} psi/in</td></tr>
              <tr><td>Normalised saw-cut depth</td><td class="mono">a/h</td><td class="mono num">{snap.stressParams.sawcutNormalized === '' ? 'Free joint' : fmt(snap.stressParams.sawcutNormalized as number)}</td></tr>
              <tr><td>Creep coefficient</td><td class="mono">a₁</td><td class="mono num">{fmt(snap.stressParams.creepA1)}</td></tr>
            </tbody>
          </table>
          {#if peakTensile}
            <p class="callout">
              Peak creep-adjusted tensile demand: <strong>{fmtFixed(toStress(peakTensile.value), 1)} {stressUnit}</strong> at hour <strong>{peakTensile.hour}</strong>.
            </p>
          {/if}
          {#if analysisCharts.stressDev}
            <div class="chart-block">
              <img src={analysisCharts.stressDev} alt="Stress Development and Cracking Risk" class="chart-image" />
            </div>
          {/if}
        </div>
        <div class="page-number"><p>{pageNum.stressParams}</p></div>
      </div>

      <!-- Stress charts -->
      <div class="page">
        <div class="page-content">
          <h2 class="page-title">Stress Analysis — Plots</h2>
          <div class="title-rule"></div>
          {#if analysisCharts.stressFibre}
            <div class="chart-block">
              <img src={analysisCharts.stressFibre} alt="Creep-Adjusted Extreme-Fibre Stress" class="chart-image" />
              <p class="chart-caption">Top and bottom extreme-fibre stresses after creep relaxation. A crossing of the two curves marks a diurnal gradient reversal that shifts tension between faces.</p>
            </div>
          {/if}
          {#if analysisCharts.stressKI}
            <div class="chart-block">
              <img src={analysisCharts.stressKI} alt="Mode-I Stress Intensity Factor" class="chart-image" />
              {#if snap.stressParams.sawcutNormalized === '' || snap.stressParams.sawcutNormalized === 0}
                <p class="chart-caption">Kᵢ is zero without a saw-cut; specify a saw-cut depth to engage the joint fracture-mechanics coefficients.</p>
              {/if}
            </div>
          {/if}
        </div>
        <div class="page-number"><p>{pageNum.stressCharts}</p></div>
      </div>

      <!-- Stress hourly table -->
      <div class="page">
        <div class="page-content">
          <h2 class="page-title">Stress Analysis — Hourly Results</h2>
          <div class="title-rule"></div>
          <p class="table-caption">Sampled at 6-hour intervals. ΔT*<sub>c</sub> and ΔT*<sub>g</sub> are the pseudo-temperatures applied to the elastic analysis after the B⁻¹ creep transformation, not the raw thermal differences.</p>
          <table class="data-table compact">
            <thead>
              <tr>
                <th>Hour</th>
                <th class="num">E (psi)</th>
                <th class="num">ΔT*<sub>c</sub> ({tUnit})</th>
                <th class="num">ΔT*<sub>g</sub> ({tUnit})</th>
                <th class="num">σ elastic ({stressUnit})</th>
                <th class="num">σ creep ({stressUnit})</th>
                <th class="num">σ top ({stressUnit})</th>
                <th class="num">σ bottom ({stressUnit})</th>
                <th class="num">σ max-tens ({stressUnit})</th>
                <th class="num">Kᵢ creep ({kiUnit})</th>
              </tr>
            </thead>
            <tbody>
              {#each sampleEvery(snap.stress?.hourlyResults, 6) as r (r.hour)}
                {@const ci = (snap.stress?.hourlyResults ?? []).findIndex((x) => x.hour === r.hour)}
                {@const c = (snap.stress?.creepResults ?? [])[ci]}
                <tr>
                  <td class="mono">{r.hour}</td>
                  <td class="mono num">{fmtFixed(r.elasticModulus, 0)}</td>
                  <td class="mono num">{fmtFixed(toDeltaT(r.pseudoUniformTemp), 2)}</td>
                  <td class="mono num">{fmtFixed(toDeltaT(r.pseudoGradientTemp), 2)}</td>
                  <td class="mono num">{fmtFixed(toStress(r.totalStress), 1)}</td>
                  <td class="mono num">{c ? fmtFixed(toStress(c.creepTotalStress), 1) : '—'}</td>
                  <td class="mono num">{c ? fmtFixed(toStress(c.creepStressTop), 1) : '—'}</td>
                  <td class="mono num">{c ? fmtFixed(toStress(c.creepStressBottom), 1) : '—'}</td>
                  <td class="mono num strong">{c ? fmtFixed(toStress(c.creepMaxTensile), 1) : '—'}</td>
                  <td class="mono num">{c ? fmtFixed(toKI(c.creepKI), 3) : '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="page-number"><p>{pageNum.stressTable}</p></div>
      </div>
    {/if}

    <!-- Appendices Divider -->
    <div class="page cover-page">
      <div class="cover-content">
        <div class="cover-title-block">
          <h1 class="cover-title">APPENDICES</h1>
        </div>
      </div>
    </div>

    <!-- Appendix A -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Appendix A</h2>
        <div class="title-rule"></div>
        <h3 class="section-subheading">Weather Station Data</h3>
        <p class="section-placeholder">Content for Weather Station Data will appear here.</p>
      </div>
      <div class="page-number"><p>{pageNum.appendixA}</p></div>
    </div>

  </div>
</div>

<!-- Offscreen Plotly render targets — outside paper-preview so they are never
     captured by html2pdf. Charts are rendered here then exported to PNG. -->
<div class="offscreen" aria-hidden="true">
  <div bind:this={offDoh} style="width:1000px;height:360px;"></div>
  <div bind:this={offHeat} style="width:1000px;height:360px;"></div>
  <div bind:this={offStrength} style="width:1000px;height:360px;"></div>
  <div bind:this={offThermal} style="width:1000px;height:480px;"></div>
  <div bind:this={offStressDev} style="width:1000px;height:400px;"></div>
  <div bind:this={offStressFibre} style="width:1000px;height:360px;"></div>
  <div bind:this={offStressKI} style="width:1000px;height:360px;"></div>
</div>

<style>
  .toolbar {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 2rem;
    background-color: #f3f4f6;
    border-bottom: 1px solid #e5e7eb;
  }

  .update-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background-color: white;
    color: #2563eb;
    border: 1.5px solid #2563eb;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background-color 0.2s, color 0.2s;
  }

  .update-btn:hover {
    background-color: #eff6ff;
  }

  .update-btn:active {
    background-color: #dbeafe;
  }

  .update-btn:disabled {
    color: #93c5fd;
    border-color: #93c5fd;
    cursor: not-allowed;
  }

  .update-btn.dirty {
    animation: update-pulse 1.8s ease-in-out infinite;
  }

  @keyframes update-pulse {
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

  .download-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background-color: #2563eb;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .download-btn:hover {
    background-color: #1d4ed8;
  }

  .download-btn:active {
    background-color: #1e40af;
  }

  .download-btn:disabled {
    background-color: #93c5fd;
    cursor: not-allowed;
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .report-container {
    display: flex;
    justify-content: center;
    padding: 2rem;
    background-color: #e5e7eb;
    height: 85vh;
    overflow-y: auto;
  }

  .paper-preview {
    width: 8.5in;
    font-family: 'Calibri', 'Carlito', sans-serif;
    font-size: 12pt;
    line-height: 1.5;
    zoom: 0.75;
    color: #000000;
  }

  /* Offscreen Plotly capture targets */
  .offscreen {
    position: absolute;
    left: -100000px;
    top: 0;
    width: 1000px;
    height: 0;
    overflow: hidden;
    pointer-events: none;
  }

  /* ---- Shared page styles ---- */
  .page {
    width: 8.5in;
    height: 11in;
    background: white;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
                0 2px 4px -1px rgba(0, 0, 0, 0.06),
                0 10px 15px -3px rgba(0, 0, 0, 0.1);
    border-radius: 2px;
    overflow: hidden;
    position: relative;
    box-sizing: border-box;
    margin-bottom: 2rem;
  }

  .page:last-child {
    margin-bottom: 0;
  }

  .page-content {
    padding: 1in;
    padding-bottom: 0;
    height: calc(11in - 1in);
    box-sizing: border-box;
  }

  .page-number {
    position: absolute;
    bottom: 1in;
    left: 1in;
    right: 1in;
    text-align: center;
  }

  .page-number p {
    font-size: 12pt;
    color: #000000;
  }

  .page-title {
    font-size: 16pt;
    font-weight: 700;
    color: #000000;
    margin: 0;
    padding: 0;
  }

  .title-rule {
    width: 100%;
    height: 2px;
    background-color: #000000;
    margin-top: 6pt;
    margin-bottom: 18pt;
  }

  /* ---- Cover page ---- */
  .cover-page {
    display: flex;
    flex-direction: column;
  }

  .cover-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1in;
    box-sizing: border-box;
  }

  .cover-title-block {
    text-align: center;
  }

  .cover-title {
    font-size: 24pt;
    font-weight: 700;
    color: #000000;
    margin: 0;
    line-height: 1.3;
  }

  .cover-divider {
    width: 4in;
    height: 3px;
    background-color: #000000;
    margin: 1.5rem auto;
  }

  .cover-location {
    font-size: 16pt;
    color: #000000;
    margin: 0 0 0.5rem 0;
  }

  .cover-date {
    font-size: 16pt;
    color: #000000;
    margin: 0;
  }

  .cover-footer {
    padding: 0 1in 1in 1in;
    text-align: center;
  }

  .cover-footer p {
    font-size: 12pt;
    color: #000000;
    line-height: 1.6;
    margin: 0;
  }

  /* ---- Table of Contents ---- */
  .toc-list {
    margin-top: 1rem;
  }

  .toc-entry {
    display: flex;
    align-items: baseline;
    margin-bottom: 1rem;
    font-size: 12pt;
    color: #000000;
  }

  .toc-entry-indent {
    padding-left: 0.25in;
  }

  .toc-label {
    white-space: nowrap;
  }

  .toc-dots {
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    color: #000000;
    font-size: 12pt;
    letter-spacing: 0.2em;
  }

  .toc-page {
    white-space: nowrap;
    color: #000000;
  }

  /* ---- Section pages ---- */
  .section-subheading {
    font-family: Calibri, sans-serif;
    font-size: 14pt;
    font-weight: bold;
    color: #000000;
    margin-top: 18pt;
    margin-bottom: 6pt;
  }

  .section-placeholder {
    color: #000000;
    margin-top: 1rem;
  }

  .no-data-message {
    font-family: Calibri, sans-serif;
    font-size: 12pt;
    color: #666;
    margin-top: 12pt;
    font-style: italic;
  }

  /* ---- Narrative (theory) paragraphs ---- */
  .narrative {
    font-family: Calibri, sans-serif;
    font-size: 11pt;
    color: #000000;
    line-height: 1.5;
  }

  .narrative :global(p) {
    margin: 0 0 9pt 0;
    text-align: justify;
  }

  .narrative :global(.katex-display) {
    margin: 8pt 0;
    font-size: 11pt;
  }

  /* ---- Analysis charts ---- */
  .chart-block {
    margin: 0 0 12pt 0;
    width: 100%;
  }

  .chart-caption,
  .table-caption {
    font-family: Calibri, sans-serif;
    font-size: 9.5pt;
    color: #555;
    margin: 4pt 0 10pt 0;
    line-height: 1.4;
  }

  .callout {
    font-family: Calibri, sans-serif;
    font-size: 11pt;
    color: #000000;
    background-color: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 3px;
    padding: 8pt 10pt;
    margin: 10pt 0;
  }

  /* ---- Environment section ---- */
  .env-info {
    font-family: Calibri, sans-serif;
    font-size: 12pt;
    color: #000000;
    margin-top: 12pt;
    margin-bottom: 12pt;
    line-height: 1.5;
  }

  .env-label {
    font-weight: normal;
  }

  .env-value {
    font-weight: bold;
  }

  .env-coords {
    font-weight: normal;
    color: #666;
  }

  .weather-table-wrapper {
    margin-top: 12pt;
    overflow-x: auto;
  }

  .weather-table {
    width: 100%;
    border-collapse: collapse;
    font-family: Calibri, sans-serif;
    font-size: 10pt;
    color: #000000;
  }

  .weather-table th {
    background-color: #f3f4f6;
    padding: 6pt 8pt;
    text-align: left;
    font-weight: bold;
    border: 1px solid #d1d5db;
  }

  .weather-table td {
    padding: 6pt 8pt;
    border: 1px solid #d1d5db;
  }

  .station-name {
    font-weight: bold;
  }

  .station-id {
    font-size: 8pt;
    color: #666;
  }

  .charts-container {
    display: flex;
    flex-direction: column;
    gap: 12pt;
    margin-top: 12pt;
  }

  .chart-wrapper {
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  }

  .chart-image {
    width: 100%;
    height: auto;
    display: block;
  }

  /* ---- Project Information section ---- */
  .info-grid {
    display: flex;
    flex-direction: column;
    gap: 8pt;
    margin-bottom: 18pt;
  }

  .info-row {
    display: flex;
    align-items: baseline;
  }

  .info-label {
    font-weight: 700;
    min-width: 200pt;
    color: #000000;
  }

  .info-value {
    color: #000000;
  }

  .map-section {
    margin-top: 18pt;
  }

  .map-title {
    font-size: 14pt;
    font-weight: 700;
    color: #000000;
    margin: 0 0 12pt 0;
  }

  .map-container {
    width: 100%;
    height: 300pt;
    border: 1px solid #000000;
  }

  /* ---- Hydration model section ---- */
  .hydration-equation {
    margin: 10pt 0 14pt 0;
    text-align: center;
  }

  .hydration-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
    color: #000000;
    margin-bottom: 6pt;
  }

  .hydration-table th {
    background-color: #f3f4f6;
    padding: 5pt 8pt;
    text-align: left;
    font-weight: bold;
    border: 1px solid #d1d5db;
  }

  .hydration-table td {
    padding: 4pt 8pt;
    border: 1px solid #d1d5db;
  }

  .hydration-table .mono {
    font-family: 'Courier New', monospace;
  }

  .hydration-table .constant-row td {
    color: #555;
    background-color: #fafafa;
  }

  .hydration-table .result-final td {
    font-weight: bold;
    background-color: #eff6ff;
  }

  /* ---- Analysis data tables ---- */
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
    color: #000000;
    margin-bottom: 6pt;
  }

  .data-table.compact {
    font-size: 8.5pt;
  }

  .data-table th {
    background-color: #f3f4f6;
    padding: 5pt 7pt;
    text-align: left;
    font-weight: bold;
    border: 1px solid #d1d5db;
  }

  .data-table td {
    padding: 4pt 7pt;
    border: 1px solid #d1d5db;
  }

  .data-table.compact th,
  .data-table.compact td {
    padding: 3pt 4pt;
  }

  .data-table .num {
    text-align: right;
  }

  .data-table .mono {
    font-family: 'Courier New', monospace;
  }

  .data-table .strong {
    font-weight: bold;
    background-color: #eff6ff;
  }
</style>
