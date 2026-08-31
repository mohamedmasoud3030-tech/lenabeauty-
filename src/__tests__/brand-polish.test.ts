import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const app = read("src/App.tsx");
const polish = read("src/brand-polish.css");
const badge = read("src/shared/components/Badge.tsx");
const card = read("src/shared/components/Card.tsx");
const premiumCard = read("src/shared/components/PremiumCard.tsx");
const pageHeader = read("src/shared/components/PageHeader.tsx");
const tabs = read("src/shared/components/Tabs.tsx");

const rawDecorativePalette = /(?:bg|text|border|ring|shadow|from|via|to)-(?:blue|purple|pink|emerald|amber|sky|indigo|violet|cyan|orange|rose|red|green|yellow)-\d/;

describe("Lena app-wide brand polish", () => {
  it("loads one global polish layer from the application root", () => {
    expect(app).toContain('import "./brand-polish.css"');
    expect(polish).toContain("--lena-brand-wash");
    expect(polish).toContain("hsl(var(--primary)");
    expect(polish).toContain("hsl(var(--secondary)");
  });

  it("keeps shared surfaces on semantic Lena tokens only", () => {
    for (const [name, source] of Object.entries({ badge, card, premiumCard, pageHeader, tabs })) {
      expect(source, name).not.toMatch(rawDecorativePalette);
    }
  });

  it("uses brand secondary for the secondary badge instead of the info status", () => {
    expect(badge).toContain("bg-secondary/10 text-secondary border border-secondary/20");
    expect(badge).not.toContain("secondary: 'bg-info/10");
  });

  it("bridges the last known legacy rose and amber utilities to semantic tokens", () => {
    expect(polish).toContain(".text-rose-500");
    expect(polish).toContain("hsl(var(--destructive))");
    expect(polish).toContain(".bg-amber-500");
    expect(polish).toContain("linear-gradient(115deg, hsl(var(--primary)), hsl(var(--secondary)))");
  });
});
