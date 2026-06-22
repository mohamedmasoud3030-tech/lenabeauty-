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
  primaryColor: '#8B5CF6',
  secondaryColor: '#EC4899',
  accentColor: '#06B6D4',
  footerText: 'Powered by LenaBeauty',
  footerTextAr: 'مدعوم بواسطة لينا بيوتي',
};

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
   */
  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('lenabeauty_branding');
      if (saved) {
        this.settings = JSON.parse(saved);
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
    this.settings = { ...this.settings, ...updates };
    
    // Save to localStorage
    const { logo, ...settingsWithoutLogo } = this.settings;
    localStorage.setItem('lenabeauty_branding', JSON.stringify(settingsWithoutLogo));
    
    if (logo) {
      localStorage.setItem('lenabeauty_logo', logo);
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
   * Get header HTML for documents (invoices, reports, etc.)
   */
  getDocumentHeader(isArabic: boolean = false): string {
    const { logo, salonName, salonNameAr, address, addressAr, phone, email, taxNumber } = this.settings;
    const name = isArabic ? salonNameAr : salonName;
    const addr = isArabic ? addressAr : address;

    return `
      <div class="document-header" style="text-align: ${isArabic ? 'right' : 'left'}; margin-bottom: 20px; border-bottom: 2px solid #8B5CF6; padding-bottom: 15px;">
        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
          ${logo ? `<img src="${logo}" alt="Logo" style="height: 60px; max-width: 150px;" />` : ''}
          <div>
            <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #1F2937;">${name}</h1>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #6B7280;">${addr}</p>
          </div>
        </div>
        <div style="display: flex; gap: 20px; font-size: 12px; color: #6B7280;">
          <span>${isArabic ? 'الهاتف' : 'Phone'}: ${phone}</span>
          <span>${isArabic ? 'البريد' : 'Email'}: ${email}</span>
          ${taxNumber ? `<span>${isArabic ? 'الرقم الضريبي' : 'Tax ID'}: ${taxNumber}</span>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Get footer HTML for documents
   */
  getDocumentFooter(isArabic: boolean = false): string {
    const footerText = this.getFooterText(isArabic);
    const { registrationNumber } = this.settings;

    return `
      <div class="document-footer" style="text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #E5E7EB; font-size: 11px; color: #9CA3AF;">
        <p style="margin: 5px 0;">${footerText}</p>
        ${registrationNumber ? `<p style="margin: 5px 0; font-size: 10px;">${isArabic ? 'رقم التسجيل' : 'Registration'}: ${registrationNumber}</p>` : ''}
        <p style="margin: 5px 0; font-size: 10px;">${new Date().toLocaleDateString(isArabic ? 'ar-SA' : 'en-US')}</p>
      </div>
    `;
  }

  /**
   * Get CSS variables for styling
   */
  getCSSVariables(): Record<string, string> {
    return {
      '--primary-color': this.settings.primaryColor,
      '--secondary-color': this.settings.secondaryColor,
      '--accent-color': this.settings.accentColor,
    };
  }

  /**
   * Get print styles for consistent document appearance
   */
  getPrintStyles(): string {
    return `
      <style>
        @media print {
          body {
            margin: 0;
            padding: 10mm;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 12px;
          }
          .document-header {
            margin-bottom: 20px;
            border-bottom: 2px solid ${this.settings.primaryColor};
            padding-bottom: 15px;
          }
          .document-footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #E5E7EB;
            text-align: center;
            font-size: 11px;
            color: #9CA3AF;
          }
          .no-print {
            display: none;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border: 1px solid #E5E7EB;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: ${this.settings.primaryColor};
            color: white;
            font-weight: bold;
          }
        }
      </style>
    `;
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
   * Export settings as JSON
   */
  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import settings from JSON
   */
  importSettings(jsonString: string): boolean {
    try {
      const imported = JSON.parse(jsonString);
      this.updateSettings(imported);
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }
}

export default BrandingService.getInstance();
