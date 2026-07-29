import { invokeDesktop } from './bridge';

export interface DesktopDatabaseHealth {
  connected: boolean;
  path: string;
  sqliteReady: boolean;
}

export interface DesktopSnapshotSummary {
  filePath: string;
  exportedAtISO: string;
  bytes: number;
}

export interface DesktopImportSummary {
  restored: boolean;
  importedAtISO: string;
}

export interface DesktopPrintPayload {
  title: string;
  html: string;
  source?: string;
}

export interface DesktopPrintSummary {
  queued: boolean;
  filePath?: string;
  queuedAtISO?: string;
}

export interface DesktopFileSelection {
  cancelled: boolean;
  filePath?: string;
}

export async function getDesktopDatabaseHealth(): Promise<DesktopDatabaseHealth> {
  const raw = await invokeDesktop<{ connected: boolean; path: string; sqlite_ready: boolean }>('desktop_db_health');
  return {
    connected: raw.connected,
    path: raw.path,
    sqliteReady: raw.sqlite_ready,
  };
}

export async function exportDesktopBackup(pretty = true): Promise<DesktopSnapshotSummary> {
  const raw = await invokeDesktop<{ file_path: string; exported_at_iso: string; bytes: number }>('desktop_export_backup', { pretty });
  return {
    filePath: raw.file_path,
    exportedAtISO: raw.exported_at_iso,
    bytes: raw.bytes,
  };
}

export async function importDesktopBackup(filePath: string): Promise<DesktopImportSummary> {
  const raw = await invokeDesktop<{ restored: boolean; imported_at_iso: string }>('desktop_import_backup', { filePath });
  return {
    restored: raw.restored,
    importedAtISO: raw.imported_at_iso,
  };
}

export async function printDesktopHtml(payload: DesktopPrintPayload): Promise<DesktopPrintSummary> {
  const raw = await invokeDesktop<{ queued: boolean; file_path?: string; queued_at_iso?: string }>('desktop_print_html', {
    title: payload.title,
    html: payload.html,
    source: payload.source || 'web',
  });
  return {
    queued: raw.queued,
    filePath: raw.file_path,
    queuedAtISO: raw.queued_at_iso,
  };
}

export async function pickDesktopBackupFile(): Promise<DesktopFileSelection> {
  const raw = await invokeDesktop<{ cancelled: boolean; file_path?: string }>('desktop_pick_backup_file');
  return {
    cancelled: raw.cancelled,
    filePath: raw.file_path,
  };
}
