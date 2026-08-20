/**
 * Help article registry — task-based, bilingual, verified content.
 *
 * Every article must describe behavior that actually ships. When a feature
 * changes, update the matching article in the same commit; the freshness
 * test pins this registry.
 *
 * Stored as a compact data table (one row per article) to keep the file free
 * of duplicated object scaffolding.
 */

export type HelpCategory =
  | "getting-started"
  | "daily-work"
  | "permissions"
  | "account"
  | "data"
  | "errors";

export interface HelpArticle {
  slug: string;
  category: HelpCategory;
  audience: "all" | "admin";
  title: Record<"ar" | "en", string>;
  body: Record<"ar" | "en", string[]>;
}

export const HELP_CATEGORY_LABELS: Record<HelpCategory, { ar: string; en: string }> = {
  "getting-started": { ar: "البدء", en: "Getting started" },
  "daily-work": { ar: "العمل اليومي", en: "Daily work" },
  permissions: { ar: "الصلاحيات", en: "Permissions" },
  account: { ar: "الحساب", en: "Account" },
  data: { ar: "البيانات", en: "Data" },
  errors: { ar: "الأخطاء", en: "Errors" },
};

type ArticleRow = readonly [
  slug: string,
  category: HelpCategory,
  audience: "all" | "admin",
  titleAr: string,
  titleEn: string,
  bodyAr: string,
  bodyEn: string,
];

