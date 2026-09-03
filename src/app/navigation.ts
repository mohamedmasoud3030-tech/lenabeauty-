import {
  LayoutDashboard,
  Receipt,
  CalendarDays,
  Users,
  UserCog,
  Boxes,
  Package,
  Scissors,
  Settings,
  FileBarChart,
  Gift,
  Wallet,
  BookOpen,
  Clock,
  Coins,
  TrendingUp,
  Sparkles,
  Bot,
  Activity,
  type LucideIcon,
} from "lucide-react";

/**
 * Navigation registry — the single source of truth for destinations.
 *
 * Before this existed, every page name was declared four separate times
 * (sidebar, mobile bottom bar + More menu, the Layout header title map, and
 * Global Search). They drifted: `/pos` was "POS" in two places and
 * "Sales & Invoices" in a third, and four admin routes existed in search only
 * with no navigation entry at all.
 *
 * Rules encoded here:
 *  - One destination has exactly one canonical name everywhere.
 *  - `adminOnly` controls *visibility only*. Authorization is enforced by
 *    `RequireAdmin` in `src/routes.tsx`; hiding a link is never the boundary.
 *  - `group` drives navigation grouping and reflects the operator's actual job,
 *    not the engineering module layout.
 */

export type NavGroupId =
  | "today"
  | "catalog"
  | "money"
  | "team"
  | "growth"
  | "system";

export interface NavDestination {
  /** Route path, matching `src/routes.tsx` exactly. */
  path: string;
  /** Canonical i18n key. The ONLY name used for this destination. */
  labelKey: string;
  icon: LucideIcon;
  group: NavGroupId;
  /** Visibility hint only — never an authorization control. */
  adminOnly?: boolean;
  /**
   * Deliberately kept out of navigation AND search while the module is
   * unfinished (`src/routes.tsx`: "Deferred modules keep their routes/data but
   * stay out of trial navigation").
   *
   * The route still exists, so saved links and direct URLs keep working and no
   * data is lost. What changes is that deferral is now *consistent*: previously
   * these appeared in Global Search only, which meant the product advertised
   * unfinished screens to anyone who typed the right word while offering no
   * way to discover them otherwise. Remove this flag when the module gains the
   * loading/empty/error states and brand styling the shipped pages have.
   */
  deferred?: boolean;
  /**
   * Shown in navigation only when the module holds real data. Keeps the menu
   * honest for centers that do not sell gift cards or packages.
   */
  optionalModule?: "giftCards" | "packages";
  /** Emoji used by Global Search result rows. */
  searchIcon: string;
}

export const NAV_GROUPS: { id: NavGroupId; titleKey: string }[] = [
  { id: "today", titleKey: "Daily Operations" },
  { id: "catalog", titleKey: "Catalog & People" },
  { id: "money", titleKey: "Money" },
  { id: "team", titleKey: "Team" },
  { id: "growth", titleKey: "Growth" },
  { id: "system", titleKey: "System" },
];

