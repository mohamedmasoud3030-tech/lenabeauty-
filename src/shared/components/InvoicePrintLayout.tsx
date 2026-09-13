import React from "react";
import { useTranslation } from "react-i18next";
import { InvoicePrintData } from "../../application/dto";
import { clsx } from "clsx";
import { QRCodeSVG as QRCode } from "qrcode.react";
import brandingService from "../../infrastructure/services/brandingService";
import { formatOMRAmount } from "../money";
import { formatSalonDate, formatSalonTime } from "../dateTime";
import { getDisplayName } from "../displayName";


export type InvoicePrintFormat = "a4-premium" | "a4-luxe" | "thermal-80" | "thermal-58";

interface Props {
  data: InvoicePrintData;
  onClose?: () => void;
  /** Paper/style. Thermal 80mm stays the default for backward compatibility
      (direct consumers); the preview modal selects A4 premium itself. */
  format?: InvoicePrintFormat;
  /** When rendered inside a shared Modal, the overlay provides Print/Close. */
  hideControls?: boolean;
}

export const InvoicePrintLayout: React.FC<Props> = ({ data, onClose, format = "thermal-80", hideControls = false }) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const { invoice, items, customer, settings } = data;

  // The persisted checkout breakdown is authoritative. The item sum is only a
  // compatibility fallback for invoices created before subtotal_amount existed.
  const itemSubtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const subtotal = invoice.subtotalAmount > 0 ? invoice.subtotalAmount : itemSubtotal;
  const manualDiscount = invoice.manualDiscount || 0;
  const tierDiscount = invoice.tierDiscount || 0;
  const loyaltyDiscount = invoice.loyaltyDiscount || 0;
  const giftCardDiscount = invoice.giftCardDiscount || 0;
  const tax = invoice.tax || 0;
  const total = invoice.totalAmount;

  const salonName = (isRtl ? settings?.displayNameAr : settings?.displayName)
    || settings?.name
    || brandingService.getSalonName(isRtl);
  const salonAddress = settings?.address || brandingService.getAddress(isRtl);
  const salonPhone = settings?.phone || brandingService.getSetting("phone");
  const taxNumber = settings?.brandTaxNumber || brandingService.getSetting("taxNumber");
  const receiptLogo = settings?.brandLogoBase64 || settings?.logoPath;
  // The footer is the fixed developer credit (src/config/brand.ts): stored
  // center values are deliberately not applied, so the attribution is the
  // same on every deployment and can never be rewritten by a customer.
  const footerText = brandingService.getFooterText(isRtl);
  const currency = settings?.currency || "OMR";
  const paymentKey = ({ cash: "Cash", card: "Card", transfer: "Transfer" } as const)[
    invoice.paymentMethod.toLowerCase() as "cash" | "card" | "transfer"
  ] || invoice.paymentMethod;
  const serial = invoice.serialNumber || invoice.id.slice(0, 8).toUpperCase();

  const qrData = JSON.stringify({ id: invoice.id, date: invoice.date, amount: total, salon: salonName });
  const isA4 = format === "a4-premium" || format === "a4-luxe";
  const isLuxe = format === "a4-luxe";
  const paperSize = format === "thermal-58" ? "58mm" : "80mm";
  const paperPadding = format === "thermal-58" ? "2mm" : "4mm";

  // Printing the current document is more reliable on mobile than a popup.
  // Global print CSS isolates this receipt from navigation and modal chrome;
  // the component owns the @page size for the selected format.
  const handlePrint = () => window.print();

  const printCss = isA4
    ? `@media print { @page { size: A4; margin: 0; } }`
    : `@media print {
        @page { size: auto; margin: 0; }
        #invoice-print-container {
          width: ${paperSize} !important;
          margin: 0 !important;
          padding: ${paperPadding} !important;
          box-sizing: border-box !important;
          page-break-after: avoid !important;
        }
      }`;

  const signature = (
    <div className="lena-receipt-signature" aria-label={salonName}>
      {receiptLogo
        ? <img src={receiptLogo} alt="" aria-hidden="true" />
        : <img src="/lena-mark.svg" alt="" aria-hidden="true" />}
      <span>{salonName.toLocaleUpperCase()}</span>
    </div>
  );

  const totalRows: { label: string; value: string; kind?: "disc" }[] = [
    { label: t("Subtotal"), value: formatOMRAmount(subtotal) },
  ];
  if (manualDiscount > 0) totalRows.push({ label: t("Discount"), value: `-${formatOMRAmount(manualDiscount)}`, kind: "disc" });
  if (tierDiscount > 0) totalRows.push({ label: t("Tier Discount"), value: `-${formatOMRAmount(tierDiscount)}`, kind: "disc" });
  if (loyaltyDiscount > 0) totalRows.push({ label: t("Loyalty Points"), value: `-${formatOMRAmount(loyaltyDiscount)}`, kind: "disc" });
  if (giftCardDiscount > 0) totalRows.push({ label: t("Gift Card Redemption"), value: `-${formatOMRAmount(giftCardDiscount)}`, kind: "disc" });
  if (tax > 0) totalRows.push({ label: `${t("Tax")}${invoice.taxRate !== undefined ? ` (${invoice.taxRate}%)` : ""}`, value: `+${formatOMRAmount(tax)}` });

  /* ---------- A4 premium / luxe ---------- */
  if (isA4) {
    return (
      <div className="space-y-4">
        <div
          id="invoice-print-container"
          className={clsx("lb-sheet lb-a4", isLuxe && "lb-luxe")}
          dir={isRtl ? "rtl" : "ltr"}
        >
          <div className="lb-topline" aria-hidden="true" />
          <div className="lb-head">
            <div className="lb-brand">
              <div className="lb-mark" aria-hidden="true">
                {receiptLogo ? <img src={receiptLogo} alt="" /> : <span className="lb-mark-fallback">✦</span>}
              </div>
              <div>
                <div className="lb-name">{salonName}</div>
                <div className="lb-sub">{t("Beauty Center")}</div>
              </div>
            </div>
            <div className="lb-contact">
              {salonAddress && <b>{salonAddress}</b>}
              {salonPhone && <div>{t("Tel")}: {salonPhone}</div>}
              {taxNumber && <div>{t("Tax ID")}: {taxNumber}</div>}
            </div>
          </div>
          {isLuxe && <div className="lb-goldhair" aria-hidden="true" />}

          <div className="lb-body">
            <div className="lb-docrow">
              <span className="lb-doctitle">{t("Simple Tax Invoice")}</span>
              <span className="lb-docno">{t("Invoice")}: {serial}</span>
            </div>

            <div className="lb-infogrid">
              <div className="lb-info"><small>{t("Date")}</small><b>{formatSalonDate(invoice.date, i18n.language)}</b></div>
              <div className="lb-info"><small>{t("Time")}</small><b>{formatSalonTime(invoice.date, i18n.language)}</b></div>
              <div className="lb-info"><small>{t("Cashier")}</small><b>{invoice.staffName ? getDisplayName(invoice.staffName, t("Unnamed")) : "—"}</b></div>
              <div className="lb-info"><small>{t("Customer")}</small><b>{customer ? getDisplayName(customer.name, t("Unnamed")) : t("Walk-in")}</b></div>
            </div>

            <table className="lb-items">
              <thead>
                <tr>
                  <th style={{ width: "42%" }}>{t("Description")}</th>
                  <th style={{ width: "12%", textAlign: "center" }}>{t("Qty")}</th>
                  <th style={{ width: "23%", textAlign: "left" }}>{t("Price")}</th>
                  <th style={{ width: "23%", textAlign: "left" }}>{t("Total")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <b>{item.name}</b>
                      {item.type === "package" && <div className="lb-item-sub">{t("Package")}</div>}
                      {item.type === "product" && <div className="lb-item-sub">{t("Product")}</div>}
                    </td>
                    <td className="lb-num" style={{ textAlign: "center" }}>{item.qty}</td>
                    <td className="lb-num" style={{ textAlign: "left" }}>{formatOMRAmount(item.price)}</td>
                    <td className="lb-num" style={{ textAlign: "left" }}><b>{formatOMRAmount(item.price * item.qty)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="lb-totals">
              {totalRows.map((row) => (
                <div key={row.label} className={clsx("lb-total-row", row.kind === "disc" && "lb-total-disc")}>
                  <span>{row.label}</span>
                  <span className="lb-num">{row.value}</span>
                </div>
              ))}
              <div className="lb-grand">
                <span>{t("Grand Total")}</span>
                <span className="lb-num">{formatOMRAmount(total)} {currency}</span>
              </div>
            </div>

            {invoice.paymentMethod ? (
              <div className="lb-total-row" style={{ padding: "7px 2px", fontSize: "9.5px" }}>
                <span style={{ color: "var(--lb-muted)" }}>{t("Payment")}</span>
                <b>{t(paymentKey)}</b>
              </div>
            ) : null}

            <div className="lb-bottom">
              <div className="lb-qr">
                <QRCode value={qrData} size={68} level="M" includeMargin={false} />
                <small>{t("Scan to verify this invoice")}</small>
              </div>
              <div className="lb-sign"><div className="lb-sign-line">{t("Cashier Signature")}</div></div>
              <div className="lb-sign"><div className="lb-sign-line">{t("Customer Signature")}</div></div>
            </div>

            {signature}

            <div className="lb-footband">
              <span className="lb-thanks">{t("Thank you for your visit")}</span>
              {salonPhone ? <span dir="ltr">{salonPhone}</span> : null}
              <span>{footerText}</span>
            </div>
          </div>

          <style dangerouslySetInnerHTML={{ __html: printCss }} />
        </div>

        {!hideControls && (
          <>
            <div className="print:hidden flex gap-3 justify-center mt-6">
              <button onClick={handlePrint} className="min-h-11 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm uppercase tracking-widest shadow-sm transition-colors">
                {t("Print Invoice")}
              </button>
              {onClose && (
                <button onClick={onClose} className="min-h-11 px-6 py-2.5 rounded-lg border border-border text-foreground font-bold text-sm uppercase tracking-widest hover:bg-muted transition-colors">
                  {t("Close")}
                </button>
              )}
            </div>
            <div className="print:hidden status-info rounded-lg p-3 text-xs text-center">
              <p className="font-bold mb-1">{t("Print Tips")}</p>
              <p>{t("Enable background graphics in the print dialog for full colors.")}</p>
            </div>
          </>
        )}
      </div>
    );
  }

  /* ---------- Refined thermal (80mm / 58mm) ---------- */
  return (
    <div className="space-y-4">
      <div
        id="invoice-print-container"
        className={clsx("bg-white text-black font-mono print:m-0", isRtl ? "text-right" : "text-left")}
        style={{
          width: paperSize,
          margin: "0 auto",
          padding: paperPadding,
          fontSize: "11px",
          lineHeight: "1.3",
          direction: isRtl ? "rtl" : "ltr",
        }}
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div style={{ textAlign: "center" }}>
          {receiptLogo && (
            <img src={receiptLogo} alt="" aria-hidden="true" className="h-12 mx-auto mb-1 object-contain" style={{ maxWidth: "100%" }} />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#111" }} aria-hidden="true">
            <span style={{ flex: 1, borderTop: "1.5px solid #111" }} />
            <span style={{ fontSize: 10 }}>✦</span>
            <span style={{ flex: 1, borderTop: "1px solid #111" }} />
          </div>
          <h1 className="font-bold" style={{ fontSize: 14, letterSpacing: "0.12em", fontFamily: 'Georgia, "Times New Roman", serif' }}>
            {salonName.toLocaleUpperCase()}
          </h1>
          <p style={{ fontSize: 7.5, letterSpacing: "0.3em", color: "#333" }}>{t("Beauty Center")}</p>
          <div style={{ borderTop: "1.5px solid #111", borderBottom: "1px solid #111", height: 4, margin: "7px 0" }} aria-hidden="true" />
          {salonAddress && <p className="text-[8px] opacity-80">{salonAddress}</p>}
          {salonPhone && (
            <p className="text-[8px] opacity-80" dir="ltr" style={{ textAlign: "center" }}>
              {salonPhone}{taxNumber ? ` · ${t("Tax ID")}: ${taxNumber}` : ""}
            </p>
          )}
          {!salonPhone && taxNumber && (
            <p className="text-[8px] opacity-80" dir="ltr" style={{ textAlign: "center" }}>{t("Tax ID")}: {taxNumber}</p>
          )}
        </div>

        {/* Invoice meta */}
        <div style={{ fontSize: 10, marginTop: 6 }}>
          <div className="flex justify-between">
            <span className="font-bold" dir="ltr">{t("Invoice")}: {serial}</span>
            <span>{formatSalonDate(invoice.date, i18n.language)}</span>
          </div>
          <div className="flex justify-between text-[8.5px] opacity-75">
            <span>{formatSalonTime(invoice.date, i18n.language)}</span>
            <span>{invoice.staffName ? `${t("Staff")}: ${getDisplayName(invoice.staffName, t("Unnamed"))}` : "\u00A0"}</span>
          </div>
          {customer && (
            <div className="flex justify-between text-[8.5px] opacity-75">
              <span>{t("Customer")}</span>
              <span className="font-bold">{getDisplayName(customer.name, t("Unnamed"))}</span>
            </div>
          )}
        </div>

        {/* Items table */}
        <table className="w-full text-[10px] mt-1 border-collapse">
          <thead>
            <tr style={{ borderBottom: "1.5px solid #111" }} className="text-[7.5px] uppercase tracking-wider font-bold">
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
                  <p className="text-[7.5px] opacity-60">
                    {formatOMRAmount(item.price)} {currency} × {item.qty}
                  </p>
                </td>
                <td className="py-1 text-center font-bold">{item.qty}</td>
                <td className={clsx("py-1 font-bold", isRtl ? "text-left" : "text-right")}>
                  {formatOMRAmount(item.price * item.qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ borderTop: "1.5px solid #111", borderBottom: "1.5px solid #111", padding: "6px 0", margin: "7px 0" }} className="text-[10px]">
          {totalRows.map((row) => (
            <div key={row.label} className="flex justify-between" style={{ padding: "1.5px 0", fontSize: row.kind === "disc" ? 9 : 10, opacity: row.kind === "disc" ? 0.85 : 1 }}>
              <span>{row.label}:</span>
              <span className={row.kind === "disc" ? "font-semibold" : "font-bold"}>{row.value}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold pt-1" style={{ fontSize: 13, borderTop: "1px solid #111" }}>
            <span>{t("Grand Total")}:</span>
            <span>{formatOMRAmount(total)} {currency}</span>
          </div>
        </div>

        {/* Payment */}
        {invoice.paymentMethod && (
          <div className="text-center text-[9px] mb-1 pb-1 border-b border-gray-300">
            <p className="opacity-75">{t("Payment")}: {t(paymentKey)}</p>
          </div>
        )}

        {/* QR */}
        <div className="flex justify-center mt-1">
          <div>
            <QRCode value={qrData} size={60} level="M" includeMargin={false} />
            <p className="text-[7px] opacity-60 mt-1">{t("Scan to verify this invoice")}</p>
          </div>
        </div>

        <div style={{ borderTop: "1.5px solid #111", borderBottom: "1px solid #111", height: 4, margin: "7px 0" }} aria-hidden="true" />
        <div className="text-center">
          <p style={{ fontSize: 9, letterSpacing: "0.14em", fontWeight: 700 }}>{t("Thank you for your visit")}</p>
          <p className="text-[7.5px] opacity-70 mt-0.5" dir="ltr">{salonPhone}</p>
          <p className="text-[7px] opacity-50 mt-1">{t("Invoice ID")}: {invoice.id.slice(0, 12)}</p>
          <p className="text-[7px] opacity-50">{footerText}</p>
        </div>

        {/* Signature: the salon's own mark once it has one, otherwise the
            product mark. The salon is the party issuing this receipt, so its
            identity wins here; the developer attribution stays in the footer
            text above instead. */}
        {signature}

        <style dangerouslySetInnerHTML={{ __html: printCss }} />
      </div>

      {/* Screen-only Controls — hidden when the shared Modal provides them */}
      {!hideControls && (
        <>
          <div className="print:hidden flex gap-3 justify-center mt-6">
            <button
              onClick={handlePrint}
              className="min-h-11 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm uppercase tracking-widest shadow-sm transition-colors"
            >
              {t("Print Invoice")}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="min-h-11 px-6 py-2.5 rounded-lg border border-border text-foreground font-bold text-sm uppercase tracking-widest hover:bg-muted transition-colors"
              >
                {t("Close")}
              </button>
            )}
          </div>

          {/* Print Preview Info */}
          <div className="print:hidden status-info rounded-lg p-3 text-xs text-center">
            <p className="font-bold mb-1">{t("Print Tips")}</p>
            <p>
              {t("Use thermal printer 80mm or 58mm for best results. Adjust margins in print settings if needed.")}
            </p>
          </div>
        </>
      )}
    </div>
  );
};
