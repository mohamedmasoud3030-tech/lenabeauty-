import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap, formatError } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { getDisplayName, getInitials } from "../shared/displayName";
import {
  ShoppingCart, User, CreditCard, Search, Trash2, Plus, 
  Scissors, Package, Boxes, ChevronRight, CheckCircle2, Sparkles, 
  ArrowRight, Minus, Receipt, Wallet, Banknote, UserPlus, XCircle, AlertTriangle,
  Zap, Clock, TrendingUp
} from "lucide-react";
// UserPlus used for inline new-customer creation at the POS checkout panel
import { ReceiptPreviewModal } from "../shared/components/ReceiptPreviewModal";
import { ScreenState } from "../shared/components/ScreenState";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";
import { Customer, Employee, Product, Service, CustomerEntitlement } from "../domain/entities";
import { getTierBySpend } from "../domain/loyalty";
import { InvoicePrintData, EntitlementRedemptionInput } from "../application/dto";
import { calculateCheckoutTotals, estimatePackageRedemptionValue } from "../domain/commerce";
import { desktopRepository } from "../desktop/repository";
import { isDesktopShell } from "../desktop/config";
import { formatOMRAmount } from "../shared/money";
import {
  ALL_SERVICE_CATEGORIES,
  filterServicesForCatalog,
  ServiceCategoryFilters,
} from "../shared/catalog/ServiceCategoryFilters";

interface CartItem {
  id: string;
  name: string;
  price: number;
  type: "service" | "product" | "package" | "gift_card";
  cartId: string;
  qty?: number;
  stockQuantity?: number;
  isActive?: boolean;
  trackInventory?: boolean;
  pricingMode?: "FIXED" | "STARTING_FROM";
  category?: string;
  brand?: string;
  includedServices?: number;
  /** Gift-card sale line: the code of the new card. */
  code?: string;
}

type PosPrintData = InvoicePrintData;

