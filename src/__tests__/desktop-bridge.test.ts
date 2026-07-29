import { describe, expect, it } from 'vitest';
import { clearDesktopDraft, loadDesktopDraft, saveDesktopDraft } from '../desktop/storage';
import { desktopShellConfig, isDesktopShell } from '../desktop/config';

describe('desktop foundation helpers', () => {
  it('exposes sqlite-ready desktop config', () => {
    expect(desktopShellConfig.bundleId).toBe('com.lenabeauty.desktop');
    expect(desktopShellConfig.capabilities.sqliteReady).toBe(true);
    expect(desktopShellConfig.capabilities.offlineFirst).toBe(true);
  });

  it('persists desktop drafts in localStorage', () => {
    saveDesktopDraft('invoice', { total: 25 });
    expect(loadDesktopDraft<{ total: number }>('invoice')?.total).toBe(25);
    clearDesktopDraft('invoice');
    expect(loadDesktopDraft('invoice')).toBeNull();
  });

  it('detects non-tauri environment in browser tests', () => {
    expect(isDesktopShell()).toBe(false);
  });
});
