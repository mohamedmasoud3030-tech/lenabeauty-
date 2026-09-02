import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Global CSS ownership contract (Round 2, Phase 12).
 *
 * The app ships four global stylesheets. Before this contract they were owned
 * by two different entry modules (main.tsx imported three, App.tsx imported the
 * fourth), which made the emitted cascade order the reverse of the documented
 * intent, and index.css had accumulated ~20 class primitives that no markup
 * referenced any more (superseded by real components such as PremiumCard,
 * NetworkStatus and PwaUpdatePrompt).
 *
 * These tests pin the two invariants that keep that from regressing:
 *   1. exactly one module owns global CSS, in the documented cascade order;
 *   2. every class selector in the global stylesheets has a real consumer.
 */

const ROOT = process.cwd();
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

const GLOBAL_STYLESHEETS = [
  "src/index.css",
  "src/brand-polish.css",
  "src/readability.css",
  "src/lena-brand.css",
] as const;

/**
 * Classes that are intentionally shipped without a current markup consumer.
 * Every entry must state why, so the list cannot become a dumping ground.
 */
const ALLOWED_WITHOUT_CONSUMER: Record<string, string> = {
  "mobile-scroll-x":
    "no surface opts in, but mobile-portrait-ux.test.ts guards POS against re-introducing a second scrollable category row with this utility",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

/** All application source that could consume a class name (CSS excluded). */
function consumerSources(): string {
  const files = [...walk(join(ROOT, "src")), join(ROOT, "index.html")].filter((file) => {
    const lower = file.toLowerCase();
    return (
      !lower.endsWith(".css") &&
      /\.(tsx?|mjs|cjs|js|jsx|html)$/.test(lower) &&
      !file.includes(`${join("src", "__tests__")}`)
    );
  });
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

/**
 * Class selectors defined by a stylesheet, unescaped to the form used in
 * markup (`text-\[10px\]` -> `text-[10px]`, `hover\:bg-x\/10` -> `hover:bg-x/10`).
 */
function definedClasses(css: string): string[] {
  const stripped = css
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/@import[^;]+;/g, " ")
    .replace(/url\([^)]*\)/g, "url()");

  // First char must not be a digit (so `0.75rem` / `rgb(0 0 0 / 0.2)` are not
  // read as classes) and must not be a bare `:`. Escaped pairs are kept whole.
  const selector = /\.((?:\\[\s\S]|[^\s{};,()>+~"'`:0-9])(?:\\[\s\S]|[^\s{};,()>+~"'`:])*)/g;
  const found = new Set<string>();
  for (const match of stripped.matchAll(selector)) {
    const name = match[1]
      .replace(/\\([\s\S])/g, "$1")
      .replace(/:{1,2}[a-zA-Z-]+$/, ""); // trailing pseudo-class/element
    if (name) found.add(name);
  }
  return [...found];
}

describe("global CSS ownership", () => {
  it("ships exactly the four known global stylesheets", () => {
    const shipped = walk(join(ROOT, "src"))
      .filter((file) => file.toLowerCase().endsWith(".css"))
      .map((file) => file.slice(ROOT.length + 1).split("\\").join("/"))
      .sort();
    expect(shipped).toEqual([...GLOBAL_STYLESHEETS].sort());
  });

  it("is imported by one owner only, in the documented cascade order", () => {
    const entry = read("src/main.tsx");
    const offsets = GLOBAL_STYLESHEETS.map((sheet) => {
      const file = sheet.replace("src/", "").replace(".", "\\.");
      return entry.search(new RegExp(`import\\s+["\\']\\./${file}["\\']`));
    });
    for (const [index, offset] of offsets.entries()) {
      expect(offset, `${GLOBAL_STYLESHEETS[index]} must be imported by main.tsx`).toBeGreaterThan(-1);
    }
    // tokens/base -> brand polish -> readability floor -> printable receipt brand
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));

    // No other module may pull in a global stylesheet: a component-side import
    // would be evaluated before main.tsx's own imports and silently reorder the
    // cascade (this is exactly how brand-polish.css used to win by accident).
    const offenders = walk(join(ROOT, "src"))
      .filter((file) => /\.(tsx?|jsx?|mjs)$/.test(file) && !file.endsWith("main.tsx"))
      .filter((file) => /import\s+["'][^"']+\.css["']/.test(readFileSync(file, "utf8")))
      .map((file) => file.slice(ROOT.length + 1));
    expect(offenders).toEqual([]);
  });

  it("defines no class selector without a real consumer", () => {
    const consumers = consumerSources();
    const stale: string[] = [];

    for (const sheet of GLOBAL_STYLESHEETS) {
      for (const name of definedClasses(read(sheet))) {
        if (name in ALLOWED_WITHOUT_CONSUMER) continue;
        if (!consumers.includes(name)) stale.push(`${sheet} -> .${name}`);
      }
    }

    expect(
      stale,
      "Global stylesheet classes with no markup/JS consumer. Either use them, " +
        "delete them, or add them to ALLOWED_WITHOUT_CONSUMER with a reason.",
    ).toEqual([]);
  });

  it("keeps the allowlist honest", () => {
    const consumers = consumerSources();
    for (const [name, reason] of Object.entries(ALLOWED_WITHOUT_CONSUMER)) {
      expect(reason.length, `${name} needs a written justification`).toBeGreaterThan(20);
      // If a consumer appears, the entry is no longer an exception.
      if (consumers.includes(name)) {
        throw new Error(`.${name} is now consumed by app source; remove it from ALLOWED_WITHOUT_CONSUMER`);
      }
    }
  });
});
