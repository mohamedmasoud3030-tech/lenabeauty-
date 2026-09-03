import { describe, expect, it } from 'vitest';
import { desktopShellConfig, isDesktopShell } from '../desktop/config';

describe('desktop foundation helpers', () => {
  it('reports prototype capabilities truthfully', () => {
    expect(desktopShellConfig.bundleId).toBe('com.lenabeauty.desktop');
    expect(desktopShellConfig.capabilities.sqliteReady).toBe(false);
    expect(desktopShellConfig.capabilities.offlineFirst).toBe(false);
    expect(desktopShellConfig.capabilities.autoUpdaterReady).toBe(false);
  });

  it('detects non-tauri environment in browser tests', () => {
    expect(isDesktopShell()).toBe(false);
  });
});
