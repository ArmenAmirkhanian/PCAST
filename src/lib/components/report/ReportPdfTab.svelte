<script lang="ts">
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
  import { get } from 'svelte/store';
<<<<<<< HEAD
>>>>>>> cedb080 (Freeze PDF preview until user explicitly clicks Update PDF)
=======
  import { onMount } from 'svelte';
>>>>>>> fe6cc5f (Add dirty-state flash to Update PDF button and unit-aware formatting)
  import { projectInfo, materials, slabLayout, weatherStations, chartImages } from '$lib/stores/form';
=======
  import { projectInfo, materials, slabLayout, weatherStations } from '$lib/stores/form';
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
  import { projectInfo, materials, slabLayout, weatherStations, chartImages } from '$lib/stores/form';
>>>>>>> 9e24379 (Add 72-hour Plotly charts to Report PDF Environment section)
=======
=======
  import { get } from 'svelte/store';
  import { tick } from 'svelte';
>>>>>>> 1a81cfc (Freeze PDF preview until user explicitly refreshes)
  import { projectInfo, materials, slabLayout, weatherStations, chartImages, stationDisplays } from '$lib/stores/form';
>>>>>>> 4d385f5 (User interface updates: Appendix A weather station tables and input placeholder fix)
=======
  import { projectInfo, materials, slabLayout, weatherStations } from '$lib/stores/form';
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
  import { projectInfo, materials, slabLayout, weatherStations, chartImages } from '$lib/stores/form';
>>>>>>> 9e24379 (Add 72-hour Plotly charts to Report PDF Environment section)
  import { site, allPoints } from '$lib/stores/stations';
  import { unitSystem } from '$lib/stores/units';
  import StaticMapView from '$lib/components/report/StaticMapView.svelte';
  import placesIndex from '$lib/data/places-index.json';
  import type { PlacesIndex } from '$lib/types';
=======
  // Report PDF Tab - displays a preview of the 8.5x11 report
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
  import { projectInfo } from '$lib/stores/form';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
=======
  import { projectInfo, materials } from '$lib/stores/form';
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
  import { projectInfo, materials, slabLayout } from '$lib/stores/form';
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
  import { site, allPoints } from '$lib/stores/stations';
  import { unitSystem } from '$lib/stores/units';
  import StaticMapView from '$lib/components/report/StaticMapView.svelte';
  import placesIndex from '$lib/data/places-index.json';
  import type { PlacesIndex } from '$lib/types';
>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
=======
  // Report PDF Tab - displays a preview of the 8.5x11 report
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
  import { projectInfo } from '$lib/stores/form';
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
=======
  import { projectInfo, materials } from '$lib/stores/form';
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
  import { projectInfo, materials, slabLayout } from '$lib/stores/form';
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
  import { site, allPoints } from '$lib/stores/stations';
  import { unitSystem } from '$lib/stores/units';
  import StaticMapView from '$lib/components/report/StaticMapView.svelte';
  import placesIndex from '$lib/data/places-index.json';
  import type { PlacesIndex } from '$lib/types';
>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
=======
  // Report PDF Tab - displays a preview of the 8.5x11 report
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
  import { projectInfo } from '$lib/stores/form';
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
=======
  import { projectInfo, materials } from '$lib/stores/form';
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
  import { site, allPoints } from '$lib/stores/stations';
  import StaticMapView from '$lib/components/report/StaticMapView.svelte';
  import placesIndex from '$lib/data/places-index.json';
  import type { PlacesIndex } from '$lib/types';
>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)

  let paperPreview: HTMLDivElement;
  let isGenerating = false;

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
  const index = placesIndex as PlacesIndex;

=======
  const index = placesIndex as PlacesIndex;

<<<<<<< HEAD
=======
  const index = placesIndex as PlacesIndex;

>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
  // Get selected location data
  $: selectedLocation = (() => {
    if (!$projectInfo.state || !$projectInfo.city) return null;
    return (index[$projectInfo.state] || []).find(
      (p) => p.city.toLowerCase() === $projectInfo.city.toLowerCase()
    ) || null;
  })();

<<<<<<< HEAD
>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
=======
>>>>>>> cedb080 (Freeze PDF preview until user explicitly clicks Update PDF)
=======
>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 2463e27 (Fix date off-by-one error in Report PDF)
=======
>>>>>>> 2463e27 (Fix date off-by-one error in Report PDF)
      // Parse date components to avoid timezone issues
      const [year, month, day] = dateStr.split('-').map(Number);
      // Create date in local timezone (month is 0-indexed)
      const date = new Date(year, month - 1, day);
<<<<<<< HEAD
<<<<<<< HEAD
=======
      const date = new Date(dateStr);
>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
=======
>>>>>>> 2463e27 (Fix date off-by-one error in Report PDF)
=======
      const date = new Date(dateStr);
>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
=======
>>>>>>> 2463e27 (Fix date off-by-one error in Report PDF)
=======
      const date = new Date(dateStr);
>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 76eabbd (Add AM/PM formatting to time fields in Report PDF)
=======
>>>>>>> 76eabbd (Add AM/PM formatting to time fields in Report PDF)
    // Convert from 24-hour format (e.g., "14:00") to 12-hour format with AM/PM
    const [hours, minutes] = hourStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12; // Convert 0 to 12 for midnight
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
<<<<<<< HEAD
<<<<<<< HEAD
=======
    return hourStr;
