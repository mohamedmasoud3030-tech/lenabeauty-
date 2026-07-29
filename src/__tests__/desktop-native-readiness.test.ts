import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('desktop native readiness', () => {
  const native = fs.readFileSync('src/desktop/native.ts', 'utf8');
  const rust = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');

  it('provides native helper layer for picker and invoice print', () => {
    expect(native).toContain('openDesktopBackupPicker');
    expect(native).toContain('queueDesktopInvoicePrint');
  });

  it('includes picker and print job metadata in rust layer', () => {
    expect(rust).toContain('desktop_pick_backup_file');
    expect(rust).toContain('source: Option<String>');
    expect(rust).toContain('queued_at_iso');
    expect(rust).toContain('file_path');
  });
});
