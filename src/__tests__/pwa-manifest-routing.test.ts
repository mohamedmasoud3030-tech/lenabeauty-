import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const viteConfig = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");
const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
const updatePrompt = readFileSync(resolve(process.cwd(), "src/shared/components/PwaUpdatePrompt.tsx"), "utf8");
const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

describe("PWA manifest routing", () => {
  it("uses hash URLs that match the shipped HashRouter", () => {
    expect(viteConfig).toContain("start_url: '/#/dashboard'");
    expect(viteConfig).toContain("url: '/#/pos'");
    expect(viteConfig).toContain("url: '/#/dashboard'");
    expect(viteConfig).not.toMatch(/start_url:\s*['"]\/dashboard['"]/);
    expect(viteConfig).not.toMatch(/url:\s*['"]\/pos['"]/);
  });

  it("lets the PWA plugin inject one manifest link and keeps one iOS status-bar declaration", () => {
    expect(indexHtml).not.toContain('rel="manifest"');
    expect(indexHtml.match(/apple-mobile-web-app-status-bar-style/g)).toHaveLength(1);
  });

  it("does not runtime-cache business or signed private images", () => {
    expect(viteConfig).not.toContain("cacheName: 'images-cache'");
    expect(viteConfig).not.toContain("urlPattern: /\\.(?:png|jpg");
    expect(viteConfig).toContain("Business/customer");
  });

  it("waits for explicit update acceptance instead of replacing live chunks", () => {
    expect(viteConfig).toContain("registerType: 'prompt'");
    expect(viteConfig).toContain("globIgnores: ['**/chunk-charts-*.js']");
    expect(app).toContain("<PwaUpdatePrompt />");
    expect(updatePrompt).toContain('useRegisterSW');
    expect(updatePrompt).toContain('updateServiceWorker(true)');
    expect(updatePrompt).toContain('A new version is available');
  });
});