>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
=======
>>>>>>> 76eabbd (Add AM/PM formatting to time fields in Report PDF)
=======
    return hourStr;
>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
=======
>>>>>>> 76eabbd (Add AM/PM formatting to time fields in Report PDF)
=======
    return hourStr;
>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
  }

  function formatTemp(temp: number | ''): string {
    if (temp === '') return 'Not specified';
<<<<<<< HEAD
    if (snap.unitSystem !== 'us') {
      return `${Math.round((temp as number - 32) * 5 / 9)}°C`;
    }
    return `${temp}°F`;
  }

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
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

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
  function formatThickness(thickness: number | ''): string {
    if (thickness === '') return 'Not specified';
    const unit = $unitSystem === 'us' ? 'in' : 'mm';
    return `${thickness} ${unit}`;
  }

  function formatJointSpacing(spacing: number | ''): string {
    if (spacing === '') return 'Not specified';
    const unit = $unitSystem === 'us' ? 'ft' : 'm';
    return `${spacing} ${unit}`;
  }

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
>>>>>>> 1a81cfc (Freeze PDF preview until user explicitly refreshes)
=======
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
>>>>>>> cedb080 (Freeze PDF preview until user explicitly clicks Update PDF)
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

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
=======
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
=======
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
    return `${temp}°F`;
  }

>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
=======
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
  // Get current date formatted
  function getFormattedDate(): string {
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Section definitions for TOC and section pages
  const sections = [
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 7e87b88 (Update Appendices structure in Report PDF)
=======
>>>>>>> 7e87b88 (Update Appendices structure in Report PDF)
    { id: 'project-info', title: 'Project Information', page: 4, indent: false },
    { id: 'materials', title: 'Materials', page: 5, indent: false },
    { id: 'slab-layout', title: 'Slab Layout', page: 6, indent: false },
    { id: 'environment', title: 'Environment', page: 7, indent: false },
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b2bba06 (Split Environment section to prevent chart cutoff)
    { id: 'analysis', title: 'Analysis', page: 9, indent: false },
    { id: 'results', title: 'Results', page: 10, indent: false },
    { id: 'appendices', title: 'Appendices', page: 11, indent: false },
<<<<<<< HEAD
    { id: 'appendix-a', title: 'Appendix A', page: 12, indent: true }
<<<<<<< HEAD
=======
    { id: 'appendix-a', title: 'Appendix A: Weather Station Data', page: 12, indent: true }
>>>>>>> 4d385f5 (User interface updates: Appendix A weather station tables and input placeholder fix)
  ];

  const totalPages = 17;

  // Helpers for 72-hour normals tables
  function formatTs(row: { month: number; day: number; hour: number }): string {
    return `${String(row.month).padStart(2, '0')}-${String(row.day).padStart(2, '0')} ${String(row.hour).padStart(2, '0')}:00`;
  }

  function formatNumber(value: number | null, digits = 1): string {
    return value === null ? '\u2014' : value.toFixed(digits);
  }

<<<<<<< HEAD
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
    { id: 'project-info', title: 'Project Information', page: 4 },
    { id: 'materials', title: 'Materials', page: 5 },
    { id: 'slab-layout', title: 'Slab Layout', page: 6 },
    { id: 'environment', title: 'Environment', page: 7 },
    { id: 'analysis', title: 'Analysis', page: 8 },
    { id: 'results', title: 'Results', page: 9 },
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    { id: 'appendices', title: 'Appendices', page: 11 }
=======
=======
>>>>>>> 7e87b88 (Update Appendices structure in Report PDF)
    { id: 'analysis', title: 'Analysis', page: 8, indent: false },
    { id: 'results', title: 'Results', page: 9, indent: false },
    { id: 'appendices', title: 'Appendices', page: 10, indent: false },
    { id: 'appendix-a', title: 'Appendix A', page: 11, indent: true }
<<<<<<< HEAD
>>>>>>> 7e87b88 (Update Appendices structure in Report PDF)
=======
>>>>>>> b2bba06 (Split Environment section to prevent chart cutoff)
  ];

  const totalPages = 12;

<<<<<<< HEAD
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
  // Build a frozen snapshot of all store values for the preview.
  // The preview only updates when the user explicitly requests a refresh.
=======
  // Snapshot of all store values — only updated when the user clicks "Update PDF".
  // The preview renders from this snapshot so it never changes on its own.
>>>>>>> cedb080 (Freeze PDF preview until user explicitly clicks Update PDF)
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
<<<<<<< HEAD
      stationDisplays: get(stationDisplays).map((s) => ({ ...s, hourly: [...s.hourly] })),
=======
>>>>>>> cedb080 (Freeze PDF preview until user explicitly clicks Update PDF)
      site: get(site),
      allPoints: ap ? [...ap] : [],
      unitSystem: get(unitSystem),
      selectedLocation: loc
    };
  }

  let snap = buildSnapshot();
  let isDirty = false;

  // Mark the button dirty whenever any input store changes after mount.
  onMount(() => {
    const stores = [projectInfo, materials, slabLayout, weatherStations, chartImages, unitSystem, site, allPoints];
    const unsubs = stores.map((s) => s.subscribe(() => { isDirty = true; }));
    // Each subscribe fires immediately with the current value — reset so we
    // only flash after the user actually changes something.
    isDirty = false;
    return () => unsubs.forEach((u) => u());
  });

