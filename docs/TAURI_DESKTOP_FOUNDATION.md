# Tauri Desktop Foundation — LenaBeauty

## الهدف
تجهيز LenaBeauty للعمل كنسخة سطح مكتب عبر **Tauri v2** مع بنية جاهزة لـ:
- Offline-first shell
- SQLite-ready architecture
- Deep links
- Updater-ready wiring
- Shell/File/Dialog/Process plugins

## ما تم إنشاؤه
- `src-tauri/Cargo.toml`
- `src-tauri/build.rs`
- `src-tauri/src/main.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/tauri.conf.json`
- `src-tauri/icons/*`
- `.cargo/config.toml`
- `src/desktop/config.ts`
- `src/desktop/storage.ts`
- `src/shared/components/DesktopShellBanner.tsx`

## أوامر مهمة
- `npm run desktop:dev`
- `npm run desktop:build:web`
- `npm run desktop:tauri:check`
- `npm run desktop:test`
- `npm run desktop:preflight`

## الملاحظات
- هذه **foundation كاملة** داخل المستودع لكنها تعتمد على وجود Rust/Tauri toolchain على الجهاز الذي سيبني التطبيق النهائي.
- لم يتم بعد تفعيل SQLite domain adapters الفعلية أو updater production signing.
- يمكن لاحقًا إضافة:
  - `tauri-plugin-sql`
  - مزامنة لاحقة مع Supabase
  - طباعة محلية أعمق
  - أوامر backup/restore سطح مكتب
