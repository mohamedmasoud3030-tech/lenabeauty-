import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap, formatError } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { 
  ShoppingCart, User, CreditCard, Search, Trash2, Plus, 
  Scissors, Package, Boxes, ChevronRight, CheckCircle2, Sparkles, 
  ArrowRight, Minus, Receipt, Wallet, Banknote, UserPlus, XCircle, AlertTriangle,
  Zap, Clock, TrendingUp
} from "lucide-react";
import { InvoicePrintLayout } from "../shared/components/InvoicePrintLayout";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";
import { Customer, Employee, Product, Service } from "../domain/entities";
import { getTierBySpend } from "../domain/loyalty";
import { InvoicePrintData } from "../application/dto";

interface CartItem {
  id: string;
  name: string;
  price: number;
  type: "service" | "product" | "package";
  cartId: string;
  qty?: number;
  stockQuantity?: number;
  category?: string;
  brand?: string;
  includedServices?: number;
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
  const [searchQ, setSearchQ] = useState("");
  const [itemSearchQ, setItemSearchQ] = useState("");
  const [activeTab, setActiveTab] = useState<"SERVICES" | "PRODUCTS" | "PACKAGES">("SERVICES");
  const [printData, setPrintData] = useState<PosPrintData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [showCheckoutSummary, setShowCheckoutSummary] = useState(isMobile);
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
      setServices(s);
      setProducts(p);
      setPackages(pkg);
      setEmployees(e);
      setGiftCards(gc);
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

