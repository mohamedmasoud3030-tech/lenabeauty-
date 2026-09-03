import { Package } from "lucide-react";
import type { InventoryReportRow } from "../../application/dto";
import { ScreenState } from "../../shared/components/ScreenState";

interface InventoryReportSectionProps {
  data: InventoryReportRow[];
  error: string | null;
  onRetry: () => void;
  onOpenInventory: () => void;
  t: (key: string, values?: Record<string, unknown>) => string;
}

export function InventoryReportSection({ data, error, onRetry, onOpenInventory, t }: InventoryReportSectionProps) {
  if (error) {
    return <ScreenState state="error" title={error === "BACKEND_METHOD_UNSUPPORTED" ? t("Inventory report requires backend") : t("Failed to load inventory report")} description={error === "BACKEND_METHOD_UNSUPPORTED" ? t("BACKEND_METHOD_UNSUPPORTED") : t("Something went wrong while loading. Try again.")} actionLabel={t("Retry")} onAction={onRetry} errorDetail={error === "BACKEND_METHOD_UNSUPPORTED" ? undefined : error} />;
  }
  if (data.length === 0) {
    return <ScreenState state="empty" icon={<Package className="h-6 w-6" />} title={t("No Inventory Data")} description={t("Add products or services to see inventory")} actionLabel={t("Go to Inventory")} onAction={onOpenInventory} />;
  }

  return (
    <section className="rounded-3xl border border-border bg-card/50 p-4 sm:p-6 lg:p-8 shadow-xl overflow-hidden">
      <div className="flex items-center gap-3 mb-5"><span className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Package className="h-5 w-5" /></span><div><h3 className="font-bold">{t("Inventory Status")}</h3><p className="text-xs text-muted-foreground">{t("Current stock levels")}</p></div></div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {data.map((item, index) => {
          const quantity = Number((item as any).quantity ?? item.stockQuantity) || 0;
          const name = (item as any).productName ?? item.name;
          const inStock = quantity > 10;
          return <div key={`${name}-${index}`} className="rounded-xl border border-border bg-card p-4 min-w-0"><p className="font-bold truncate">{name}</p><p className="text-2xl font-bold mt-2">{quantity}</p><p className={`text-[10px] font-bold mt-1 ${inStock ? "text-success" : "text-destructive"}`}>{inStock ? t("In Stock") : t("Low Stock")}</p></div>;
        })}
      </div>
    </section>
  );
}
