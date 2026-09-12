// Arabic strings for the public online-booking surface, the client portal,
// the Settings → Online Booking section, and the commission UI completed by
// the commission engine migration. Keys must mirror en/booking.ts exactly
// (the no-language-leak guard treats any divergence as a CI failure).

export const arBooking = {
  // — Public booking page —
  "Loading booking options...": "جاري تحميل خيارات الحجز...",
  "Booking is unavailable right now": "الحجز غير متاح حاليًا",
  "Could not sign in. Please check your phone number and portal code.": "تعذّر تسجيل الدخول. يُرجى التحقق من رقم الهاتف ورمز البوابة.",
  "The request could not be completed. Please try again.": "تعذّر إتمام الطلب. يُرجى المحاولة مرة أخرى.",
  "We could not find this appointment. Please contact the salon.": "تعذّر العثور على هذا الموعد. يُرجى التواصل مع الصالون.",
  "Invalid portal credentials": "بيانات الدخول إلى البوابة غير صحيحة",
  "Account temporarily locked. Try again later.": "الحساب مقفل مؤقتًا. يُرجى المحاولة لاحقًا.",
  // Messages public_create_booking_v1 raises directly. They reach the client
  // mid-flow (a service withdrawn, or a slot taken between load and submit), so
  // they must render in the client's language rather than in English.
  "Service is not available": "الخدمة غير متاحة حاليًا",
  "Selected staff is not available": "الأخصائية المختارة غير متاحة حاليًا",
  "Cannot book a time in the past": "لا يمكن الحجز في وقت ماضٍ",
  "Missing required booking fields": "بيانات الحجز غير مكتملة",
  "Name and phone are required": "الاسم ورقم الهاتف مطلوبان",
  "Invalid phone number": "رقم الهاتف غير صحيح",
  "Missing center id": "معرّف المركز مفقود",
  "You do not have permission to do that.": "لا تملكين صلاحية تنفيذ هذا الإجراء.",
  "This client does not belong to this salon.": "هذه العميلة لا تنتمي إلى هذا الصالون.",
  "This appointment does not belong to this salon.": "هذا الموعد لا ينتمي إلى هذا الصالون.",
  "This service does not belong to this salon.": "هذه الخدمة لا تنتمي إلى هذا الصالون.",
  "Only an administrator can do that.": "هذا الإجراء متاح لمديرة النظام فقط.",
  "This appointment can no longer be cancelled.": "لم يعد بالإمكان إلغاء هذا الموعد.",
  "A past or started appointment cannot be cancelled.": "لا يمكن إلغاء موعد ماضٍ أو بدأ بالفعل.",
  "This appointment can no longer be rescheduled.": "لم يعد بالإمكان إعادة جدولة هذا الموعد.",
  "A past or started appointment cannot be rescheduled.": "لا يمكن إعادة جدولة موعد ماضٍ أو بدأ بالفعل.",
  "Please choose a time in the future.": "يُرجى اختيار وقت في المستقبل.",
  "The selected specialist is not available for that time.": "الأخصائية المختارة غير متاحة في هذا الوقت.",
  "This time slot is no longer available": "هذا الوقت لم يعد متاحًا",
  "Too many attempts. Please try again in a little while.": "محاولات كثيرة في وقت قصير. يُرجى المحاولة بعد قليل.",
  "This booking link is not configured. Please contact the salon.": "رابط الحجز غير مُهيأ. يُرجى التواصل مع الصالون.",
  "This portal link is not configured. Please contact the salon.": "رابط البوابة غير مُهيأ. يُرجى التواصل مع الصالون.",
  "No services are published for booking yet": "لا توجد خدمات متاحة للحجز بعد",
  "No specialists are available for booking yet": "لا توجد أخصائيات متاحات للحجز بعد",
  "Back": "رجوع",
  "Continue": "متابعة",
  "Date & Time": "التاريخ والوقت",
  "Your Name": "اسمك",
  "Please enter your full name": "يُرجى إدخال الاسم الكامل",
  "Please enter a valid phone number": "يُرجى إدخال رقم هاتف صحيح",
  "Your appointment is booked": "تم حجز موعدك بنجاح",
  "We look forward to seeing you": "نتطلع لرؤيتك",
  "Need to change it? Ask the salon for your portal code, then open the client portal from this page.": "تريدين التغيير؟ اطلبي رمز البوابة من الصالون ثم افتحي بوابة العميل من هذه الصفحة.",

  // — Client portal —
  "Client Portal": "بوابة العميل",
  "Client portal": "بوابة العميل",
  "Your visits, your rewards": "زياراتك ومكافآتك",
  "Sign in to your portal": "الدخول إلى بوابتك",
  "Use the phone number you booked with and the code from the salon": "استخدمي رقم الهاتف الذي حجزتِ به والرمز الذي أعطاكِ إياه الصالون",
  "Enter your phone number and the code given to you by the salon": "أدخلي رقم هاتفك والرمز الذي أعطاكِ إياه الصالون",
  "Loading your visits...": "جاري تحميل زياراتك...",
  "Visits": "الزيارات",
  "Upcoming Appointments": "المواعيد القادمة",
  "No upcoming appointments": "لا توجد مواعيد قادمة",
  "Appointment": "الموعد",
  "Reschedule": "تغيير الموعد",
  "Confirm New Time": "تأكيد الوقت الجديد",
  "Visit History": "سجل الزيارات",
  "No visits recorded yet": "لا توجد زيارات مسجلة بعد",
  "Past appointments": "المواعيد السابقة",
  "Exit Portal": "الخروج من البوابة",
  "Powered by": "بتقنية",

  // — Settings → Online Booking —
  "Your public booking link and client portal": "رابط الحجز العام وبوابة العميل",
  "Let clients book themselves, 24/7, without calling you.": "دعي العميلات يحجزن بأنفسهن على مدار الساعة دون اتصال.",
  "Public booking link": "رابط الحجز العام",
  "Share this link on Instagram or WhatsApp. Anyone who opens it can pick a service, a specialist and a free time — it lands in your Appointments calendar as a scheduled visit.": "شاركي هذا الرابط على إنستغرام أو واتساب. من يفتحه تختار خدمة وأخصائية ووقتًا متاحًا — ويظهر الموعد فورًا في تقويم المواعيد كزيارة مجدولة.",
  "Copy booking link": "نسخ رابط الحجز",
  "Copy portal link": "نسخ رابط البوابة",
  "Scan to open the booking page": "امسحي الكود لفتح صفحة الحجز",
  "Each customer gets a personal code from the Customers screen. With their phone number and that code they can open the portal, see their visits and rewards, and cancel or move an upcoming appointment themselves.": "تحصل كل عميلة على رمز خاص من شاشة العملاء. برقم هاتفها ورمزها تستطيع فتح البوابة ومشاهدة زياراتها ومكافآتها، وإلغاء موعد قادم أو تأجيله بنفسها.",
  "Appointments created online appear instantly in your calendar.": "المواعيد المحجوزة أونلاين تظهر فورًا في تقويمك.",
  "Customers can only cancel or reschedule a future scheduled appointment.": "يمكن للعميلة إلغاء أو تغيير الموعد المجدول القادم فقط.",
  "Wrong code entries lock the portal for 15 minutes, exactly like a bank.": "تكرار الرمز الخطأ يقفل البوابة 15 دقيقة، تمامًا كما في البنوك.",

  // — Customers screen: portal code action —
  "Portal code": "رمز البوابة",
  "Issuing...": "جاري الإصدار...",
  "Code for {{name}}: {{code}} — share it with her privately.": "رمز {{name}}: {{code}} — شاركيه معها بسرية.",

  // — Commission UI (payroll + employees) —
  "Commission is calculated by the payroll run from recorded paid sales.": "تُحسب العمولة في مسير الرواتب من المبيعات المدفوعة المسجلة.",
  "Net salary = base + commission from recorded sales − advances in the same month": "الراتب الصافي = الأساسي + عمولة المبيعات المسجلة − السلف في نفس الشهر",
} as const;
