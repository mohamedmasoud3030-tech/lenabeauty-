/**
 * Print Service
 * Unified printing and PDF export service for all documents
 * Ensures consistent appearance across print, preview, and PDF export
 */

import brandingService from './brandingService';

export interface PrintOptions {
  paperSize?: '80mm' | '58mm' | 'A4' | 'A3';
  orientation?: 'portrait' | 'landscape';
  margins?: { top: number; right: number; bottom: number; left: number };
  scale?: number;
  filename?: string;
}

export interface DocumentContent {
  title: string;
  content: string;
  isArabic?: boolean;
}

export function sanitizePrintHTML(html: string): string {
  if (typeof DOMParser === 'undefined') return html;
  const document = new DOMParser().parseFromString(html, 'text/html');
  document.querySelectorAll('script, iframe, object, embed, base, link, meta[http-equiv], style:not([data-lb-print-style])').forEach((node) => node.remove());
  document.querySelectorAll('*').forEach((element) => {
    for (const attribute of element.attributes) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc') element.removeAttribute(attribute.name);
      if ((name === 'href' || name === 'src' || name === 'action' || name === 'formaction')
          && (value.startsWith('javascript:') || value.startsWith('vbscript:'))) {
        element.removeAttribute(attribute.name);
      }
    }
  });
  return `<!DOCTYPE html>\n${document.documentElement.outerHTML}`;
}

