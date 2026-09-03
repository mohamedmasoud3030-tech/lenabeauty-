import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('desktop native readiness', () => {
  const rust = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
  const tauriConfig = fs.readFileSync('src-tauri/tauri.conf.json', 'utf8');
  const cargo = fs.readFileSync('src-tauri/Cargo.toml', 'utf8');

  it('includes picker and print job metadata in rust layer', () => {
    expect(rust).toContain('desktop_pick_backup_file');
    expect(rust).toContain('source: Option<String>');
    expect(rust).toContain('queued_at_iso');
    expect(rust).toContain('file_path');
  });

  it('enforces a desktop CSP and does not register an unhandled deep link scheme', () => {
    const config = JSON.parse(tauriConfig);
    expect(config.app.security.csp).toContain("default-src 'self'");
    expect(config.app.security.csp).toContain('https://*.supabase.co');
    expect(config.plugins['deep-link']).toBeUndefined();
    expect(cargo).not.toContain('tauri-plugin-deep-link');
  });
});