const ARTICLE_ROWS: ArticleRow[] = [
  ["first-login", "getting-started", "all",
    "تسجيل الدخول الأول ودورك", "First login and your role",
    "سجّل الدخول باستخدام البريد الإلكتروني الذي سجّله مدير المركز لك وكلمة المرور الخاصة بك.|لا يوجد تسجيل عام: الحسابات تُنشأ فقط من قبل مدير المركز.|الأدوار ثلاثة: ADMIN (مدير)، MANAGER (مشرف)، STAFF (موظف). المدير فقط يرى الأقسام الإدارية مثل التقارير والموظفين والرواتب.",
    "Sign in with the work email your center administrator registered for you, plus your password.|There is no public sign-up: accounts are created only by the center administrator.|Three roles exist: ADMIN, MANAGER, and STAFF. Only ADMIN sees administrative sections such as reports, employees, and payroll."],
  ["set-up-services", "getting-started", "admin",
    "إضافة أول خدماتك", "Adding your first services",
    "افتح صفحة الخدمات ثم اضغط 'إضافة خدمة' وأدخل الاسم والسعر والمدة.|الخدمات النشطة فقط تظهر في نقطة البيع. لخدمات 'يبدأ من'، سيُطلب منك إدخال السعر النهائي عند البيع.|لا يمكن حجز أو بيع أي شيء قبل وجود قائمة خدمات.",
    "Open the Services page and tap 'Add Service', then enter the name, price, and duration.|Only active services appear in the POS. For 'starts from' services, the final price is requested at sale time.|Nothing can be booked or sold until a service menu exists."],
  ["book-appointment", "daily-work", "all",
    "حجز موعد", "Booking an appointment",
    "افتح صفحة المواعيد واختر اليوم أو الأسبوع، ثم اضغط على خانة فارغة.|اختر العميل والخدمة والأخصائي والتاريخ والوقت. حماية التداخل تمنع حجز نفس الأخصائي في نفس الوقت مرتين.|يمكنك إنشاء عميل جديد مباشرة من نافذة الحجز إذا لم يظهر في البحث.",
    "Open Appointments and pick the day or week view, then tap an empty slot.|Choose the customer, service, specialist, date, and time. Overlap protection prevents double-booking the same specialist.|You can create a new customer inline from the booking dialog if search finds nothing."],
  ["take-payment", "daily-work", "all",
    "تسجيل عملية بيع في نقطة البيع", "Recording a sale at the POS",
    "اختر الخدمات أو المنتجات أو الباقات من الكتالوج، ثم اختر العميل والأخصائي.|طريقة الدفع (نقد/بطاقة/تحويل) توثّق التحصيل اليدوي فقط — لا يتم خصم أي مبلغ من البطاقة داخل التطبيق.|بعد إتمام البيع تُعرض الفاتورة للطباعة ويُحدَّث المخزون ونقاط الولاء تلقائيًا.",
    "Pick services, products, or packages from the catalog, then choose the customer and specialist.|The payment method (Cash/Card/Transfer) records manual collection only — no card is charged inside the app.|After checkout, the receipt is shown for printing and stock and loyalty points update automatically."],
  ["manage-customers", "daily-work", "all",
    "إدارة العملاء", "Managing customers",
    "ابحث عن العميل بالاسم أو الهاتف من صفحة العملاء، أو أنشئ ملفًا جديدًا.|يحفظ ملف العميل بيانات التواصل والملاحظات وسجل المواعيد والفواتير ونقاط الولاء.|يمكن إضافة عميل جديد من داخل نقطة البيع مباشرة لبيع أسرع.",
    "Search customers by name or phone from the Customers page, or create a new record.|A customer record keeps contact details, notes, appointment history, invoices, and loyalty points.|You can add a new customer directly from the POS for faster checkout."],
  ["permissions", "permissions", "all",
    "من يرى ماذا", "Who can see what",
    "ADMIN فقط يصل إلى الموظفين والتقارير والمصروفات والحضور والسلف والرواتب والإعدادات.|MANAGER و STAFF لهما نفس النطاق التشغيلي: لوحة التحكم، نقطة البيع، المواعيد، العملاء، الخدمات، المنتجات.|رواتب الموظفين لا تُعرض إلا للمدير؛ أي دور آخر يرى بيانات الموظف بدون الأرقام المالية.",
    "Only ADMIN can open Employees, Reports, Expenses, Attendance, Advances, Payroll, and Settings.|MANAGER and STAFF share the same operational scope: Dashboard, POS, Appointments, Customers, Services, Products.|Employee compensation is shown to ADMIN only; other roles see employee data without financial figures."],
  ["forgot-password", "account", "all",
    "إعادة تعيين كلمة المرور", "Reset your password",
    "في صفحة تسجيل الدخول اضغط 'نسيت كلمة المرور؟' وأدخل بريدك الإلكتروني.|سيصلك رابط إعادة تعيين إذا كان الحساب موجودًا — لا نكشف ما إذا كان البريد مسجلاً لأسباب أمنية.|افتح الرابط واختر كلمة مرور جديدة (8 أحرف على الأقل) ثم سجّل الدخول.",
    "On the sign-in page tap 'Forgot password?' and enter your email.|A reset link is sent if the account exists — we never reveal whether an email is registered, for security.|Open the link, choose a new password (at least 8 characters), then sign in."],
  ["whatsapp-notifications", "daily-work", "admin",
    "تذكيرات واتساب", "WhatsApp reminders",
    "الإشعارات الحالية تفتح رابط wa.me يدويًا — ترسل الرسالة بنفسك من واتساب ولا يوجد تأكيد توصيل تلقائي.|رسائل SMS غير مفعّلة حتى يتوفر مزود خادم.|من الإعدادات ← الإشعارات يمكنك تعديل القوالب وساعات التذكير قبل الموعد.",
    "Current notifications open a manual wa.me link — you send the message yourself in WhatsApp, and there is no automatic delivery receipt.|SMS sending is disabled until a server-side provider exists.|From Settings → Notifications you can edit templates and the reminder lead time."],
  ["backup-export", "data", "admin",
    "تصدير بياناتك", "Exporting your data",
    "الإعدادات ← البيانات تتيح تصدير ملف JSON تشغيلي.|هذا التصدير ليس نسخة احتياطية كاملة لقاعدة البيانات ولا يمكن استعادته — الاستعادة معطّلة عمدًا.|للنسخ الاحتياطي الحقيقي استخدم النسخ المُدارة من مزود قاعدة البيانات وخطة استعادة موثقة.",
    "Settings → Data offers an operational JSON export.|This export is not a full database backup and cannot be restored — restore is deliberately disabled.|For real backups use the managed database backups from your provider and a documented recovery plan."],
  ["error-codes", "errors", "all",
    "فهم رسائل الخطأ", "Understanding error messages",
    "عند حدوث خطأ غير متوقع تظهر شاشة بها رمز تقرير (Report ID) وزرّي 'إعادة تحميل' و'العودة للوحة التحكم'.|احتفظ برمز التقرير وتواصل مع الدعم عبر مركز المساعدة — الرمز يربط الشكوى بالسجلات دون كشف بيانات.|رسائل التحقق (مثل 'الاسم مطلوب') تعني أن الحقل غير مكتمل؛ أصلحه ثم أعد المحاولة.",
    "On an unexpected error, a screen appears with a Report ID and two actions: 'Reload Page' and 'Back to Dashboard'.|Keep the Report ID and contact support through the Help Center — it correlates your report with logs without exposing data.|Validation messages (e.g. 'name is required') mean a field is incomplete; fix it and retry."],
  ["offline", "data", "all",
    "العمل بدون اتصال", "Working offline",
    "التطبيق PWA: يعمل هيكل الواجهة والبيانات المخزنة مؤخرًا بدون اتصال.|أي عملية كتابة (حجز، بيع، تعديل) تتطلب اتصالاً بالإنترنت؛ بدون اتصال ستظهر رسالة خطأ.|أعد الاتصال ثم أعد المحاولة — لا يتم تسجيل المعاملة جزئيًا.",
    "This is a PWA: the interface shell and recently loaded data work offline.|Any write operation (booking, sale, edit) requires a connection; offline attempts show an error.|Reconnect and retry — a transaction is never recorded partially."],
  ["payment-gateway", "data", "admin",
    "المدفوعات الإلكترونية", "Online payments",
    "الإعدادات ← المدفوعات تخزّن بيانات المزود (Thawani / PayTabs / Stripe) كبيانات وصفية فقط.|لا توجد جلسة دفع حية أو webhook في هذا الإصدار — الدفع يُسجَّل يدويًا في نقطة البيع.|إعدادات الوديعة تحدد مبلغ الدفعة المقدمة عند الحجز ويُحسب عند إتمام البيع.",
    "Settings → Payments stores provider metadata (Thawani / PayTabs / Stripe) only.|There is no live payment session or webhook in this version — payment is recorded manually at the POS.|Deposit settings define the booking prepayment amount and are applied at checkout."],
];

export const HELP_ARTICLES: HelpArticle[] = ARTICLE_ROWS.map((row) => {
  const [slug, category, audience, titleAr, titleEn, bodyAr, bodyEn] = row;
  return {
    slug,
    category,
    audience,
    title: { ar: titleAr, en: titleEn },
    body: {
      ar: bodyAr.split("|"),
      en: bodyEn.split("|"),
    },
  };
});

/** Lookup helper used by the Help Center page. */
export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function searchHelpArticles(query: string, language: "ar" | "en"): HelpArticle[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return HELP_ARTICLES;
  return HELP_ARTICLES.filter((a) => {
    const title = a.title[language].toLocaleLowerCase();
    const body = a.body[language].join(" ").toLocaleLowerCase();
    return title.includes(q) || body.includes(q);
  });
}
