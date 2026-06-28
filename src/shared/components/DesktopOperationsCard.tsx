import { useState } from 'react';
import { HardDriveDownload, HardDriveUpload, Printer, DatabaseZap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { desktopRepository } from '../../desktop/repository';
import { useToast } from './Toast';
import { isDesktopShell } from '../../desktop/config';

export function DesktopOperationsCard() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [healthPath, setHealthPath] = useState<string | null>(null);

  async function handleHealth() {
    setBusy(true);
    const res = await desktopRepository.getHealth();
    setBusy(false);
    if (!res.ok) return showToast('error', t('Error'), t('Desktop SQLite bridge is only available inside the Tauri shell'));
    setHealthPath(res.data.path);
    showToast('success', t('Success'), `${t('Desktop database ready')}: ${res.data.path}`);
  }

  async function handleExport() {
    setBusy(true);
    const res = await desktopRepository.exportBackup();
    setBusy(false);
    if (!res.ok) return showToast('error', t('Error'), t('Desktop backup export is only available inside the Tauri shell'));
    showToast('success', t('Success'), `${t('Desktop backup exported')}: ${res.data.filePath}`);
  }

  async function handleImport() {
    setBusy(true);
    const res = await desktopRepository.importBackup('manual-selection-required');
    setBusy(false);
    if (!res.ok) return showToast('error', t('Error'), t('Desktop backup restore requires the Tauri shell file picker'));
    showToast('success', t('Success'), t('Desktop backup restored successfully'));
  }

  async function handlePrint() {
    setBusy(true);
    const res = await desktopRepository.printHtml('LenaBeauty Print Test', '<html><body><h1>LenaBeauty Desktop Print</h1><p>Print bridge ready.</p></body></html>');
    setBusy(false);
    if (!res.ok) return showToast('error', t('Error'), t('Desktop printing is only available inside the Tauri shell'));
    showToast('success', t('Success'), t('Desktop print job queued successfully'));
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-3">
        <DatabaseZap className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-bold">{t('Desktop Operations')}</h3>
          <p className="text-xs text-muted-foreground">
            {isDesktopShell()
              ? t('SQLite, backup, restore, and print bridges are active in desktop mode.')
              : t('Desktop actions will activate automatically when the app runs inside Tauri.')}
          </p>
          {healthPath && <p className="mt-1 text-[10px] text-muted-foreground" dir="ltr">{healthPath}</p>}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <button disabled={busy} onClick={handleHealth} className="rounded-xl border border-border px-3 py-2 text-sm font-bold flex items-center justify-center gap-2">
          <DatabaseZap className="h-4 w-4" /> {t('Check Desktop DB')}
        </button>
        <button disabled={busy} onClick={handleExport} className="rounded-xl border border-border px-3 py-2 text-sm font-bold flex items-center justify-center gap-2">
          <HardDriveDownload className="h-4 w-4" /> {t('Export Desktop Backup')}
        </button>
        <button disabled={busy} onClick={handleImport} className="rounded-xl border border-border px-3 py-2 text-sm font-bold flex items-center justify-center gap-2">
          <HardDriveUpload className="h-4 w-4" /> {t('Restore Desktop Backup')}
        </button>
        <button disabled={busy} onClick={handlePrint} className="rounded-xl border border-border px-3 py-2 text-sm font-bold flex items-center justify-center gap-2">
          <Printer className="h-4 w-4" /> {t('Desktop Print Test')}
        </button>
      </div>
    </div>
  );
}
