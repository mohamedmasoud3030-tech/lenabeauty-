/**
 * Client-side PDF export for the premium print sheets.
 *
 * The sheet is rendered off-screen at full A4 size (see .lb-pdf-source in
 * src/lena-brand.css) and rasterized with html2pdf.js — which is loaded on
 * demand, so the ~0.7MB library only ships when the user actually exports a
 * file. Output is a real, shareable .pdf matching the printed layout, and it
 * works in Arabic because the text is captured exactly as rendered (shaping,
 * RTL, digits all intact).
 */
export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<void> {
  const { default: html2pdf } = await import("html2pdf.js");
  await html2pdf()
    .set({
      margin: 0,
      filename,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .from(element)
    .save();
}
