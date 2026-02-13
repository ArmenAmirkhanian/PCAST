<script lang="ts">
  import { projectInfo } from '$lib/stores/form';

  let paperPreview: HTMLDivElement;
  let isGenerating = false;

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
    { id: 'project-info', title: 'Project Information', page: 4 },
    { id: 'materials', title: 'Materials', page: 5 },
    { id: 'slab-layout', title: 'Slab Layout', page: 6 },
    { id: 'environment', title: 'Environment', page: 7 },
    { id: 'analysis', title: 'Analysis', page: 8 },
    { id: 'results', title: 'Results', page: 9 },
    { id: 'appendices', title: 'Appendices', page: 10 }
  ];

  const totalPages = 10;

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

      const options = {
        margin: 0,
        filename: 'pavement-cracking-report.pdf',
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
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

    <!-- PAGES 4-10: Section Pages -->
    {#each sections as section, i}
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

  </div>
</div>

<style>
  .toolbar {
    display: flex;
    justify-content: flex-end;
    padding: 1rem 2rem;
    background-color: #f3f4f6;
    border-bottom: 1px solid #e5e7eb;
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
</style>
