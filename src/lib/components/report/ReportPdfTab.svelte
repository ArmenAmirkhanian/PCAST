<script lang="ts">
  // Report PDF Tab - displays a preview of the 8.5x11 report

  let paperPreview: HTMLDivElement;
  let isGenerating = false;

  async function downloadPdf() {
    if (isGenerating) return;
    isGenerating = true;

    try {
      // Dynamically import html2pdf (browser-only library)
      const html2pdf = (await import('html2pdf.js')).default;

      const options = {
        margin: 0,
        filename: 'pavement-cracking-report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true
        },
        jsPDF: {
          unit: 'in',
          format: 'letter',
          orientation: 'portrait'
        }
      };

      await html2pdf().set(options).from(paperPreview).save();
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
    <div class="paper-content">
      <!-- Header -->
      <div class="report-header">
        <h1>Pavement Cracking Analysis Report</h1>
        <p class="subtitle">Generated Report Preview</p>
      </div>

      <!-- Placeholder content - will be populated with data from other tabs -->
      <div class="report-body">
        <p class="placeholder-text">
          Report content will appear here. This document will include:
        </p>
        <ul class="placeholder-list">
          <li>Project Information</li>
          <li>Materials Data</li>
          <li>Slab Layout Details</li>
          <li>Environmental Conditions</li>
          <li>Analysis Results</li>
        </ul>
      </div>

      <!-- Footer -->
      <div class="report-footer">
        <p>Page 1 of 1</p>
      </div>
    </div>
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
    min-height: 80vh;
  }

  .paper-preview {
    /* 8.5 x 11 inches - exact dimensions */
    width: 8.5in;
    height: 11in;
    background: white;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
                0 2px 4px -1px rgba(0, 0, 0, 0.06),
                0 10px 15px -3px rgba(0, 0, 0, 0.1);
    border-radius: 2px;
    overflow: hidden;
    position: relative;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 1rem;
    line-height: 1.5;
  }

  .paper-content {
    padding: 1in;
    padding-bottom: 0;
    height: calc(11in - 1in);
    box-sizing: border-box;
  }

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
    position: absolute;
    bottom: 1in;
    left: 1in;
    right: 1in;
    text-align: center;
    border-top: 1px solid #d1d5db;
    padding-top: 1rem;
  }

  .report-footer p {
    font-size: 0.75rem;
    color: #9ca3af;
  }

</style>
