import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

/* Global stylesheet ownership.
 *
 * This module is the ONLY owner of global CSS. Import order below is the real
 * runtime cascade order (Vite emits CSS in module-graph order), so it is kept
 * explicit and intentional:
 *
 *   1. index.css        design tokens, base elements, shared primitives
 *                       (Tailwind v4 emits these into @layer theme/base/
 *                       components/utilities)
 *   2. brand-polish.css app-wide brand polish + legacy palette bridge. Written
 *                       unlayered on purpose: unlayered rules outrank every
 *                       Tailwind layer, so the polish wins without !important
 *                       and without depending on source order.
 *   3. readability.css  operational minimum on-screen text size (floor)
 *   4. lena-brand.css   printable receipt signature
 *
 * App.tsx is imported AFTER the stylesheets so no component-side import can
 * jump ahead of this order. Do not move global CSS imports into App.tsx.
 */
import './index.css';
import './brand-polish.css';
import './readability.css';
import './lena-brand.css';

import App from './App.tsx';
import './i18n';
import { getStoredLanguage, getStoredTheme } from './preferences';

const savedLang = getStoredLanguage();
document.documentElement.lang = savedLang;
document.documentElement.dir = savedLang === "ar" ? "rtl" : "ltr";

const savedTheme = getStoredTheme();
if (savedTheme === "light") {
  document.documentElement.classList.remove("dark");
} else {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service Worker registration is owned by PwaUpdatePrompt through
// virtual:pwa-register. A manual navigator.serviceWorker.register('/sw.js')
// here would create a duplicate registration and is intentionally omitted.
