import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Save, Download, Share2, ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCases } from '../app/composition/useCases';
import { unwrap } from '../shared/hooks/useApplication';
import { useToast } from '../shared/components/Toast';
import { LENA_BRAND_PALETTE, isValidBrandColor, normalizeBrandColor } from '../shared/theme/brandPalette';
import brandingService, { validateBrandingImport } from '../infrastructure/services/brandingService';

interface BrandingSettings {
  salonName: string;
  salonNameAr: string;
  address: string;
  addressAr: string;
  phone: string;
  email: string;
  taxNumber: string;
  registrationNumber: string;
  logo: string | null; // Base64 or URL
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  footerText: string;
  footerTextAr: string;
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

const DEFAULT_SETTINGS: BrandingSettings = {
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

function fromCenterSettings(cs: any): BrandingSettings {
  return {
    salonName: cs?.displayName ?? DEFAULT_SETTINGS.salonName,
    salonNameAr: cs?.displayNameAr ?? DEFAULT_SETTINGS.salonNameAr,
    address: cs?.address ?? DEFAULT_SETTINGS.address,
    addressAr: DEFAULT_SETTINGS.addressAr,
    phone: cs?.phone ?? DEFAULT_SETTINGS.phone,
    email: cs?.brandEmail ?? DEFAULT_SETTINGS.email,
    taxNumber: cs?.brandTaxNumber ?? DEFAULT_SETTINGS.taxNumber,
    registrationNumber: cs?.brandRegistrationNumber ?? DEFAULT_SETTINGS.registrationNumber,
    logo: cs?.brandLogoBase64 ?? null,
    primaryColor: normalizeBrandColor(cs?.brandPrimaryColor, DEFAULT_SETTINGS.primaryColor),
    secondaryColor: normalizeBrandColor(cs?.brandSecondaryColor, DEFAULT_SETTINGS.secondaryColor),
    accentColor: normalizeBrandColor(cs?.brandAccentColor, DEFAULT_SETTINGS.accentColor),
    footerText: cs?.brandFooterText ?? DEFAULT_SETTINGS.footerText,
    footerTextAr: cs?.brandFooterTextAr ?? DEFAULT_SETTINGS.footerTextAr,
  };
}

/** Convert a #RRGGBB hex string to the HSL triple used by the app tokens. */
function hexToHsl(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Lift lightness for a readable dark-mode variant of a brand color. */
function liftLightness(hsl: string, by: number): string {
  const parts = hsl.split(' ');
  const l = Math.min(100, Math.round(Number(parts[2].replace('%', ''))) + by);
  return `${parts[0]} ${parts[1]} ${l}%`;
}

/**
 * Feed saved branding values into the shared application tokens (--primary,
 * --secondary, --ring, --accent) for BOTH light and dark modes, via a single
 * injected <style> tag. Semantic colors (success/warning/danger/info) and the
 * surface tokens are intentionally preserved.
 */
function applyBrandTokens(s: Pick<BrandingSettings, 'primaryColor' | 'secondaryColor' | 'accentColor'>) {
  if (typeof document === 'undefined') return;
  const pL = hexToHsl(s.primaryColor);
  const sL = hexToHsl(s.secondaryColor);
  const aL = hexToHsl(s.accentColor);
  const rules: string[] = [];
  if (pL) rules.push(`:root { --primary: ${pL}; --ring: ${pL}; }`);
  if (sL) rules.push(`:root { --secondary: ${sL}; }`);
  if (aL) rules.push(`:root { --accent: ${aL}; }`);
  if (pL) rules.push(`.dark { --primary: ${liftLightness(pL, 10)}; --ring: ${liftLightness(pL, 10)}; }`);
  if (sL) rules.push(`.dark { --secondary: ${liftLightness(sL, 8)}; }`);
  if (aL) rules.push(`.dark { --accent: ${liftLightness(aL, 6)}; }`);
  if (rules.length === 0) return;
  let tag = document.getElementById('brand-tokens') as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'brand-tokens';
    document.head.appendChild(tag);
  }
  tag.textContent = rules.join('\n');
}

export default function BrandingSettingsPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [settings, setSettings] = useState<BrandingSettings>(DEFAULT_SETTINGS);
  const [preview, setPreview] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Supabase is the source of truth; localStorage is only a cache/fallback.
    (async () => {
      let next: BrandingSettings | null = null;
      try {
        const res = await useCases.settings.get();
        if (res.ok) {
          next = fromCenterSettings(res.data);
        }
      } catch {
        // fall through to localStorage
      }
      if (!next) {
        const savedLocal = localStorage.getItem('lenabeauty_branding');
        if (savedLocal) {
          try { next = JSON.parse(savedLocal); } catch { /* ignore */ }
        }
      }
      if (next) {
        setSettings(next);
        if (next.logo) setPreview(next.logo);
        // Reflect the saved brand across the app tokens.
        applyBrandTokens(next);
      }
    })();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('error', t('Error'), t('Logo file must be an image under 2MB'));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      showToast('error', t('Error'), t('Logo file must be an image under 2MB'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPreview(base64);
      setSettings(prev => ({ ...prev, logo: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (field: keyof BrandingSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleColorChange = (field: 'primaryColor' | 'secondaryColor' | 'accentColor', value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Persist an explicit settings snapshot.
   *
   * The snapshot (not the component state) is the single source for this save,
   * so callers — including the import flow — can save a just-validated object
   * atomically without waiting for (or racing) React state commits.
   */
  const persistSettings = async (next: BrandingSettings) => {
    setSaving(true);
    try {
      await unwrap(useCases.settings.update({
        displayName: next.salonName,
        displayNameAr: next.salonNameAr,
        brandEmail: next.email,
        brandTaxNumber: next.taxNumber,
        brandRegistrationNumber: next.registrationNumber,
        brandPrimaryColor: next.primaryColor,
        brandSecondaryColor: next.secondaryColor,
        brandAccentColor: next.accentColor,
        brandFooterText: next.footerText,
        brandFooterTextAr: next.footerTextAr,
        phone: next.phone,
        address: next.address,
        brandLogoBase64: next.logo ?? undefined,
      }));
      // Single persistence path for the local cache: after Supabase accepts
      // the save, update the branding singleton (which owns the cache keys
      // and the logo storage — including removing the logo when it is null).
      // printService and InvoicePrintLayout read this singleton, so the next
      // printed document uses the new branding without a reload. Writing the
      // cache through a separate path here would leave the two sources
      // drifting apart.
      brandingService.updateSettings(next);
      // Saved values feed the shared application tokens.
      applyBrandTokens(next);
      setSaved(true);
      showToast('success', t('Success'), t('Branding settings saved successfully'));
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      showToast('error', t('Error'), err?.message || t('Failed to load branding'));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    // Strict color contract at the UI boundary: the free-text color inputs
    // accept anything, so refuse to persist unless all three are #RRGGBB.
    // (The repository boundary independently normalizes, but a clear error
    // here beats a silent value change.)
    const invalidColors = [
      settings.primaryColor,
      settings.secondaryColor,
      settings.accentColor,
    ].filter((value) => !isValidBrandColor(value));
    if (invalidColors.length > 0) {
      showToast('error', t('Error'), t('Brand colors must be in #RRGGBB format'));
      return;
    }
    await persistSettings(settings);
  };

  const handleExportSettings = () => {
    const data = JSON.stringify(settings, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lenabeauty-branding-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        // Strict structural validation FIRST: only a complete exported
        // snapshot is accepted. Arrays, null, primitives, empty/unknown
        // objects, and partial shapes are rejected before anything can be
        // persisted — a malformed file must never overwrite the salon's
        // branding with defaults. The validated snapshot is then persisted
        // directly (no dependence on React state commits).
        const validated = validateBrandingImport(JSON.parse(event.target?.result as string));
        setSettings(validated);
        if (validated.logo) setPreview(validated.logo);
        void persistSettings(validated);
      } catch {
        showToast('error', t('Error'), t('Invalid branding settings file'));
      }
    };
    reader.readAsText(file);
  };

  const inputCls =
    'w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition';
  const labelCls = 'block text-[11px] font-bold text-muted-foreground mb-1';
  const cardCls = 'bg-card border border-border rounded-xl p-3 sm:p-4';

  const ColorRow = useCallback(
    ({ field, labelKey }: { field: 'primaryColor' | 'secondaryColor' | 'accentColor'; labelKey: string }) => (
      <div>
        <label className={labelCls}>{t(labelKey)}</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={settings[field]}
            onChange={(e) => handleColorChange(field, e.target.value)}
            className="h-9 w-12 rounded-lg cursor-pointer border border-border bg-card p-0.5"
            aria-label={t(labelKey)}
          />
          <input
            type="text"
            value={settings[field]}
            onChange={(e) => handleColorChange(field, e.target.value)}
            className={inputCls + ' font-mono text-xs'}
            dir="ltr"
          />
        </div>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, t]
  );

  return (
    <div className="space-y-4">
      {!embedded && (
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground">{t('Branding Settings')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t('Manage your salon branding and company information')}</p>
        </div>
      )}

      {saved && (
        <div className="p-3 bg-success/10 border border-success/30 rounded-lg text-success text-sm font-bold">
          {t('Branding settings saved successfully')}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Logo + Colors */}
        <div className="lg:col-span-1 space-y-4">
          <div className={cardCls}>
            <h2 className="text-sm font-bold text-foreground mb-3">{t('Salon Logo')}</h2>

            <div className="mb-3 p-3 bg-muted/30 rounded-lg border-2 border-dashed border-primary/30 flex items-center justify-center min-h-32">
              {preview ? (
                <img src={preview} alt={t('Salon Logo')} className="max-w-full max-h-28 object-contain" />
              ) : (
                <div className="text-center">
                  <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-1.5" />
                  <p className="text-muted-foreground text-xs">{t('No logo uploaded yet')}</p>
                </div>
              )}
            </div>

            <label className="block w-full">
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <div className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg cursor-pointer hover:bg-primary/90 transition text-center font-bold text-sm flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" />
                {t('Upload Logo')}
              </div>
            </label>
          </div>

          <div className={cardCls}>
            <h2 className="text-sm font-bold text-foreground mb-3">{t('Colors')}</h2>
            <div className="space-y-3">
              <ColorRow field="primaryColor" labelKey="Primary Color" />
              <ColorRow field="secondaryColor" labelKey="Secondary Color" />
              <ColorRow field="accentColor" labelKey="Accent Color" />
            </div>

            {/* Real component preview using the picked colors */}
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-[11px] font-bold text-muted-foreground mb-2">{t('Live preview')}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className="h-9 px-3 rounded-lg font-bold text-sm text-white shadow-sm"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  {t('Save')}
                </button>
                <span
                  className="h-9 px-3 inline-flex items-center rounded-lg font-bold text-sm text-white"
                  style={{ backgroundColor: settings.secondaryColor }}
                >
                  {t('Secondary Color')}
                </span>
                <span
                  className="h-9 w-9 rounded-lg border border-border"
                  style={{ backgroundColor: settings.accentColor }}
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className={cardCls}>
            <h2 className="text-sm font-bold text-foreground mb-3">{t('Basic Information')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('Salon Name (English)')}</label>
                <input type="text" value={settings.salonName} onChange={(e) => handleInputChange('salonName', e.target.value)} className={inputCls} dir="ltr" />
              </div>
              <div>
                <label className={labelCls}>{t('Salon Name (Arabic)')}</label>
                <input type="text" value={settings.salonNameAr} onChange={(e) => handleInputChange('salonNameAr', e.target.value)} className={inputCls} dir="rtl" />
              </div>
              <div>
                <label className={labelCls}>{t('Phone')}</label>
                <input type="tel" value={settings.phone} onChange={(e) => handleInputChange('phone', e.target.value)} className={inputCls} dir="ltr" />
              </div>
              <div>
                <label className={labelCls}>{t('Email')}</label>
                <input type="email" value={settings.email} onChange={(e) => handleInputChange('email', e.target.value)} className={inputCls} dir="ltr" />
              </div>
              <div>
                <label className={labelCls}>{t('Address (English)')}</label>
                <input type="text" value={settings.address} onChange={(e) => handleInputChange('address', e.target.value)} className={inputCls} dir="ltr" />
              </div>
              <div>
                <label className={labelCls}>{t('Address (Arabic)')}</label>
                <input type="text" value={settings.addressAr} onChange={(e) => handleInputChange('addressAr', e.target.value)} className={inputCls} dir="rtl" />
              </div>
            </div>
          </div>

          <div className={cardCls}>
            <h2 className="text-sm font-bold text-foreground mb-3">{t('Legal Information')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('Tax ID')}</label>
                <input type="text" value={settings.taxNumber} onChange={(e) => handleInputChange('taxNumber', e.target.value)} className={inputCls} dir="ltr" />
              </div>
              <div>
                <label className={labelCls}>{t('Registration Number')}</label>
                <input type="text" value={settings.registrationNumber} onChange={(e) => handleInputChange('registrationNumber', e.target.value)} className={inputCls} dir="ltr" />
              </div>
            </div>
          </div>

          <div className={cardCls}>
            <h2 className="text-sm font-bold text-foreground mb-3">{t('Footer Text')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('Footer Text (English)')}</label>
                <input type="text" value={settings.footerText} onChange={(e) => handleInputChange('footerText', e.target.value)} className={inputCls} dir="ltr" />
              </div>
              <div>
                <label className={labelCls}>{t('Footer Text (Arabic)')}</label>
                <input type="text" value={settings.footerTextAr} onChange={(e) => handleInputChange('footerTextAr', e.target.value)} className={inputCls} dir="rtl" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 min-w-36 h-11 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 active:scale-95 transition font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {t('Save Settings')}
            </button>
            <label className="flex-1 min-w-36">
              <input type="file" accept=".json" onChange={handleImportSettings} className="hidden" />
              <div className="w-full h-11 bg-card border border-border text-foreground rounded-lg hover:bg-muted transition font-bold text-sm flex items-center justify-center gap-2 cursor-pointer">
                <Download className="w-4 h-4" />
                {t('Import')}
              </div>
            </label>
            <button
              onClick={handleExportSettings}
              className="flex-1 min-w-36 h-11 bg-card border border-border text-foreground rounded-lg hover:bg-muted transition font-bold text-sm flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              {t('Export')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
