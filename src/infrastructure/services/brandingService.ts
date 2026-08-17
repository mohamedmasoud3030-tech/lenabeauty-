import { LENA_BRAND_PALETTE, normalizeBrandColor } from '../../shared/theme/brandPalette';

/**
 * Branding Service
 * Manages salon identity and branding across the entire application
 * Ensures consistent branding in all documents, reports, and invoices
 */

export interface BrandingSettings {
  salonName: string;
  salonNameAr: string;
  address: string;
  addressAr: string;
  phone: string;
  email: string;
  taxNumber: string;
  registrationNumber: string;
  logo: string | null; // Base64 encoded image
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  footerText: string;
  footerTextAr: string;
}

const DEFAULT_BRANDING: BrandingSettings = {
  salonName: 'LenaBeauty',
  salonNameAr: 'لينا بيوتي',
  address: 'Muscat, Oman',
  addressAr: 'مسقط، عمان',
  phone: '+968 9414 1330',
  email: 'info@lenabeauty.om',
  taxNumber: 'OM123456789',
  registrationNumber: 'CR/2024/123456',
  logo: null,
  primaryColor: LENA_BRAND_PALETTE.primary,
  secondaryColor: LENA_BRAND_PALETTE.secondary,
  accentColor: LENA_BRAND_PALETTE.surfaceAccent,
  footerText: 'Powered by LenaBeauty',
  footerTextAr: 'مدعوم بواسطة لينا بيوتي',
};

const BRANDING_STRING_FIELDS = [
  'salonName', 'salonNameAr', 'address', 'addressAr', 'phone', 'email',
  'taxNumber', 'registrationNumber', 'footerText', 'footerTextAr',
] as const;

const BRANDING_COLOR_FIELDS = ['primaryColor', 'secondaryColor', 'accentColor'] as const;

/**
 * Strict structural validation for a branding import file.
 *
 * The exporter always writes a COMPLETE snapshot, so an import is accepted
 * only when it is a plain object containing every core string field and all
 * three color fields with the correct types. Anything else — arrays, null,
 * primitives, empty objects, unknown-only objects, or partial shapes — throws
 * instead of silently persisting defaults over the salon's real branding.
 * Colors are then normalized through the strict #RRGGBB contract.
 */
export function validateBrandingImport(raw: unknown): BrandingSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Branding import must be a JSON object');
  }
  const src = raw as Record<string, unknown>;

  const missingStrings = BRANDING_STRING_FIELDS.filter((key) => typeof src[key] !== 'string');
  const missingColors = BRANDING_COLOR_FIELDS.filter((key) => typeof src[key] !== 'string');
  if (missingStrings.length > 0 || missingColors.length > 0) {
    throw new Error(
      'Branding import is missing required fields (a complete exported snapshot is expected)',
    );
  }
  if (src.logo !== undefined && src.logo !== null && typeof src.logo !== 'string') {
    throw new Error('Branding import logo must be a string or null');
  }

  return {
    salonName: src.salonName as string,
    salonNameAr: src.salonNameAr as string,
    address: src.address as string,
    addressAr: src.addressAr as string,
    phone: src.phone as string,
    email: src.email as string,
    taxNumber: src.taxNumber as string,
    registrationNumber: src.registrationNumber as string,
    footerText: src.footerText as string,
    footerTextAr: src.footerTextAr as string,
    logo: typeof src.logo === 'string' ? src.logo : null,
    primaryColor: normalizeBrandColor(src.primaryColor, LENA_BRAND_PALETTE.primary),
    secondaryColor: normalizeBrandColor(src.secondaryColor, LENA_BRAND_PALETTE.secondary),
    accentColor: normalizeBrandColor(src.accentColor, LENA_BRAND_PALETTE.surfaceAccent),
  };
}

class BrandingService {
  private static instance: BrandingService;
  private settings: BrandingSettings = DEFAULT_BRANDING;

  private constructor() {
    this.loadSettings();
  }

  static getInstance(): BrandingService {
    if (!BrandingService.instance) {
      BrandingService.instance = new BrandingService();
    }
    return BrandingService.instance;
  }

