import { clsx } from "clsx";

interface PosMobileModeToggleProps {
  showingCart: boolean;
  cartCount: number;
  catalogLabel: string;
  cartLabel: string;
  onShowCatalog: () => void;
  onShowCart: () => void;
}

export function PosMobileModeToggle({
  showingCart,
  cartCount,
  catalogLabel,
  cartLabel,
  onShowCatalog,
  onShowCart,
}: PosMobileModeToggleProps) {
  return (
    <div className="px-0 pt-1">
      {/* One-handed catalog / cart toggle — thumb-width targets, no duplicate category row */}
      <div className="flex gap-2">
        <button
          onClick={onShowCatalog}
          className={clsx(
            "flex-1 min-h-11 py-2.5 rounded-xl font-bold text-xs transition-all touch-target",
            !showingCart ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground",
          )}
        >
          {catalogLabel}
        </button>
        <button
          onClick={onShowCart}
          className={clsx(
            "flex-1 min-h-11 py-2.5 rounded-xl font-bold text-xs transition-all relative touch-target",
            showingCart ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground",
          )}
        >
          {cartLabel}
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -end-1.5 bg-destructive text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
