import { useEffect, useState } from "react";
import { useCases } from "../../app/composition/useCases";

/**
 * Optional-module availability.
 *
 * Gift cards and service packages are optional modules: a destination is only
 * advertised when the center actually has data for it, so navigation never
 * links to an empty feature. A failed read resolves to "hidden" rather than
 * throwing.
 *
 * This was previously resolved by a byte-identical 12-line effect in BOTH
 * ui/layout/Layout.tsx and ui/layout/Sidebar.tsx. Because Layout renders
 * Sidebar, that fired `giftCards.list()` and `servicePackages.list()` twice on
 * every authenticated page load, and gave the two owners independent copies of
 * the rule that Layout's own comment says must stay in sync ("so the mobile
 * menu can never advertise a module the sidebar hides").
 *
 * One owner now, and concurrent callers share a single in-flight resolution, so
 * the two surfaces cannot disagree and the duplicate round-trip is gone. The
 * in-flight handle is cleared as soon as it settles: this deduplicates
 * simultaneous mounts, it is not a cache, so a later mount still re-reads
 * current data exactly as before.
 */
export type OptionalModules = {
  giftCards: boolean;
  packages: boolean;
};

/** Everything hidden until proven available. */
export const NO_OPTIONAL_MODULES: OptionalModules = { giftCards: false, packages: false };

let inflight: Promise<OptionalModules> | null = null;

/** Resolve which optional modules this center has data for. */
export function resolveOptionalModules(): Promise<OptionalModules> {
  if (!inflight) {
    inflight = Promise.all([
      useCases.giftCards.list().catch(() => ({ ok: false as const })),
      useCases.servicePackages.list().catch(() => ({ ok: false as const })),
    ])
      .then(([giftCards, packages]) => ({
        giftCards: giftCards.ok && Array.isArray(giftCards.data) && giftCards.data.length > 0,
        packages: packages.ok && Array.isArray(packages.data) && packages.data.length > 0,
      }))
      .catch(() => NO_OPTIONAL_MODULES)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * React binding for {@link resolveOptionalModules}. Starts hidden and updates
 * once availability is known; a component that unmounts before then never sets
 * state.
 */
export function useOptionalModules(): OptionalModules {
  const [optionalModules, setOptionalModules] = useState<OptionalModules>(NO_OPTIONAL_MODULES);

  useEffect(() => {
    let active = true;
    void resolveOptionalModules().then((resolved) => {
      if (!active) return;
      setOptionalModules(resolved);
    });
    return () => {
      active = false;
    };
  }, []);

  return optionalModules;
}
