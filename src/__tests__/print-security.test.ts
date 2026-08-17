import { describe, expect, it } from "vitest";
import printService, { escapePrintText, sanitizePrintHTML } from "../infrastructure/services/printService";

describe("print HTML security", () => {
  it("removes active content while preserving the generated print stylesheet", () => {
    const sanitized = sanitizePrintHTML(`<!doctype html><html><head>
      <style data-lb-print-style>body { color: black; }</style>
      <style>body { background: url(https://attacker.invalid/leak); }</style>
      </head><body onload="steal()">
      <script>steal()</script><iframe srcdoc="bad"></iframe>
      <img src="x" onerror="steal()"><a href="javascript:steal()">click</a>
      <p>safe content</p></body></html>`);

    expect(sanitized).toContain("data-lb-print-style");
    expect(sanitized).toContain("safe content");
    expect(sanitized).not.toMatch(/<script|<iframe|onload=|onerror=|javascript:|attacker\.invalid/i);
  });

  it("escapes untrusted text before interpolation into print markup", () => {
    expect(escapePrintText(`<img src=x onerror="alert(1)">&'`))
      .toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;");
  });

  it("generateInvoiceHTML escapes customer and item data so it cannot become active markup", () => {
    const html = printService.generateInvoiceHTML({
      invoice: { number: "INV-<script>bad</script>", date: "2026-08-17" },
      customer: { name: `<img src=x onerror="steal()">`, phone: "123&456", email: "" },
      items: [{ name: `<style>*{display:none}</style>`, qty: 1, price: 5.5 }],
      totals: { subtotal: 5.5, discount: 0, tax: 0, total: 5.5 },
    });

    // No raw tag or style element may survive interpolation (the escaped
    // payload still contains inert "onerror=" text, so the assertions target
    // active markup: raw tags and raw quoted attributes).
    expect(html).not.toMatch(/<\s*(script|img|style|iframe|link|meta|object|embed|base)[\s>/]/i);
    expect(html).not.toMatch(/(^|\s)onerror\s*=\s*["']/i);
    expect(html).toContain("&lt;img src=x onerror=&quot;steal()&quot;&gt;");
    expect(html).toContain("123&amp;456");
    expect(html).toContain("&lt;style&gt;*{display:none}&lt;/style&gt;");
  });

  it("generateReportHTML escapes title, summary, headers, and cell values", () => {
    const html = printService.generateReportHTML({
      title: `<a href="javascript:steal()">Sales</a>`,
      summary: { "Day<script>": "100<script>" },
      data: [{ name: `<iframe srcdoc="x"></iframe>`, total: 9.25 }],
    });

    // The dangerous unescaped forms (raw href="javascript:", raw tags, raw
    // srcdoc attributes) are gone; inert escaped text is expected to remain.
    expect(html).not.toMatch(/<\s*(script|img|style|iframe|a|link|meta|object|embed|base)[\s>/]/i);
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).not.toMatch(/(^|\s)srcdoc\s*=\s*["']/i);
    expect(html).toContain("&lt;a href=&quot;javascript:steal()&quot;&gt;Sales&lt;/a&gt;");
    expect(html).toContain("&lt;iframe srcdoc=&quot;x&quot;&gt;&lt;/iframe&gt;");
  });
});
