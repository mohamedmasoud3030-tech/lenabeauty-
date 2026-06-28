import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('tauri foundation files', () => {
  it('includes core Rust and config files', () => {
    expect(fs.existsSync('src-tauri/Cargo.toml')).toBe(true);
    expect(fs.existsSync('src-tauri/tauri.conf.json')).toBe(true);
    expect(fs.existsSync('src-tauri/src/main.rs')).toBe(true);
    expect(fs.existsSync('src-tauri/build.rs')).toBe(true);
  });

  it('declares desktop npm scripts', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    expect(pkg.scripts['desktop:dev']).toBeTruthy();
    expect(pkg.scripts['desktop:preflight']).toBeTruthy();
    expect(pkg.scripts['desktop:tauri:check']).toBeTruthy();
  });

  it('contains tauri product config', () => {
    const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
    expect(conf.productName).toContain('LenaBeauty');
    expect(conf.identifier).toBe('com.lenabeauty.desktop');
  });
});
