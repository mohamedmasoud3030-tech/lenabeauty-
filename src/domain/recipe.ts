import { Appointment, AppointmentStatus, Product, ServiceRecipe, VisitStage } from "./entities";
import { roundMoney } from "./commerce";

/**
 * Service Recipes — the stock a service is expected to consume while it is
 * delivered, and the deterministic costing derived from it. Pure and
 * framework-free; the authoritative consumption happens inside the checkout
 * transaction (keyed by invoice line, so it can never double-consume).
 */

export interface RecipeConsumptionLine {
  productId: string;
  quantity: number;
  unit?: string;
  estimatedCost?: number;
}

export interface ConsumptionPlan {
  /** Lines that will be consumed for one delivery of the service × qty. */
  lines: RecipeConsumptionLine[];
  /** Estimated material cost (3-decimal OMR) of the plan. */
  estimatedMaterialCost: number;
}

/** Expand a recipe into a consumption plan for a service quantity. */
export function planRecipeConsumption(
  recipe: Pick<ServiceRecipe, "items"> | undefined | null,
  serviceQty: number,
  productById?: Map<string, Pick<Product, "id" | "cost">>,
): ConsumptionPlan {
  const qty = Math.max(1, Math.floor(serviceQty || 1));
  const lines: RecipeConsumptionLine[] = [];
  let cost = 0;
  for (const item of recipe?.items ?? []) {
    if (!item?.productId || !Number.isFinite(item.quantity) || item.quantity <= 0) continue;
    const itemCost =
      item.estimatedCost !== undefined && Number.isFinite(item.estimatedCost)
        ? Number(item.estimatedCost)
        : productById?.get(item.productId)?.cost ?? 0;
    lines.push({
      productId: item.productId,
      quantity: roundMoney(item.quantity * qty),
      unit: item.unit,
      estimatedCost: roundMoney(Number(itemCost)),
    });
    cost += Number(itemCost) * item.quantity * qty;
  }
  return { lines, estimatedMaterialCost: roundMoney(cost) };
}

export interface ServiceContributionEstimate {
  serviceRevenue: number;
  estimatedMaterialCost: number;
  /** Only populated when reliable compensation data exists — never fabricated. */
  employeeCompensation?: number;
  estimatedContribution: number;
  isEstimate: true;
}

/**
 * Estimated contribution of a delivered service. Compensation is optional and
 * only included when the caller has reliable data (commission/salary share);
 * payroll allocation is never invented.
 */
export function estimateServiceContribution(input: {
  serviceRevenue: number;
  recipe?: Pick<ServiceRecipe, "items"> | null;
  serviceQty?: number;
  productById?: Map<string, Pick<Product, "id" | "cost">>;
  employeeCompensation?: number;
}): ServiceContributionEstimate {
  const revenue = roundMoney(Math.max(0, input.serviceRevenue ?? 0));
  const plan = planRecipeConsumption(input.recipe, input.serviceQty ?? 1, input.productById);
  const comp =
    input.employeeCompensation !== undefined && Number.isFinite(input.employeeCompensation)
      ? roundMoney(Math.max(0, input.employeeCompensation))
      : undefined;
  const contribution = roundMoney(revenue - plan.estimatedMaterialCost - (comp ?? 0));
  return {
    serviceRevenue: revenue,
    estimatedMaterialCost: plan.estimatedMaterialCost,
    employeeCompensation: comp,
    estimatedContribution: contribution,
    isEstimate: true,
  };
}

/**
 * Whether an appointment's service may have produced recipe consumption.
 * Consumption is recorded only when a visit is genuinely completed (paid);
 * cancelled and no-show visits never consume.
 */
export function visitMayHaveConsumed(
  appointment: Pick<Appointment, "status">,
): boolean {
  return appointment.status === AppointmentStatus.COMPLETED;
}

/** A stage from which consumption can still legally occur (pre-checkout). */
export function isConsumptionEligibleStage(stage: VisitStage | undefined): boolean {
  return stage === VisitStage.READY_FOR_CHECKOUT || stage === VisitStage.IN_SERVICE;
}

export interface BookingDemandLine {
  productId: string;
  productName?: string;
  /** Units expected to be consumed by upcoming booked services. */
  expectedUnits: number;
  currentStock: number;
  shortfall: number;
  /** Booked services driving the demand (name × count). */
  drivers: { serviceName?: string; count: number }[];
}

/**
 * Deterministic inventory demand from booked appointments + recipes. Answers
 * "what do the next N days' bookings consume?" — no extrapolation, no invented
 * probability. Only scheduled (not terminal) appointments count.
 */
export function forecastBookingDemand(input: {
  appointments: {
    status: string;
    serviceId?: string;
    serviceName?: string;
    service?: { name?: string };
  }[];
  recipeByServiceId: Map<string, Pick<ServiceRecipe, "items"> | undefined>;
  products: (Pick<Product, "id" | "name" | "stockQuantity">)[];
}): BookingDemandLine[] {
  const productStock = new Map(input.products.map((p) => [p.id, p]));
  const demand = new Map<
    string,
    { expectedUnits: number; drivers: Map<string, number> }
  >();

  for (const appt of input.appointments) {
    if (appt.status === "CANCELLED" || appt.status === "NO_SHOW") continue;
    if (!appt.serviceId) continue;
    const recipe = input.recipeByServiceId.get(appt.serviceId);
    if (!recipe) continue;
    const serviceName = appt.service?.name ?? appt.serviceName ?? "Service";
    for (const item of recipe.items ?? []) {
      if (!item?.productId || item.quantity <= 0) continue;
      const entry = demand.get(item.productId) ?? { expectedUnits: 0, drivers: new Map<string, number>() };
      entry.expectedUnits = roundMoney(entry.expectedUnits + item.quantity);
      entry.drivers.set(serviceName, (entry.drivers.get(serviceName) ?? 0) + 1);
      demand.set(item.productId, entry);
    }
  }

  const rows: BookingDemandLine[] = [];
  for (const [productId, d] of demand.entries()) {
    const product = productStock.get(productId);
    const currentStock = product?.stockQuantity ?? 0;
    rows.push({
      productId,
      productName: product?.name,
      expectedUnits: d.expectedUnits,
      currentStock,
      shortfall: Math.max(0, roundMoney(d.expectedUnits - currentStock)),
      drivers: [...d.drivers.entries()].map(([serviceName, count]) => ({ serviceName, count })),
    });
  }
  return rows.filter((r) => r.shortfall > 0).sort((a, b) => b.shortfall - a.shortfall);
}
