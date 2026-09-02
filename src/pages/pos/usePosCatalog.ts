import { useCallback, useState } from "react";
import { Employee, Product, Service } from "../../domain/entities";
import { useCases } from "../../app/composition/useCases";
import { unwrap, formatError } from "../../shared/hooks/useApplication";

/**
 * POS catalog loading. Owns the sellable-catalog state (services, products,
 * packages, employees, gift cards) plus the tax rate from settings, and
 * exposes a single `loadData` used by the page on mount, after checkout, and
 * on retry.
 *
 * Sellable lines are filtered exactly once here: disabled or non-positive
 * prices never reach the cart. Packages arrive with `packagePrice` (domain
 * field) and are exposed as `price` so cart, totals, and the checkout payload
 * all treat package lines uniformly.
 */
export function usePosCatalog() {
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [giftCards, setGiftCards] = useState<any[]>([]);
  const [taxRate, setTaxRate] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [s, p, pkg, e, settings, gc] = await Promise.all([
        unwrap(useCases.services.list()),
        unwrap(useCases.products.list()),
        useCases.servicePackages.list().then((r: any) => (r.ok ? r.data : [])).catch(() => []),
        unwrap(useCases.employees.list()),
        useCases.settings.get().then((r) => (r.ok ? r.data : null)).catch(() => null),
        useCases.giftCards.list().then((r: any) => (r.ok ? r.data : [])).catch(() => []),
      ]);
      // Disabled or zero-priced catalog entries remain manageable in their
      // admin screens but are never exposed as sellable POS lines.
      setServices(s.filter((service) => service.isActive !== false && Number.isFinite(service.price) && service.price > 0));
      setProducts(p.filter((product) => product.isActive !== false && Number.isFinite(product.price) && product.price > 0));
      setPackages((pkg as any[])
        .filter((entry) => entry.isActive !== false && Number.isFinite(Number(entry.packagePrice)) && Number(entry.packagePrice) > 0)
        .map((entry) => ({ ...entry, price: Number(entry.packagePrice) })));
      setEmployees(e.filter((employee) => employee.isActive !== false));
      setGiftCards(gc.filter((card: any) => card.isActive !== false));
      if (settings && typeof settings.taxRate === "number") setTaxRate(settings.taxRate);
    } catch (error) {
      setLoadError(formatError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    services,
    products,
    packages,
    employees,
    giftCards,
    taxRate,
    loading,
    loadError,
    loadData,
  };
}
