# تطبيق Kanzy Spa - دليل إعداد نسخة Desktop (EXE)

## نظرة عامة

هذا الدليل يشرح كيفية تحويل تطبيق Kanzy Spa من تطبيق ويب إلى تطبيق سطح مكتب قابل للتثبيت على أجهزة Windows و Mac و Linux.

## المتطلبات

### 1. متطلبات النظام

- **Node.js**: الإصدار 16 أو أحدث
- **Rust**: أحدث إصدار مستقر
- **Visual Studio Build Tools** (Windows فقط)

### 2. تثبيت المتطلبات

#### على Windows:

```bash
# تثبيت Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# تثبيت Visual Studio Build Tools
# قم بتحميله من: https://visualstudio.microsoft.com/downloads/

# تثبيت Tauri CLI
npm install -g @tauri-apps/cli
```

#### على macOS:

```bash
# تثبيت Xcode Command Line Tools
xcode-select --install

# تثبيت Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# تثبيت Tauri CLI
npm install -g @tauri-apps/cli
```

#### على Linux:

```bash
# تثبيت المكتبات المطلوبة
sudo apt-get install libwebkit2gtk-4.0-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

# تثبيت Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# تثبيت Tauri CLI
npm install -g @tauri-apps/cli
```

## خطوات الإعداد

### الخطوة 1: تثبيت Tauri

```bash
cd /home/ubuntu/spa-app

# تثبيت Tauri كـ dev dependency
npm install --save-dev @tauri-apps/cli @tauri-apps/api

# أو استخدام yarn
yarn add --dev @tauri-apps/cli @tauri-apps/api
```

### الخطوة 2: إنشاء مشروع Tauri

```bash
# إنشاء هيكل Tauri
npm run tauri init

# أو
npx tauri init
```

سيطلب منك الإجابة على الأسئلة التالية:

```
? What is your app name? (Kanzy Spa)
? What should the window title be? (Kanzy Spa - نظام إدارة الصالونات)
? Where are your web assets (src-tauri/target/release/bundle) located, relative to the <current dir>/src-tauri/tauri.conf.json file that will be created? (../dist)
? A relative custom protocol to use in development. By default, this is localhost, so tauri dev and tauri build use a local server. Set it to a blank string to use a file protocol instead. (tauri)
? Enable fullscreen on startup? (false)
? Enable window icon? (true)
```

### الخطوة 3: تحديث ملف الإعدادات

قم بتحديث `src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devPath": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "fullscreen": false,
        "height": 900,
        "resizable": true,
        "title": "Kanzy Spa - نظام إدارة الصالونات",
        "width": 1200
      }
    ],
    "security": {
      "csp": null
    }
  },
  "package": {
    "productName": "Kanzy Spa",
    "version": "1.0.0"
  }
}
```

### الخطوة 4: تحديث package.json

أضف الأوامر التالية إلى `package.json`:

```json
{
  "scripts": {
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:build:windows": "tauri build --target x86_64-pc-windows-msvc",
    "tauri:build:macos": "tauri build --target universal-apple-darwin",
    "tauri:build:linux": "tauri build --target x86_64-unknown-linux-gnu"
  }
}
```

## البناء والتطوير

### تشغيل التطبيق في وضع التطوير

```bash
npm run tauri:dev
```

هذا سيفتح نافذة التطبيق مع أدوات تطوير Chrome.

### بناء التطبيق للإنتاج

```bash
# بناء عام
npm run tauri:build

# بناء لـ Windows
npm run tauri:build:windows

# بناء لـ macOS
npm run tauri:build:macos

# بناء لـ Linux
npm run tauri:build:linux
```

سيتم إنشاء ملفات التثبيت في `src-tauri/target/release/bundle/`.

## ملفات التثبيت المُنتجة

### على Windows:
- `*.msi` - ملف التثبيت (Microsoft Installer)
- `*.exe` - ملف قابل للتنفيذ مباشرة

### على macOS:
- `*.dmg` - ملف التثبيت (Disk Image)
- `*.app` - التطبيق نفسه

### على Linux:
- `*.deb` - ملف التثبيت (Debian/Ubuntu)
- `*.rpm` - ملف التثبيت (Red Hat/Fedora)
- `*.AppImage` - ملف قابل للتنفيذ مباشرة

## الميزات الإضافية

### 1. الوصول إلى النظام الملفات

يمكن استخدام Tauri API للوصول إلى الملفات:

```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { readDir, readTextFile } from '@tauri-apps/api/fs';

// قراءة ملف
const content = await readTextFile('path/to/file.txt');

// قراءة مجلد
const entries = await readDir('path/to/dir');
```

### 2. قاعدة البيانات المحلية

يمكن استخدام SQLite للتخزين المحلي:

```bash
npm install @tauri-apps/plugin-sql
```

### 3. التحديثات التلقائية

يمكن تفعيل التحديثات التلقائية:

```json
{
  "app": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://updates.example.com/releases/{{target}}/{{current_version}}"
      ],
      "dialog": true,
      "pubkey": "your_public_key"
    }
  }
}
```

## استكشاف الأخطاء

### المشكلة: "error: linker `cc` not found"

**الحل:**
```bash
# على Ubuntu/Debian
sudo apt-get install build-essential

# على Fedora
sudo dnf install gcc
```

### المشكلة: "error: Microsoft Visual C++ 14.0 or greater is required"

**الحل:**
قم بتثبيت Visual Studio Build Tools من: https://visualstudio.microsoft.com/downloads/

### المشكلة: "error: failed to run custom build command"

**الحل:**
```bash
# تنظيف الملفات المؤقتة
rm -rf src-tauri/target

# إعادة المحاولة
npm run tauri:build
```

## التوزيع

### نشر على Windows Store

1. قم بإنشاء حساب Microsoft Developer
2. قم بتحضير التطبيق للنشر
3. استخدم Windows App Installer

### نشر على macOS App Store

1. قم بإنشاء حساب Apple Developer
2. قم بتوقيع التطبيق
3. قم بتقديم التطبيق للمراجعة

### نشر على Linux

1. قم بإنشاء حزم `.deb` و `.rpm`
2. قم بنشرها على مستودعات Linux

## الأداء والتحسينات

### تقليل حجم التطبيق

```bash
# تفعيل الضغط
npm run tauri:build -- --release
```

### تحسين سرعة التطبيق

1. استخدم `preload` scripts
2. قلل عدد الملفات المُحملة
3. استخدم lazy loading

## الخلاصة

بعد اتباع هذه الخطوات، سيكون لديك:

✅ تطبيق سطح مكتب قابل للتثبيت
✅ دعم Windows و macOS و Linux
✅ إمكانية الوصول إلى موارد النظام
✅ أداء عالي وحجم صغير
✅ إمكانية التحديث التلقائي

## المراجع

- [Tauri Documentation](https://tauri.app/docs/)
- [Tauri API](https://tauri.app/docs/api/)
- [Rust Documentation](https://doc.rust-lang.org/)
