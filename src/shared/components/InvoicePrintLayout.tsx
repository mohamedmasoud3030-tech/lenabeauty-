import React from "react";
import { useTranslation } from "react-i18next";
import { InvoicePrintData } from "../../application/dto";
import { clsx } from "clsx";

interface Props {
  data: InvoicePrintData;
  onClose?: () => void;
}

export const InvoicePrintLayout: React.FC<Props> = ({ data, onClose }) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  const { invoice, items, customer, settings } = data;

  return (
    <div 
      className={clsx(
        "bg-white text-black p-4 sm:p-8 max-w-[80mm] mx-auto print:max-w-none print:m-0 print:p-4",
        isRtl ? "text-right" : "text-left"
      )}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="text-center mb-6">
        {settings?.logoPath && (
          <img 
            src={settings.logoPath} 
            alt="Logo" 
            className="h-16 mx-auto mb-2 object-contain"
          />
        )}
        <h1 className="text-xl font-bold uppercase tracking-tighter">{settings?.name || "KANZY SPA"}</h1>
        {settings?.address && <p className="text-[10px] mt-1">{settings.address}</p>}
        {settings?.phone && <p className="text-[10px]">{t("Phone")}: {settings.phone}</p>}
        {settings?.cr && <p className="text-[10px]">{t("CR")}: {settings.cr}</p>}
      </div>

      <div className="border-t border-b border-black py-2 mb-4">
        <div className="flex justify-between text-[10px] font-bold">
          <span>{t("Invoice")}: {invoice.serialNumber || invoice.id.slice(0, 8)}</span>
          <span>{new Date(invoice.date).toLocaleDateString(i18n.language)}</span>
        </div>
      </div>

      {/* Customer Info */}
      {customer && (
        <div className="mb-4 text-[10px]">
          <p className="font-bold uppercase tracking-widest text-[8px] opacity-50 mb-1">{t("Customer")}</p>
          <p className="font-bold">{customer.name}</p>
          {customer.phone && <p>{customer.phone}</p>}
        </div>
      )}

      {/* Items Table */}
      <table className="w-full text-[10px] mb-6 border-collapse">
        <thead>
          <tr className="border-b border-black text-[8px] uppercase tracking-widest">
            <th className={clsx("py-1", isRtl ? "text-right" : "text-left")}>{t("Description")}</th>
            <th className="py-1 text-center">{t("Qty")}</th>
            <th className={clsx("py-1", isRtl ? "text-left" : "text-right")}>{t("Total")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-gray-100 last:border-0">
              <td className="py-2 leading-tight">
                <p className="font-bold">{item.name}</p>
                <p className="text-[8px] opacity-60">{item.price} {settings?.currency || "OMR"}</p>
              </td>
              <td className="py-2 text-center">{item.qty}</td>
              <td className={clsx("py-2 font-bold", isRtl ? "text-left" : "text-right")}>
                {(item.price * item.qty).toFixed(3)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="space-y-1 border-t border-black pt-2 mb-6">
        <div className="flex justify-between text-[10px]">
          <span>{t("Subtotal")}</span>
          <span>{(invoice.totalAmount + invoice.discount).toFixed(3)}</span>
        </div>
        {invoice.discount > 0 && (
          <div className="flex justify-between text-[10px]">
            <span>{t("Discount")}</span>
            <span>-{invoice.discount.toFixed(3)}</span>
          </div>
        )}
        {invoice.loyaltyPointsUsed > 0 && (
          <div className="flex justify-between text-[10px]">
            <span>{t("Loyalty Points Used")}</span>
            <span>-{invoice.loyaltyPointsUsed}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold pt-1 border-t border-gray-200">
          <span>{t("Grand Total")}</span>
          <span>{invoice.totalAmount.toFixed(3)} {settings?.currency || "OMR"}</span>
        </div>
      </div>

      <div className="text-center text-[8px] uppercase tracking-[0.2em] mt-8 opacity-50">
        <p>{t("Thank you for your visit")}</p>
        <p className="mt-1">Powered by RENTRIXXX</p>
      </div>

      {/* Screen only close button */}
      <div className="mt-8 print:hidden flex justify-center">
        <button 
          onClick={() => window.print()}
          className="bg-primary text-white px-6 py-2 rounded-full text-xs font-bold shadow-lg"
        >
          {t("Print")}
        </button>
        {onClose && (
          <button 
            onClick={onClose}
            className="ms-2 bg-gray-200 text-black px-6 py-2 rounded-full text-xs font-bold"
          >
            {t("Close")}
          </button>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-print-container, #invoice-print-container * {
            visibility: visible;
          }
          #invoice-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}} />
    </div>
  );
};
