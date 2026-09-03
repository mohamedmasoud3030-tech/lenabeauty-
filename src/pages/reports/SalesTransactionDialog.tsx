import { Receipt } from "lucide-react";
import type { SalesReportRow } from "../../application/dto";
import { Modal } from "../../shared/components/Modal";
import { formatOMRAmount } from "../../shared/money";

interface SalesTransactionDialogProps {
  sale: SalesReportRow | null;
  onClose: () => void;
  t: (key: string) => string;
  formatDay: (value: string) => string;
}

export function SalesTransactionDialog({ sale, onClose, t, formatDay }: SalesTransactionDialogProps) {
  return (
    <Modal
      isOpen={sale !== null}
      onClose={onClose}
      size="md"
      title={
        <span className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><Receipt className="h-5 w-5" /></span>
          <span>{t("Transaction Details")}</span>
        </span>
      }
      description={sale ? `${t("Invoice No")} · ${sale.id.slice(-6).toUpperCase()}` : undefined}
      className="sm:rounded-[2rem]"
    >
      {sale && (
        <div className="space-y-5 sm:p-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-muted/40 p-3"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("Date")}</p><p className="font-bold text-foreground">{formatDay(sale.date.split("T")[0])}</p></div>
            <div className="rounded-xl bg-muted/40 p-3"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("Customer")}</p><p className="font-bold text-foreground truncate">{sale.customer ?? t("Walk-in")}</p></div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("Items")}</p>
            {sale.items.length === 0 ? <p className="text-sm text-muted-foreground">{t("No items recorded")}</p> : sale.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0"><p className="text-sm font-bold text-foreground truncate">{item.name}</p><p className="text-[10px] font-bold text-muted-foreground mt-0.5">{item.type === "service" ? t("Service") : item.type === "product" ? t("Product") : t("Package")} · {item.qty} × {formatOMRAmount(item.price)}</p></div>
                <p className="text-sm font-bold text-foreground shrink-0">{formatOMRAmount(item.price * item.qty)}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 border-t border-border pt-3 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted-foreground font-medium">{t("Subtotal")}</span><span className="font-bold text-foreground">{formatOMRAmount(sale.totalAmount + sale.discount)}</span></div>
            {sale.discount > 0 && <div className="flex items-center justify-between"><span className="text-muted-foreground font-medium">{t("Discount")}</span><span className="font-bold text-destructive">-{formatOMRAmount(sale.discount)}</span></div>}
            <div className="flex items-center justify-between pt-1"><span className="font-bold text-foreground">{t("Total")}</span><span className="text-lg font-bold text-primary">{formatOMRAmount(sale.totalAmount)} OMR</span></div>
          </div>
        </div>
      )}
    </Modal>
  );
}
