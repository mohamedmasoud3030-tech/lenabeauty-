import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('tauri rust bridge implementation', () => {
  const rust = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');

  it('includes sqlite health, backup, picker restore and print commands', () => {
    expect(rust).toContain('desktop_db_health');
    expect(rust).toContain('desktop_export_backup');
    expect(rust).toContain('desktop_pick_backup_file');
    expect(rust).toContain('desktop_import_backup');
    expect(rust).toContain('desktop_print_html');
  });

  it('writes backup and print queue files in app data directory', () => {
    expect(rust).toContain('app_data_dir');
    expect(rust).toContain('print-jobs');
    expect(rust).toContain('backups');
    expect(rust).toContain('print_job_');
  });
});
