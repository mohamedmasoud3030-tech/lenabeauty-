import React, { useState, useEffect } from 'react';
import { Upload, Save, Eye, Download, Share2, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  logoFile?: File;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  footerText: string;
  footerTextAr: string;
}

export default function BrandingSettingsPage() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [settings, setSettings] = useState<BrandingSettings>({
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
  });

  const [preview, setPreview] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem('lenabeauty_branding');
    if (saved) {
      setSettings(JSON.parse(saved));
      const logoData = localStorage.getItem('lenabeauty_logo');
      if (logoData) {
        setPreview(logoData);
      }
    }
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setPreview(base64);
        setSettings(prev => ({ ...prev, logo: base64, logoFile: file }));
        localStorage.setItem('lenabeauty_logo', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (field: keyof BrandingSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleColorChange = (field: 'primaryColor' | 'secondaryColor' | 'accentColor', value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    localStorage.setItem('lenabeauty_branding', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleExportSettings = () => {
    const data = JSON.stringify(settings, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lenabeauty-branding-settings.json';
    a.click();
  };

  const handleImportSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          setSettings(imported);
          if (imported.logo) {
            setPreview(imported.logo);
          }
          handleSave();
        } catch (err) {
          alert('فشل استيراد الإعدادات. تأكد من صيغة الملف.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            {isArabic ? 'إعدادات الهوية البصرية' : 'Branding Settings'}
          </h1>
          <p className="text-gray-400">
            {isArabic ? 'إدارة هوية الصالون وبيانات الشركة' : 'Manage your salon branding and company information'}
          </p>
        </div>

        {/* Success Message */}
        {saved && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400">
            {isArabic ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved successfully'}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Logo Section */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                {isArabic ? 'شعار الصالون' : 'Salon Logo'}
              </h2>

              {/* Logo Preview */}
              <div className="mb-6 p-6 bg-white/5 rounded-xl border-2 border-dashed border-purple-500/50 flex items-center justify-center min-h-48">
                {preview ? (
                  <img src={preview} alt="Logo" className="max-w-full max-h-40 object-contain" />
                ) : (
                  <div className="text-center">
                    <Upload className="w-12 h-12 text-purple-400 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">
                      {isArabic ? 'لم يتم رفع شعار بعد' : 'No logo uploaded yet'}
                    </p>
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <label className="block w-full">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <div className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg cursor-pointer hover:shadow-lg hover:shadow-purple-500/50 transition text-center font-semibold flex items-center justify-center gap-2">
                  <Upload className="w-5 h-5" />
                  {isArabic ? 'رفع شعار' : 'Upload Logo'}
                </div>
              </label>

              {/* Color Palette */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <h3 className="text-lg font-bold text-white mb-4">
                  {isArabic ? 'الألوان' : 'Colors'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">
                      {isArabic ? 'اللون الأساسي' : 'Primary Color'}
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="color"
                        value={settings.primaryColor}
                        onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                        className="w-16 h-10 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.primaryColor}
                        onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                        className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">
                      {isArabic ? 'اللون الثانوي' : 'Secondary Color'}
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="color"
                        value={settings.secondaryColor}
                        onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                        className="w-16 h-10 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.secondaryColor}
                        onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                        className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">
                      {isArabic ? 'لون التأكيد' : 'Accent Color'}
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="color"
                        value={settings.accentColor}
                        onChange={(e) => handleColorChange('accentColor', e.target.value)}
                        className="w-16 h-10 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.accentColor}
                        onChange={(e) => handleColorChange('accentColor', e.target.value)}
                        className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                {isArabic ? 'المعلومات الأساسية' : 'Basic Information'}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    {isArabic ? 'اسم الصالون (إنجليزي)' : 'Salon Name (English)'}
                  </label>
                  <input
                    type="text"
                    value={settings.salonName}
                    onChange={(e) => handleInputChange('salonName', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    {isArabic ? 'اسم الصالون (عربي)' : 'Salon Name (Arabic)'}
                  </label>
                  <input
                    type="text"
                    value={settings.salonNameAr}
                    onChange={(e) => handleInputChange('salonNameAr', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    {isArabic ? 'الهاتف' : 'Phone'}
                  </label>
                  <input
                    type="tel"
                    value={settings.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    {isArabic ? 'البريد الإلكتروني' : 'Email'}
                  </label>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    {isArabic ? 'العنوان (إنجليزي)' : 'Address (English)'}
                  </label>
                  <input
                    type="text"
                    value={settings.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    {isArabic ? 'العنوان (عربي)' : 'Address (Arabic)'}
                  </label>
                  <input
                    type="text"
                    value={settings.addressAr}
                    onChange={(e) => handleInputChange('addressAr', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Legal Information */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                {isArabic ? 'المعلومات القانونية' : 'Legal Information'}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    {isArabic ? 'الرقم الضريبي' : 'Tax Number'}
                  </label>
                  <input
                    type="text"
                    value={settings.taxNumber}
                    onChange={(e) => handleInputChange('taxNumber', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    {isArabic ? 'رقم التسجيل التجاري' : 'Registration Number'}
                  </label>
                  <input
                    type="text"
                    value={settings.registrationNumber}
                    onChange={(e) => handleInputChange('registrationNumber', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Footer Text */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                {isArabic ? 'نص التذييل' : 'Footer Text'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    {isArabic ? 'نص التذييل (إنجليزي)' : 'Footer Text (English)'}
                  </label>
                  <input
                    type="text"
                    value={settings.footerText}
                    onChange={(e) => handleInputChange('footerText', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    {isArabic ? 'نص التذييل (عربي)' : 'Footer Text (Arabic)'}
                  </label>
                  <input
                    type="text"
                    value={settings.footerTextAr}
                    onChange={(e) => handleInputChange('footerTextAr', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSave}
                className="flex-1 min-w-40 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition font-semibold flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                {isArabic ? 'حفظ الإعدادات' : 'Save Settings'}
              </button>

              <label className="flex-1 min-w-40">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportSettings}
                  className="hidden"
                />
                <div className="w-full bg-white/10 border border-white/20 text-white py-3 rounded-lg hover:bg-white/20 transition font-semibold flex items-center justify-center gap-2 cursor-pointer">
                  <Download className="w-5 h-5" />
                  {isArabic ? 'استيراد' : 'Import'}
                </div>
              </label>

              <button
                onClick={handleExportSettings}
                className="flex-1 min-w-40 bg-white/10 border border-white/20 text-white py-3 rounded-lg hover:bg-white/20 transition font-semibold flex items-center justify-center gap-2"
              >
                <Share2 className="w-5 h-5" />
                {isArabic ? 'تصدير' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
