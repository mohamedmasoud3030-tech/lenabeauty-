import { createUnsupportedReadError, createUnsupportedWriteError } from '../infrastructure/supabase/errors';
import { exportDesktopBackup, getDesktopDatabaseHealth, importDesktopBackup, pickDesktopBackupFile, printDesktopHtml } from './sqlite';

export const desktopRepository = {
  getHealth: async () => {
    try {
      return { ok: true as const, data: await getDesktopDatabaseHealth() };
    } catch {
      return { ok: false as const, error: createUnsupportedReadError('Desktop.getHealth') };
    }
  },
  exportBackup: async () => {
    try {
      return { ok: true as const, data: await exportDesktopBackup(true) };
    } catch {
      return { ok: false as const, error: createUnsupportedWriteError('Desktop.exportBackup') };
    }
  },
  pickBackupFile: async () => {
    try {
      return { ok: true as const, data: await pickDesktopBackupFile() };
    } catch {
      return { ok: false as const, error: createUnsupportedReadError('Desktop.pickBackupFile') };
    }
  },
  importBackup: async (filePath: string) => {
    try {
      return { ok: true as const, data: await importDesktopBackup(filePath) };
    } catch {
      return { ok: false as const, error: createUnsupportedWriteError('Desktop.importBackup') };
    }
  },
  printHtml: async (title: string, html: string, source = 'web') => {
    try {
      return { ok: true as const, data: await printDesktopHtml({ title, html, source }) };
    } catch {
      return { ok: false as const, error: createUnsupportedWriteError('Desktop.printHtml') };
    }
  },
};