export default function PosInvoicesPage() {
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCards, setGiftCards] = useState<any[]>([]);
  // Customer-owned entitlements (packages) available for redemption at checkout.
  const [entitlements, setEntitlements] = useState<CustomerEntitlement[]>([]);
  const [entitlementRedemptions, setEntitlementRedemptions] = useState<EntitlementRedemptionInput[]>([]);
  // Inline gift-card sale form (code + value).
  const [giftCardSaleCode, setGiftCardSaleCode] = useState("");
  const [giftCardSaleValue, setGiftCardSaleValue] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [itemSearchQ, setItemSearchQ] = useState("");
  const [selectedServiceCategory, setSelectedServiceCategory] = useState(ALL_SERVICE_CATEGORIES);
  // Inline «عميل جديد → بيع» دون مغادرة نقطة البيع
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [activeTab, setActiveTab] = useState<"SERVICES" | "PRODUCTS" | "PACKAGES">("SERVICES");
  const [printData, setPrintData] = useState<PosPrintData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [showCheckoutSummary, setShowCheckoutSummary] = useState(false);
  // True while a checkout is in flight: guards against double-submit (a second
  // tap on "Complete Payment" or Ctrl+Enter must never charge the same order
  // twice).
  const [checkingOut, setCheckingOut] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        itemSearchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setShowCheckoutSummary(false);
      }
      if (e.key === "Enter" && e.ctrlKey) {
        handleCheckout();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, selectedCustomer, selectedEmployee]);

  async function loadData() {
    setLoading(true);
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
      // Packages arrive with packagePrice (domain field) — expose it as `price`
      // so the cart, totals, and checkout payload work for package lines too.
      setPackages((pkg as any[])
        .filter((entry) => entry.isActive !== false && Number.isFinite(Number(entry.packagePrice)) && Number(entry.packagePrice) > 0)
        .map((entry) => ({ ...entry, price: Number(entry.packagePrice) })));
      setEmployees(e.filter((employee) => employee.isActive !== false));
      setGiftCards(gc.filter((card: any) => card.isActive !== false));
      if (settings && typeof settings.taxRate === "number") setTaxRate(settings.taxRate);
    } finally {
      setLoading(false);
    }
  }

  async function searchCustomers(q: string) {
    setSearchQ(q);
    if (q.length > 1) {
      const res = await unwrap(useCases.customers.list(q));
      setCustomers(res);
    } else {
      setCustomers([]);
    }
  }

  /** إنشاء عميل جديد من داخل نقطة البيع ثم اختياره مباشرة للفاتورة. */
  async function handleCreateCustomer() {
    const name = newCustomerName.trim();
    if (!name || creatingCustomer) return;
    setCreatingCustomer(true);
    try {
      const created = await unwrap(useCases.customers.create({
        name,
        phone: newCustomerPhone.trim() || undefined,
      }));
      await selectCustomer(created);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setShowNewCustomer(false);
      showToast('success', t("Success"), t("Customer created successfully"));
    } catch (err: any) {
      showToast('error', t("Error"), err?.message || t("Failed to create customer"));
    } finally {
      setCreatingCustomer(false);
    }
  }

  function addToCart(item: {
    id: string;
    name: string;
    price: number;
    qty?: number;
    target?: string;
    stockQuantity?: number;
    includedServices?: number;
    isActive?: boolean;
    trackInventory?: boolean;
    pricingMode?: "FIXED" | "STARTING_FROM";
  }, type: "service" | "product" | "package") {
    if (item.isActive === false || !Number.isFinite(item.price) || item.price <= 0) {
      showToast('error', t("Error"), t("This item is not available for sale"));
      return;
    }
    if (type === "product" && item.trackInventory !== false && item.stockQuantity !== undefined && item.stockQuantity <= 0) {
      showToast('error', t("Error"), t("Out of stock!"));
      return;
    }

    let finalPrice = item.price;
    if (type === "service" && item.pricingMode === "STARTING_FROM") {
      const entered = window.prompt(
        t("Enter the final selling price for this service"),
        formatOMRAmount(item.price),
      );
      if (entered === null) return;
      finalPrice = Number(entered);
      if (!Number.isFinite(finalPrice) || finalPrice < item.price || finalPrice <= 0) {
        showToast('error', t("Error"), t("Final price must be at least the starting price"));
        return;
      }
    }

    setCart([...cart, { ...item, price: finalPrice, type, cartId: globalThis.crypto.randomUUID() }]);
    showToast('success', t("Added"), `${item.name} ${t("added to cart")}`);
  }

  function removeFromCart(cartId: string) {
    setCart(cart.filter(it => it.cartId !== cartId));
  }

  function clearCart() {
    setCart([]);
    setSelectedCustomer(null);
    setDiscount(0);
    setUseLoyaltyPoints(false);
    setGiftCardCode("");
    setEntitlements([]);
    setEntitlementRedemptions([]);
  }

  async function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setCustomers([]);
    setSearchQ("");
    setEntitlements([]);
    setEntitlementRedemptions([]);
    try {
      const res = await useCases.entitlements.listForCustomer(customer.id);
      if (res.ok) setEntitlements(res.data.filter((e) => e.kind === "PACKAGE"));
    } catch {
      setEntitlements([]);
    }
  }

  function addGiftCardToCart() {
    const code = giftCardSaleCode.trim().toUpperCase();
    const value = Number(giftCardSaleValue);
    if (code.length < 4) {
      showToast('error', t("Error"), t("Gift card code must be at least 4 characters"));
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      showToast('error', t("Error"), t("Gift card value must be positive"));
      return;
    }
    if (cart.some((it) => it.type === "gift_card" && it.code === code)) {
      showToast('error', t("Error"), t("This gift card code is already in the cart"));
      return;
    }
    setCart([...cart, {
      id: `gc-${code}`,
      name: t("Gift Card") + ` ${code}`,
      price: value,
      type: "gift_card",
      cartId: globalThis.crypto.randomUUID(),
      qty: 1,
      code,
    }]);
    setGiftCardSaleCode("");
    setGiftCardSaleValue("");
  }

  /** Client-side preview of applied package redemptions (server is authoritative). */
  function appliedRedemptionEstimate(): number {
    let total = 0;
    for (const redemption of entitlementRedemptions) {
      if (redemption.type !== "units" || !redemption.serviceId) continue;
      const entitlement = entitlements.find((e) => e.id === redemption.entitlementId);
      if (!entitlement) continue;
      const serviceLines = cart
        .filter((it) => it.type === "service" && it.id === redemption.serviceId)
        .map((it) => ({ serviceId: it.id, price: Number(it.price), qty: Number(it.qty ?? 1) }));
      total += estimatePackageRedemptionValue(redemption, entitlement.remainingValue, serviceLines);
    }
    return total;
  }

  const tierInfo = selectedCustomer ? getTierBySpend(selectedCustomer.totalSpent) : null;
  const tierPercent = tierInfo?.discountPercent ?? 0;
  const selectedGiftCard = giftCards.find((card) => {
    if (card.code !== giftCardCode.trim().toUpperCase() || !card.isActive) return false;
    return !card.expiresAt || new Date(card.expiresAt).getTime() >= Date.now();
  });
  // The shared pure calculator mirrors the authoritative RPC at OMR's
  // three-decimal precision. The RPC still re-resolves every catalog price.
  const entitlementRedemptionPreview = appliedRedemptionEstimate();
  const checkoutTotals = calculateCheckoutTotals({
    items: cart.map((item) => ({ price: Number(item.price), qty: Number(item.qty ?? 1) })),
    manualDiscount: Number.isFinite(discount) ? discount : 0,
    tierPercent,
    loyaltyPoints: selectedCustomer?.loyaltyPoints ?? 0,
    useLoyaltyPoints,
    giftCardBalance: selectedGiftCard?.currentBalance ?? 0,
    entitlementRedemption: entitlementRedemptionPreview,
    taxRate,
  });
  const { subtotal, tierDiscount, loyaltyDiscount, giftCardDiscount, entitlementRedemption, tax, total } = checkoutTotals;

  async function handleCheckout() {
    if (checkingOut) return;

    if (!selectedCustomer || !selectedEmployee || cart.length === 0) {
      showToast('error', t("Error"), t("Please select a customer, employee, and add items to the cart"));
      return;
    }

    if (!Number.isFinite(discount) || discount < 0 || discount + tierDiscount > subtotal) {
      showToast('error', t("Error"), t("Discount cannot exceed subtotal"));
      return;
    }

    if (!["cash", "card", "transfer"].includes(paymentMethod.toLowerCase())) {
      showToast('error', t("Error"), t("Invalid payment method"));
      return;
    }

    const hasInvalidPriceOrQty = cart.some((it) => {
      const price = Number(it.price);
      const qty = Number(it.qty ?? 1);
      return !Number.isFinite(price) || price <= 0 || !Number.isInteger(qty) || qty <= 0;
    });
    if (hasInvalidPriceOrQty) {
      showToast('error', t("Error"), t("One or more items have an invalid price or quantity"));
      return;
    }

    setCheckingOut(true);
    try {
      const payload = {
        customerId: selectedCustomer.id,
        employeeId: selectedEmployee,
        paymentMethod: paymentMethod.toLowerCase() as "cash" | "card" | "transfer",
        discountAmount: discount,
        useLoyaltyPoints,
        giftCardCode: giftCardCode.trim() ? giftCardCode.trim().toUpperCase() : undefined,
        entitlementRedemptions: entitlementRedemptions.length > 0 ? entitlementRedemptions : undefined,
        items: cart.map(it => {
          if (it.type === "service") {
            return {
              type: "service" as const,
              serviceId: it.id,
              qty: Number(it.qty ?? 1),
              price: Number(it.price)
            };
          } else if (it.type === "product") {
            return {
              type: "product" as const,
              productId: it.id,
              qty: Number(it.qty ?? 1),
              price: Number(it.price)
            };
          } else if (it.type === "package") {
            return {
              type: "package" as const,
              packageId: it.id,
              qty: Number(it.qty ?? 1),
              price: Number(it.price)
            };
          } else {
            return {
              type: "gift_card" as const,
              code: it.code || "",
              qty: 1,
              price: Number(it.price)
            };
          }
        })
      };

      const res = await unwrap(useCases.invoices.checkout(payload));
      
      try {
        const pData = await unwrap(useCases.invoices.getForPrint(res.invoice.id));
        setPrintData(pData);
        setShowPrintModal(true);
        if (isDesktopShell()) {
          const invoiceHtml = `<div><h1>${pData.settings?.name || "LenaBeauty"}</h1><p>Invoice ${pData.invoice.id}</p><p>Total: ${formatOMRAmount(pData.invoice.totalAmount)}</p></div>`;
          await desktopRepository.printHtml(`Invoice ${pData.invoice.id}`, invoiceHtml);
        }
      } catch (e) {
        console.error("Print failed", e);
        showToast('error', t("Error"), t("Payment succeeded, but receipt could not be loaded"));
      }

      // The payment is already committed at this point. Clear the order and
      // report success before refreshing so a transient catalog read can never
      // be misreported as a failed payment. The refresh makes decremented stock
      // visible immediately and prevents a second order using stale quantity.
      clearCart();
      showToast('success', t("Success"), t("Payment successful!"));
      try {
        await loadData();
      } catch (e) {
        console.error("Catalog refresh failed after successful checkout", e);
        showToast('error', t("Error"), t("Sale completed, but catalog refresh failed"));
      }
    } catch (err: any) {
      showToast('error', t("Error"), err.message || t("Payment failed"));
    } finally {
      setCheckingOut(false);
    }
  }

  const filteredItems = activeTab === "SERVICES"
    ? filterServicesForCatalog(services, selectedServiceCategory, itemSearchQ)
    : activeTab === "PRODUCTS"
      ? products.filter(it => it.name.toLowerCase().includes(itemSearchQ.toLowerCase()))
      : packages.filter((it: any) => it.name.toLowerCase().includes(itemSearchQ.toLowerCase()));

  return (
    <div className="flex flex-col gap-3 lg:gap-6 min-h-0 lg:min-h-[calc(100vh-120px)] pb-4 lg:pb-0 min-w-0 overflow-x-clip">

      {/* Receipt preview — shared overlay above all chrome, sticky Print/Close */}
      <ReceiptPreviewModal data={showPrintModal ? printData : null} onClose={() => setShowPrintModal(false)} />

      {/* Mobile: Quick Catalog/Cart Toggle + Sticky categories */}
      {isMobile && (
        <div className="px-0 pt-1">
          {/* One-handed catalog / cart toggle — thumb-width targets, no duplicate category row */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowCheckoutSummary(false)}
              className={clsx(
                "flex-1 min-h-11 py-2.5 rounded-xl font-bold text-xs transition-all touch-target",
                !showCheckoutSummary 
                  ? "bg-primary text-primary-foreground shadow-lg" 
                  : "bg-muted text-muted-foreground"
              )}
            >
              {t("Catalog")}
            </button>
            <button
              onClick={() => setShowCheckoutSummary(true)}
              className={clsx(
                "flex-1 min-h-11 py-2.5 rounded-xl font-bold text-xs transition-all relative touch-target",
                showCheckoutSummary 
                  ? "bg-primary text-primary-foreground shadow-lg" 
                  : "bg-muted text-muted-foreground"
              )}
            >
              {t("Cart")}
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -end-1.5 bg-destructive text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-3 lg:gap-6 lg:min-h-0 px-0">

        {/* Left: Items Selection (Hidden on mobile if showing checkout) */}
        {(!isMobile || !showCheckoutSummary) && (
          <div className="flex-1 flex flex-col rounded-2xl lg:rounded-[2.5rem] border border-border bg-card shadow-sm overflow-hidden print:hidden lg:h-full">

            <div className="p-4 lg:p-6 border-b border-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-lg lg:text-xl font-bold tracking-tight text-foreground">{t("Service Catalog")}</h2>
                  <p className="hidden lg:block text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{t("Press F1 to search")}</p>
                </div>
                <div className="flex bg-muted rounded-xl p-1 shadow-inner w-full sm:w-auto">
                  <button 
                    onClick={() => setActiveTab("SERVICES")}
                    className={clsx(
                      "flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                      activeTab === "SERVICES" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Scissors className="h-4 w-4 shrink-0" />
                    {t("Services")}
                  </button>
                  <button 
                    onClick={() => setActiveTab("PRODUCTS")}
                    className={clsx(
                      "flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                      activeTab === "PRODUCTS" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Package className="h-4 w-4 shrink-0" />
                    {t("Products")}
                  </button>
                  <button 
                    onClick={() => setActiveTab("PACKAGES")}
                    className={clsx(
                      "flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                      activeTab === "PACKAGES" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Boxes className="h-4 w-4 shrink-0" />
                    {t("Packages")}
                  </button>
                </div>
              </div>
              <div className="relative group">
                <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input 
                  ref={itemSearchRef}
                  className="w-full rounded-xl lg:rounded-2xl border border-border bg-muted/30 ps-10 pe-4 py-3 lg:py-4 text-sm font-medium outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                  placeholder={t("Search items... (F1)")}
                  value={itemSearchQ}
                  onChange={(e) => setItemSearchQ(e.target.value)}
                />
              </div>
              {activeTab === "SERVICES" && (
                <ServiceCategoryFilters
                  services={services}
                  selectedCategory={selectedServiceCategory}
                  onSelect={setSelectedServiceCategory}
                  allLabel={t("All")}
                />
              )}
            </div>

            <div className="flex-1 overflow-auto p-3 lg:p-6 bg-muted/5 scrollbar-hide min-h-[40vh] lg:min-h-0 safe-area-bottom">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40 py-20">
                  <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">{t("Loading Catalog...")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2 lg:gap-4">
                  <AnimatePresence mode="popLayout">
                    {filteredItems.map((it, idx) => (
                      <motion.button
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.02 } }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        key={it.id} 
                        onClick={() => addToCart(it as any, activeTab === "SERVICES" ? "service" : activeTab === "PRODUCTS" ? "product" : "package")}
                        disabled={activeTab === "PRODUCTS" && (it as Product).trackInventory && (it as Product).stockQuantity <= 0}
                        className={clsx(
                          "group relative rounded-xl lg:rounded-2xl border border-border bg-card p-2.5 lg:p-4 shadow-sm transition-all hover:shadow-lg hover:border-primary/50 flex flex-col items-start gap-2 text-start touch-target active:scale-[0.98]",
                          activeTab === "PRODUCTS" && (it as Product).trackInventory && (it as Product).stockQuantity <= 0 && "opacity-50 grayscale pointer-events-none"
                        )}
                      >
                        <div className="flex items-start justify-between w-full gap-2">
                          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                            {activeTab === "SERVICES" ? <Scissors className="h-4 w-4" /> : activeTab === "PRODUCTS" ? <Package className="h-4 w-4" /> : <Boxes className="h-4 w-4" />}
                          </div>
                          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                            <Plus className="h-4 w-4" />
                          </div>
                        </div>
                        
                        <div className="flex-1 w-full min-w-0">
                          <h3 className="text-xs lg:text-sm font-bold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">{it.name}</h3>
                          {activeTab === "PRODUCTS" && (
                            <div className={clsx(
                              "mt-0.5 text-[9px] lg:text-[10px] font-bold uppercase tracking-wider",
                              (it as Product).stockQuantity > 5 ? "text-success" : "text-destructive"
                            )}>
                              {(it as Product).stockQuantity} {t("Stock")}
                            </div>
                          )}
                          {activeTab === "PACKAGES" && (
                            <div className="mt-0.5 text-[9px] lg:text-[10px] font-bold uppercase tracking-wider text-info">
                              {(it as any).items?.length || 0} {t("Included")}
                            </div>
                          )}
                        </div>

                        <div className="w-full pt-1.5 lg:pt-2 border-t border-border/50 flex items-baseline justify-between">
                          <span className="text-sm lg:text-lg font-bold text-foreground">{formatOMRAmount(it.price)}</span>
                          <span className="text-[9px] lg:text-[10px] font-bold text-muted-foreground uppercase">
                            {activeTab === "SERVICES" && (it as Service).pricingMode === "STARTING_FROM" ? `${t("From")} · ` : ""}{t("OMR")}
                          </span>
                        </div>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                  {filteredItems.length === 0 && (
                    <div className="col-span-full">
                      <ScreenState
                        state="empty"
                        compact
                        icon={<Search className="h-6 w-6" />}
                        title={t("No items found")}
                        description={itemSearchQ.trim() ? t("Try a different search term") : t("Add services or products to start selling")}
                      />
                    </div>
                  )}
                </div>
              )}
              
              {/* Floating Cart Preview on Mobile */}
              {isMobile && cart.length > 0 && !showCheckoutSummary && (
                <motion.button
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  onClick={() => setShowCheckoutSummary(true)}
                  className="fixed end-4 above-bottom-nav z-40 h-14 px-4 rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center gap-3 touch-target active:scale-95 transition-transform"
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span className="font-bold">{cart.length} {t("Items")}</span>
                  <span className="text-sm font-bold opacity-80">{formatOMRAmount(total)}</span>
                </motion.button>
              )}

              {activeTab === "PACKAGES" && (
                <div className="mt-4 rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="h-4 w-4" />
                    <h3 className="text-sm font-bold">{t("Sell a Gift Card")}</h3>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-bold outline-none focus:ring-4 focus:ring-primary/10"
                      placeholder={t("New gift card code")}
                      value={giftCardSaleCode}
                      onChange={(e) => setGiftCardSaleCode(e.target.value.toUpperCase())}
                    />
                    <input
                      className="w-full sm:w-28 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-bold outline-none focus:ring-4 focus:ring-primary/10"
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder={t("Value OMR")}
                      value={giftCardSaleValue}
                      onChange={(e) => setGiftCardSaleValue(e.target.value)}
                    />
                    <button
                      onClick={addGiftCardToCart}
                      className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
                    >
                      <Plus className="h-3.5 w-3.5 inline me-1" />
                      {t("Add to Cart")}
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {t("Payment is collected at checkout and booked as a deferred obligation")}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right: Checkout Panel (Hidden on mobile if showing catalog) */}
        {(!isMobile || showCheckoutSummary) && (
          <div className="w-full lg:w-[420px] flex flex-col rounded-2xl lg:rounded-[2.5rem] border border-border bg-card shadow-2xl overflow-hidden print:hidden lg:h-full safe-area-bottom">
            
            {/* Header */}
            <div className="p-3 lg:p-6 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div className="space-y-0">
                  <h2 className="text-sm lg:text-lg font-bold">{t("Order")}</h2>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{cart.length} {t("Items")}</p>
                </div>
              </div>
              {cart.length > 0 && (
                <motion.button
                  key={cart.length}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  onClick={clearCart}
                  className="h-9 w-9 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all flex items-center justify-center touch-target"
                  title={t("Clear cart")}
                >
                  <Trash2 className="h-4 w-4" />
                </motion.button>
              )}
            </div>

            {/* Cart Items - compact list */}
            <div className="flex-1 overflow-auto p-3 lg:p-6 space-y-1.5 scrollbar-hide">
              <AnimatePresence initial={false} mode="popLayout">
                {cart.length === 0 ? (
                  <ScreenState
                    state="empty"
                    compact
                    icon={<ShoppingCart className="h-6 w-6" />}
                    title={t("Cart is Empty")}
                    description={t("Add items to start")}
                  />
                ) : (
                  cart.map((item) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20, scale: 0.95 }}
                      key={item.cartId} 
                      className="group flex items-center gap-2.5 rounded-lg border border-border p-2.5 transition-all hover:bg-muted/30 touch-target"
                    >
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-colors text-xs font-bold">
                        {item.type === "service" ? <Scissors className="h-4 w-4" /> : item.type === "product" ? <Package className="h-4 w-4" /> : <Boxes className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-foreground leading-tight">{item.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">{formatOMRAmount(item.price)}</span>
                        <button 
                          onClick={() => removeFromCart(item.cartId)} 
                          aria-label={t("Remove")}
                          className="h-11 w-11 flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-all touch-target"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Checkout Form - compact, optimized for mobile */}
            <div className="p-3 lg:p-6 bg-muted/30 border-t border-border space-y-4">
              <div className="space-y-3">
                
                {/* Customer Search - compact */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                    <User className="h-3 w-3" />
                    {t("Customer")}
                  </label>
                  <AnimatePresence mode="wait">
                    {selectedCustomer ? (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-2.5"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-bold">
                            {getInitials(selectedCustomer, "·")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-foreground block truncate">{getDisplayName(selectedCustomer, t("Unnamed"))}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => setSelectedCustomer(null)} 
                          className="h-8 w-8 flex items-center justify-center rounded-lg bg-background border border-border text-destructive hover:bg-destructive/10 transition-all shrink-0"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </motion.div>
                    ) : (
                      <div className="relative group">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                          ref={searchInputRef}
                          className="w-full rounded-lg border border-border bg-card ps-9 pe-9 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all mobile-input"
                          placeholder={t("Search customer...")}
                          value={searchQ}
                          onChange={(e) => searchCustomers(e.target.value)}
                        />
                        <button
                          onClick={() => { setShowNewCustomer(v => !v); setCustomers([]); }}
                          className="absolute end-1 top-1/2 -translate-y-1/2 h-8 px-2 rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-1 text-[10px] font-bold touch-target"
                          title={t("New customer")}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                        </button>
                        <AnimatePresence>
                          {customers.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute bottom-full inset-x-0 mb-2 rounded-lg border border-border bg-card shadow-xl max-h-44 overflow-auto z-50 p-1"
                            >
                              {customers.map(c => (
                                <button 
                                  key={c.id} 
                                  onClick={() => { void selectCustomer(c); }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-muted rounded-lg text-start transition-all touch-target"
                                >
                                  <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">{getInitials(c, "·")}</div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-foreground truncate">{getDisplayName(c, t("Unnamed"))}</p>
                                  </div>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                    {showNewCustomer && !selectedCustomer && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2"
                      >
                        <input
                          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                          placeholder={t("Customer name")}
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                        />
                        <button
                          onClick={() => void handleCreateCustomer()}
                          disabled={creatingCustomer || !newCustomerName.trim()}
                          className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 touch-target"
                        >
                          <UserPlus className="h-4 w-4" />
                          {creatingCustomer ? t("Creating...") : t("Create & select")}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Employee Select - compact */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                      <Scissors className="h-3 w-3" />
                      {t("Specialist")}
                    </label>
                    <div className="relative">
                      <select 
                        className="w-full rounded-lg border border-border bg-card px-2 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer touch-target"
                        value={selectedEmployee}
                        onChange={(e) => setSelectedEmployee(e.target.value)}
                      >
                        <option value="">{t("Select")}</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                      <ChevronRight className="absolute end-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none rotate-90" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                      <Wallet className="h-3 w-3" />
                      {t("Payment")}
                    </label>
                    <div className="relative">
                      <select 
                        className="w-full rounded-lg border border-border bg-card px-2 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer touch-target"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      >
                        <option value="CASH">{t("Cash")}</option>
                        <option value="CARD">{t("Card")}</option>
                        <option value="TRANSFER">{t("Transfer")}</option>
                      </select>
                      <ChevronRight className="absolute end-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none rotate-90" />
                    </div>
                  </div>
                </div>

                {/* Loyalty Points - compact toggle */}
                {selectedCustomer && selectedCustomer.loyaltyPoints > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-between rounded-lg border border-success/20 bg-success/5 p-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className="h-4 w-4 text-success shrink-0" />
                      <p className="text-[9px] font-bold text-success uppercase tracking-widest truncate">
                        {selectedCustomer.loyaltyPoints} {t("Points")} (-{formatOMRAmount(loyaltyDiscount)})
                      </p>
                    </div>
                    <button 
                      onClick={() => setUseLoyaltyPoints(!useLoyaltyPoints)}
                      role="switch"
                      aria-checked={useLoyaltyPoints}
                      aria-label={t("Loyalty Points")}
                      className={clsx(
                        "relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-none shrink-0",
                        useLoyaltyPoints ? "bg-success" : "bg-muted"
                      )}
                    >
                      <span className={clsx(
                        "inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md",
                        useLoyaltyPoints ? "translate-x-8" : "translate-x-1"
                      )} />
                    </button>
                  </motion.div>
                )}

                {/* Gift Card - inline */}
                <div className="space-y-1.5">
                  <input
                    className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder={t("Gift card code")}
                    value={giftCardCode}
                    onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              {/* Summary & Checkout — sticky in the thumb zone above the bottom nav */}
              <div className="pt-3 border-t border-border space-y-3 sticky z-20 bg-muted/95 backdrop-blur-sm -mx-3 px-3 pb-3 lg:static lg:bg-transparent lg:backdrop-blur-none lg:mx-0 lg:px-0 lg:pb-0 above-bottom-nav lg:bottom-auto">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("Total")}</span>
                  <div>
                    <span className="text-2xl font-bold tracking-tight text-primary">{formatOMRAmount(total)}</span>
                    <span className="text-[9px] font-bold text-muted-foreground ms-1 uppercase">{t("OMR")}</span>
                  </div>
                </div>

                <button 
                  onClick={handleCheckout}
                  disabled={checkingOut || cart.length === 0 || !selectedCustomer || !selectedEmployee}
                  className="group relative w-full min-h-12 rounded-xl bg-primary py-3.5 lg:py-4 font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 text-sm touch-target"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  <span>{checkingOut ? t("Processing...") : t("Complete Payment")}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
