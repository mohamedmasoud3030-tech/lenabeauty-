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

## ما تم استكماله بعد الـ foundation
- جسر Desktop invoke في `src/desktop/bridge.ts`
- طبقة SQLite/backup/restore/print في `src/desktop/sqlite.ts`
- desktop repository helper في `src/desktop/repository.ts`
- أوامر Rust فعلية داخل `src-tauri/src/lib.rs` لـ:
  - `desktop_db_health`
  - `desktop_export_backup`
  - `desktop_import_backup`
  - `desktop_print_html`
- تخزين ملف قاعدة سطح المكتب محليًا داخل app data directory بصيغة JSON transitional snapshot
- إنشاء مجلد print queue محلي لالتقاط مهام الطباعة
- ربط أولي لطباعة سطح المكتب من تدفق POS عند توفر Tauri shell
- بطاقة عمليات سطح المكتب مع فحص DB + export/restore/print test

## الملاحظات
- هذه **foundation متقدمة** داخل المستودع لكنها تعتمد على وجود Rust/Tauri toolchain على الجهاز الذي سيبني التطبيق النهائي.
- تم تنفيذ طبقة SQLite-ready وbackup/restore/print bridge، لكن ما يزال ينقص لاحقًا:
  - استبدال JSON snapshot backend بمحرك SQLite حقيقي أو `tauri-plugin-sql`
  - مزامنة لاحقة مع Supabase
  - updater production signing
  - file picker/print dialog production UX داخل shell