  /**
   * Load branding settings from localStorage
   *
   * localStorage is a user-writable cache, so every value is re-validated on
   * load: colors are strictly #RRGGBB (invalid/malicious values fall back to
   * the defaults) and missing fields keep their defaults instead of being
   * silently dropped.
   */
  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('lenabeauty_branding');
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const raw = parsed as Record<string, unknown>;
          this.settings = {
            ...DEFAULT_BRANDING,
            ...(typeof raw.salonName === 'string' ? { salonName: raw.salonName } : {}),
            ...(typeof raw.salonNameAr === 'string' ? { salonNameAr: raw.salonNameAr } : {}),
            ...(typeof raw.address === 'string' ? { address: raw.address } : {}),
            ...(typeof raw.addressAr === 'string' ? { addressAr: raw.addressAr } : {}),
            ...(typeof raw.phone === 'string' ? { phone: raw.phone } : {}),
            ...(typeof raw.email === 'string' ? { email: raw.email } : {}),
            ...(typeof raw.taxNumber === 'string' ? { taxNumber: raw.taxNumber } : {}),
            ...(typeof raw.registrationNumber === 'string' ? { registrationNumber: raw.registrationNumber } : {}),
            ...(typeof raw.footerText === 'string' ? { footerText: raw.footerText } : {}),
            ...(typeof raw.footerTextAr === 'string' ? { footerTextAr: raw.footerTextAr } : {}),
            logo: typeof raw.logo === 'string' ? raw.logo : null,
            primaryColor: normalizeBrandColor(raw.primaryColor, LENA_BRAND_PALETTE.primary),
            secondaryColor: normalizeBrandColor(raw.secondaryColor, LENA_BRAND_PALETTE.secondary),
            accentColor: normalizeBrandColor(raw.accentColor, LENA_BRAND_PALETTE.surfaceAccent),
          };
        }
      }

      // Load logo separately
      const logo = localStorage.getItem('lenabeauty_logo');
      if (logo) {
        this.settings.logo = logo;
      }
    } catch (error) {
      console.error('Failed to load branding settings:', error);
      this.settings = DEFAULT_BRANDING;
    }
  }

  /**
   * Get all branding settings
   */
  getSettings(): BrandingSettings {
    return { ...this.settings };
  }

  /**
   * Get specific setting value
   */
  getSetting<K extends keyof BrandingSettings>(key: K): BrandingSettings[K] {
    return this.settings[key];
  }

  /**
   * Update branding settings
   */
  updateSettings(updates: Partial<BrandingSettings>): void {
    // Enforce the strict color contract at the in-memory boundary too: a
    // malformed color never enters the cached settings or the saved cache.
    const sanitized: Partial<BrandingSettings> = { ...updates };
    if (sanitized.primaryColor !== undefined) {
      sanitized.primaryColor = normalizeBrandColor(sanitized.primaryColor, this.settings.primaryColor);
    }
    if (sanitized.secondaryColor !== undefined) {
      sanitized.secondaryColor = normalizeBrandColor(sanitized.secondaryColor, this.settings.secondaryColor);
    }
    if (sanitized.accentColor !== undefined) {
      sanitized.accentColor = normalizeBrandColor(sanitized.accentColor, this.settings.accentColor);
    }

    this.settings = { ...this.settings, ...sanitized };

    // Save to localStorage. The logo cache key must be removed when the logo
    // is cleared (logo: null): loadSettings re-applies the separate key over
    // the main cache, so a stale logo would otherwise be resurrected after
    // reload.
    const { logo, ...settingsWithoutLogo } = this.settings;
    localStorage.setItem('lenabeauty_branding', JSON.stringify(settingsWithoutLogo));

    if (logo) {
      localStorage.setItem('lenabeauty_logo', logo);
    } else {
      localStorage.removeItem('lenabeauty_logo');
    }
  }

  /**
   * Get salon name (bilingual)
   */
  getSalonName(isArabic: boolean = false): string {
    return isArabic ? this.settings.salonNameAr : this.settings.salonName;
  }

  /**
   * Get address (bilingual)
   */
  getAddress(isArabic: boolean = false): string {
    return isArabic ? this.settings.addressAr : this.settings.address;
  }

  /**
   * Get footer text (bilingual)
   */
  getFooterText(isArabic: boolean = false): string {
    return isArabic ? this.settings.footerTextAr : this.settings.footerText;
  }

  /**
   * Get CSS variables for styling
   *
   * Emission boundary: values are normalized here too, so a stylesheet can
   * only ever receive strict #RRGGBB colors even if a caller bypasses
   * updateSettings/loadSettings.
   */
  getCSSVariables(): Record<string, string> {
    return {
      '--primary-color': normalizeBrandColor(this.settings.primaryColor, LENA_BRAND_PALETTE.primary),
      '--secondary-color': normalizeBrandColor(this.settings.secondaryColor, LENA_BRAND_PALETTE.secondary),
      '--accent-color': normalizeBrandColor(this.settings.accentColor, LENA_BRAND_PALETTE.surfaceAccent),
    };
  }

  /**
   * Reset to default settings
   */
  resetToDefaults(): void {
    this.settings = DEFAULT_BRANDING;
    localStorage.removeItem('lenabeauty_branding');
    localStorage.removeItem('lenabeauty_logo');
  }

  /**
   * Re-read the validated local cache into the singleton and return the
   * snapshot. Used as the cache fallback when the remote source is
   * unreachable: the singleton may have been constructed before the cache was
   * seeded (e.g. another tab saved after this one loaded).
   */
  reloadFromCache(): BrandingSettings {
    this.loadSettings();
    return { ...this.settings };
  }

  /**
   * Export settings as JSON
   */
  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import settings from JSON
   *
   * Strict structural validation: only complete exported snapshots are
   * accepted. Arrays, primitives, empty/unknown objects, and partial shapes
   * are rejected — a malformed file must never overwrite the salon's branding
   * with defaults.
   */
  importSettings(jsonString: string): boolean {
    try {
      this.updateSettings(validateBrandingImport(JSON.parse(jsonString)));
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }
}

export default BrandingService.getInstance();
