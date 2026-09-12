import { formatOMRAmount } from "../../shared/money";
import { downloadCSV } from "../../shared/downloadCSV";

type ExportableProduct = { name: string; stockQuantity: number; cost: number; price: number };

export function exportToCSV(products: ExportableProduct[], t: (k: string) => string) {
  const headers = [t('Product'), t('Stock'), t('Cost'), t('Price'), t('Profit %')];
  const rows = products.map(p => [
    p.name,
    p.stockQuantity,
    formatOMRAmount(p.cost),
    formatOMRAmount(p.price),
    ((p.price - p.cost) / (p.price || 1) * 100).toFixed(1) + '%'
  ]);
  downloadCSV(`inventory_${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
}