export const NAV_DESTINATIONS: NavDestination[] = [
  // Today — touched every hour.
  { path: "/dashboard", labelKey: "Dashboard", icon: LayoutDashboard, group: "today", searchIcon: "📊" },
  { path: "/action-center", labelKey: "Action Center", icon: Activity, group: "today", searchIcon: "🎯" },
  { path: "/appointments", labelKey: "Appointments", icon: CalendarDays, group: "today", searchIcon: "📅" },
  { path: "/pos", labelKey: "Point of Sale", icon: Receipt, group: "today", searchIcon: "🛒" },

  // Catalog & People — the records the center maintains.
  { path: "/customers", labelKey: "Customers", icon: Users, group: "catalog", searchIcon: "👥" },
  { path: "/services", labelKey: "Services", icon: Scissors, group: "catalog", searchIcon: "✂️" },
  { path: "/inventory", labelKey: "Inventory", icon: Boxes, group: "catalog", searchIcon: "📦" },
  { path: "/gift-cards", labelKey: "Gift Cards", icon: Gift, group: "catalog", optionalModule: "giftCards", searchIcon: "🎁" },
  { path: "/packages", labelKey: "Packages", icon: Package, group: "catalog", optionalModule: "packages", searchIcon: "🎫" },
  { path: "/employees", labelKey: "Employees", icon: UserCog, group: "catalog", adminOnly: true, searchIcon: "👔" },

  // Money — everything financial in one predictable place.
  { path: "/reports", labelKey: "Reports", icon: FileBarChart, group: "money", adminOnly: true, searchIcon: "📈" },
  { path: "/expenses", labelKey: "Expenses", icon: Wallet, group: "money", adminOnly: true, searchIcon: "💰" },
  { path: "/accounting", labelKey: "Accounting", icon: BookOpen, group: "money", adminOnly: true, deferred: true, searchIcon: "📚" },

  // Team — workforce administration, previously scattered under "Management".
  { path: "/attendance", labelKey: "Attendance", icon: Clock, group: "team", adminOnly: true, searchIcon: "🕒" },
  { path: "/advances", labelKey: "Advances", icon: Coins, group: "team", adminOnly: true, searchIcon: "💵" },
  { path: "/payroll", labelKey: "Payroll", icon: Receipt, group: "team", adminOnly: true, searchIcon: "🧾" },
  { path: "/staff-analytics", labelKey: "Staff Analytics", icon: TrendingUp, group: "team", adminOnly: true, searchIcon: "📊" },

  // Growth — deferred modules. Their routes stay live so existing links work,
  // but they are hidden from BOTH navigation and search until finished, rather
  // than being search-only (which advertised them to anyone who guessed).
  { path: "/customer-experience", labelKey: "Customer Experience", icon: Sparkles, group: "growth", adminOnly: true, deferred: true, searchIcon: "✨" },
  { path: "/forecasting", labelKey: "Forecasting", icon: TrendingUp, group: "growth", adminOnly: true, deferred: true, searchIcon: "📉" },
  { path: "/advanced-automation", labelKey: "Automation", icon: Bot, group: "growth", adminOnly: true, deferred: true, searchIcon: "🤖" },

  // System.
  { path: "/settings", labelKey: "Settings", icon: Settings, group: "system", adminOnly: true, searchIcon: "⚙️" },
];

/**
 * Destination-style mobile bottom navigation is intentionally empty. Phones
 * use the compact icon dock (menu/search/quick-add) plus the navigation bottom
 * sheet instead of maintaining a second destination model.
 */
export const MOBILE_PRIMARY_PATHS: readonly string[] = [];

/** Every shipped destination is reachable from the mobile navigation sheet. */
export const MOBILE_MORE_PATHS = NAV_DESTINATIONS
  .filter((d) => !d.deferred)
  .map((d) => d.path);

const BY_PATH = new Map(NAV_DESTINATIONS.map((d) => [d.path, d]));

export function findDestination(path: string): NavDestination | undefined {
  return BY_PATH.get(path);
}

/** Canonical i18n key for a route, used by the header title and page headings. */
export function destinationLabelKey(path: string): string | undefined {
  return BY_PATH.get(path)?.labelKey;
}

export interface VisibilityContext {
  isAdmin: boolean;
  /** Optional modules that hold real data; absent means "not yet known". */
  optionalModules?: { giftCards: boolean; packages: boolean };
}

/**
 * Destinations a given role may see in navigation.
 *
 * This is presentation only. `RequireAdmin` independently blocks direct URL
 * entry, so a hidden link is never the security boundary.
 */
export function visibleDestinations(ctx: VisibilityContext): NavDestination[] {
  return NAV_DESTINATIONS.filter((d) => {
    if (d.deferred) return false;
    if (d.adminOnly && !ctx.isAdmin) return false;
    if (d.optionalModule) {
      if (!ctx.optionalModules) return false;
      return ctx.optionalModules[d.optionalModule];
    }
    return true;
  });
}
