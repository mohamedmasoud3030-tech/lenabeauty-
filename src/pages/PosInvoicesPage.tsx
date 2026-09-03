import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import {
  Boxes,
  CheckCircle2,
  ChevronRight,
  Package,
  Scissors,
  Search,
  ShoppingCart,
  Sparkles,
  Trash2,
  User,
  UserPlus,
  Wallet,
  XCircle,
} from "lucide-react";
import { useCases } from "../app/composition/useCases";
import type { EntitlementRedemptionInput, InvoicePrintData } from "../application/dto";
import { calculateCheckoutTotals, estimatePackageRedemptionValue } from "../domain/commerce";
import type { Appointment, Customer, CustomerEntitlement } from "../domain/entities";
import { AppointmentStatus } from "../domain/entities";
import { getTierBySpend } from "../domain/loyalty";
import { buildCustomerWallet, walletAvailableForCheckout } from "../domain/wallet";
import { desktopRepository } from "../desktop/repository";
import { isDesktopShell } from "../desktop/config";
import { escapePrintText } from "../infrastructure/services/printService";
import { ALL_SERVICE_CATEGORIES, filterServicesForCatalog } from "../shared/catalog/ServiceCategoryFilters";
import { ReceiptPreviewModal } from "../shared/components/ReceiptPreviewModal";
import { ScreenState } from "../shared/components/ScreenState";
import { useToast } from "../shared/components/Toast";
import { getDisplayName, getInitials } from "../shared/displayName";
import { formatError, unwrap } from "../shared/hooks/useApplication";
import { formatOMRAmount } from "../shared/money";
import { PosCatalogPanel, type PosCatalogTab } from "./pos/PosCatalogPanel";
import { PosMobileModeToggle } from "./pos/PosMobileModeToggle";
import { usePosCatalog } from "./pos/usePosCatalog";
import { VisitContextCard } from "./pos/VisitContextCard";

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
  includedServices?: number;
  code?: string;
}

type PosPrintData = InvoicePrintData;

