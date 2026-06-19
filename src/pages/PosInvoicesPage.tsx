import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCases } from "../app/composition/useCases";
import { unwrap, formatError } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { mapErrorToMessage } from "../application/errors/ErrorMapper";
import { 
  ShoppingCart, User, CreditCard, Search, Trash2, Plus, 
  Scissors, Package, ChevronRight, CheckCircle2, Sparkles, 
  ArrowRight, Minus, Receipt, Wallet, Banknote, UserPlus, XCircle, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";
import { Customer, Employee, Product, Service } from "../domain/entities";
import { InvoicePrintData } from "../application/dto";

interface CartItem {
  id: string;
  name: string;
  price: number;
  type: "service" | "product";
  cartId: string;
  stockQuantity?: number;
  category?: string;
  brand?: string;
}

interface PosPrintData extends InvoicePrintData {
  settings?: {
    name: string;
    address?: string;
    phone?: string;
    currency?: string;
  };
}

export default function PosInvoicesPage() {
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [discount, setDiscount] = useState(0);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [itemSearchQ, setItemSearchQ] = useState("");
  const [activeTab, setActiveTab] = useState<"SERVICES" | "PRODUCTS">("SERVICES");
  const [printData, setPrintData] = useState<PosPrintData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [s, p, e] = await Promise.all([
        unwrap(useCases.services.list()),
        unwrap(useCases.products.list()),
        unwrap(useCases.employees.list()),
      ]);
      setServices(s);
      setProducts(p);
      setEmployees(e);
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

  function addToCart(item: {id:string, name:string, price:number, qty?:number, target?:string, stockQuantity?: number}, type: "service" | "product") {
    if (type === "product" && item.stockQuantity !== undefined && item.stockQuantity <= 0) {
      showToast('error', 'Error', t("Out of stock!"));
      return;
    }
    setCart([...cart, { ...item, type, cartId: Math.random().toString(36).substring(2, 11) }]);
  }

  function removeFromCart(cartId: string) {
    setCart(cart.filter(it => it.cartId !== cartId));
  }

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price), 0);
  const loyaltyDiscount = useLoyaltyPoints && selectedCustomer ? Math.floor(selectedCustomer.loyaltyPoints / 100) : 0;
  const total = Math.max(0, subtotal - discount - loyaltyDiscount);

  async function handleCheckout() {
    if (!selectedCustomer || !selectedEmployee || cart.length === 0) {
      showToast('error', 'Error', t("Please select a customer, employee, and add items to the cart"));
      return;
    }

    if (discount + loyaltyDiscount > subtotal) {
      showToast('error', 'Error', t("Discount cannot exceed subtotal"));
      return;
    }

    if (!["cash", "card", "transfer"].includes(paymentMethod.toLowerCase())) {
      showToast('error', 'Error', t("Invalid payment method"));
      return;
    }

    const hasInvalidPriceOrQty = cart.some(it => isNaN(Number(it.price)) || Number(it.price) < 0);
    if (hasInvalidPriceOrQty) {
      showToast('error', 'Error', t("One or more items have an invalid price or quantity"));
      return;
    }

    try {
      const payload = {
        customerId: selectedCustomer.id,
        employeeId: selectedEmployee || undefined,
        paymentMethod: paymentMethod.toLowerCase() as "cash" | "card" | "transfer",
        discountAmount: discount,
        useLoyaltyPoints,
        items: cart.map(it => {
          if (it.type === "service") {
            return {
              type: "service" as const,
              serviceId: it.id,
              qty: 1,
              price: Number(it.price)
            };
          } else {
            return {
              type: "product" as const,
              productId: it.id,
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
        setTimeout(() => {
          window.print();
          setPrintData(null);
        }, 500);
      } catch (e) {
        console.error("Print failed", e);
      }

      setCart([]);
      setSelectedCustomer(null);
      setDiscount(0);
      setUseLoyaltyPoints(false);
      showToast('success', t("Success"), t("Payment successful!"));
    } catch (err: any) {
      if (err.code === "BACKEND_METHOD_UNSUPPORTED") {
         showToast('error', t("Backend Required"), t("BACKEND_METHOD_UNSUPPORTED"));
      } else {
         showToast('error', 'Error', err.message || t("Payment failed"));
      }
    }
  }

  const filteredItems = activeTab === "SERVICES"
    ? services.filter(it => 
        it.name.toLowerCase().includes(itemSearchQ.toLowerCase())
      )
    : products.filter(it => 
        it.name.toLowerCase().includes(itemSearchQ.toLowerCase())
      );

  return (
    <div className="flex flex-col gap-6 lg:gap-8 min-h-[calc(100vh-120px)] lg:h-[calc(100vh-120px)] lg:min-h-0 pb-4">
      {/* Backend Required Warning Banner */}
      <div className="w-full bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-[1.5rem] py-3 px-6 shrink-0 flex items-center justify-start gap-4 print:hidden backdrop-blur-sm">
        <AlertTriangle className="h-6 w-6 shrink-0" />
        <div>
          <span className="text-sm font-bold block">{t("Backend Schema Required")}</span>
          <span className="text-[10px] font-medium uppercase tracking-widest opacity-80">{t("BACKEND_METHOD_UNSUPPORTED")}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-8 lg:min-h-0">
        {/* Print Area Hidden */}
      {printData && (
        <div id="print-area" className="hidden print:block bg-white text-black p-8 font-sans text-sm w-[80mm] mx-auto" dir={i18n.language === "ar" ? "rtl" : "ltr"}>
          <div className="text-center mb-6 space-y-1">
            <h1 className="font-bold text-xl">{printData.settings?.name || "Kanzy Spa"}</h1>
            <div className="text-xs opacity-70">{printData.settings?.address}</div>
            <div className="text-xs opacity-70">{printData.settings?.phone}</div>
          </div>
          <div className="border-t border-b border-dashed border-black py-3 mb-4 text-xs space-y-1">
            <div className="flex justify-between">
              <span>{i18n.language === "ar" ? "رقم الفاتورة:" : "Invoice No:"}</span> 
              <span className="font-bold">{printData.invoice.id.slice(-6).toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span>{i18n.language === "ar" ? "التاريخ:" : "Date:"}</span> 
              <span>{new Date(printData.invoice.date).toLocaleString(i18n.language || "ar")}</span>
            </div>
            <div className="flex justify-between">
              <span>{i18n.language === "ar" ? "العميل:" : "Customer:"}</span> 
              <span className="font-bold">{printData.customer?.name}</span>
            </div>
          </div>
          <table className="w-full text-xs mb-4">
            <thead>
              <tr className="border-b border-black">
                <th className="py-2 text-start">
                  {i18n.language === "ar" ? "الصنف" : "Item"}
                </th>
                <th className="py-2 text-end">
                  {i18n.language === "ar" ? "السعر" : "Price"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-black/20">
              {printData.items.map((it) => (
                <tr key={it.id}>
                  <td className="py-2">{it.name}</td>
                  <td className="py-2 font-bold text-end">{it.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-black pt-3 text-base font-bold flex justify-between">
            <span>{i18n.language === "ar" ? "الإجمالي:" : "Total Amount:"}</span>
            <span>{printData.invoice.totalAmount} {printData.settings?.currency}</span>
          </div>
          <div className="text-center mt-10 text-xs opacity-50 italic">
            {i18n.language === "ar" ? "شكراً لزيارتكم!" : "Thank you for your visit!"}
          </div>
        </div>
      )}

      {/* Left: Items Selection */}
      <div className="flex-1 flex flex-col rounded-[1.5rem] lg:rounded-[2.5rem] border border-border bg-card shadow-sm overflow-hidden print:hidden lg:h-full">

        <div className="p-4 sm:p-5 lg:p-8 border-b border-border space-y-4 lg:space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 lg:gap-6">
            <div className="space-y-1">
              <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">{t("Service Catalog")}</h2>
              <p className="text-[10px] lg:text-xs text-muted-foreground font-bold uppercase tracking-widest">{t("Select items for checkout")}</p>
            </div>
            <div className="flex bg-muted rounded-2xl p-1.5 shadow-inner self-start sm:self-auto w-full sm:w-auto">
              <button 
                onClick={() => setActiveTab("SERVICES")}
                className={clsx(
                  "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 lg:px-6 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                  activeTab === "SERVICES" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Scissors className="h-4 w-4 shrink-0" />
                {t("Services")}
              </button>
              <button 
                onClick={() => setActiveTab("PRODUCTS")}
                className={clsx(
                  "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 lg:px-6 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                  activeTab === "PRODUCTS" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Package className="h-4 w-4 shrink-0" />
                {t("Products")}
              </button>
            </div>
          </div>
          <div className="relative group">
            <Search className="absolute start-4 lg:start-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input 
              className="w-full rounded-2xl lg:rounded-[1.5rem] border border-border bg-muted/30 ps-10 lg:ps-12 pe-4 lg:pe-6 py-3 lg:py-4 text-sm font-medium outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
              placeholder={t("Search by name or category...")}
              value={itemSearchQ}
              onChange={(e) => setItemSearchQ(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-5 lg:p-8 bg-muted/5 scrollbar-hide min-h-[50vh] lg:min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40 py-20">
              <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] font-bold uppercase tracking-widest">{t("Loading Catalog...")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-6">
              <AnimatePresence mode="popLayout">
                {filteredItems.map((it, idx) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.02 } }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={it.id} 
                    onClick={() => addToCart(it, activeTab === "SERVICES" ? "service" : "product")}
                    className={clsx(
                      "group relative cursor-pointer rounded-[1.5rem] lg:rounded-[2rem] border border-border bg-card p-5 lg:p-6 shadow-sm transition-all hover:shadow-2xl hover:-translate-y-1 hover:border-primary/50 flex flex-row lg:flex-col items-center lg:items-start gap-4",
                      activeTab === "PRODUCTS" && (it as Product).stockQuantity <= 0 && "opacity-50 grayscale pointer-events-none"
                    )}
                  >
                    <div className="h-12 w-12 rounded-2xl bg-muted flex flex-col items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-all lg:group-hover:scale-110">
                      {activeTab === "SERVICES" ? <Scissors className="h-5 lg:h-6 w-5 lg:w-6" /> : <Package className="h-5 lg:h-6 w-5 lg:w-6" />}
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center justify-between gap-2 lg:hidden mb-1">
                        <h3 className="text-sm font-bold text-foreground leading-tight truncate group-hover:text-primary transition-colors">{it.name}</h3>
                        {activeTab === "PRODUCTS" && (
                          <div className={clsx(
                            "px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider shrink-0",
                            (it as Product).stockQuantity > 5 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                          )}>
                            {(it as Product).stockQuantity} {t("In Stock")}
                          </div>
                        )}
                      </div>

                      <div className="hidden lg:block space-y-1 w-full relative">
                        <div className="flex justify-between items-start w-full">
                           <h3 className="text-base font-bold text-foreground leading-tight group-hover:text-primary transition-colors pe-2">{it.name}</h3>
                           {activeTab === "PRODUCTS" && (
                            <div className={clsx(
                              "px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider shrink-0 mt-1",
                              (it as Product).stockQuantity > 5 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                            )}>
                              {(it as Product).stockQuantity} {t("In Stock")}
                            </div>
                           )}
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.15em]">
                          {activeTab === "SERVICES" ? t("Service") : t("General")}
                        </p>
                      </div>

                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.15em] lg:hidden mb-1">
                          {activeTab === "SERVICES" ? t("Service") : t("General")}
                      </p>

                      <div className="pt-2 lg:pt-4 mt-auto flex items-center justify-between lg:border-t border-border/50">
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg lg:text-xl font-bold text-foreground">{it.price}</span>
                          <span className="text-[9px] lg:text-[10px] font-bold text-muted-foreground uppercase">{t("OMR")}</span>
                        </div>
                        <div className={clsx(
                          "h-8 lg:h-10 w-8 lg:w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg shadow-primary/20",
                          i18n.language === "ar" ? "-translate-x-2 lg:-translate-x-4 group-hover:translate-x-0" : "translate-x-2 lg:translate-x-4 group-hover:translate-x-0"
                        )}>
                          <Plus className="h-4 lg:h-5 w-4 lg:w-5" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredItems.length === 0 && (
                <div className="col-span-full py-20 lg:py-32 flex flex-col items-center justify-center gap-4 opacity-20">
                  <Search className="h-12 lg:h-16 w-12 lg:w-16" />
                  <p className="text-[10px] lg:text-sm font-bold uppercase tracking-widest">{t("No items found")}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Checkout Panel */}
      <div className="w-full lg:w-[450px] flex flex-col rounded-[1.5rem] lg:rounded-[2.5rem] border border-border bg-card shadow-2xl overflow-hidden print:hidden lg:h-full">
        <div className="p-5 sm:p-8 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div className="space-y-0.5">
              <h2 className="text-xl font-bold">{t("Current Order")}</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Manage your cart")}</p>
            </div>
          </div>
          <motion.div 
            key={cart.length}
            initial={{ scale: 1.2, color: "var(--primary)" }}
            animate={{ scale: 1, color: "inherit" }}
            className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
          >
            {cart.length} {t("Items")}
          </motion.div>
        </div>

        <div className="flex-1 overflow-auto p-5 sm:p-8 space-y-4 scrollbar-hide">
          <AnimatePresence initial={false} mode="popLayout">
            {cart.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-20"
              >
                <div className="h-24 w-24 rounded-[2rem] bg-muted flex items-center justify-center">
                  <ShoppingCart className="h-12 w-12" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold uppercase tracking-widest">{t("Cart is Empty")}</p>
                  <p className="text-xs">{t("Add items from the catalog to start")}</p>
                </div>
              </motion.div>
            ) : (
              cart.map((item, idx) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20, scale: 0.95 }}
                  key={item.cartId} 
                  className="group flex items-center gap-5 rounded-[1.5rem] border border-border p-5 transition-all hover:bg-muted/30 hover:shadow-inner"
                >
                  <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    {item.type === "service" ? <Scissors className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate text-foreground leading-tight">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">
                      {item.type === "service" ? t("Service") : t("Product")} • {item.category || t("General")}
                    </p>
                  </div>
                  <div className="text-end space-y-1">
                    <p className="text-sm font-bold text-foreground">{item.price} <span className="text-[10px] opacity-50">{t("OMR")}</span></p>
                    <button 
                      onClick={() => removeFromCart(item.cartId)} 
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        <div className="p-5 sm:p-8 bg-muted/30 border-t border-border space-y-8">
          <div className="space-y-6">
            {/* Customer Search */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground ms-1">
                <User className="h-3 w-3" />
                {t("Customer")}
              </label>
              <AnimatePresence mode="wait">
                {selectedCustomer ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-inner"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-lg font-bold shadow-lg shadow-primary/20">
                        {selectedCustomer.name[0]}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground block">{selectedCustomer.name}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{selectedCustomer.phone}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedCustomer(null)} 
                      className="h-10 w-10 flex items-center justify-center rounded-xl bg-background border border-border text-rose-500 hover:bg-rose-500/10 transition-all"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </motion.div>
                ) : (
                  <div className="relative group">
                    <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      className="w-full rounded-2xl border border-border bg-card ps-12 pe-6 py-4 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                      placeholder={t("Search or Add Customer...")}
                      value={searchQ}
                      onChange={(e) => searchCustomers(e.target.value)}
                    />
                    <AnimatePresence>
                      {customers.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute bottom-full inset-x-0 mb-4 rounded-[2rem] border border-border bg-card shadow-2xl max-h-64 overflow-auto z-50 p-2"
                        >
                          {customers.map(c => (
                            <button 
                              key={c.id} 
                              onClick={() => { setSelectedCustomer(c); setCustomers([]); setSearchQ(""); }}
                              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted rounded-2xl text-start transition-all group/item"
                            >
                              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-sm font-bold group-hover/item:bg-primary group-hover/item:text-primary-foreground transition-colors">{c.name[0]}</div>
                              <div className="flex-1 text-start">
                                <p className="text-sm font-bold text-foreground">{c.name}</p>
                                <p className="text-[10px] text-muted-foreground font-bold tracking-widest">{c.phone}</p>
                              </div>
                              <ChevronRight className={clsx("h-4 w-4 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-all", i18n.language === "ar" && "rotate-180")} />
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
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground ms-1">
                <Scissors className="h-3 w-3" />
                {t("Assigned Specialist")}
              </label>
              <div className="relative">
                <select 
                  className="w-full rounded-2xl border border-border bg-card ps-6 pe-12 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer"
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                >
                  <option value="">{t("Choose a specialist")}</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <ChevronRight className="absolute end-6 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none rotate-90" />
              </div>
            </div>

            {/* Payment & Discount */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground ms-1">
                  <Wallet className="h-3 w-3" />
                  {t("Payment")}
                </label>
                <div className="relative">
                  <select 
                    className="w-full rounded-2xl border border-border bg-card px-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="CASH">{t("Cash")}</option>
                    <option value="CARD">{t("Card")}</option>
                    <option value="TRANSFER">{t("Transfer")}</option>
                  </select>
                  <ChevronRight className="absolute end-6 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none rotate-90" />
                </div>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground ms-1">
                  <Minus className="h-3 w-3" />
                  {t("Discount")}
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    className="w-full rounded-2xl border border-border bg-card px-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    placeholder="0.00"
                  />
                  <div className="absolute end-6 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase">{t("OMR")}</div>
                </div>
              </div>
            </div>

            {/* Loyalty Points */}
            {selectedCustomer && selectedCustomer.loyaltyPoints >= 100 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-between rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6 shadow-inner"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{t("Loyalty Points")}: {selectedCustomer.loyaltyPoints}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{t("Redeem for")} {loyaltyDiscount} {t("Discount")}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setUseLoyaltyPoints(!useLoyaltyPoints)}
                  className={clsx(
                    "relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none shadow-inner",
                    useLoyaltyPoints ? "bg-emerald-500" : "bg-muted"
                  )}
                >
                  <span className={clsx(
                    "inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md",
                    useLoyaltyPoints ? "translate-x-7" : "translate-x-1"
                  )} />
                </button>
              </motion.div>
            )}
          </div>

          <div className="pt-8 border-t border-border space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-widest">
                <span>{t("Subtotal")}</span>
                <span>{subtotal} OMR</span>
              </div>
              {(discount > 0 || loyaltyDiscount > 0) && (
                <div className="flex items-center justify-between text-xs font-bold text-rose-500 uppercase tracking-widest">
                  <span>{t("Total Discounts")}</span>
                  <span>-{discount + loyaltyDiscount} OMR</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-4">
                <span className="text-sm font-bold text-foreground uppercase tracking-[0.2em]">{t("Grand Total")}</span>
                <div className="text-end">
                  <span className="text-4xl font-bold tracking-tighter text-primary">{total}</span>
                  <span className="text-xs font-bold text-muted-foreground ms-2 uppercase">{t("OMR")}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={handleCheckout}
              disabled={cart.length === 0 || !selectedCustomer || !selectedEmployee}
              className="group relative w-full rounded-[2rem] bg-primary py-5 font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <CheckCircle2 className="h-6 w-6 relative z-10" />
              <span className="text-lg relative z-10">{t("Complete Payment")}</span>
              <span className="absolute top-2 start-2 bg-black/30 text-white text-[8px] px-2 py-0.5 rounded-full uppercase tracking-widest">{t("Backend Required")}</span>
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
