import { describe, expect, it } from "vitest";
import { escapePrintText, sanitizePrintHTML } from "../infrastructure/services/printService";

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
});
