import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { getStoredLanguage, getStoredTheme } from './preferences';

const savedLang = getStoredLanguage();
document.documentElement.lang = savedLang;
document.documentElement.dir = savedLang === "ar" ? "rtl" : "ltr";

// Load theme from localStorage
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

// Service Worker registration is handled automatically by vite-plugin-pwa
// (registerType: 'autoUpdate' injects registerSW). A manual
// navigator.serviceWorker.register('/sw.js') here caused a double
// registration and is intentionally removed.