export function escapePrintText(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

class PrintService {
  private static instance: PrintService;

  private constructor() {}

  static getInstance(): PrintService {
    if (!PrintService.instance) {
      PrintService.instance = new PrintService();
    }
    return PrintService.instance;
  }

  /**
   * Generate print-ready HTML with unified styling
   */
  generatePrintHTML(content: string, options: PrintOptions = {}): string {
    const { paperSize = 'A4', orientation = 'portrait', margins = { top: 10, right: 10, bottom: 10, left: 10 } } = options;
    const branding = brandingService.getSettings();
    const cssVars = brandingService.getCSSVariables();

    const paperSizes: Record<string, { width: string; height: string }> = {
      '80mm': { width: '80mm', height: 'auto' },
      '58mm': { width: '58mm', height: 'auto' },
      'A4': { width: '210mm', height: '297mm' },
      'A3': { width: '297mm', height: '420mm' },
    };

    const size = paperSizes[paperSize] || paperSizes['A4'];

    return sanitizePrintHTML(`
      <!DOCTYPE html>
      <html dir="ltr" lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapePrintText(options.filename || 'Document')}</title>
        <style data-lb-print-style>
          :root {
            ${Object.entries(cssVars).map(([key, value]) => `${key}: ${value};`).join('\n')}
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 12px;
            line-height: 1.5;
            color: #1F2937;
            background-color: white;
          }

          .print-container {
            width: ${size.width};
            ${size.height !== 'auto' ? `height: ${size.height};` : ''}
            margin: 0 auto;
            padding: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
            background-color: white;
            page-break-after: always;
          }

          .document-header {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid var(--primary-color);
            text-align: center;
          }

          .document-header img {
            max-height: 80px;
            max-width: 100%;
            margin-bottom: 10px;
            object-fit: contain;
          }

          .document-header h1 {
            font-size: 20px;
            font-weight: bold;
            color: #1F2937;
            margin-bottom: 5px;
          }

          .document-header p {
            font-size: 11px;
            color: #6B7280;
            margin: 3px 0;
          }

          .document-content {
            margin: 20px 0;
          }

          .document-footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #E5E7EB;
            text-align: center;
            font-size: 10px;
            color: #9CA3AF;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }

          th {
            background-color: var(--primary-color);
            color: white;
            padding: 10px;
            text-align: left;
            font-weight: bold;
            border: 1px solid #E5E7EB;
          }

          td {
            padding: 8px 10px;
            border: 1px solid #E5E7EB;
          }

          tr:nth-child(even) {
            background-color: #F9FAFB;
          }

          .text-center {
            text-align: center;
          }

          .text-right {
            text-align: right;
          }

          .font-bold {
            font-weight: bold;
          }

          .text-sm {
            font-size: 10px;
          }

          .text-lg {
            font-size: 14px;
          }

          .mb-3 {
            margin-bottom: 15px;
          }

          .mt-3 {
            margin-top: 15px;
          }

          .section {
            margin-bottom: 20px;
            page-break-inside: avoid;
          }

          .section-title {
            font-size: 13px;
            font-weight: bold;
            color: var(--primary-color);
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid var(--primary-color);
          }

          .qr-code {
            text-align: center;
            margin: 20px 0;
          }

          .qr-code img {
            max-width: 150px;
            height: auto;
          }

          @media print {
            body {
              margin: 0;
              padding: 0;
              background-color: white;
            }

            .print-container {
              margin: 0;
              box-shadow: none;
              page-break-after: always;
            }

            .no-print {
              display: none !important;
            }

            @page {
              size: ${size.width} ${size.height};
              margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
            }
          }

          @media screen {
            .print-container {
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
              margin-bottom: 30px;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${this.getDocumentHeader()}
          <div class="document-content">
            ${content}
          </div>
          ${this.getDocumentFooter()}
        </div>
      </body>
      </html>
    `);
  }

  /**
   * Get unified document header
   */
  private getDocumentHeader(): string {
    const branding = brandingService.getSettings();
    return `
      <div class="document-header">
        ${branding.logo ? `<img src="${escapePrintText(branding.logo)}" alt="Logo" />` : ''}
        <h1>${escapePrintText(branding.salonName)}</h1>
        <p>${escapePrintText(branding.address)}</p>
        <p>${escapePrintText(branding.phone)} | ${escapePrintText(branding.email)}</p>
        ${branding.taxNumber ? `<p>Tax ID: ${escapePrintText(branding.taxNumber)}</p>` : ''}
      </div>
    `;
  }

  /**
   * Get unified document footer
   */
  private getDocumentFooter(): string {
    const branding = brandingService.getSettings();
    return `
      <div class="document-footer">
        <p>${escapePrintText(branding.footerText)}</p>
        ${branding.registrationNumber ? `<p>Registration: ${escapePrintText(branding.registrationNumber)}</p>` : ''}
        <p>${new Date().toLocaleDateString()}</p>
      </div>
    `;
  }

  /**
   * Print document to printer
   */
  printDocument(htmlContent: string, options: PrintOptions = {}): void {
    const printHTML = this.generatePrintHTML(htmlContent, options);
    const printWindow = window.open('', '', 'height=600,width=800');
    
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
      
      // Wait for content to load before printing
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  /**
   * Export document as a PDF.
   *
   * Two paths, both dependency-free at the app level:
   *   1. If an `html2pdf` build is present on `window` (bundled/loaded by the
   *      host), generate a real .pdf file directly.
   *   2. Otherwise (the common case for a single salon), open a dedicated print
   *      window with the rendered document and trigger the browser's print
   *      dialog — from which "Save as PDF" produces a proper PDF with the
   *      chosen filename. This is reliable, free, and needs no third-party
   *      service or API key.
   */
  async exportToPDF(htmlContent: string, filename: string = 'document.pdf', options: PrintOptions = {}): Promise<void> {
    // Optional: a real client-side PDF library, if the host bundle provides it.
    if (typeof (window as any).html2pdf !== 'undefined') {
      try {
        const printHTML = this.generatePrintHTML(htmlContent, { ...options, filename });
        const element = document.createElement('div');
        element.innerHTML = printHTML;

        const opt = {
          margin: [10, 10, 10, 10],
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { orientation: options.orientation || 'portrait', unit: 'mm', format: options.paperSize || 'a4' },
        };

        await (window as any).html2pdf().set(opt).from(element).save();
        return;
      } catch (error) {
        console.warn('html2pdf export failed, falling back to print dialog', error);
      }
    }

    // Practical, dependency-free path: print dialog → Save as PDF.
    this.printDocument(htmlContent, { ...options, filename });
  }

  /**
   * Generate print preview URL
   */
  generatePreviewURL(htmlContent: string, options: PrintOptions = {}): string {
    const printHTML = this.generatePrintHTML(htmlContent, options);
    const blob = new Blob([printHTML], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }

  /**
   * Share document (via email, WhatsApp, etc.)
   */
  async shareDocument(htmlContent: string, filename: string, method: 'email' | 'whatsapp' | 'print' = 'email'): Promise<void> {
    switch (method) {
      case 'email':
        // Generate PDF and prepare for email
        await this.exportToPDF(htmlContent, filename);
        break;
      case 'whatsapp':
        // Generate preview and share link
        const previewURL = this.generatePreviewURL(htmlContent);
        const message = `Check out this document: ${previewURL}`;
        const whatsappURL = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappURL, '_blank');
        break;
      case 'print':
        this.printDocument(htmlContent);
        break;
    }
  }

  /**
   * Generate invoice HTML
   */
  generateInvoiceHTML(invoiceData: any, isArabic: boolean = false): string {
    const { invoice, items, customer, totals } = invoiceData;
    
    return `
      <div class="section">
        <div class="section-title">${isArabic ? 'فاتورة' : 'Invoice'}</div>
        <table>
          <tr>
            <td class="font-bold">${isArabic ? 'رقم الفاتورة' : 'Invoice #'}:</td>
            <td>${invoice.number}</td>
            <td class="font-bold">${isArabic ? 'التاريخ' : 'Date'}:</td>
            <td>${invoice.date}</td>
          </tr>
        </table>
      </div>

      ${customer ? `
        <div class="section">
          <div class="section-title">${isArabic ? 'بيانات العميل' : 'Customer Information'}</div>
          <p class="font-bold">${customer.name}</p>
          <p>${customer.phone}</p>
          <p>${customer.email || ''}</p>
        </div>
      ` : ''}

      <div class="section">
        <div class="section-title">${isArabic ? 'التفاصيل' : 'Details'}</div>
        <table>
          <thead>
            <tr>
              <th>${isArabic ? 'الصنف' : 'Item'}</th>
              <th>${isArabic ? 'الكمية' : 'Qty'}</th>
              <th>${isArabic ? 'السعر' : 'Price'}</th>
              <th>${isArabic ? 'الإجمالي' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item: any) => `
              <tr>
                <td>${item.name}</td>
                <td class="text-center">${item.qty}</td>
                <td class="text-right">${item.price.toFixed(3)}</td>
                <td class="text-right">${(item.qty * item.price).toFixed(3)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <table>
          <tr>
            <td class="font-bold">${isArabic ? 'الإجمالي' : 'Subtotal'}:</td>
            <td class="text-right">${totals.subtotal.toFixed(3)}</td>
          </tr>
          ${totals.discount > 0 ? `
            <tr>
              <td class="font-bold">${isArabic ? 'الخصم' : 'Discount'}:</td>
              <td class="text-right">-${totals.discount.toFixed(3)}</td>
            </tr>
          ` : ''}
          ${totals.tax > 0 ? `
            <tr>
              <td class="font-bold">${isArabic ? 'الضريبة' : 'Tax'}:</td>
              <td class="text-right">+${totals.tax.toFixed(3)}</td>
            </tr>
          ` : ''}
          <tr style="background-color: var(--primary-color); color: white;">
            <td class="font-bold">${isArabic ? 'الإجمالي النهائي' : 'Grand Total'}:</td>
            <td class="text-right font-bold">${totals.total.toFixed(3)}</td>
          </tr>
        </table>
      </div>
    `;
  }

  /**
   * Generate report HTML
   */
  generateReportHTML(reportData: any, isArabic: boolean = false): string {
    const { title, summary, data } = reportData;

    return `
      <div class="section">
        <h2 class="text-lg font-bold mb-3">${title}</h2>
        ${summary ? `
          <div class="section">
            <div class="section-title">${isArabic ? 'الملخص' : 'Summary'}</div>
            <table>
              ${Object.entries(summary).map(([key, value]) => `
                <tr>
                  <td class="font-bold">${key}:</td>
                  <td class="text-right">${value}</td>
                </tr>
              `).join('')}
            </table>
          </div>
        ` : ''}
        ${data ? `
          <div class="section">
            <div class="section-title">${isArabic ? 'البيانات' : 'Data'}</div>
            <table>
              <thead>
                <tr>
                  ${Object.keys(data[0] || {}).map(key => `<th>${key}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${data.map((row: any) => `
                  <tr>
                    ${Object.values(row).map(value => `<td>${value}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>
    `;
  }
}

export default PrintService.getInstance();
