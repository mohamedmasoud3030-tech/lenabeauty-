import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { InvoicePrintData } from "../../application/dto";
import { clsx } from "clsx";
import { QRCodeSVG as QRCode } from "qrcode.react";
import brandingService from "../../infrastructure/services/brandingService";

interface Props {
  data: InvoicePrintData;
  onClose?: () => void;
  paperSize?: "80mm" | "58mm";
}

export const InvoicePrintLayout: React.FC<Props> = ({ data, onClose, paperSize = "80mm" }) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const printRef = useRef<HTMLDivElement>(null);

  const { invoice, items, customer, settings } = data;

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discount = invoice.discount || 0;
  const tax = invoice.tax || 0;
  const total = invoice.totalAmount || (subtotal - discount + tax);

  // Generate QR code data (invoice details)
  const qrData = JSON.stringify({
    id: invoice.id,
    date: invoice.date,
    amount: total,
    salon: settings?.name,
  });

  const paperWidth = paperSize === "80mm" ? "80mm" : "58mm";
  const paperPadding = paperSize === "80mm" ? "4mm" : "2mm";

  const handlePrint = () => {
    const printWindow = window.open("", "", "height=600,width=800");
    if (printWindow && printRef.current) {
      printWindow.document.write(printRef.current.innerHTML);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-4">
      {/* Preview Container */}
      <div 
        ref={printRef}
        id="invoice-print-container"
        className={clsx(
          "bg-white text-black font-mono print:m-0",
          isRtl ? "text-right" : "text-left"
        )}
        style={{
          width: paperWidth,
          margin: "0 auto",
          padding: paperPadding,
          fontSize: "11px",
          lineHeight: "1.2",
          direction: isRtl ? "rtl" : "ltr",
        }}
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Header with Logo */}
        <div className="text-center mb-3 border-b border-black pb-2">
          {settings?.logoPath && (
            <img 
              src={settings.logoPath} 
              alt="Logo" 
              className="h-12 mx-auto mb-1 object-contain"
              style={{ maxWidth: "100%" }}
            />
          )}
          <div className="text-center">
            <h1 className="font-bold text-sm uppercase tracking-tight">
              {brandingService.getSalonName(isRtl)}
            </h1>
            <p className="text-[9px] opacity-80 mt-0.5">
              {brandingService.getAddress(isRtl)}
            </p>
            <p className="text-[9px] opacity-80">
              {t("Tel")}: {brandingService.getSetting('phone')}
            </p>
            <p className="text-[9px] opacity-80">
              {t("Tax ID")}: {brandingService.getSetting('taxNumber')}
            </p>
          </div>
        </div>

        {/* Invoice Header */}
        <div className="mb-2 text-[10px]">
          <div className="flex justify-between mb-1">
            <span className="font-bold">
              {t("Invoice")}: {invoice.serialNumber || invoice.id.slice(0, 8).toUpperCase()}
            </span>
            <span>
              {new Date(invoice.date).toLocaleDateString(i18n.language === "ar" ? "ar-SA" : "en-US")}
            </span>
          </div>
          <div className="flex justify-between text-[9px] opacity-70">
            <span>
              {new Date(invoice.date).toLocaleTimeString(i18n.language === "ar" ? "ar-SA" : "en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span>{t("Staff")}: {invoice.staffName || "—"}</span>
          </div>
        </div>

        {/* Customer Info */}
        {customer && (
          <div className="mb-2 pb-2 border-b border-gray-300 text-[10px]">
            <p className="font-bold uppercase text-[8px] opacity-50 mb-0.5">{t("Customer")}</p>
            <p className="font-bold">{customer.name}</p>
            {customer.phone && <p className="text-[9px] opacity-70">{customer.phone}</p>}
          </div>
        )}

        {/* Items Table */}
        <table className="w-full text-[10px] mb-2 border-collapse">
          <thead>
            <tr className="border-b border-black text-[8px] uppercase tracking-wider font-bold pb-1">
              <th className={clsx("py-1", isRtl ? "text-right" : "text-left")} style={{ width: "50%" }}>
                {t("Description")}
              </th>
              <th className="py-1 text-center" style={{ width: "15%" }}>
                {t("Qty")}
              </th>
              <th className={clsx("py-1", isRtl ? "text-left" : "text-right")} style={{ width: "35%" }}>
                {t("Total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200 last:border-0">
                <td className="py-1 leading-tight">
                  <p className="font-bold break-words">{item.name}</p>
                  <p className="text-[8px] opacity-60">
                    {item.price.toFixed(3)} {settings?.currency || "OMR"} × {item.qty}
                  </p>
                </td>
                <td className="py-1 text-center font-bold">{item.qty}</td>
                <td className={clsx("py-1 font-bold", isRtl ? "text-left" : "text-right")}>
                  {(item.price * item.qty).toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals Section */}
        <div className="border-t-2 border-b border-black py-1.5 mb-2 space-y-0.5 text-[10px]">
          <div className="flex justify-between">
            <span>{t("Subtotal")}:</span>
            <span className="font-bold">{subtotal.toFixed(3)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-[9px] opacity-80">
              <span>{t("Discount")}:</span>
              <span>-{discount.toFixed(3)}</span>
            </div>
          )}

          {tax > 0 && (
            <div className="flex justify-between text-[9px] opacity-80">
              <span>{t("Tax")}:</span>
              <span>+{tax.toFixed(3)}</span>
            </div>
          )}

          {invoice.loyaltyPointsUsed > 0 && (
            <div className="flex justify-between text-[9px] opacity-80">
              <span>{t("Loyalty Points")}:</span>
              <span>-{invoice.loyaltyPointsUsed}</span>
            </div>
          )}

          <div className="flex justify-between font-bold text-sm border-t border-black pt-1">
            <span>{t("Grand Total")}:</span>
            <span>{total.toFixed(3)} {settings?.currency || "OMR"}</span>
          </div>
        </div>

        {/* Payment Method */}
        {invoice.paymentMethod && (
          <div className="text-center text-[9px] mb-2 pb-2 border-b border-gray-300">
            <p className="opacity-70">
              {t("Payment")}: {invoice.paymentMethod}
            </p>
          </div>
        )}

        {/* QR Code */}
        <div className="flex justify-center my-2 py-2 border-b border-gray-300">
          <div style={{ width: "60px", height: "60px" }}>
            <QRCode
              value={qrData}
              size={60}
              level="L"
              includeMargin={false}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[8px] space-y-1 mt-2">
          <p className="uppercase tracking-wider font-bold">
            {t("Thank you for your visit")}
          </p>
          <p className="opacity-60">
            {brandingService.getSalonName(isRtl)}
          </p>
          <p className="text-[7px] opacity-50 mt-1">
            {t("Invoice ID")}: {invoice.id.slice(0, 12)}
          </p>
          <p className="text-[7px] opacity-50">
            {brandingService.getFooterText(isRtl)}
          </p>
        </div>

        {/* Print Styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            * {
              margin: 0 !important;
              padding: 0 !important;
              box-sizing: border-box !important;
            }
            body {
              width: ${paperWidth} !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            #invoice-print-container {
              width: ${paperWidth} !important;
              margin: 0 !important;
              padding: ${paperPadding} !important;
              page-break-after: avoid !important;
            }
            @page {
              size: ${paperWidth} auto;
              margin: 0;
              padding: 0;
            }
          }
          @media print and (max-width: 100mm) {
            body {
              font-size: 10px !important;
            }
          }
        `}} />
      </div>

      {/* Screen-only Controls */}
      <div className="print:hidden flex gap-3 justify-center mt-6">
        <button 
          onClick={handlePrint}
          className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm uppercase tracking-widest shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
        >
          🖨️ {t("Print Invoice")}
        </button>
        {onClose && (
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg border-2 border-border text-foreground font-bold text-sm uppercase tracking-widest hover:bg-muted transition-all"
          >
            ✕ {t("Close")}
          </button>
        )}
      </div>

      {/* Print Preview Info */}
      <div className="print:hidden bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 text-center">
        <p className="font-bold mb-1">💡 {t("Print Tips")}</p>
        <p>
          {t("Use thermal printer 80mm or 58mm for best results. Adjust margins in print settings if needed.")}
        </p>
      </div>
    </div>
  );
};
