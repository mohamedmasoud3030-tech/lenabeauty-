import { useTranslation } from "react-i18next";
import { Printer, X } from "lucide-react";
import { Modal } from "./Modal";
import { InvoicePrintLayout } from "./InvoicePrintLayout";
import { InvoicePrintData } from "../../application/dto";

interface Props {
  data: InvoicePrintData | null;
  onClose: () => void;
  paperSize?: "80mm" | "58mm";
}

/**
 * Shared receipt preview overlay used by both POS checkout and the
 * customer / sales-history reprint path, so the on-screen preview and the
 * printed output always come from one 80mm implementation.
 *
 * Opens above all app chrome (portaled Modal), scrolls inside the body, and
 * keeps Print + Close in a sticky footer above the mobile keyboard and bottom
 * navigation. Printing uses the global print CSS which isolates
 * #invoice-print-container, so only the thermal receipt is printed.
 */
export function ReceiptPreviewModal({ data, onClose, paperSize = "80mm" }: Props) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={!!data}
      onClose={onClose}
      title={t("Invoice")}
      size="md"
      className="bg-white"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 rounded-lg border border-border bg-card font-bold text-foreground hover:bg-muted transition-all flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            {t("Close")}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-11 px-4 rounded-lg bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            {t("Print Invoice")}
          </button>
        </div>
      }
    >
      {data && <InvoicePrintLayout data={data} hideControls paperSize={paperSize} />}
    </Modal>
  );
}
