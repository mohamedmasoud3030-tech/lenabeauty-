/**
 * Canonical CSV export. Every list that downloads a CSV (customers,
 * inventory, …) builds `headers` + `rows` and lets this own the blob,
 * download link, and cleanup so the browser-side plumbing stays in one place.
 */
export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
