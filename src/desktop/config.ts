export interface DesktopShellConfig {
  productName: string;
  bundleId: string;
  defaultWindow: {
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    resizable: boolean;
    fullscreen: boolean;
  };
  capabilities: {
    offlineFirst: boolean;
    localDraftStorage: boolean;
    desktopShortcuts: boolean;
    deepLinksReady: boolean;
    autoUpdaterReady: boolean;
    sqliteReady: boolean;
  };
}

export const desktopShellConfig: DesktopShellConfig = {
  productName: 'LenaBeauty Desktop',
  bundleId: 'com.lenabeauty.desktop',
  defaultWindow: {
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 800,
    resizable: true,
    fullscreen: false,
  },
  capabilities: {
    offlineFirst: true,
    localDraftStorage: true,
    desktopShortcuts: true,
    deepLinksReady: true,
    autoUpdaterReady: false,
    sqliteReady: true,
  },
};

export function isDesktopShell(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}
