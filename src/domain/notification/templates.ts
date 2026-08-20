/**
 * Template registry with validation and variable interpolation.
 * All customer-facing templates are bilingual (Arabic + English).
 */

import { BilingualTemplate } from "./types";

/** Known template variables and their expected types. */
export const KNOWN_VARIABLES: Record<string, string> = {
  customer_name: "string",
  appointment_date: "string",
  appointment_time: "string",
  service_name: "string",
  staff_name: "string",
  center_name: "string",
  payment_amount: "string",
  payment_method: "string",
  loyalty_points: "number",
  total_points: "number",
  tier_name: "string",
  tier_discount: "number",
  reward_name: "string",
  days_left: "number",
  invoice_serial: "string",
};

/** Default bilingual templates for each notification event. */
export const DEFAULT_TEMPLATES: Record<string, BilingualTemplate> = {
  appointment_booked: {
    ar: "مرحباً {customer_name}!\nتم تأكيد موعدك في {center_name}\nالخدمة: {service_name}\nالتاريخ: {appointment_date}\nالوقت: {appointment_time}\nالأخصائي: {staff_name}",
    en: "Hello {customer_name}!\nYour appointment at {center_name} is confirmed.\nService: {service_name}\nDate: {appointment_date}\nTime: {appointment_time}\nStaff: {staff_name}",
  },
  appointment_reminder: {
    ar: "تذكير بموعدك غداً في {center_name}\nالخدمة: {service_name}\nالتاريخ: {appointment_date}\nالوقت: {appointment_time}\nنتظرك!",
    en: "Reminder: your appointment tomorrow at {center_name}\nService: {service_name}\nDate: {appointment_date}\nTime: {appointment_time}\nSee you soon!",
  },
  appointment_cancelled: {
    ar: "تم إلغاء موعدك في {center_name}\nالخدمة: {service_name}\nالتاريخ: {appointment_date}\nالوقت: {appointment_time}\nللاتصال بنا لحجز موعد جديد.",
    en: "Your appointment at {center_name} has been cancelled.\nService: {service_name}\nDate: {appointment_date}\nTime: {appointment_time}\nPlease contact us to reschedule.",
  },
  appointment_rescheduled: {
    ar: "تم تغيير موعدك في {center_name}\nالخدمة: {service_name}\nالتاريخ الجديد: {appointment_date}\nالوقت الجديد: {appointment_time}\nالأخصائي: {staff_name}",
    en: "Your appointment at {center_name} has been rescheduled.\nService: {service_name}\nNew date: {appointment_date}\nNew time: {appointment_time}\nStaff: {staff_name}",
  },
  invoice_complete: {
    ar: "شكراً لزيارتك {center_name}!\nالمبلغ: {payment_amount}\nطريقة الدفع: {payment_method}\nرقم الفاتورة: {invoice_serial}\nتاريخ الفاتورة: {appointment_date}",
    en: "Thank you for visiting {center_name}!\nAmount: {payment_amount}\nPayment: {payment_method}\nInvoice: {invoice_serial}\nInvoice date: {appointment_date}",
  },
  loyalty_points_earned: {
    ar: "أحسنت! حصلت على {loyalty_points} نقطة ولاء!\nرصيدك الإجمالي: {total_points}\nالمستوى: {tier_name}",
    en: "Great! You earned {loyalty_points} loyalty points!\nTotal balance: {total_points}\nTier: {tier_name}",
  },
  tier_upgrade: {
    ar: "تهانينا! لقد ارتقيت إلى مستوى {tier_name}\nالآن تحصل على {tier_discount}% خصم!",
    en: "Congratulations! You've reached {tier_name} tier!\nYou now get {tier_discount}% discount!",
  },
  reward_expiring: {
    ar: "تنبيه مهم! جائزتك \"{reward_name}\" ستنتهي خلال {days_left} أيام فقط.\nاستخدمها الآن!",
    en: "Important! Your reward \"{reward_name}\" will expire in {days_left} days.\nUse it now!",
  },
};

/** Variable interpolation error. */
export class TemplateInterpolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateInterpolationError";
  }
}

/**
 * Extract variable names from a template string like "{customer_name}".
 */
export function extractVariables(template: string): string[] {
  const regex = /\{(\w+)\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(template)) !== null) {
    variables.push(match[1]);
  }
  return [...new Set(variables)];
}

/**
 * Validates a template string:
 * - All variables are known
 * - No HTML/script tags
 * - Max length 4096
 * - No double braces
 */
export function validateTemplate(template: string, _eventId?: string): string[] {
  const errors: string[] = [];

  if (template.length > 4096) {
    errors.push(`Template exceeds 4096 characters (${template.length})`);
  }

  if (/<[a-z][\s\S]*>/i.test(template)) {
    errors.push("Template must not contain HTML tags");
  }

  if (/\{\{\w+\}\}/.test(template)) {
    errors.push("Template must not contain double braces {{...}}");
  }

  const found = extractVariables(template);
  for (const v of found) {
    if (!KNOWN_VARIABLES[v]) {
      errors.push(`Unknown template variable: ${v}`);
    }
  }

  return errors;
}

/**
 * Validate a bilingual template pair (ar + en).
 * Both languages must have the same set of variables.
 */
export function validateBilingualTemplate(
  template: BilingualTemplate,
  _eventId?: string,
): string[] {
  const arVars = extractVariables(template.ar);
  const enVars = extractVariables(template.en);
  const errors: string[] = [];

  errors.push(
    ...validateTemplate(template.ar, _eventId).map((e) => `[ar] ${e}`),
  );
  errors.push(
    ...validateTemplate(template.en, _eventId).map((e) => `[en] ${e}`),
  );

  for (const v of enVars) {
    if (!arVars.includes(v)) {
      errors.push(
        `Variable "${v}" present in English template but missing in Arabic`,
      );
    }
  }
  for (const v of arVars) {
    if (!enVars.includes(v)) {
      errors.push(
        `Variable "${v}" present in Arabic template but missing in English`,
      );
    }
  }

  return errors;
}

/**
 * Interpolate variables into a template.
 * Missing variables leave the placeholder intact.
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, string | number | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = variables[name];
    return value !== undefined && value !== null ? String(value) : `{${name}}`;
  });
}

/**
 * Build a rendered message for a given event and language.
 * If a custom template is provided, use it; otherwise use the default.
 */
export function renderMessage(
  eventId: string,
  language: "ar" | "en",
  variables: Record<string, string | number | undefined>,
  customTemplate?: string,
): string {
  const template = customTemplate || DEFAULT_TEMPLATES[eventId]?.[language];
  if (!template) {
    return `[No template for ${eventId} in ${language}]`;
  }
  return interpolateTemplate(template, variables);
}
