import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import brandingService from "../../infrastructure/services/brandingService";

export interface SalonIdentity {
  /** The salon's own name, language-aware. Never a translation key. */
  name: string;
  /** The salon's uploaded logo, or null to fall back to the product mark. */
  logoUrl: string | null;
  /** True once a salon name has actually been configured. */
  isConfigured: boolean;
}

function readIdentity(isArabic: boolean): SalonIdentity {
  const settings = brandingService.getSettings();
  const configured = (isArabic ? settings.salonNameAr : settings.salonName)?.trim?.() ?? "";
  return {
    name: brandingService.getSalonName(isArabic),
    logoUrl: brandingService.getSalonLogo(),
    isConfigured: configured.length > 0,
  };
}

/**
 * The salon's identity as configured in Settings, reactive across the app.
 *
 * Every salon-facing surface (sidebar, mobile header, document title, receipts,
 * printed documents) reads this instead of a hard-coded product or salon name,
 * so saving a new name/logo in Settings replaces the identity everywhere at
 * once — no reload required.
 *
 * Before an operator configures the salon, this returns the product fallback;
 * it never invents a business name.
 */
export function useSalonIdentity(): SalonIdentity {
  const { i18n } = useTranslation();
  const isArabic = i18n.language?.startsWith("ar") ?? false;
  const [identity, setIdentity] = useState<SalonIdentity>(() => readIdentity(isArabic));

  useEffect(() => {
    setIdentity(readIdentity(isArabic));
    return brandingService.subscribe(() => setIdentity(readIdentity(isArabic)));
  }, [isArabic]);

  return identity;
}
