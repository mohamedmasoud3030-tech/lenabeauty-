import { useTranslation } from "react-i18next";
import { Printer, X, Share2, Download } from "lucide-react";
import { Modal } from "./Modal";
import { InvoicePrintLayout } from "./InvoicePrintLayout";
import { InvoicePrintData } from "../../application/dto";
import { clsx } from "clsx";
import { formatOMRAmount } from "../money";

interface Props {
  data: InvoicePrintData | null;
  onClose: () => void;
  paperSize?: "80mm" | "58mm";
}

/**
 * Shared receipt preview overlay - mobile optimized with Print, Share, and Download options.
 * Opens above all app chrome, scrolls inside the body, and keeps actions in a sticky footer.
 */
export function ReceiptPreviewModal({ data, onClose, paperSize = "80mm" }: Props) {
  const { t } = useTranslation();

  const handleShare = async () => {
    if (!data || !navigator.share) return;
    try {
      await navigator.share({
        title: t("Invoice"),
        text: `${t("Invoice")} ${data.invoice.id?.slice(-6).toUpperCase() || ''} - ${formatOMRAmount(data.invoice.totalAmount)}`,
        url: window.location.href,
      });
    } catch (err) {
      // User cancelled or share failed
    }
  };

  const handleDownload = () => {
    if (!data) return;
    // Create a simple text receipt for sharing
    const receiptText = [
      `=== ${data.settings?.name || 'LenaBeauty'} ===`,
      `${t("Invoice")}: ${data.invoice.id?.slice(-6).toUpperCase() || ''}`,
      `Date: ${new Date(data.invoice.date).toLocaleString()}`,
      '---',
      ...(data.items?.map(item => 
        `${item.name || 'Item'}`.padEnd(20) + 
        formatOMRAmount(item.price).padStart(10)
      ) || []),
      '---',
      `${t("Total")}: ${formatOMRAmount(data.invoice.totalAmount)}`,
      `${t("Payment")}: ${data.invoice.paymentMethod?.toUpperCase() || 'N/A'}`,
    ].join('\n');

    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt_${data.invoice.id?.slice(-6) || Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      isOpen={!!data}
      onClose={onClose}
      title={t("Invoice")}
      size="md"
      className="bg-white"
      footer={
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleDownload}
            aria-label={t("Save")}
            className="flex-1 min-w-0 h-11 px-2 sm:px-4 rounded-xl border border-border bg-card font-bold text-sm text-foreground hover:bg-muted transition-all flex items-center justify-center gap-2 touch-target"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{t("Save")}</span>
          </button>
          {'share' in navigator && (
            <button
              type="button"
              onClick={handleShare}
              aria-label={t("Share")}
              className="flex-1 min-w-0 h-11 px-2 sm:px-4 rounded-xl border border-border bg-card font-bold text-sm text-foreground hover:bg-muted transition-all flex items-center justify-center gap-2 touch-target"
            >
              <Share2 className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{t("Share")}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            aria-label={t("Print Invoice")}
            className="flex-1 min-w-0 h-11 px-2 sm:px-4 rounded-xl bg-primary font-bold text-sm text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2 touch-target"
          >
            <Printer className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{t("Print")}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className="h-11 w-11 shrink-0 rounded-xl border border-border bg-card font-bold text-sm text-foreground hover:bg-muted transition-all flex items-center justify-center touch-target"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      }
    >
      {data && <InvoicePrintLayout data={data} hideControls paperSize={paperSize} />}
    </Modal>
  );
}
