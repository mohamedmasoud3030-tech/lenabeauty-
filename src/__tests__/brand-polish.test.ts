import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const app = read("src/App.tsx");
const entry = read("src/main.tsx");
const polish = read("src/brand-polish.css");
const premiumCard = read("src/shared/components/PremiumCard.tsx");
const pageHeader = read("src/shared/components/PageHeader.tsx");
const tabs = read("src/shared/components/Tabs.tsx");

const rawDecorativePalette = /(?:bg|text|border|ring|shadow|from|via|to)-(?:blue|purple|pink|emerald|amber|sky|indigo|violet|cyan|orange|rose|red|green|yellow)-\d/;

describe("Lena app-wide brand polish", () => {
  it("loads one global polish layer from the single stylesheet owner", () => {
    // main.tsx is the ONLY module allowed to import global CSS. App.tsx used to
    // import the polish layer itself, which made the emitted cascade order the
    // reverse of the documented intent (App's module graph is evaluated before
    // main's own stylesheet imports).
    expect(entry).toMatch(/import\s+["']\.\/brand-polish\.css["']/);
    expect(app).not.toMatch(/import\s+["'][^"']+\.css["']/);
    expect(polish).toContain("--lena-brand-wash");
    expect(polish).toContain("hsl(var(--primary)");
    expect(polish).toContain("hsl(var(--secondary)");
  });

  it("keeps the global cascade in the documented intentional order", () => {
    const order = ["index.css", "brand-polish.css", "readability.css", "lena-brand.css"].map((sheet) =>
      entry.search(new RegExp(`import\\s+["\\']\\./${sheet.replace(".", "\\.")}["\\']`)),
    );
    for (const [index, offset] of order.entries()) {
      expect(offset, `stylesheet ${index} must be imported by main.tsx`).toBeGreaterThan(-1);
    }
    // tokens/base -> brand polish -> readability floor -> printable receipt brand
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("does not restyle primitives that no markup renders", () => {
    // .ui-card was superseded by shared/components/PremiumCard; the polish rule
    // targeting it was inert. Guard against re-adding polish for dead classes.
    expect(polish).not.toContain(".ui-card");
    expect(polish).not.toContain("--lena-brand-shadow");
    expect(polish).toContain("#main-content :where(.rounded-2xl, .rounded-3xl)");
  });

  it("keeps shared surfaces on semantic Lena tokens only", () => {
    for (const [name, source] of Object.entries({ premiumCard, pageHeader, tabs })) {
      expect(source, name).not.toMatch(rawDecorativePalette);
    }
  });

  it("bridges the last known legacy rose and amber utilities to semantic tokens", () => {
    expect(polish).toContain(".text-rose-500");
    expect(polish).toContain("hsl(var(--destructive))");
    expect(polish).toContain(".bg-amber-500");
    expect(polish).toContain("linear-gradient(115deg, hsl(var(--primary)), hsl(var(--secondary)))");
  });
});
