import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getStoredLanguage } from '../preferences';

import { arCommon } from "./ar/common";
import { arAuth } from "./ar/auth";
import { arDashboard } from "./ar/dashboard";
import { arAppointments } from "./ar/appointments";
import { arCustomers } from "./ar/customers";
import { arServices } from "./ar/services";
import { arInventory } from "./ar/inventory";
import { arPos } from "./ar/pos";
import { arAccounting } from "./ar/accounting";
import { arWorkforce } from "./ar/workforce";
import { arSettings } from "./ar/settings";
import { arErrors } from "./ar/errors";
import { enCommon } from "./en/common";
import { enAuth } from "./en/auth";
import { enDashboard } from "./en/dashboard";
import { enAppointments } from "./en/appointments";
import { enCustomers } from "./en/customers";
import { enServices } from "./en/services";
import { enInventory } from "./en/inventory";
import { enPos } from "./en/pos";
import { enAccounting } from "./en/accounting";
import { enWorkforce } from "./en/workforce";
import { enSettings } from "./en/settings";
import { enErrors } from "./en/errors";

const resources = {
  ar: {
    translation: {
      ...arCommon,
      ...arAuth,
      ...arDashboard,
      ...arAppointments,
      ...arCustomers,
      ...arServices,
      ...arInventory,
      ...arPos,
      ...arAccounting,
      ...arWorkforce,
      ...arSettings,
      ...arErrors
    }
  },
  en: {
    translation: {
      ...enCommon,
      ...enAuth,
      ...enDashboard,
      ...enAppointments,
      ...enCustomers,
      ...enServices,
      ...enInventory,
      ...enPos,
      ...enAccounting,
      ...enWorkforce,
      ...enSettings,
      ...enErrors
    }
  }
};

const savedLang = getStoredLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLang,
    fallbackLng: 'ar',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
