'use client'

import html2pdf from 'html2pdf.js'

/**
 * Generate PDF on the client-side using html2pdf.js
 * Converts HTML string to PDF and triggers download
 */
export async function generateAuditPDFClient(
  html: string,
  filename: string
): Promise<void> {
  // Parse HTML and extract body content
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Create wrapper
  const wrapper = document.createElement('div')
  wrapper.id = 'pdf-export-container'

  // Get styles from parsed document
  const styles = doc.querySelectorAll('style')
  styles.forEach(style => wrapper.appendChild(style.cloneNode(true)))

  // Get body content
  const bodyContent = doc.body.cloneNode(true) as HTMLElement
  wrapper.appendChild(bodyContent)

  // Set wrapper styles for off-screen rendering
  wrapper.style.cssText = `
    width: 794px;
    position: relative;
  `

  // Create isolated container - completely off-screen with containment
  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed;
    left: -100000px;
    top: 0;
    width: 794px;
    pointer-events: none;
    contain: strict;
    will-change: transform;
    transform: translateZ(0);
  `
  container.appendChild(wrapper)

  document.body.appendChild(container)

  try {
    console.log('[PDF Export] Starting client-side PDF generation...', {
      htmlLength: html.length,
      wrapperWidth: wrapper.offsetWidth,
      wrapperHeight: wrapper.offsetHeight,
      contentChildrenCount: bodyContent.children.length,
    })

    // Wait for styles and images
    await new Promise(resolve => setTimeout(resolve, 500))

    const options = {
      margin: [10, 10, 10, 10],
      filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: true,
        backgroundColor: '#ffffff',
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait' as const,
      },
    }

    console.log('[PDF Export] Calling html2pdf...')

    // Generate PDF
    const worker = html2pdf().set(options).from(bodyContent).save()
    await worker

    console.log('[PDF Export] PDF generation completed')

    // Wait before cleanup
    await new Promise(resolve => setTimeout(resolve, 1000))
  } catch (error) {
    console.error('[PDF Export] Failed to generate PDF:', error)
    throw error
  } finally {
    document.body.removeChild(container)
  }
}
