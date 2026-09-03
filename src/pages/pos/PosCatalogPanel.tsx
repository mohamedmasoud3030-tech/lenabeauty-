import type { RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Boxes, CreditCard, Package, Plus, Scissors, Search, ShoppingCart } from "lucide-react";
import { clsx } from "clsx";
import type { Product, Service } from "../../domain/entities";
import { Spinner } from "../../shared/components/Spinner";
import { ScreenState } from "../../shared/components/ScreenState";
import { formatOMRAmount } from "../../shared/money";
import { ServiceCategoryFilters } from "../../shared/catalog/ServiceCategoryFilters";

export type PosCatalogTab = "SERVICES" | "PRODUCTS" | "PACKAGES";

interface PosCatalogPanelProps {
  t: (key: string) => string;
  activeTab: PosCatalogTab;
  onTabChange: (tab: PosCatalogTab) => void;
  itemSearchQ: string;
  onItemSearchChange: (value: string) => void;
  itemSearchRef: RefObject<HTMLInputElement | null>;
  services: Service[];
  selectedServiceCategory: string;
  onServiceCategoryChange: (value: string) => void;
  filteredItems: any[];
  loading: boolean;
  onAddToCart: (item: any, type: "service" | "product" | "package") => void;
  isMobile: boolean;
  cartCount: number;
  showingCheckout: boolean;
  onShowCheckout: () => void;
  total: number;
  giftCardSaleCode: string;
  onGiftCardSaleCodeChange: (value: string) => void;
  giftCardSaleValue: string;
  onGiftCardSaleValueChange: (value: string) => void;
  onAddGiftCard: () => void;
}

export function PosCatalogPanel({
  t,
  activeTab,
  onTabChange,
  itemSearchQ,
  onItemSearchChange,
  itemSearchRef,
  services,
  selectedServiceCategory,
  onServiceCategoryChange,
  filteredItems,
  loading,
  onAddToCart,
  isMobile,
  cartCount,
  showingCheckout,
  onShowCheckout,
  total,
  giftCardSaleCode,
  onGiftCardSaleCodeChange,
  giftCardSaleValue,
  onGiftCardSaleValueChange,
  onAddGiftCard,
}: PosCatalogPanelProps) {
  return (
    <div className="flex-1 flex flex-col rounded-2xl lg:rounded-[2.5rem] border border-border bg-card shadow-sm overflow-hidden print:hidden lg:h-full">
      <div className="p-4 lg:p-6 border-b border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg lg:text-xl font-bold tracking-tight text-foreground">{t("Service Catalog")}</h2>
            <p className="hidden lg:block text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{t("Press F1 to search")}</p>
          </div>
          <div className="flex bg-muted rounded-xl p-1 shadow-inner w-full sm:w-auto">
            <button
              onClick={() => onTabChange("SERVICES")}
              className={clsx(
                "flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                activeTab === "SERVICES" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Scissors className="h-4 w-4 shrink-0" />
              {t("Services")}
            </button>
            <button
              onClick={() => onTabChange("PRODUCTS")}
              className={clsx(
                "flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                activeTab === "PRODUCTS" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Package className="h-4 w-4 shrink-0" />
              {t("Products")}
            </button>
            <button
              onClick={() => onTabChange("PACKAGES")}
              className={clsx(
                "flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                activeTab === "PACKAGES" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground",
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
            onChange={(event) => onItemSearchChange(event.target.value)}
          />
        </div>
        {activeTab === "SERVICES" && (
          <ServiceCategoryFilters
            services={services}
            selectedCategory={selectedServiceCategory}
            onSelect={onServiceCategoryChange}
            allLabel={t("All")}
          />
        )}
      </div>

      <div className="flex-1 overflow-auto p-3 lg:p-6 bg-muted/5 scrollbar-hide min-h-[40vh] lg:min-h-0 safe-area-bottom">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40 py-20">
            <Spinner />
            <p className="text-[10px] font-bold uppercase tracking-widest">{t("Loading Catalog...")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2 lg:gap-4">
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item, index) => (
                <motion.button
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: index * 0.02 } }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={item.id}
                  onClick={() => onAddToCart(item, activeTab === "SERVICES" ? "service" : activeTab === "PRODUCTS" ? "product" : "package")}
                  disabled={activeTab === "PRODUCTS" && (item as Product).trackInventory && (item as Product).stockQuantity <= 0}
                  className={clsx(
                    "group relative rounded-xl lg:rounded-2xl border border-border bg-card p-2.5 lg:p-4 shadow-sm transition-all hover:shadow-lg hover:border-primary/50 flex flex-col items-start gap-2 text-start touch-target active:scale-[0.98]",
                    activeTab === "PRODUCTS" && (item as Product).trackInventory && (item as Product).stockQuantity <= 0 && "opacity-50 grayscale pointer-events-none",
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
                    <h3 className="text-xs lg:text-sm font-bold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">{item.name}</h3>
                    {activeTab === "PRODUCTS" && (
                      <div className={clsx(
                        "mt-0.5 text-[9px] lg:text-[10px] font-bold uppercase tracking-wider",
                        (item as Product).stockQuantity > 5 ? "text-success" : "text-destructive",
                      )}>
                        {(item as Product).stockQuantity} {t("Stock")}
                      </div>
                    )}
                    {activeTab === "PACKAGES" && (
                      <div className="mt-0.5 text-[9px] lg:text-[10px] font-bold uppercase tracking-wider text-info">
                        {item.items?.length || 0} {t("Included")}
                      </div>
                    )}
                  </div>
                  <div className="w-full pt-1.5 lg:pt-2 border-t border-border/50 flex items-baseline justify-between">
                    <span className="text-sm lg:text-lg font-bold text-foreground">{formatOMRAmount(item.price)}</span>
                    <span className="text-[9px] lg:text-[10px] font-bold text-muted-foreground uppercase">
                      {activeTab === "SERVICES" && (item as Service).pricingMode === "STARTING_FROM" ? `${t("From")} · ` : ""}{t("OMR")}
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

        {isMobile && cartCount > 0 && !showingCheckout && (
          <motion.button
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={onShowCheckout}
            className="fixed end-4 above-bottom-nav z-40 h-14 px-4 rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center gap-3 touch-target active:scale-95 transition-transform"
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="font-bold">{cartCount} {t("Items")}</span>
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
                onChange={(event) => onGiftCardSaleCodeChange(event.target.value.toUpperCase())}
              />
              <input
                className="w-full sm:w-28 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-bold outline-none focus:ring-4 focus:ring-primary/10"
                type="number"
                min="0"
                step="0.001"
                placeholder={t("Value OMR")}
                value={giftCardSaleValue}
                onChange={(event) => onGiftCardSaleValueChange(event.target.value)}
              />
              <button onClick={onAddGiftCard} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
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
  );
}