  function addToCart(item: {id:string, name:string, price:number, qty?:number, target?:string, stockQuantity?: number, includedServices?: number}, type: "service" | "product" | "package") {
    if (type === "product" && item.stockQuantity !== undefined && item.stockQuantity <= 0) {
      showToast('error', t("Error"), t("Out of stock!"));
      return;
    }
    setCart([...cart, { ...item, type, cartId: Math.random().toString(36).substring(2, 11) }]);
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
  }

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.qty ?? 1), 0);
  // Mirror the server RPC (process_checkout_v1): 1 loyalty point = 1 OMR,
  // capped at (subtotal - manual discount). Previously this used /100 which
  // disagreed with the backend and showed the customer the wrong discount.
  // Automatic tier discount from the customer's lifetime spend
  // (server-authoritative; mirrored here for an accurate preview).
  const tierInfo = selectedCustomer ? getTierBySpend(selectedCustomer.totalSpent) : null;
  const tierPercent = tierInfo?.discountPercent ?? 0;
  const tierDiscount = Math.round(subtotal * tierPercent / 100 * 1000) / 1000;
  const loyaltyDiscount =
    useLoyaltyPoints && selectedCustomer
      ? Math.max(0, Math.min(subtotal - discount - tierDiscount, selectedCustomer.loyaltyPoints))
      : 0;
  const selectedGiftCard = giftCards.find((card) => card.code === giftCardCode.trim().toUpperCase());
  const giftCardDiscount = selectedGiftCard
    ? Math.max(0, Math.min(subtotal - discount - tierDiscount - loyaltyDiscount, selectedGiftCard.currentBalance))
    : 0;
  // Net (pre-tax) after discounts, then VAT from center settings, then total.
  // Mirrors the server RPC exactly so the preview equals what is persisted.
  const net = Math.max(0, subtotal - discount - tierDiscount - loyaltyDiscount - giftCardDiscount);
  const tax = Math.round(net * (taxRate || 0) / 100 * 1000) / 1000;
  const total = net + tax;

  async function handleCheckout() {
    if (!selectedCustomer || !selectedEmployee || cart.length === 0) {
      showToast('error', t("Error"), t("Please select a customer, employee, and add items to the cart"));
      return;
    }

    if (discount + tierDiscount + loyaltyDiscount + giftCardDiscount > subtotal) {
      showToast('error', t("Error"), t("Discount cannot exceed subtotal"));
      return;
    }

    if (!["cash", "card", "transfer"].includes(paymentMethod.toLowerCase())) {
      showToast('error', t("Error"), t("Invalid payment method"));
      return;
    }

    const hasInvalidPriceOrQty = cart.some(it => isNaN(Number(it.price)) || Number(it.price) < 0);
    if (hasInvalidPriceOrQty) {
      showToast('error', t("Error"), t("One or more items have an invalid price or quantity"));
      return;
    }

    try {
      const payload = {
        customerId: selectedCustomer.id,
        employeeId: selectedEmployee || undefined,
        paymentMethod: paymentMethod.toLowerCase() as "cash" | "card" | "transfer",
        discountAmount: discount,
        useLoyaltyPoints,
        giftCardCode: giftCardCode.trim() ? giftCardCode.trim().toUpperCase() : undefined,
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
          } else {
            return {
              type: "package" as const,
              packageId: it.id,
              qty: Number(it.qty ?? 1),
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
      } catch (e) {
        console.error("Print failed", e);
      }

      clearCart();
      showToast('success', t("Success"), t("Payment successful!"));
    } catch (err: any) {
      showToast('error', t("Error"), err.message || t("Payment failed"));
    }
  }

  const filteredItems = activeTab === "SERVICES"
    ? services.filter(it => it.name.toLowerCase().includes(itemSearchQ.toLowerCase()))
    : activeTab === "PRODUCTS"
      ? products.filter(it => it.name.toLowerCase().includes(itemSearchQ.toLowerCase()))
      : packages.filter((it: any) => it.name.toLowerCase().includes(itemSearchQ.toLowerCase()));

  return (
    <div className="flex flex-col gap-4 lg:gap-6 min-h-[calc(100vh-120px)] pb-4 lg:pb-0">

      {/* Print Modal */}
      {showPrintModal && printData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl print:p-0 print:bg-transparent">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] shadow-2xl overflow-hidden max-w-lg w-full max-h-[90vh] overflow-y-auto print:shadow-none print:rounded-none print:max-h-none"
          >
            <div id="invoice-print-container">
              <InvoicePrintLayout data={printData} onClose={() => setShowPrintModal(false)} />
            </div>
          </motion.div>
        </div>
      )}

      {/* Mobile: Toggle between catalog and checkout */}
      {isMobile && (
        <div className="flex gap-2 px-4 pt-4">
          <button
            onClick={() => setShowCheckoutSummary(false)}
            className={clsx(
              "flex-1 py-3 rounded-xl font-bold text-sm transition-all",
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
              "flex-1 py-3 rounded-xl font-bold text-sm transition-all relative",
              showCheckoutSummary 
                ? "bg-primary text-primary-foreground shadow-lg" 
                : "bg-muted text-muted-foreground"
            )}
          >
            {t("Cart")}
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 lg:min-h-0 px-4 lg:px-0">

        {/* Left: Items Selection (Hidden on mobile if showing checkout) */}
        {(!isMobile || !showCheckoutSummary) && (
          <div className="flex-1 flex flex-col rounded-2xl lg:rounded-[2.5rem] border border-border bg-card shadow-sm overflow-hidden print:hidden lg:h-full">

            <div className="p-4 lg:p-6 border-b border-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-lg lg:text-xl font-bold tracking-tight text-foreground">{t("Service Catalog")}</h2>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{t("Press F1 to search")}</p>
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
            </div>

            <div className="flex-1 overflow-auto p-4 lg:p-6 bg-muted/5 scrollbar-hide min-h-[40vh] lg:min-h-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40 py-20">
                  <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">{t("Loading Catalog...")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
                  <AnimatePresence mode="popLayout">
                    {filteredItems.map((it, idx) => (
                      <motion.button
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.02 } }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        key={it.id} 
                        onClick={() => addToCart(it as any, activeTab === "SERVICES" ? "service" : activeTab === "PRODUCTS" ? "product" : "package")}
                        disabled={activeTab === "PRODUCTS" && (it as Product).stockQuantity <= 0}
                        className={clsx(
                          "group relative rounded-xl lg:rounded-2xl border border-border bg-card p-3 lg:p-4 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 hover:border-primary/50 flex flex-col items-start gap-3 text-start",
                          activeTab === "PRODUCTS" && (it as Product).stockQuantity <= 0 && "opacity-50 grayscale pointer-events-none"
                        )}
                      >
                        <div className="flex items-start justify-between w-full gap-2">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                            {activeTab === "SERVICES" ? <Scissors className="h-4 w-4" /> : activeTab === "PRODUCTS" ? <Package className="h-4 w-4" /> : <Boxes className="h-4 w-4" />}
                          </div>
                          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg">
                            <Plus className="h-4 w-4" />
                          </div>
                        </div>
                        
                        <div className="flex-1 w-full">
                          <h3 className="text-sm font-bold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">{it.name}</h3>
                          {activeTab === "PRODUCTS" && (
                            <div className={clsx(
                              "mt-1 text-[10px] font-bold uppercase tracking-wider",
                              (it as Product).stockQuantity > 5 ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {(it as Product).stockQuantity} {t("Stock")}
                            </div>
                          )}
                          {activeTab === "PACKAGES" && (
                            <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-sky-600">
                              {(it as any).items?.length || 0} {t("Included Services")}
                            </div>
                          )}
                        </div>

                        <div className="w-full pt-2 border-t border-border/50 flex items-baseline justify-between">
                          <span className="text-base lg:text-lg font-bold text-foreground">{it.price}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{t("OMR")}</span>
                        </div>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                  {filteredItems.length === 0 && (
                    <div className="col-span-full py-16 lg:py-24 flex flex-col items-center justify-center gap-4 opacity-20">
                      <Search className="h-12 w-12" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">{t("No items found")}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right: Checkout Panel (Hidden on mobile if showing catalog) */}
        {(!isMobile || showCheckoutSummary) && (
          <div className="w-full lg:w-[420px] flex flex-col rounded-2xl lg:rounded-[2.5rem] border border-border bg-card shadow-2xl overflow-hidden print:hidden lg:h-full">
            
            {/* Header */}
            <div className="p-4 lg:p-6 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-lg font-bold">{t("Order")}</h2>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{cart.length} {t("Items")}</p>
                </div>
              </div>
              {cart.length > 0 && (
                <motion.button
                  key={cart.length}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  onClick={clearCart}
                  className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                  title={t("Clear cart")}
                >
                  <Trash2 className="h-4 w-4" />
                </motion.button>
              )}
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-2 scrollbar-hide">
              <AnimatePresence initial={false} mode="popLayout">
                {cart.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-30 py-8"
                  >
                    <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center">
                      <ShoppingCart className="h-8 w-8" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-widest">{t("Cart is Empty")}</p>
                      <p className="text-[10px]">{t("Add items to start")}</p>
                    </div>
                  </motion.div>
                ) : (
                  cart.map((item) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20, scale: 0.95 }}
                      key={item.cartId} 
                      className="group flex items-center gap-3 rounded-lg border border-border p-3 transition-all hover:bg-muted/30 hover:shadow-inner"
                    >
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-colors text-sm font-bold">
                        {item.type === "service" ? <Scissors className="h-4 w-4" /> : item.type === "product" ? <Package className="h-4 w-4" /> : <Boxes className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-foreground leading-tight">{item.name}</p>
                        <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">
                          {item.type === "service" ? t("Service") : item.type === "product" ? t("Product") : t("Package")}
                        </p>
                      </div>
                      <div className="text-end space-y-1">
                        <p className="text-xs font-bold text-foreground">{item.price} <span className="text-[9px] opacity-50">{t("OMR")}</span></p>
                        <button 
                          onClick={() => removeFromCart(item.cartId)} 
                          className="h-6 w-6 flex items-center justify-center rounded-md text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Checkout Form */}
            <div className="p-4 lg:p-6 bg-muted/30 border-t border-border space-y-6">
              <div className="space-y-4">
                
                {/* Customer Search */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <User className="h-3 w-3" />
                    {t("Customer")}
                  </label>
                  <AnimatePresence mode="wait">
                    {selectedCustomer ? (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3 shadow-inner"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shadow-lg">
                            {selectedCustomer.name[0]}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-foreground block truncate">{selectedCustomer.name}</span>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate">{selectedCustomer.phone}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => setSelectedCustomer(null)} 
                          className="h-8 w-8 flex items-center justify-center rounded-lg bg-background border border-border text-rose-500 hover:bg-rose-500/10 transition-all shrink-0"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </motion.div>
                    ) : (
                      <div className="relative group">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                          ref={searchInputRef}
                          className="w-full rounded-lg border border-border bg-card ps-10 pe-3 py-2.5 text-xs font-medium outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                          placeholder={t("Search customer...")}
                          value={searchQ}
                          onChange={(e) => searchCustomers(e.target.value)}
                        />
                        <AnimatePresence>
                          {customers.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute bottom-full inset-x-0 mb-2 rounded-lg border border-border bg-card shadow-2xl max-h-48 overflow-auto z-50 p-1"
                            >
                              {customers.map(c => (
                                <button 
                                  key={c.id} 
                                  onClick={() => { setSelectedCustomer(c); setCustomers([]); setSearchQ(""); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-lg text-start transition-all group/item"
                                >
                                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold group-hover/item:bg-primary group-hover/item:text-primary-foreground transition-colors shrink-0">{c.name[0]}</div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-foreground truncate">{c.name}</p>
                                    <p className="text-[9px] text-muted-foreground font-bold tracking-widest truncate">{c.phone}</p>
                                  </div>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Employee Select */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <Scissors className="h-3 w-3" />
                    {t("Specialist")}
                  </label>
                  <div className="relative">
                    <select 
                      className="w-full rounded-lg border border-border bg-card ps-3 pe-8 py-2.5 text-xs font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer"
                      value={selectedEmployee}
                      onChange={(e) => setSelectedEmployee(e.target.value)}
                    >
                      <option value="">{t("Choose specialist")}</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    <ChevronRight className="absolute end-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none rotate-90" />
                  </div>
                </div>

                {/* Payment & Discount */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      <Wallet className="h-3 w-3" />
                      {t("Payment")}
                    </label>
                    <div className="relative">
                      <select 
                        className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      >
                        <option value="CASH">{t("Cash")}</option>
                        <option value="CARD">{t("Card")}</option>
                        <option value="TRANSFER">{t("Transfer")}</option>
                      </select>
                      <ChevronRight className="absolute end-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none rotate-90" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      <Minus className="h-3 w-3" />
                      {t("Discount")}
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                        value={discount}
                        onChange={(e) => setDiscount(Number(e.target.value))}
                        placeholder="0.00"
                      />
                      <div className="absolute end-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted-foreground uppercase pointer-events-none">{t("OMR")}</div>
                    </div>
                  </div>
                </div>

                {/* Loyalty Points */}
                {selectedCustomer && selectedCustomer.loyaltyPoints > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 shadow-inner"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">{selectedCustomer.loyaltyPoints} {t("Points")}</p>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">{loyaltyDiscount} {t("OMR Discount")}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setUseLoyaltyPoints(!useLoyaltyPoints)}
                      className={clsx(
                        "relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-none shadow-inner shrink-0",
                        useLoyaltyPoints ? "bg-emerald-500" : "bg-muted"
                      )}
                    >
                      <span className={clsx(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-md",
                        useLoyaltyPoints ? "translate-x-5" : "translate-x-1"
                      )} />
                    </button>
                  </motion.div>
                )}

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <CreditCard className="h-3 w-3" />
                    {t("Gift Card")}
                  </label>
                  <input
                    className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                    placeholder={t("Enter gift card code")}
                    value={giftCardCode}
                    onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
                  />
                  {selectedGiftCard && (
                    <p className="text-[9px] font-bold text-sky-600 uppercase tracking-widest">
                      {t("Available Balance")}: {selectedGiftCard.currentBalance.toFixed(2)} {t("OMR")} · {t("Redeem for")} {giftCardDiscount.toFixed(2)} {t("OMR")}
                    </p>
                  )}
                </div>
              </div>

              {/* Summary & Checkout */}
              <div className="pt-4 border-t border-border space-y-4">
                <div className="space-y-2 bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    <span>{t("Subtotal")}</span>
                    <span>{subtotal.toFixed(2)} OMR</span>
                  </div>
                  {tierDiscount > 0 && tierInfo && (
                    <div className="flex items-center justify-between text-[9px] font-bold text-emerald-600 uppercase tracking-widest">
                      <span>{tierInfo.icon} {t(tierInfo.labelKey)} ({tierPercent}%)</span>
                      <span>-{tierDiscount.toFixed(2)} OMR</span>
                    </div>
                  )}
                  {(discount > 0 || loyaltyDiscount > 0 || giftCardDiscount > 0) && (
                    <div className="flex items-center justify-between text-[9px] font-bold text-rose-500 uppercase tracking-widest">
                      <span>{t("Discounts")}</span>
                      <span>-{(discount + loyaltyDiscount + giftCardDiscount).toFixed(2)} OMR</span>
                    </div>
                  )}
                  {giftCardDiscount > 0 && (
                    <div className="flex items-center justify-between text-[9px] font-bold text-sky-600 uppercase tracking-widest">
                      <span>{t("Gift Card Redemption")}</span>
                      <span>-{giftCardDiscount.toFixed(2)} OMR</span>
                    </div>
                  )}
                  {taxRate > 0 && (
                    <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                      <span>{t("VAT")} ({taxRate}%)</span>
                      <span>{tax.toFixed(2)} OMR</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <span className="text-xs font-bold text-foreground uppercase tracking-[0.1em]">{t("Total")}</span>
                    <div className="text-end">
                      <span className="text-2xl lg:text-3xl font-bold tracking-tighter text-primary">{total.toFixed(2)}</span>
                      <span className="text-[9px] font-bold text-muted-foreground ms-1 uppercase">{t("OMR")}</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || !selectedCustomer || !selectedEmployee}
                  className="group relative w-full rounded-lg bg-primary py-3 lg:py-4 font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 overflow-hidden text-sm lg:text-base"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <CheckCircle2 className="h-5 w-5 relative z-10" />
                  <span className="relative z-10">{t("Complete Payment")}</span>
                  <span className="text-[7px] lg:text-[8px] font-bold">(Ctrl+Enter)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
