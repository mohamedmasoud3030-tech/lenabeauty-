/**
 * LOW STOCK — one rule, decided once.
 *
 * The level a product is measured against, and the comparison itself, used to be
 * decided independently in six places: three honoured the per-product
 * `reorder_level` with a fallback, one compared against a fixed 5, one against a
 * fixed 10, and the comparison flipped between `<` and `<=` from screen to
 * screen. The consequences were visible to the salon owner:
 *
 *   - the same product read "Low Stock" in the reports (≤ 10) and healthy in the
 *     point of sale (≤ 5);
 *   - the reorder level typed on the product was ignored by three of the six
 *     screens that claim to warn about it.
 *
 * The rule is: a product needs reordering when its remaining quantity has
 * REACHED the level it is measured against.
 *
 * That level is the product's own `reorder_level` when the owner set one, and
 * DEFAULT_REORDER_LEVEL when they did not. The column is `NOT NULL DEFAULT 0`,
 * so "not set" arrives as 0 rather than undefined — treating 0 as a real level
 * would make a product low only once stock hit zero, which is why anything not
 * greater than zero falls back to the default.
 */

/** Used when the owner has not set a level on the product. */
export const DEFAULT_REORDER_LEVEL = 5;

export interface StockLevelInput {
  stockQuantity?: number | null;
  reorderLevel?: number | null;
  /** Only inventory-tracked products decrement stock, so only they can run out. */
  trackInventory?: boolean;
  isActive?: boolean;
}

/** Remaining quantity, as a number that can always be compared. */
function remainingStock(product: StockLevelInput | null | undefined): number {
  const quantity = Number(product?.stockQuantity);
  return Number.isFinite(quantity) ? quantity : 0;
}

/** The level this product is measured against. */
export function reorderLevelFor(product: StockLevelInput | null | undefined): number {
  const configured = Number(product?.reorderLevel);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_REORDER_LEVEL;
}

/**
 * True when the product should be reordered.
 *
 * A disabled product is not a purchasing task, and a product that does not
 * track inventory has no stock level to run out of — neither should light up a
 * reorder warning, which is what the point of sale used to do for every
 * untracked product (their stock sits at 0).
 */
export function isLowStock(product: StockLevelInput | null | undefined): boolean {
  if (!product) return false;
  if (product.isActive === false) return false;
  if (product.trackInventory === false) return false;
  return remainingStock(product) <= reorderLevelFor(product);
}