<<<<<<< HEAD
  function refreshPreview() {
    snap = buildSnapshot();
  }

  // These format functions reference snap.unitSystem so must be declared after snap.
=======
  function updatePdf() {
    snap = buildSnapshot();
    isDirty = false;
  }

  // These depend on snap.unitSystem so must come after snap is declared.
>>>>>>> cedb080 (Freeze PDF preview until user explicitly clicks Update PDF)
  function formatThickness(thickness: number | ''): string {
    if (thickness === '') return 'Not specified';
    const unit = snap.unitSystem === 'us' ? 'in' : 'mm';
    return `${thickness} ${unit}`;
  }

  function formatJointSpacing(spacing: number | ''): string {
    if (spacing === '') return 'Not specified';
    const unit = snap.unitSystem === 'us' ? 'ft' : 'm';
    return `${spacing} ${unit}`;
  }

<<<<<<< HEAD
>>>>>>> 1a81cfc (Freeze PDF preview until user explicitly refreshes)
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
    { id: 'appendices', title: 'Appendices', page: 10 }
=======
    { id: 'appendices', title: 'Appendices', page: 11 }
>>>>>>> 588e01c (Add APPENDICES divider page before Appendices section)
=======
>>>>>>> 7e87b88 (Update Appendices structure in Report PDF)
=======
    { id: 'analysis', title: 'Analysis', page: 9, indent: false },
    { id: 'results', title: 'Results', page: 10, indent: false },
    { id: 'appendices', title: 'Appendices', page: 11, indent: false },
    { id: 'appendix-a', title: 'Appendix A', page: 12, indent: true }
>>>>>>> b2bba06 (Split Environment section to prevent chart cutoff)
  ];

  const totalPages = 12;

>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
>>>>>>> cedb080 (Freeze PDF preview until user explicitly clicks Update PDF)
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
    { id: 'appendices', title: 'Appendices', page: 10 }
  ];

  const totalPages = 10;

>>>>>>> 7b4388f (Update Report PDF formatting and structure)
  async function downloadPdf() {
    if (isGenerating) return;
    isGenerating = true;

<<<<<<< HEAD
<<<<<<< HEAD
    // Refresh the snapshot so the downloaded PDF reflects the latest inputs
    refreshPreview();
    await tick();

    try {
<<<<<<< HEAD
<<<<<<< HEAD
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
=======
      // Dynamically import html2pdf (browser-only library)
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
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
<<<<<<< HEAD
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
          allowTaint: true,
>>>>>>> 2c32951 (Fix map not appearing in downloaded PDF)
=======
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
<<<<<<< HEAD
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
          allowTaint: true,
>>>>>>> 2c32951 (Fix map not appearing in downloaded PDF)
=======
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
<<<<<<< HEAD
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
          allowTaint: true,
>>>>>>> 2c32951 (Fix map not appearing in downloaded PDF)
          letterRendering: true
        },
        jsPDF: {
          unit: 'in',
          format: 'letter',
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
          orientation: 'portrait' as const
=======
          orientation: 'portrait'
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
          orientation: 'portrait' as const
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
          orientation: 'portrait'
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
          orientation: 'portrait' as const
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
          orientation: 'portrait'
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
          orientation: 'portrait' as const
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
        }
      };

      await html2pdf().set(options).from(paperPreview).save();
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)

      // Restore styles after PDF generation
      paperPreview.style.zoom = '';
      pages.forEach((page) => {
        page.style.marginBottom = '';
        page.style.boxShadow = '';
        page.style.borderRadius = '';
      });
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      isGenerating = false;
    }
  }
</script>

<div class="toolbar">
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  <button class="refresh-btn" on:click={refreshPreview} disabled={isGenerating}>
=======
  <button class="update-btn" on:click={updatePdf} disabled={isGenerating}>
>>>>>>> cedb080 (Freeze PDF preview until user explicitly clicks Update PDF)
=======
  <button class="update-btn" class:dirty={isDirty} on:click={updatePdf} disabled={isGenerating}>
>>>>>>> fe6cc5f (Add dirty-state flash to Update PDF button and unit-aware formatting)
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"></polyline>
      <polyline points="1 20 1 14 7 14"></polyline>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
    </svg>
<<<<<<< HEAD
    Refresh Preview
  </button>
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
    Update PDF
  </button>
