import { desktopRepository } from './repository';

export async function openDesktopBackupPicker(): Promise<string | null> {
  const res = await desktopRepository.pickBackupFile();
  if (!res.ok) return null;
  if (res.data.cancelled) return null;
  return res.data.filePath || null;
}

export async function queueDesktopInvoicePrint(title: string, html: string): Promise<boolean> {
  const res = await desktopRepository.printHtml(title, html, 'invoice');
  return res.ok ? res.data.queued : false;
}