export default function PosInvoicesPage() {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const {
    services,
    products,
    packages,
    employees,
    giftCards,
    taxRate,
    loading,
    loadError,
    loadData,
  } = usePosCatalog();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [discount] = useState(0);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [giftCardCode, setGiftCardCode] = useState("");
  const [entitlements, setEntitlements] = useState<CustomerEntitlement[]>([]);
  const [entitlementRedemptions, setEntitlementRedemptions] = useState<EntitlementRedemptionInput[]>([]);
  const [giftCardSaleCode, setGiftCardSaleCode] = useState("");
  const [giftCardSaleValue, setGiftCardSaleValue] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [itemSearchQ, setItemSearchQ] = useState("");
  const [selectedServiceCategory, setSelectedServiceCategory] = useState(ALL_SERVICE_CATEGORIES);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [activeTab, setActiveTab] = useState<PosCatalogTab>("SERVICES");
  const [printData, setPrintData] = useState<PosPrintData | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const [showCheckoutSummary, setShowCheckoutSummary] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const checkoutInFlightRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemSearchRef = useRef<HTMLInputElement>(null);
  const customerSearchRequestRef = useRef(0);
  const visitHydrationRef = useRef("");
  const servicePrefillRef = useRef("");

  const [searchParams, setSearchParams] = useSearchParams();
  const appointmentParam = searchParams.get("appointment");
  const [visitAppointment, setVisitAppointment] = useState<Appointment | null>(null);
  const [visitContextError, setVisitContextError] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F1") {
        event.preventDefault();
        itemSearchRef.current?.focus();
      }
      if (event.key === "Escape") setShowCheckoutSummary(false);
      if (event.key === "Enter" && event.ctrlKey) void handleCheckout();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, selectedCustomer, selectedEmployee, visitAppointment, discount, useLoyaltyPoints, giftCardCode, entitlementRedemptions]);

  useEffect(() => {
    if (!appointmentParam || visitHydrationRef.current === appointmentParam) return;
    visitHydrationRef.current = appointmentParam;
    let cancelled = false;

    void (async () => {
      try {
        const appointment = await unwrap(useCases.appointments.getById(appointmentParam));
        if (cancelled) return;
        if (appointment.status !== AppointmentStatus.SCHEDULED) {
          setVisitAppointment(null);
          setVisitContextError(null);
          return;
        }
        setVisitAppointment(appointment);
        if (appointment.employeeId) setSelectedEmployee(appointment.employeeId);
        if (appointment.customerId) {
          try {
            const customer = await unwrap(useCases.customers.getById(appointment.customerId));
            if (cancelled) return;
            setSelectedCustomer(customer);
            const result = await useCases.entitlements.listForCustomer(customer.id);
            if (result.ok) setEntitlements(result.data);
          } catch {
            // The operator can still select the customer manually.
          }
        }
      } catch (error) {
        if (!cancelled) setVisitContextError(formatError(error));
      }
    })();

    return () => { cancelled = true; };
  }, [appointmentParam]);

  useEffect(() => {
    if (!visitAppointment?.serviceId || servicePrefillRef.current === visitAppointment.id || services.length === 0) return;
    servicePrefillRef.current = visitAppointment.id;
    const service = services.find((entry) => entry.id === visitAppointment.serviceId);
    if (!service) return;
    setCart((previous) => previous.some((item) => item.type === "service" && item.id === service.id)
      ? previous
      : [...previous, {
          id: service.id,
          name: service.name,
          price: service.price,
          type: "service",
          cartId: globalThis.crypto.randomUUID(),
          qty: 1,
          pricingMode: service.pricingMode,
        }]);
  }, [visitAppointment, services]);

  function detachVisit() {
    setVisitAppointment(null);
    setVisitContextError(null);
    visitHydrationRef.current = "";
    servicePrefillRef.current = "";
    if (appointmentParam) setSearchParams({}, { replace: true });
  }

  async function searchCustomers(query: string) {
    setSearchQ(query);
    const requestId = ++customerSearchRequestRef.current;
    if (query.trim().length <= 1) {
      setCustomers([]);
      return;
    }
    try {
      const result = await unwrap(useCases.customers.list(query));
      if (requestId === customerSearchRequestRef.current) setCustomers(result);
    } catch (error) {
      if (requestId !== customerSearchRequestRef.current) return;
      setCustomers([]);
      showToast("error", t("Error"), formatError(error));
    }
  }

  async function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setCustomers([]);
    setSearchQ("");
    setEntitlements([]);
    setEntitlementRedemptions([]);
    try {
      const result = await useCases.entitlements.listForCustomer(customer.id);
      if (result.ok) setEntitlements(result.data);
    } catch {
      setEntitlements([]);
    }
  }

  async function handleCreateCustomer() {
    const name = newCustomerName.trim();
    if (!name || creatingCustomer) return;
    setCreatingCustomer(true);
    try {
      const created = await unwrap(useCases.customers.create({ name, phone: newCustomerPhone.trim() || undefined }));
      await selectCustomer(created);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setShowNewCustomer(false);
      showToast("success", t("Success"), t("Customer created successfully"));
    } catch (error: any) {
      showToast("error", t("Error"), error?.message || t("Failed to create customer"));
    } finally {
      setCreatingCustomer(false);
    }
  }

  function addToCart(item: {
    id: string;
    name: string;
    price: number;
    qty?: number;
    stockQuantity?: number;
    isActive?: boolean;
    trackInventory?: boolean;
    pricingMode?: "FIXED" | "STARTING_FROM";
  }, type: "service" | "product" | "package") {
    if (item.isActive === false || !Number.isFinite(item.price) || item.price <= 0) {
      showToast("error", t("Error"), t("This item is not available for sale"));
      return;
    }
    if (type === "product" && item.trackInventory !== false && item.stockQuantity !== undefined && item.stockQuantity <= 0) {
      showToast("error", t("Error"), t("Out of stock!"));
      return;
    }

    let finalPrice = item.price;
    if (type === "service" && item.pricingMode === "STARTING_FROM") {
      const entered = window.prompt(t("Enter the final selling price for this service"), formatOMRAmount(item.price));
      if (entered === null) return;
      finalPrice = Number(entered);
      if (!Number.isFinite(finalPrice) || finalPrice < item.price || finalPrice <= 0) {
        showToast("error", t("Error"), t("Final price must be at least the starting price"));
        return;
      }
    }

    setCart((previous) => [...previous, { ...item, price: finalPrice, type, cartId: globalThis.crypto.randomUUID() }]);
    showToast("success", t("Added"), `${item.name} ${t("added to cart")}`);
  }

  function clearCart() {
    setCart([]);
    setSelectedCustomer(null);
    setUseLoyaltyPoints(false);
    setGiftCardCode("");
    setEntitlements([]);
    setEntitlementRedemptions([]);
  }

  function addGiftCardToCart() {
    const code = giftCardSaleCode.trim().toUpperCase();
    const value = Number(giftCardSaleValue);
    if (code.length < 4) return showToast("error", t("Error"), t("Gift card code must be at least 4 characters"));
    if (!Number.isFinite(value) || value <= 0) return showToast("error", t("Error"), t("Gift card value must be positive"));
    if (cart.some((item) => item.type === "gift_card" && item.code === code)) {
      return showToast("error", t("Error"), t("This gift card code is already in the cart"));
    }
    setCart((previous) => [...previous, {
      id: `gc-${code}`,
      name: `${t("Gift Card")} ${code}`,
      price: value,
      type: "gift_card",
      cartId: globalThis.crypto.randomUUID(),
      qty: 1,
      code,
    }]);
    setGiftCardSaleCode("");
    setGiftCardSaleValue("");
  }

  const tierPercent = selectedCustomer ? getTierBySpend(selectedCustomer.totalSpent).discountPercent : 0;
  const selectedGiftCard = giftCards.find((card) => {
    if (card.code !== giftCardCode.trim().toUpperCase() || !card.isActive) return false;
    return !card.expiresAt || new Date(card.expiresAt).getTime() >= Date.now();
  });
  const customerWallet = useMemo(() => buildCustomerWallet({
    entitlements,
    loyaltyPoints: selectedCustomer?.loyaltyPoints ?? 0,
    depositAmount: visitAppointment?.depositAmount ?? 0,
  }), [entitlements, selectedCustomer, visitAppointment]);
  const cartServiceIds = useMemo(() => cart.filter((item) => item.type === "service").map((item) => item.id), [cart]);
  const applicablePackageSessions = useMemo(
    () => walletAvailableForCheckout(customerWallet, cartServiceIds).filter((benefit) => benefit.kind === "PACKAGE"),
    [customerWallet, cartServiceIds],
  );

  function appliedRedemptionEstimate() {
    let value = 0;
    for (const redemption of entitlementRedemptions) {
      if (redemption.type !== "units" || !redemption.serviceId) continue;
      const entitlement = entitlements.find((entry) => entry.id === redemption.entitlementId);
      if (!entitlement) continue;
      const serviceLines = cart
        .filter((item) => item.type === "service" && item.id === redemption.serviceId)
        .map((item) => ({ serviceId: item.id, price: Number(item.price), qty: Number(item.qty ?? 1) }));
      value += estimatePackageRedemptionValue(redemption, entitlement.remainingValue, serviceLines);
    }
    return value;
  }

  const checkoutTotals = calculateCheckoutTotals({
    items: cart.map((item) => ({ price: Number(item.price), qty: Number(item.qty ?? 1) })),
    manualDiscount: discount,
    tierPercent,
    loyaltyPoints: selectedCustomer?.loyaltyPoints ?? 0,
    useLoyaltyPoints,
    giftCardBalance: selectedGiftCard?.currentBalance ?? 0,
    entitlementRedemption: appliedRedemptionEstimate(),
    taxRate,
  });
  const { subtotal, tierDiscount, loyaltyDiscount, total } = checkoutTotals;

  function applyPackageSession(entitlementId: string, serviceId: string) {
    if (entitlementRedemptions.some((entry) => entry.entitlementId === entitlementId && entry.serviceId === serviceId)) return;
    setEntitlementRedemptions((previous) => [...previous, { entitlementId, type: "units", serviceId, units: 1 }]);
  }

  function removePackageSession(entitlementId: string, serviceId: string) {
    setEntitlementRedemptions((previous) => previous.filter((entry) => !(entry.entitlementId === entitlementId && entry.serviceId === serviceId)));
  }

  async function handleCheckout() {
    if (checkoutInFlightRef.current) return;
    if (!selectedCustomer || !selectedEmployee || cart.length === 0) {
      showToast("error", t("Error"), t("Please select a customer, employee, and add items to the cart"));
      return;
    }
    if (!Number.isFinite(discount) || discount < 0 || discount + tierDiscount > subtotal) {
      showToast("error", t("Error"), t("Discount cannot exceed subtotal"));
      return;
    }
    if (!["cash", "card", "transfer"].includes(paymentMethod.toLowerCase())) {
      showToast("error", t("Error"), t("Invalid payment method"));
      return;
    }
    if (cart.some((item) => !Number.isFinite(Number(item.price)) || Number(item.price) <= 0 || !Number.isInteger(Number(item.qty ?? 1)) || Number(item.qty ?? 1) <= 0)) {
      showToast("error", t("Error"), t("One or more items have an invalid price or quantity"));
      return;
    }

    checkoutInFlightRef.current = true;
    setCheckingOut(true);
    try {
      const result = await unwrap(useCases.invoices.checkout({
        customerId: selectedCustomer.id,
        employeeId: selectedEmployee,
        paymentMethod: paymentMethod.toLowerCase() as "cash" | "card" | "transfer",
        discountAmount: discount,
        useLoyaltyPoints,
        giftCardCode: giftCardCode.trim() ? giftCardCode.trim().toUpperCase() : undefined,
        entitlementRedemptions: entitlementRedemptions.length > 0 ? entitlementRedemptions : undefined,
        appointmentId: visitAppointment?.id,
        items: cart.map((item) => item.type === "service"
          ? { type: "service" as const, serviceId: item.id, qty: Number(item.qty ?? 1), price: Number(item.price) }
          : item.type === "product"
            ? { type: "product" as const, productId: item.id, qty: Number(item.qty ?? 1), price: Number(item.price) }
            : item.type === "package"
              ? { type: "package" as const, packageId: item.id, qty: Number(item.qty ?? 1), price: Number(item.price) }
              : { type: "gift_card" as const, code: item.code || "", qty: 1, price: Number(item.price) }),
      }));

      try {
        const receipt = await unwrap(useCases.invoices.getForPrint(result.invoice.id));
        setPrintData(receipt);
        setShowPrintModal(true);
        if (isDesktopShell()) {
          const html = `<div><h1>${escapePrintText(receipt.settings?.name || "LenaBeauty")}</h1><p>Invoice ${escapePrintText(receipt.invoice.id)}</p><p>Total: ${escapePrintText(formatOMRAmount(receipt.invoice.totalAmount))}</p></div>`;
          await desktopRepository.printHtml(`Invoice ${receipt.invoice.id}`, html);
        }
      } catch (error) {
        console.error("Print failed", error);
        showToast("error", t("Error"), t("Sale was recorded, but receipt could not be loaded"));
      }

      clearCart();
      if (visitAppointment) detachVisit();
      showToast("success", t("Success"), t("Sale and payment method recorded successfully"));
      try {
        await loadData();
      } catch (error) {
        console.error("Catalog refresh failed after successful checkout", error);
        showToast("error", t("Error"), t("Sale completed, but catalog refresh failed"));
      }
    } catch (error: any) {
      showToast("error", t("Error"), error?.message || t("Sale could not be recorded"));
    } finally {
      checkoutInFlightRef.current = false;
      setCheckingOut(false);
    }
  }

  const filteredItems = activeTab === "SERVICES"
    ? filterServicesForCatalog(services, selectedServiceCategory, itemSearchQ)
    : activeTab === "PRODUCTS"
      ? products.filter((item) => item.name.toLowerCase().includes(itemSearchQ.toLowerCase()))
      : packages.filter((item) => item.name.toLowerCase().includes(itemSearchQ.toLowerCase()));

  if (loadError) {
    return <ScreenState state="error" title={t("Failed to load point of sale")} description={loadError} actionLabel={t("Retry")} onAction={() => void loadData()} />;
  }

  return (
    <div className="flex flex-col gap-3 lg:gap-6 min-h-0 lg:min-h-[calc(100vh-120px)] pb-4 lg:pb-0 min-w-0 overflow-x-clip">
      <ReceiptPreviewModal data={showPrintModal ? printData : null} onClose={() => setShowPrintModal(false)} />
      <VisitContextCard appointment={visitAppointment} error={visitContextError} onDetach={detachVisit} />

      {/* Catalog and Cart stay the only mobile modes; no duplicate category row. */}
      {isMobile && (
        <PosMobileModeToggle
          showingCart={showCheckoutSummary}
          cartCount={cart.length}
          catalogLabel={t("Catalog")}
          cartLabel={t("Cart")}
          onShowCatalog={() => setShowCheckoutSummary(false)}
          onShowCart={() => setShowCheckoutSummary(true)}
        />
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-3 lg:gap-6 lg:min-h-0 px-0">
        {(!isMobile || !showCheckoutSummary) && (
          <PosCatalogPanel
            t={(key) => t(key)}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            itemSearchQ={itemSearchQ}
            onItemSearchChange={setItemSearchQ}
            itemSearchRef={itemSearchRef}
            services={services}
            selectedServiceCategory={selectedServiceCategory}
            onServiceCategoryChange={setSelectedServiceCategory}
            filteredItems={filteredItems}
            loading={loading}
            onAddToCart={addToCart}
            isMobile={isMobile}
            cartCount={cart.length}
            showingCheckout={showCheckoutSummary}
            onShowCheckout={() => setShowCheckoutSummary(true)}
            total={total}
            giftCardSaleCode={giftCardSaleCode}
            onGiftCardSaleCodeChange={setGiftCardSaleCode}
            giftCardSaleValue={giftCardSaleValue}
            onGiftCardSaleValueChange={setGiftCardSaleValue}
            onAddGiftCard={addGiftCardToCart}
          />
        )}

        {(!isMobile || showCheckoutSummary) && (
          <div className="w-full lg:w-[420px] flex flex-col rounded-2xl lg:rounded-[2.5rem] border border-border bg-card shadow-2xl overflow-hidden print:hidden lg:h-full safe-area-bottom">
            <div className="p-3 lg:p-6 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <span className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><ShoppingCart className="h-5 w-5" /></span>
                <div><h2 className="text-sm lg:text-lg font-bold">{t("Order")}</h2><p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{cart.length} {t("Items")}</p></div>
              </div>
              {cart.length > 0 && <button onClick={clearCart} className="h-11 w-11 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center touch-target" title={t("Clear cart")}><Trash2 className="h-4 w-4" /></button>}
            </div>

            <div className="flex-1 overflow-auto p-3 lg:p-6 space-y-1.5 scrollbar-hide">
              <AnimatePresence initial={false} mode="popLayout">
                {cart.length === 0 ? (
                  <ScreenState state="empty" compact icon={<ShoppingCart className="h-6 w-6" />} title={t("Cart is Empty")} description={t("Add items to start")} />
                ) : cart.map((item) => (
                  <motion.div layout key={item.cartId} className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 touch-target">
                    <span className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {item.type === "service" ? <Scissors className="h-4 w-4" /> : item.type === "product" ? <Package className="h-4 w-4" /> : <Boxes className="h-4 w-4" />}
                    </span>
                    <p className="flex-1 min-w-0 text-xs font-bold truncate">{item.name}</p>
                    <span className="text-xs font-bold">{formatOMRAmount(item.price)}</span>
                    <button onClick={() => setCart((previous) => previous.filter((entry) => entry.cartId !== item.cartId))} aria-label={t("Remove")} className="h-11 w-11 flex items-center justify-center rounded-md text-destructive touch-target"><Trash2 className="h-3.5 w-3.5" /></button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="p-3 lg:p-6 bg-muted/30 border-t border-border space-y-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground"><User className="h-3 w-3" />{t("Customer")}</label>
                  {selectedCustomer ? (
                    <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                      <div className="flex items-center gap-2 min-w-0"><span className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">{getInitials(selectedCustomer, "·")}</span><span className="text-xs font-bold truncate">{getDisplayName(selectedCustomer, t("Unnamed"))}</span></div>
                      <button onClick={() => setSelectedCustomer(null)} className="h-8 w-8 flex items-center justify-center rounded-lg text-destructive"><XCircle className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <div className="relative group">
                      <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input ref={searchInputRef} className="w-full rounded-lg border border-border bg-card ps-9 pe-10 py-2.5 text-xs font-medium mobile-input" placeholder={t("Search customer...")} value={searchQ} onChange={(event) => void searchCustomers(event.target.value)} />
                      <button onClick={() => { setShowNewCustomer((value) => !value); setCustomers([]); }} className="absolute end-1 top-1/2 -translate-y-1/2 h-8 px-2 rounded-md bg-primary/10 text-primary touch-target" title={t("New customer")}><UserPlus className="h-3.5 w-3.5" /></button>
                      {customers.length > 0 && <div className="absolute bottom-full inset-x-0 mb-2 rounded-lg border border-border bg-card shadow-xl max-h-44 overflow-auto z-50 p-1">{customers.map((customer) => <button key={customer.id} onClick={() => void selectCustomer(customer)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-start touch-target"><span className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold">{getInitials(customer, "·")}</span><span className="text-xs font-bold truncate">{getDisplayName(customer, t("Unnamed"))}</span></button>)}</div>}
                    </div>
                  )}
                  {showNewCustomer && !selectedCustomer && <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2"><input className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-bold" placeholder={t("Customer name")} value={newCustomerName} onChange={(event) => setNewCustomerName(event.target.value)} /><input className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-bold" placeholder={t("Phone")} value={newCustomerPhone} onChange={(event) => setNewCustomerPhone(event.target.value)} /><button onClick={() => void handleCreateCustomer()} disabled={creatingCustomer || !newCustomerName.trim()} className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50">{creatingCustomer ? t("Creating...") : t("Create & select")}</button></div>}
                </div>

                {selectedCustomer && customerWallet.hasValue && (
                  <div className="rounded-lg border border-border bg-muted/20 p-2.5 space-y-2">
                    <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground"><Wallet className="h-3 w-3" />{t("wallet.title")}</p>
                    {customerWallet.giftCards.map((giftCard) => <button key={giftCard.entitlementId} type="button" onClick={() => giftCard.code && setGiftCardCode(giftCard.code)} disabled={!giftCard.code} className="w-full flex items-center justify-between rounded-md border border-border bg-card px-2.5 py-2 text-[10px] font-bold disabled:opacity-50"><span dir="ltr">{giftCard.code}</span><span>{formatOMRAmount(giftCard.remainingValue)} {t("OMR")}</span></button>)}
                    {applicablePackageSessions.map((benefit) => {
                      const session = benefit.packageSession!;
                      const applied = entitlementRedemptions.some((entry) => entry.entitlementId === session.entitlementId && entry.serviceId === session.serviceId);
                      return <div key={`${session.entitlementId}-${session.serviceId}`} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-2"><div className="min-w-0"><p className="text-[10px] font-bold truncate">{session.packageName}{session.serviceName ? ` · ${session.serviceName}` : ""}</p><p className="text-[9px] text-muted-foreground">{session.remainingUnits} {t("passport.sessionsLeft")}</p></div><button type="button" onClick={() => applied ? removePackageSession(session.entitlementId, session.serviceId) : applyPackageSession(session.entitlementId, session.serviceId)} className={clsx("h-8 px-2.5 rounded-md text-[10px] font-bold", applied ? "bg-success/15 text-success" : "bg-primary/10 text-primary")}>{applied ? t("wallet.used") : t("wallet.use")}</button></div>;
                    })}
                    {customerWallet.rewardsPoints > 0 && <p className="text-[10px] text-muted-foreground">{t("wallet.rewards")}: {customerWallet.rewardsPoints} {t("Points")}</p>}
                    {customerWallet.depositAmount > 0 && <p className="text-[10px] text-muted-foreground">{t("wallet.deposit")}: {formatOMRAmount(customerWallet.depositAmount)} {t("OMR")}</p>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground"><span className="flex items-center gap-1.5"><Scissors className="h-3 w-3" />{t("Specialist")}</span><span className="relative block"><select className="w-full rounded-lg border border-border bg-card px-2 py-2.5 text-xs font-bold appearance-none touch-target" value={selectedEmployee} onChange={(event) => setSelectedEmployee(event.target.value)}><option value="">{t("Select")}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select><ChevronRight className="absolute end-2 top-1/2 -translate-y-1/2 h-3 w-3 rotate-90 pointer-events-none" /></span></label>
                  <label className="space-y-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground"><span className="flex items-center gap-1.5"><Wallet className="h-3 w-3" />{t("Payment")}</span><span className="relative block"><select className="w-full rounded-lg border border-border bg-card px-2 py-2.5 text-xs font-bold appearance-none touch-target" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="CASH">{t("Cash")}</option><option value="CARD">{t("Card")}</option><option value="TRANSFER">{t("Transfer")}</option></select><ChevronRight className="absolute end-2 top-1/2 -translate-y-1/2 h-3 w-3 rotate-90 pointer-events-none" /></span></label>
                </div>
                <p className="text-[10px] leading-relaxed text-muted-foreground">{t("The selected payment method confirms manual collection outside the app; no card is charged here")}</p>

                {selectedCustomer && selectedCustomer.loyaltyPoints > 0 && <div className="flex items-center justify-between rounded-lg border border-success/20 bg-success/5 p-2.5"><p className="flex items-center gap-2 text-[9px] font-bold text-success"><Sparkles className="h-4 w-4" />{selectedCustomer.loyaltyPoints} {t("Points")} (-{formatOMRAmount(loyaltyDiscount)})</p><button onClick={() => setUseLoyaltyPoints((value) => !value)} role="switch" aria-checked={useLoyaltyPoints} aria-label={t("Loyalty Points")} className={clsx("h-8 px-3 rounded-lg text-[10px] font-bold", useLoyaltyPoints ? "bg-success text-white" : "bg-muted")}>{useLoyaltyPoints ? t("wallet.used") : t("wallet.use")}</button></div>}
                <input className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-bold" placeholder={t("Gift card code")} value={giftCardCode} onChange={(event) => setGiftCardCode(event.target.value.toUpperCase())} />
              </div>

              {/* Record completed sale stays in the mobile thumb zone above-bottom-nav. */}
              <div className="pt-3 border-t border-border space-y-3 sticky z-20 bg-muted/95 backdrop-blur-sm -mx-3 px-3 pb-3 lg:static lg:bg-transparent lg:mx-0 lg:px-0 lg:pb-0 above-bottom-nav lg:bottom-auto">
                <div className="flex items-center justify-between"><span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("Total")}</span><span className="text-2xl font-bold text-primary">{formatOMRAmount(total)} <small className="text-[9px] text-muted-foreground">{t("OMR")}</small></span></div>
                <button onClick={() => void handleCheckout()} disabled={checkingOut || cart.length === 0 || !selectedCustomer || !selectedEmployee} className="w-full min-h-12 rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2 touch-target"><CheckCircle2 className="h-5 w-5" /><span>{checkingOut ? t("Processing...") : t("Record completed sale")}</span></button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