>>>>>>> cedb080 (Freeze PDF preview until user explicitly clicks Update PDF)
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD

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

    <!-- PAGE 2: Disclaimer -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Disclaimer</h2>
        <div class="title-rule"></div>
        <p>Armen, you gotta say something official here so they know that if something goes wrong it's not our fault.</p>
      </div>
      <div class="page-number">
        <p>2</p>
      </div>
    </div>

    <!-- PAGE 3: Table of Contents -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Table of Contents</h2>
        <div class="title-rule"></div>
        <div class="toc-list">
          {#each sections as section}
            <div class="toc-entry" class:toc-entry-indent={section.indent}>
<<<<<<< HEAD
              <span class="toc-label">{section.title}</span>
              <span class="toc-dots"> .................................................................................................................................................... </span>
              <span class="toc-page">{section.page}</span>
            </div>
          {/each}
        </div>
      </div>
      <div class="page-number">
        <p>3</p>
      </div>
    </div>

    <!-- PAGE 4: Project Information -->
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
      <div class="page-number">
        <p>4</p>
      </div>
    </div>

    <!-- PAGE 5: Materials -->
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
      </div>
      <div class="page-number">
        <p>5</p>
      </div>
    </div>

    <!-- PAGE 6: Slab Layout -->
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
      <div class="page-number">
        <p>6</p>
      </div>
    </div>

    <!-- PAGE 7: Environment -->
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
      <div class="page-number">
        <p>7</p>
      </div>
    </div>

    <!-- PAGE 8: Environment - Remaining Charts -->
    {#if snap.chartImages.wind || snap.chartImages.cloud}
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
        <div class="page-number">
          <p>8</p>
        </div>
      </div>
    {/if}

    <!-- PAGES 9-10: Other Section Pages -->
    {#each sections.slice(4, 6) as section}
      <div class="page">
        <div class="page-content">
          <h2 class="page-title">{section.title}</h2>
          <div class="title-rule"></div>
          <p class="section-placeholder">Content for {section.title} will appear here.</p>
        </div>
        <div class="page-number">
          <p>{section.page}</p>
        </div>
      </div>
    {/each}

    <!-- PAGE 11: Appendices Divider -->
    <div class="page cover-page">
      <div class="cover-content">
        <div class="cover-title-block">
          <h1 class="cover-title">APPENDICES</h1>
        </div>
      </div>
    </div>

    <!-- PAGES 12-17: Appendix A - Weather Station Data (two pages per station) -->
    {#each snap.stationDisplays as station, i}
      <!-- First page: rows 0-44 -->
      <div class="page">
        <div class="page-content">
          <h2 class="page-title">Appendix A: Weather Station Data</h2>
          <div class="title-rule"></div>

          {#if i === 0}
            <p class="normals-heading">72-hour normals (HLY-TEMP-NORMAL, HLY-CLDH-NORMAL, HLY-WIND-AVGSPD)</p>
          {/if}

          <div class="normals-station-header">
            <p class="normals-station-name">{station.name ?? 'Station'} ({station.ghcnId ?? 'N/A'})</p>
            <p class="normals-station-info">
              Offset span: 0–71 hrs &middot; Distance {station.distanceKm.toFixed(1)} km
              &middot; Lat/Lon {formatCoord(station.latitude)}, {formatCoord(station.longitude)}
              &middot; Elev {formatElevation(station.elevation)}
            </p>
          </div>

          <div class="normals-table-wrapper">
            <table class="normals-table">
              <thead>
                <tr>
                  <th>Offset hr</th>
                  <th>Month-Day Hr</th>
                  <th>HLY Temp</th>
                  <th>HLY Cloud</th>
                  <th>HLY Wind</th>
                </tr>
              </thead>
              <tbody>
                {#each station.hourly.slice(0, 45) as reading}
                  <tr>
                    <td>{reading.offsetHr}</td>
                    <td>{formatTs(reading)}</td>
                    <td>{formatNumber(reading.temp)}</td>
                    <td>{formatNumber(reading.cloud)}</td>
                    <td>{formatNumber(reading.wind)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
        <div class="page-number">
          <p>{12 + i * 2}</p>
        </div>
      </div>

      <!-- Second page: rows 45-71 -->
      <div class="page">
        <div class="page-content">
          <h2 class="page-title">Appendix A: Weather Station Data</h2>
          <div class="title-rule"></div>

          <div class="normals-station-header">
            <p class="normals-station-name">{station.name ?? 'Station'} ({station.ghcnId ?? 'N/A'}) — continued</p>
          </div>

          <div class="normals-table-wrapper">
            <table class="normals-table">
              <thead>
                <tr>
                  <th>Offset hr</th>
                  <th>Month-Day Hr</th>
                  <th>HLY Temp</th>
                  <th>HLY Cloud</th>
                  <th>HLY Wind</th>
                </tr>
              </thead>
              <tbody>
                {#each station.hourly.slice(45) as reading}
                  <tr>
                    <td>{reading.offsetHr}</td>
                    <td>{formatTs(reading)}</td>
                    <td>{formatNumber(reading.temp)}</td>
                    <td>{formatNumber(reading.cloud)}</td>
                    <td>{formatNumber(reading.wind)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
        <div class="page-number">
          <p>{13 + i * 2}</p>
        </div>
      </div>
    {/each}

=======
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
    <div class="paper-content">
      <!-- Header -->
      <div class="report-header">
        <h1>Pavement Cracking Analysis Report</h1>
        <p class="subtitle">Generated Report Preview</p>
      </div>
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)

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
<<<<<<< HEAD
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======

    <!-- PAGE 2: Disclaimer -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Disclaimer</h2>
        <div class="title-rule"></div>
        <p>Armen, you gotta say something official here so they know that if something goes wrong it's not our fault.</p>
      </div>
      <div class="page-number">
        <p>2</p>
      </div>
    </div>

    <!-- PAGE 3: Table of Contents -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Table of Contents</h2>
        <div class="title-rule"></div>
        <div class="toc-list">
          {#each sections as section}
            <div class="toc-entry">
=======
>>>>>>> 7e87b88 (Update Appendices structure in Report PDF)
              <span class="toc-label">{section.title}</span>
              <span class="toc-dots"> .................................................................................................................................................... </span>
              <span class="toc-page">{section.page}</span>
            </div>
          {/each}
        </div>
      </div>
      <div class="page-number">
        <p>3</p>
      </div>
    </div>

    <!-- PAGE 4: Project Information -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Project Information</h2>
        <div class="title-rule"></div>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">State:</span>
            <span class="info-value">{formatValue($projectInfo.state)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">City:</span>
            <span class="info-value">{formatValue($projectInfo.city)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Latitude:</span>
            <span class="info-value">{formatCoord(selectedLocation?.latitude ?? null)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Longitude:</span>
            <span class="info-value">{formatCoord(selectedLocation?.longitude ?? null)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date:</span>
            <span class="info-value">{formatDate($projectInfo.date)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Start Hour:</span>
            <span class="info-value">{formatHour($projectInfo.startHour)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Construction Start Temperature:</span>
            <span class="info-value">{formatTemp($projectInfo.startTempF)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Concrete Delivery Temperature:</span>
            <span class="info-value">{formatTemp($projectInfo.deliveryTempF)}</span>
          </div>
        </div>

        {#if $site && $site.length === 2}
          <div class="map-section">
            <h3 class="map-title">Project Location Map</h3>
            <div class="map-container">
              <StaticMapView center={$site as [number, number]} points={$allPoints as [number, number][]} />
            </div>
          </div>
        {/if}
      </div>
      <div class="page-number">
        <p>4</p>
      </div>
    </div>

    <!-- PAGE 5: Materials -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Materials</h2>
        <div class="title-rule"></div>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Cement Type:</span>
            <span class="info-value">{formatValue($materials.cementType)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">SCM:</span>
            <span class="info-value">{formatValue($materials.scm)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">
              w/c (m):
              <div style="font-size: 10pt; color: #666; font-weight: normal; margin-top: 2pt;">Allowed range: 0.37 - 0.45</div>
            </span>
            <span class="info-value">{formatWaterCementRatio($materials.waterCementRatio)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Curing:</span>
            <span class="info-value">{formatCuring($materials.curing)}</span>
          </div>
        </div>
      </div>
      <div class="page-number">
        <p>5</p>
      </div>
    </div>

    <!-- PAGE 6: Slab Layout -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Slab Layout</h2>
        <div class="title-rule"></div>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Slab Thickness:</span>
            <span class="info-value">{formatThickness($slabLayout.thickness)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Joint Spacing:</span>
            <span class="info-value">{formatJointSpacing($slabLayout.jointSpacing)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Expected Saw Cutting Time:</span>
            <span class="info-value">{formatHour($slabLayout.sawCutHour)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Joint Type:</span>
            <span class="info-value">{formatValue($slabLayout.jointType)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Base Type:</span>
            <span class="info-value">{formatValue($slabLayout.baseType)}</span>
          </div>
        </div>
      </div>
      <div class="page-number">
        <p>6</p>
      </div>
    </div>

    <!-- PAGE 7: Environment -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Environment</h2>
        <div class="title-rule"></div>

        <h3 class="section-subheading">Nearest Weather Stations</h3>

        {#if selectedLocation}
          <div class="env-info">
            <p>
              <span class="env-label">Selected location:</span>
              <span class="env-value">{selectedLocation.city}, {$projectInfo.state}</span>
              <span class="env-coords">({formatCoord(selectedLocation.latitude)}, {formatCoord(selectedLocation.longitude)})</span>
            </p>
            <p>
              <span class="env-label">Start date:</span>
              <span class="env-value">{formatDate($projectInfo.date)}</span>
              <span class="env-label">at hour</span>
              <span class="env-value">{formatHour($projectInfo.startHour)}</span>
            </p>
          </div>
        {/if}

        {#if $weatherStations.length > 0}
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
                {#each $weatherStations as station}
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

        {#if $chartImages.temp}
          <h3 class="section-subheading">72-Hour Charts (Plotly)</h3>
          <div class="charts-container">
            <div class="chart-wrapper">
              <img src={$chartImages.temp} alt="Temperature Chart" class="chart-image" />
            </div>
          </div>
        {/if}
      </div>
      <div class="page-number">
        <p>7</p>
      </div>
    </div>

    <!-- PAGE 8: Environment - Remaining Charts -->
    {#if $chartImages.wind || $chartImages.cloud}
      <div class="page">
        <div class="page-content">
          <h2 class="page-title">Environment</h2>
          <div class="title-rule"></div>

          <div class="charts-container">
            {#if $chartImages.wind}
              <div class="chart-wrapper">
                <img src={$chartImages.wind} alt="Wind Speed Chart" class="chart-image" />
              </div>
            {/if}
            {#if $chartImages.cloud}
              <div class="chart-wrapper">
                <img src={$chartImages.cloud} alt="Cloud Cover Chart" class="chart-image" />
              </div>
            {/if}
          </div>
        </div>
        <div class="page-number">
          <p>8</p>
        </div>
      </div>
    {/if}

    <!-- PAGES 9-10: Other Section Pages -->
    {#each sections.slice(4, 6) as section}
      <div class="page">
        <div class="page-content">
          <h2 class="page-title">{section.title}</h2>
          <div class="title-rule"></div>
          <p class="section-placeholder">Content for {section.title} will appear here.</p>
        </div>
        <div class="page-number">
          <p>{section.page}</p>
        </div>
      </div>
    {/each}

<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
    <!-- PAGE 10: Appendices Divider -->
=======
    <!-- PAGE 11: Appendices Divider -->
>>>>>>> b2bba06 (Split Environment section to prevent chart cutoff)
    <div class="page cover-page">
      <div class="cover-content">
        <div class="cover-title-block">
          <h1 class="cover-title">APPENDICES</h1>
        </div>
      </div>
    </div>

    <!-- PAGE 12: Appendix A -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Appendix A</h2>
        <div class="title-rule"></div>
        <h3 class="section-subheading">Weather Station Data</h3>
        <p class="section-placeholder">Content for Weather Station Data will appear here.</p>
      </div>
      <div class="page-number">
        <p>12</p>
      </div>
    </div>

>>>>>>> 588e01c (Add APPENDICES divider page before Appendices section)
=======
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)

    <!-- PAGE 1: Cover Page -->
    <div class="page cover-page">
      <div class="cover-content">
        <div class="cover-title-block">
          <h1 class="cover-title">Pavement Cracking<br/>Analysis Report</h1>
          <div class="cover-divider"></div>
          <p class="cover-location">
            {#if $projectInfo.city && $projectInfo.state}
              {$projectInfo.city}, {$projectInfo.state}
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
<<<<<<< HEAD
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======

    <!-- PAGE 2: Disclaimer -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Disclaimer</h2>
        <div class="title-rule"></div>
        <p>Armen, you gotta say something official here so they know that if something goes wrong it's not our fault.</p>
      </div>
      <div class="page-number">
        <p>2</p>
      </div>
    </div>

    <!-- PAGE 3: Table of Contents -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Table of Contents</h2>
        <div class="title-rule"></div>
        <div class="toc-list">
          {#each sections as section}
            <div class="toc-entry" class:toc-entry-indent={section.indent}>
              <span class="toc-label">{section.title}</span>
              <span class="toc-dots"> .................................................................................................................................................... </span>
              <span class="toc-page">{section.page}</span>
            </div>
          {/each}
        </div>
      </div>
      <div class="page-number">
        <p>3</p>
      </div>
    </div>

    <!-- PAGE 4: Project Information -->
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
      <div class="page-number">
        <p>4</p>
      </div>
    </div>

    <!-- PAGE 5: Materials -->
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
      </div>
      <div class="page-number">
        <p>5</p>
      </div>
    </div>

    <!-- PAGE 6: Slab Layout -->
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
      <div class="page-number">
        <p>6</p>
      </div>
    </div>

    <!-- PAGE 7: Environment -->
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
      <div class="page-number">
        <p>7</p>
      </div>
    </div>

    <!-- PAGE 8: Environment - Remaining Charts -->
    {#if snap.chartImages.wind || snap.chartImages.cloud}
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
        <div class="page-number">
          <p>8</p>
        </div>
      </div>
    {/if}

    <!-- PAGES 9-10: Other Section Pages -->
    {#each sections.slice(4, 6) as section}
      <div class="page">
        <div class="page-content">
          <h2 class="page-title">{section.title}</h2>
          <div class="title-rule"></div>
          <p class="section-placeholder">Content for {section.title} will appear here.</p>
        </div>
        <div class="page-number">
          <p>{section.page}</p>
        </div>
      </div>
    {/each}

<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
    <!-- PAGE 10: Appendices Divider -->
=======
    <!-- PAGE 11: Appendices Divider -->
>>>>>>> b2bba06 (Split Environment section to prevent chart cutoff)
    <div class="page cover-page">
      <div class="cover-content">
        <div class="cover-title-block">
          <h1 class="cover-title">APPENDICES</h1>
        </div>
      </div>
    </div>

    <!-- PAGE 12: Appendix A -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Appendix A</h2>
        <div class="title-rule"></div>
        <h3 class="section-subheading">Weather Station Data</h3>
        <p class="section-placeholder">Content for Weather Station Data will appear here.</p>
      </div>
      <div class="page-number">
        <p>12</p>
      </div>
    </div>

>>>>>>> 588e01c (Add APPENDICES divider page before Appendices section)
=======
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)

    <!-- PAGE 1: Cover Page -->
    <div class="page cover-page">
      <div class="cover-content">
        <div class="cover-title-block">
          <h1 class="cover-title">Pavement Cracking<br/>Analysis Report</h1>
          <div class="cover-divider"></div>
          <p class="cover-location">
            {#if $projectInfo.city && $projectInfo.state}
              {$projectInfo.city}, {$projectInfo.state}
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
<<<<<<< HEAD
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======

    <!-- PAGE 2: Disclaimer -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Disclaimer</h2>
        <div class="title-rule"></div>
        <p>Armen, you gotta say something official here so they know that if something goes wrong it's not our fault.</p>
      </div>
      <div class="page-number">
        <p>2</p>
      </div>
    </div>

    <!-- PAGE 3: Table of Contents -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Table of Contents</h2>
        <div class="title-rule"></div>
        <div class="toc-list">
          {#each sections as section}
            <div class="toc-entry">
              <span class="toc-label">{section.title}</span>
              <span class="toc-dots"> .................................................................................................................................................... </span>
              <span class="toc-page">{section.page}</span>
            </div>
          {/each}
        </div>
      </div>
      <div class="page-number">
        <p>3</p>
      </div>
    </div>

    <!-- PAGE 4: Project Information -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Project Information</h2>
        <div class="title-rule"></div>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">State:</span>
            <span class="info-value">{formatValue($projectInfo.state)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">City:</span>
            <span class="info-value">{formatValue($projectInfo.city)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Latitude:</span>
            <span class="info-value">{formatCoord(selectedLocation?.latitude ?? null)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Longitude:</span>
            <span class="info-value">{formatCoord(selectedLocation?.longitude ?? null)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date:</span>
            <span class="info-value">{formatDate($projectInfo.date)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Start Hour:</span>
            <span class="info-value">{formatHour($projectInfo.startHour)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Construction Start Temperature:</span>
            <span class="info-value">{formatTemp($projectInfo.startTempF)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Concrete Delivery Temperature:</span>
            <span class="info-value">{formatTemp($projectInfo.deliveryTempF)}</span>
          </div>
        </div>

        {#if $site && $site.length === 2}
          <div class="map-section">
            <h3 class="map-title">Project Location Map</h3>
            <div class="map-container">
              <StaticMapView center={$site as [number, number]} points={$allPoints as [number, number][]} />
            </div>
          </div>
        {/if}
      </div>
      <div class="page-number">
        <p>4</p>
      </div>
    </div>

    <!-- PAGE 5: Materials -->
    <div class="page">
      <div class="page-content">
        <h2 class="page-title">Materials</h2>
        <div class="title-rule"></div>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Cement Type:</span>
            <span class="info-value">{formatValue($materials.cementType)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">SCM:</span>
            <span class="info-value">{formatValue($materials.scm)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">
              w/c (m):
              <div style="font-size: 10pt; color: #666; font-weight: normal; margin-top: 2pt;">Allowed range: 0.37 - 0.45</div>
            </span>
            <span class="info-value">{formatWaterCementRatio($materials.waterCementRatio)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Curing:</span>
            <span class="info-value">{formatCuring($materials.curing)}</span>
          </div>
        </div>
      </div>
      <div class="page-number">
        <p>5</p>
      </div>
    </div>

    <!-- PAGES 6-10: Other Section Pages -->
    {#each sections.slice(2) as section}
      <div class="page">
        <div class="page-content">
          <h2 class="page-title">{section.title}</h2>
          <div class="title-rule"></div>
          <p class="section-placeholder">Content for {section.title} will appear here.</p>
        </div>
        <div class="page-number">
          <p>{section.page}</p>
        </div>
      </div>
    {/each}

>>>>>>> 7b4388f (Update Report PDF formatting and structure)
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    justify-content: flex-end;
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    gap: 0.75rem;
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
    gap: 0.75rem;
>>>>>>> cedb080 (Freeze PDF preview until user explicitly clicks Update PDF)
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
    padding: 1rem 2rem;
    background-color: #f3f4f6;
    border-bottom: 1px solid #e5e7eb;
  }

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  .refresh-btn {
=======
  .update-btn {
>>>>>>> cedb080 (Freeze PDF preview until user explicitly clicks Update PDF)
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background-color: white;
<<<<<<< HEAD
    color: #374151;
    border: 1px solid #d1d5db;
=======
    color: #2563eb;
    border: 1.5px solid #2563eb;
>>>>>>> cedb080 (Freeze PDF preview until user explicitly clicks Update PDF)
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
<<<<<<< HEAD
    transition: background-color 0.2s, border-color 0.2s;
  }

  .refresh-btn:hover {
    background-color: #f9fafb;
    border-color: #9ca3af;
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
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

<<<<<<< HEAD
>>>>>>> cedb080 (Freeze PDF preview until user explicitly clicks Update PDF)
=======
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

>>>>>>> fe6cc5f (Add dirty-state flash to Update PDF button and unit-aware formatting)
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
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

  /* ---- Shared page styles ---- */
  .page {
=======
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
    min-height: 80vh;
  }

  .paper-preview {
    /* 8.5 x 11 inches - exact dimensions */
<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
    height: 85vh;
    overflow-y: auto;
  }

  .paper-preview {
=======
    height: 85vh;
    overflow-y: auto;
  }

  .paper-preview {
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
    height: 85vh;
    overflow-y: auto;
  }

  .paper-preview {
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
    width: 8.5in;
    font-family: 'Calibri', 'Carlito', sans-serif;
    font-size: 12pt;
    line-height: 1.5;
    zoom: 0.75;
    color: #000000;
  }

  /* ---- Shared page styles ---- */
  .page {
<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
    width: 8.5in;
    height: 11in;
    background: white;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
                0 2px 4px -1px rgba(0, 0, 0, 0.06),
                0 10px 15px -3px rgba(0, 0, 0, 0.1);
    border-radius: 2px;
    overflow: hidden;
    position: relative;
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    box-sizing: border-box;
    margin-bottom: 2rem;
  }

  .page:last-child {
    margin-bottom: 0;
  }

  .page-content {
=======
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 1rem;
    line-height: 1.5;
  }

  .paper-content {
<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
    box-sizing: border-box;
    margin-bottom: 2rem;
  }

=======
    box-sizing: border-box;
    margin-bottom: 2rem;
  }

>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
    box-sizing: border-box;
    margin-bottom: 2rem;
  }

>>>>>>> 7b4388f (Update Report PDF formatting and structure)
  .page:last-child {
    margin-bottom: 0;
  }

  .page-content {
<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
    padding: 1in;
    padding-bottom: 0;
    height: calc(11in - 1in);
    box-sizing: border-box;
  }

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  .page-number {
=======
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
  .report-header {
    text-align: center;
    border-bottom: 2px solid #1f2937;
    padding-bottom: 1rem;
    margin-bottom: 1.5rem;
  }

  .report-header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0;
  }

  .report-header .subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.5rem;
  }

  .placeholder-text {
    color: #4b5563;
    margin-bottom: 1rem;
  }

  .placeholder-list {
    list-style: none;
    padding-left: 0;
    margin: 0;
    color: #6b7280;
  }

  .placeholder-list li {
    margin-bottom: 0.5rem;
    padding-left: 1.5rem;
    position: relative;
  }

  .placeholder-list li::before {
    content: "\2022";
    position: absolute;
    left: 0.5rem;
    color: #6b7280;
  }

  .report-footer {
<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
  .page-number {
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
  .page-number {
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
  .page-number {
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
    position: absolute;
    bottom: 1in;
    left: 1in;
    right: 1in;
    text-align: center;
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
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

<<<<<<< HEAD
<<<<<<< HEAD
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

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 9e24379 (Add 72-hour Plotly charts to Report PDF Environment section)
=======
>>>>>>> 9e24379 (Add 72-hour Plotly charts to Report PDF Environment section)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  }

=======
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
    max-width: 7.5in;
=======
>>>>>>> bf7d28e (Move chart legends below and use full page width)
  }

>>>>>>> 9e24379 (Add 72-hour Plotly charts to Report PDF Environment section)
=======
    max-width: 7.5in;
=======
>>>>>>> bf7d28e (Move chart legends below and use full page width)
  }

>>>>>>> 9e24379 (Add 72-hour Plotly charts to Report PDF Environment section)
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
=======
    border-top: 1px solid #d1d5db;
    padding-top: 1rem;
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
  }

  .page-number p {
    font-size: 12pt;
    color: #000000;
  }

<<<<<<< HEAD
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
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

=======
>>>>>>> 7e87b88 (Update Appendices structure in Report PDF)
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
<<<<<<< HEAD
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======

=======
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
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
<<<<<<< HEAD
>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
=======

  /* ---- Appendix A: 72-hour normals tables ---- */
  .normals-heading {
    font-family: Calibri, sans-serif;
    font-size: 11pt;
    font-weight: bold;
    color: #000000;
    margin-top: 6pt;
    margin-bottom: 6pt;
  }

  .normals-station-header {
    margin-bottom: 4pt;
  }

  .normals-station-name {
    font-family: Calibri, sans-serif;
    font-size: 9pt;
    font-weight: bold;
    color: #000000;
    margin: 0;
  }

  .normals-station-info {
    font-family: Calibri, sans-serif;
    font-size: 7pt;
    color: #666;
    margin: 1pt 0 0 0;
  }

  .normals-table-wrapper {
    margin-top: 4pt;
  }

  .normals-table {
    width: 100%;
    border-collapse: collapse;
    font-family: Calibri, sans-serif;
    font-size: 7pt;
    color: #000000;
    line-height: 1.1;
  }

  .normals-table th {
    background-color: #f3f4f6;
    padding: 2pt 4pt;
    text-align: left;
    font-weight: bold;
    border: 0.5pt solid #d1d5db;
    font-size: 7pt;
  }

  .normals-table td {
    padding: 1.5pt 4pt;
    border: 0.5pt solid #d1d5db;
  }
>>>>>>> 4d385f5 (User interface updates: Appendix A weather station tables and input placeholder fix)
=======
    border-top: 1px solid #d1d5db;
    padding-top: 1rem;
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
  }

  .page-number p {
    font-size: 12pt;
    color: #000000;
  }

<<<<<<< HEAD
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
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

=======
>>>>>>> 7e87b88 (Update Appendices structure in Report PDF)
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
<<<<<<< HEAD
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======

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
>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
=======
    border-top: 1px solid #d1d5db;
    padding-top: 1rem;
=======
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
  }

  .page-number p {
    font-size: 12pt;
    color: #000000;
  }

<<<<<<< HEAD
>>>>>>> bab3b5f (Add Report PDF tab with downloadable PDF generation)
=======
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
  .section-placeholder {
    color: #000000;
    margin-top: 1rem;
  }
<<<<<<< HEAD
>>>>>>> 7b4388f (Update Report PDF formatting and structure)
=======

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
>>>>>>> bfef8f9 (Adjust map zoom and fix legend in PDF download)
</style>
