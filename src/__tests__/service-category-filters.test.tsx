import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ALL_SERVICE_CATEGORIES,
  filterServicesForCatalog,
  getServiceCategoryCounts,
  ServiceCategoryFilters,
} from "../shared/catalog/ServiceCategoryFilters";

const services = [
  { id: "s1", name: "قص الشعر", categoryName: "الشعر" },
  { id: "s2", name: "صبغة شعر", categoryName: "الشعر" },
  { id: "s3", name: "مانيكير", categoryName: "الأظافر" },
];

describe("service category filters", () => {
  it("derives only real categories with their service counts", () => {
    expect(getServiceCategoryCounts(services)).toEqual([
      { name: "الأظافر", count: 1 },
      { name: "الشعر", count: 2 },
    ]);
  });

  it("filters by category while an active search spans every category", () => {
    expect(filterServicesForCatalog(services, "الشعر", "").map((service) => service.id)).toEqual(["s1", "s2"]);
    expect(filterServicesForCatalog(services, "الشعر", "مانيكير").map((service) => service.id)).toEqual(["s3"]);
    expect(filterServicesForCatalog(services, ALL_SERVICE_CATEGORIES, "صبغة").map((service) => service.id)).toEqual(["s2"]);
  });

  it("renders All first, shows counts, and reports the selected segment", () => {
    const onSelect = vi.fn();
    render(
      <ServiceCategoryFilters
        services={services}
        selectedCategory={ALL_SERVICE_CATEGORIES}
        onSelect={onSelect}
        allLabel="الكل"
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("الكل");
    expect(buttons[0]).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: /الشعر\s*2/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /الأظافر\s*1/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /الشعر\s*2/ }));
    expect(onSelect).toHaveBeenCalledWith("الشعر");
  });
});
