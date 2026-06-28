import { MonitorSmartphone, HardDriveDownload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { desktopShellConfig, isDesktopShell } from '../../desktop/config';

export function DesktopShellBanner() {
  const { t } = useTranslation();
  if (isDesktopShell()) return null;

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <MonitorSmartphone className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="font-bold">{t('Desktop shell ready')}</p>
          <p className="text-muted-foreground">
            {t('The Tauri desktop foundation is prepared with offline-first and SQLite-ready architecture.')}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <HardDriveDownload className="h-4 w-4" />
            <span>{desktopShellConfig.productName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
