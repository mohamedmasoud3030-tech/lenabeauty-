import { clsx } from "clsx";

export const ALL_SERVICE_CATEGORIES = "__all__";

export type CategorizedService = {
  id: string;
  name: string;
  categoryName?: string;
};

export type ServiceCategoryCount = {
  name: string;
  count: number;
};

export function getServiceCategoryCounts(services: CategorizedService[]): ServiceCategoryCount[] {
  const counts = new Map<string, number>();
  for (const service of services) {
    const name = service.categoryName?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => left.name.localeCompare(right.name, "ar"));
}

/**
 * Category browsing applies while the search is empty. A search deliberately
 * spans the entire service catalog so a selected segment never hides a match.
 */
export function filterServicesForCatalog<T extends CategorizedService>(
  services: T[],
  selectedCategory: string,
  search: string,
): T[] {
  const query = search.trim().toLocaleLowerCase();
  if (query) {
    return services.filter((service) => {
      const searchable = `${service.name} ${service.categoryName ?? ""}`.toLocaleLowerCase();
      return searchable.includes(query);
    });
  }

  if (selectedCategory === ALL_SERVICE_CATEGORIES) return services;
  return services.filter((service) => service.categoryName === selectedCategory);
}

type Props = {
  services: CategorizedService[];
  selectedCategory: string;
  onSelect: (category: string) => void;
  allLabel: string;
  className?: string;
};

export function ServiceCategoryFilters({
  services,
  selectedCategory,
  onSelect,
  allLabel,
  className,
}: Props) {
  const categories = getServiceCategoryCounts(services);
  const segments = [
    { name: ALL_SERVICE_CATEGORIES, label: allLabel, count: services.length },
    ...categories.map((category) => ({ ...category, label: category.name })),
  ];

  return (
    <div
      className={clsx("flex gap-2 overflow-x-auto pb-1 scrollbar-hide", className)}
      aria-label={allLabel}
    >
      {segments.map((segment) => {
        const active = selectedCategory === segment.name;
        return (
          <button
            key={segment.name}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(segment.name)}
            className={clsx(
              "min-h-11 shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
            )}
          >
            <span>{segment.label}</span>
            <span className={clsx(
              "ms-2 inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 text-[10px]",
              active ? "bg-primary-foreground/15" : "bg-muted text-muted-foreground",
            )}>
              {segment.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
