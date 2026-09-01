import { describe, expect, it } from "vitest";
import { AppointmentStatus, VisitStage } from "../domain/entities";
import {
  estimateServiceContribution,
  forecastBookingDemand,
  planRecipeConsumption,
  visitMayHaveConsumed,
} from "../domain/recipe";

const colorRecipe = {
  id: "r1",
  centerId: "c",
  serviceId: "svc-color",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [
    { id: "i1", centerId: "c", recipeId: "r1", productId: "p-tube", quantity: 1, unit: "unit", estimatedCost: 2.5, createdAt: new Date() },
    { id: "i2", centerId: "c", recipeId: "r1", productId: "p-gloves", quantity: 2, unit: "unit", estimatedCost: 0.1, createdAt: new Date() },
  ],
};

describe("Service recipes", () => {
  it("expands a recipe into consumption lines with cost", () => {
    const plan = planRecipeConsumption(colorRecipe, 1);
    expect(plan.lines).toHaveLength(2);
    expect(plan.estimatedMaterialCost).toBeCloseTo(2.7, 3);
  });

  it("scales consumption with service quantity", () => {
    const plan = planRecipeConsumption(colorRecipe, 2);
    expect(plan.lines.find((l) => l.productId === "p-tube")!.quantity).toBe(2);
    expect(plan.lines.find((l) => l.productId === "p-gloves")!.quantity).toBe(4);
  });

  it("treats empty/invalid recipe as zero consumption", () => {
    expect(planRecipeConsumption(null, 1).lines).toEqual([]);
    expect(planRecipeConsumption(undefined, 1).estimatedMaterialCost).toBe(0);
  });

  it("estimates service contribution and labels it as an estimate", () => {
    const est = estimateServiceContribution({
      serviceRevenue: 25,
      recipe: colorRecipe,
      serviceQty: 1,
      employeeCompensation: 10,
    });
    expect(est.serviceRevenue).toBe(25);
    expect(est.estimatedMaterialCost).toBeCloseTo(2.7, 3);
    expect(est.employeeCompensation).toBe(10);
    expect(est.estimatedContribution).toBeCloseTo(12.3, 3);
    expect(est.isEstimate).toBe(true);
  });

  it("never fabricates employee compensation when absent", () => {
    const est = estimateServiceContribution({ serviceRevenue: 25, recipe: colorRecipe });
    expect(est.employeeCompensation).toBeUndefined();
    expect(est.estimatedContribution).toBeCloseTo(22.3, 3);
  });

  it("only a completed (paid) visit may have consumed stock", () => {
    expect(visitMayHaveConsumed({ status: AppointmentStatus.COMPLETED })).toBe(true);
    expect(visitMayHaveConsumed({ status: AppointmentStatus.SCHEDULED })).toBe(false);
    expect(visitMayHaveConsumed({ status: AppointmentStatus.CANCELLED })).toBe(false);
    expect(visitMayHaveConsumed({ status: AppointmentStatus.NO_SHOW })).toBe(false);
  });

  it("forecasts booking demand and shortfall from recipes", () => {
    const rows = forecastBookingDemand({
      appointments: [
        { status: "SCHEDULED", serviceId: "svc-color", service: { name: "Coloring" } },
        { status: "SCHEDULED", serviceId: "svc-color", service: { name: "Coloring" } },
        { status: "CANCELLED", serviceId: "svc-color", service: { name: "Coloring" } },
      ],
      recipeByServiceId: new Map([["svc-color", colorRecipe]]),
      products: [
        { id: "p-tube", name: "Color Tube", stockQuantity: 1 },
        { id: "p-gloves", name: "Gloves", stockQuantity: 50 },
      ],
    });
    const tube = rows.find((r) => r.productId === "p-tube");
    expect(tube).toBeDefined();
    expect(tube!.expectedUnits).toBe(2); // only scheduled appointments count
    expect(tube!.shortfall).toBe(1);
    expect(rows.find((r) => r.productId === "p-gloves")).toBeUndefined();
  });
});
