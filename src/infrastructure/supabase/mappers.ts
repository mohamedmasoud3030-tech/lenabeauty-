import { 
  Customer, Employee, Service, Appointment, Product, Expense, Invoice, InvoiceItem, CenterSettings,
  AppointmentStatus, GiftCard, GiftCardTransaction, ServicePackage, ServicePackageItem,
  NotificationSettingsEntity, PaymentGatewaySettings, CustomerReview, ServiceFile, ServiceFileImage, CustomerNotificationEvent, AccountingJournalEntry, AiBookingLead
} from "../../domain/entities";
import { UserRole, SessionState, AuthenticatedSession } from "../../domain/entities/Session";
import { createMappingError } from "./errors";
import { Session as SupabaseSession } from "@supabase/supabase-js";

// Helper to safely parse dates and fail closed
function parseDate(val: unknown, fieldName: string, methodName: string): Date {

  if (!val) {
    throw createMappingError(methodName, `Missing required timestamp field (${fieldName})`);
  }
  const d = new Date(val as string | number);
  if (isNaN(d.getTime())) {
    throw createMappingError(methodName, `Invalid timestamp for field (${fieldName})`);
  }
  return d;
}

function parseOptionalDate(val: unknown, fieldName: string, methodName: string): Date | undefined {
  if (!val) return undefined;
  const d = new Date(val as string | number);
  if (isNaN(d.getTime())) {
    throw createMappingError(methodName, `Invalid timestamp for field (${fieldName})`);
  }
  return d;
}

function assertRowObject(row: unknown, methodName: string): asserts row is Record<string, unknown> {
  if (!row || typeof row !== "object") {
    throw createMappingError(methodName, "Received a row that is not an object");
  }
}

export function mapCustomer(row: unknown): Customer {
  assertRowObject(row, "mapCustomer");
  if (typeof row.id !== "string" || typeof row.name !== "string") {
    throw createMappingError("mapCustomer", "Missing or invalid required fields (id, name)");
  }
  return {
    id: row.id,
    name: row.name,
    category: typeof row.category === "string" ? row.category : undefined,
    phone: typeof row.phone === "string" ? row.phone : undefined,
    email: typeof row.email === "string" ? row.email : undefined,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    totalSpent: Number(row.total_spent) || 0,
    loyaltyPoints: Number(row.loyalty_points) || 0,
    lastVisit: parseOptionalDate(row.last_visit, "last_visit", "mapCustomer"),
    portalAccessToken: typeof row.portal_access_token === "string" ? row.portal_access_token : undefined,
    portalAccessEnabled: typeof row.portal_access_enabled === "boolean" ? row.portal_access_enabled : true,
    portalLastLoginAt: parseOptionalDate(row.portal_last_login_at, "portal_last_login_at", "mapCustomer"),
    createdAt: parseDate(row.created_at, "created_at", "mapCustomer"),
    updatedAt: parseDate(row.updated_at, "updated_at", "mapCustomer")
  };
}

export function mapEmployee(row: unknown): Employee {
  assertRowObject(row, "mapEmployee");
  if (typeof row.id !== "string" || typeof row.name !== "string") {
    throw createMappingError("mapEmployee", "Missing or invalid required fields (id, name)");
  }
  return {
    id: row.id,
    name: row.name,
    role: typeof row.role === "string" ? row.role : "Staff",
    phone: typeof row.phone === "string" ? row.phone : undefined,
    salary: Number(row.salary) || 0,
    baseSalary: Number(row.base_salary) || 0,
    commissionPercentage: Number(row.commission_percentage) || 0,
    isActive: typeof row.is_active === "boolean" ? row.is_active : true,
    createdAt: parseDate(row.created_at, "created_at", "mapEmployee"),
    updatedAt: parseDate(row.updated_at, "updated_at", "mapEmployee"),
    // Missing from schema but required by domain optionally
    monthCommissionTotal: 0 
  };
}

export function mapService(row: unknown): Service {
  assertRowObject(row, "mapService");
  if (typeof row.id !== "string" || typeof row.name !== "string" || row.price === undefined || row.duration_minutes === undefined) {
      throw createMappingError("mapService", "Missing or invalid required fields (id, name, price, duration_minutes)");
  }
  return {
    id: row.id,
    name: row.name,
    categoryId: typeof row.category_id === "string" ? row.category_id : "",
    price: Number(row.price),
    durationMinutes: Number(row.duration_minutes),
    durationMins: Number(row.duration_minutes),
    isActive: typeof row.is_active === "boolean" ? row.is_active : true,
    createdAt: parseDate(row.created_at, "created_at", "mapService"),
    updatedAt: parseDate(row.updated_at, "updated_at", "mapService")
  };
}

export function mapProduct(row: unknown): Product {
    assertRowObject(row, "mapProduct");
    if (typeof row.id !== "string" || typeof row.name !== "string" || row.price === undefined || row.cost === undefined) {
        throw createMappingError("mapProduct", "Missing or invalid required fields (id, name, price, cost)");
    }
    return {
        id: row.id,
        name: row.name,
        barcode: typeof row.barcode === "string" ? row.barcode : undefined,
        stockQuantity: Number(row.stock_quantity) || 0,
        price: Number(row.price),
        cost: Number(row.cost),
        createdAt: parseDate(row.created_at, "created_at", "mapProduct"),
        updatedAt: parseDate(row.updated_at, "updated_at", "mapProduct")
    };
}

export function mapAppointment(row: unknown): Appointment {
    assertRowObject(row, "mapAppointment");
    if (typeof row.id !== "string" || typeof row.customer_id !== "string" || typeof row.date_time !== "string") {
        throw createMappingError("mapAppointment", "Missing required fields (id, customer_id, date_time)");
    }
    
    // Map status string to enum, fail closed if invalid unless we define a reasonable fallback
    const rawStatus = typeof row.status === "string" ? row.status.toUpperCase() : "";
    if (!Object.values(AppointmentStatus).includes(rawStatus as AppointmentStatus)) {
        throw createMappingError("mapAppointment", `Invalid or missing appointment status (${rawStatus})`);
    }
    const status = rawStatus as AppointmentStatus;

    return {
        id: row.id,
        customerId: row.customer_id,
        employeeId: typeof row.employee_id === "string" ? row.employee_id : undefined,
        serviceId: typeof row.service_id === "string" ? row.service_id : undefined,
        dateTime: parseDate(row.date_time, "date_time", "mapAppointment"),
        status: status,
        notes: typeof row.notes === "string" ? row.notes : undefined,
        depositAmount: Number(row.deposit_amount) || 0,
        noShowFeeAmount: Number(row.no_show_fee_amount) || 0,
        noShowFeeCharged: Number(row.no_show_fee_charged) || 0,
        noShowMarkedAt: parseOptionalDate(row.no_show_marked_at, "no_show_marked_at", "mapAppointment"),
        noShowNote: typeof row.no_show_note === "string" ? row.no_show_note : undefined,
        createdAt: parseDate(row.created_at, "created_at", "mapAppointment"),
        updatedAt: parseDate(row.updated_at, "updated_at", "mapAppointment")
    };
}

export function mapExpense(row: unknown): Expense {
    assertRowObject(row, "mapExpense");
    if (typeof row.id !== "string" || row.amount === undefined || typeof row.category !== "string") {
        throw createMappingError("mapExpense", "Missing or invalid required fields (id, amount, category)");
    }
    return {
        id: row.id,
        amount: Number(row.amount),
        category: row.category,
        description: typeof row.description === "string" ? row.description : undefined,
        date: parseDate(row.date || row.created_at, "date or created_at", "mapExpense"),
        createdAt: parseDate(row.created_at, "created_at", "mapExpense")
    };
}

export function mapCenterSettings(row: unknown): CenterSettings {
    assertRowObject(row, "mapCenterSettings");
    if (typeof row.center_id !== "string" || typeof row.name !== "string") {
        throw createMappingError("mapCenterSettings", "Missing or invalid required fields (center_id, name)");
    }
    return {
        id: row.center_id,
        name: row.name,
        currency: typeof row.currency === "string" ? row.currency : "OMR",
        taxRate: Number(row.tax_rate) || 0,
        logoPath: typeof row.logo_path === "string" ? row.logo_path : undefined,
        address: typeof row.address === "string" ? row.address : undefined,
        phone: typeof row.phone === "string" ? row.phone : undefined,
        cr: typeof row.cr === "string" ? row.cr : undefined,
        postalCode: typeof row.postal_code === "string" ? row.postal_code : undefined
    };
}

export function mapInvoiceItem(row: unknown): InvoiceItem {
  assertRowObject(row, "mapInvoiceItem");
  if (typeof row.id !== "string" || typeof row.invoice_id !== "string" || row.price === undefined || row.quantity === undefined) {
      throw createMappingError("mapInvoiceItem", "Missing or invalid required fields (id, invoice_id, price, quantity)");
  }
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    serviceId: typeof row.service_id === "string" ? row.service_id : undefined,
    productId: typeof row.product_id === "string" ? row.product_id : undefined,
    price: Number(row.price),
    quantity: Number(row.quantity),
    createdAt: parseDate(row.created_at, "created_at", "mapInvoiceItem")
  };
}

export function mapInvoice(row: unknown): Invoice {
  assertRowObject(row, "mapInvoice");
  if (typeof row.id !== "string" || typeof row.customer_id !== "string" || row.total_amount === undefined || typeof row.payment_method !== "string") {
      throw createMappingError("mapInvoice", "Missing or invalid required fields (id, customer_id, total_amount, payment_method)");
  }
  return {
    id: row.id,
    serialNumber: typeof row.serial_number === "string" ? row.serial_number : undefined,
    date: parseDate(row.date || row.created_at, "date or created_at", "mapInvoice"),
    totalAmount: Number(row.total_amount),
    discount: Number(row.discount || 0),
    tax: row.tax !== undefined && row.tax !== null ? Number(row.tax) : undefined,
    loyaltyPointsUsed: Number(row.loyalty_points_used || 0),
    paymentMethod: row.payment_method,
    customerId: row.customer_id,
    createdAt: parseDate(row.created_at, "created_at", "mapInvoice"),
    updatedAt: parseDate(row.updated_at, "updated_at", "mapInvoice")
  };
}

export function mapAuthSession(session: SupabaseSession | null): SessionState {
    if (!session || !session.user) {
        return { status: "anonymous" };
    }
    
    // Explicitly validate required fields
    if (typeof session.user.id !== "string") {
        return { status: "error", error: createMappingError("mapAuthSession", "Missing or invalid required fields (id)") };
    }
    
    const email = session.user.email || "";
    // Note: We avoid trusting user_metadata for critical authorization unless specifically validated.
    // For now, mapping everyone to a default role of STAFF or MANAGER depends on domain logic,
    // but the safest approach with current contracts is mapping whatever we can derive.
    // Assuming simple fallback for now.
    
    const roleStr = session.user.user_metadata?.role;
    let role: UserRole;
    
    if (roleStr && Object.values(UserRole).includes(roleStr as UserRole)) {
        role = roleStr as UserRole;
    } else {
        // We do not silently escalate or default to STAFF. If they don't have a configured mapped role, they are unauthorized to proceed.
        return { 
            status: "error", 
            error: new Error("MISSING_OR_INVALID_ROLE") 
        };
    }
    
    return {
        status: "authenticated",
        session: {
            user: {
                id: session.user.id,
                username: email,
                role: role,
                name: typeof session.user.user_metadata?.name === "string" ? session.user.user_metadata.name : undefined
            }
        }
    };
}


export function mapGiftCard(row: unknown): GiftCard {
  assertRowObject(row, "mapGiftCard");
  if (typeof row.id !== "string" || typeof row.center_id !== "string" || typeof row.code !== "string") {
    throw createMappingError("mapGiftCard", "Missing or invalid required fields (id, center_id, code)");
  }
  return {
    id: row.id,
    centerId: row.center_id,
    code: row.code,
    initialBalance: Number(row.initial_balance) || 0,
    currentBalance: Number(row.current_balance) || 0,
    customerId: typeof row.customer_id === "string" ? row.customer_id : undefined,
    note: typeof row.note === "string" ? row.note : undefined,
    expiresAt: parseOptionalDate(row.expires_at, "expires_at", "mapGiftCard"),
    isActive: typeof row.is_active === "boolean" ? row.is_active : true,
    createdAt: parseDate(row.created_at, "created_at", "mapGiftCard"),
    updatedAt: parseDate(row.updated_at, "updated_at", "mapGiftCard")
  };
}

export function mapGiftCardTransaction(row: unknown): GiftCardTransaction {
  assertRowObject(row, "mapGiftCardTransaction");
  if (typeof row.id !== "string" || typeof row.gift_card_id !== "string" || typeof row.center_id !== "string" || typeof row.kind !== "string") {
    throw createMappingError("mapGiftCardTransaction", "Missing or invalid required fields (id, gift_card_id, center_id, kind)");
  }
  if (!["ISSUED", "REDEEMED", "ADJUSTED"].includes(row.kind)) {
    throw createMappingError("mapGiftCardTransaction", `Invalid gift card transaction kind (${row.kind})`);
  }
  return {
    id: row.id,
    giftCardId: row.gift_card_id,
    centerId: row.center_id,
    kind: row.kind as "ISSUED" | "REDEEMED" | "ADJUSTED",
    amount: Number(row.amount) || 0,
    invoiceId: typeof row.invoice_id === "string" ? row.invoice_id : undefined,
    note: typeof row.note === "string" ? row.note : undefined,
    createdAt: parseDate(row.created_at, "created_at", "mapGiftCardTransaction")
  };
}

export function mapNotificationSettings(row: unknown): NotificationSettingsEntity {
  assertRowObject(row, "mapNotificationSettings");
  if (typeof row.id !== "string" || typeof row.center_id !== "string") {
    throw createMappingError("mapNotificationSettings", "Missing or invalid required fields (id, center_id)");
  }
  return {
    id: row.id,
    centerId: row.center_id,
    whatsappEnabled: Boolean(row.whatsapp_enabled),
    smsEnabled: Boolean(row.sms_enabled),
    reminderEnabled: row.reminder_enabled !== false,
    reminderHoursBefore: Number(row.reminder_hours_before) || 24,
    whatsappSenderName: typeof row.whatsapp_sender_name === "string" ? row.whatsapp_sender_name : undefined,
    smsSenderName: typeof row.sms_sender_name === "string" ? row.sms_sender_name : undefined,
    whatsappTemplateBooking: typeof row.whatsapp_template_booking === "string" ? row.whatsapp_template_booking : undefined,
    whatsappTemplateReminder: typeof row.whatsapp_template_reminder === "string" ? row.whatsapp_template_reminder : undefined,
    smsTemplateReminder: typeof row.sms_template_reminder === "string" ? row.sms_template_reminder : undefined,
    createdAt: parseDate(row.created_at, "created_at", "mapNotificationSettings"),
    updatedAt: parseDate(row.updated_at, "updated_at", "mapNotificationSettings")
  };
}

export function mapPaymentGatewaySettings(row: unknown): PaymentGatewaySettings {
  assertRowObject(row, "mapPaymentGatewaySettings");
  if (typeof row.id !== "string" || typeof row.center_id !== "string" || typeof row.provider !== "string") {
    throw createMappingError("mapPaymentGatewaySettings", "Missing or invalid required fields (id, center_id, provider)");
  }
  const provider = ["manual", "thawani", "paytabs", "stripe"].includes(row.provider) ? row.provider as "manual" | "thawani" | "paytabs" | "stripe" : "manual";
  const depositType = ["fixed", "percentage"].includes(String(row.booking_deposit_type)) ? row.booking_deposit_type as "fixed" | "percentage" : "fixed";
  return {
    id: row.id,
    centerId: row.center_id,
    provider,
    isEnabled: Boolean(row.is_enabled),
    isSandbox: row.is_sandbox !== false,
    publicKey: typeof row.public_key === "string" ? row.public_key : undefined,
    merchantIdentifier: typeof row.merchant_identifier === "string" ? row.merchant_identifier : undefined,
    webhookSecretHint: typeof row.webhook_secret_hint === "string" ? row.webhook_secret_hint : undefined,
    bookingDepositEnabled: Boolean(row.booking_deposit_enabled),
    bookingDepositType: depositType,
    bookingDepositValue: Number(row.booking_deposit_value) || 0,
    successUrl: typeof row.success_url === "string" ? row.success_url : undefined,
    cancelUrl: typeof row.cancel_url === "string" ? row.cancel_url : undefined,
    createdAt: parseDate(row.created_at, "created_at", "mapPaymentGatewaySettings"),
    updatedAt: parseDate(row.updated_at, "updated_at", "mapPaymentGatewaySettings")
  };
}

export function mapServicePackage(row: unknown): ServicePackage {
  assertRowObject(row, "mapServicePackage");
  if (typeof row.id !== "string" || typeof row.center_id !== "string" || typeof row.name !== "string") {
    throw createMappingError("mapServicePackage", "Missing or invalid required fields (id, center_id, name)");
  }
  const items = Array.isArray((row as any).service_package_items)
    ? (row as any).service_package_items.map((item: any): ServicePackageItem => ({
        id: String(item.id),
        packageId: String(item.package_id ?? row.id),
        serviceId: String(item.service_id),
        quantity: Number(item.quantity) || 1,
        createdAt: parseDate(item.created_at, "created_at", "mapServicePackage.items")
      }))
    : undefined;
  return {
    id: row.id,
    centerId: row.center_id,
    name: row.name,
    description: typeof row.description === "string" ? row.description : undefined,
    packagePrice: Number(row.package_price) || 0,
    isActive: typeof row.is_active === "boolean" ? row.is_active : true,
    items,
    createdAt: parseDate(row.created_at, "created_at", "mapServicePackage"),
    updatedAt: parseDate(row.updated_at, "updated_at", "mapServicePackage")
  };
}


export function mapCustomerReview(row: unknown): CustomerReview {
  assertRowObject(row, "mapCustomerReview");
  if (typeof row.id !== "string" || typeof row.center_id !== "string" || typeof row.customer_id !== "string") {
    throw createMappingError("mapCustomerReview", "Missing or invalid required fields (id, center_id, customer_id)");
  }
  return {
    id: row.id,
    centerId: row.center_id,
    customerId: row.customer_id,
    appointmentId: typeof row.appointment_id === "string" ? row.appointment_id : undefined,
    rating: Number(row.rating) || 0,
    comment: typeof row.comment === "string" ? row.comment : undefined,
    isPublished: Boolean(row.is_published),
    createdAt: parseDate(row.created_at, "created_at", "mapCustomerReview"),
    updatedAt: parseDate(row.updated_at, "updated_at", "mapCustomerReview"),
  };
}

export function mapServiceFileImage(row: unknown): ServiceFileImage {
  assertRowObject(row, "mapServiceFileImage");
  if (typeof row.id !== "string" || typeof row.center_id !== "string" || typeof row.service_file_id !== "string" || typeof row.image_url !== "string") {
    throw createMappingError("mapServiceFileImage", "Missing or invalid required fields");
  }
  return {
    id: row.id,
    centerId: row.center_id,
    serviceFileId: row.service_file_id,
    imageKind: (typeof row.image_kind === "string" ? row.image_kind : "REFERENCE") as any,
    imageUrl: row.image_url,
    sortOrder: Number(row.sort_order) || 0,
    createdAt: parseDate(row.created_at, "created_at", "mapServiceFileImage"),
  };
}

export function mapServiceFile(row: unknown): ServiceFile {
  assertRowObject(row, "mapServiceFile");
  if (typeof row.id !== "string" || typeof row.center_id !== "string" || typeof row.customer_id !== "string" || typeof row.title !== "string") {
    throw createMappingError("mapServiceFile", "Missing or invalid required fields");
  }
  return {
    id: row.id,
    centerId: row.center_id,
    customerId: row.customer_id,
    appointmentId: typeof row.appointment_id === "string" ? row.appointment_id : undefined,
    serviceId: typeof row.service_id === "string" ? row.service_id : undefined,
    title: row.title,
    note: typeof row.note === "string" ? row.note : undefined,
    createdAt: parseDate(row.created_at, "created_at", "mapServiceFile"),
    updatedAt: parseDate(row.updated_at, "updated_at", "mapServiceFile"),
    images: Array.isArray(row.images) ? row.images.map(mapServiceFileImage) : undefined,
  };
}

export function mapCustomerNotificationEvent(row: unknown): CustomerNotificationEvent {
  assertRowObject(row, "mapCustomerNotificationEvent");
  if (typeof row.id !== "string" || typeof row.center_id !== "string" || typeof row.customer_id !== "string" || typeof row.message_preview !== "string") {
    throw createMappingError("mapCustomerNotificationEvent", "Missing or invalid required fields");
  }
  return {
    id: row.id,
    centerId: row.center_id,
    customerId: row.customer_id,
    appointmentId: typeof row.appointment_id === "string" ? row.appointment_id : undefined,
    channel: (typeof row.channel === "string" ? row.channel : "SYSTEM") as any,
    direction: (typeof row.direction === "string" ? row.direction : "OUTBOUND") as any,
    templateKey: typeof row.template_key === "string" ? row.template_key : undefined,
    messagePreview: row.message_preview,
    deliveryStatus: (typeof row.delivery_status === "string" ? row.delivery_status : "QUEUED") as any,
    sentAt: parseOptionalDate(row.sent_at, "sent_at", "mapCustomerNotificationEvent"),
    createdAt: parseDate(row.created_at, "created_at", "mapCustomerNotificationEvent"),
  };
}

export function mapAccountingJournalEntry(row: unknown): AccountingJournalEntry {
  assertRowObject(row, "mapAccountingJournalEntry");
  if (typeof row.id !== "string" || typeof row.center_id !== "string" || typeof row.description !== "string") {
    throw createMappingError("mapAccountingJournalEntry", "Missing or invalid required fields");
  }
  return {
    id: row.id,
    centerId: row.center_id,
    entryDate: parseDate(row.entry_date, "entry_date", "mapAccountingJournalEntry"),
    entryType: (typeof row.entry_type === "string" ? row.entry_type : "ADJUSTMENT") as any,
    referenceType: typeof row.reference_type === "string" ? row.reference_type : undefined,
    referenceId: typeof row.reference_id === "string" ? row.reference_id : undefined,
    description: row.description,
    debitAccount: typeof row.debit_account === "string" ? row.debit_account : "",
    creditAccount: typeof row.credit_account === "string" ? row.credit_account : "",
    amount: Number(row.amount) || 0,
    currency: typeof row.currency === "string" ? row.currency : "OMR",
    createdAt: parseDate(row.created_at, "created_at", "mapAccountingJournalEntry"),
    updatedAt: parseDate(row.updated_at, "updated_at", "mapAccountingJournalEntry"),
  };
}

export function mapAiBookingLead(row: unknown): AiBookingLead {
  assertRowObject(row, "mapAiBookingLead");
  if (typeof row.id !== "string" || typeof row.center_id !== "string" || typeof row.customer_name !== "string") {
    throw createMappingError("mapAiBookingLead", "Missing or invalid required fields");
  }
  return {
    id: row.id,
    centerId: row.center_id,
    customerName: row.customer_name,
    customerPhone: typeof row.customer_phone === "string" ? row.customer_phone : undefined,
    preferredServiceId: typeof row.preferred_service_id === "string" ? row.preferred_service_id : undefined,
    preferredDate: parseOptionalDate(row.preferred_date, "preferred_date", "mapAiBookingLead"),
    sourceChannel: (typeof row.source_channel === "string" ? row.source_channel : "WEB") as any,
    status: (typeof row.status === "string" ? row.status : "NEW") as any,
    summary: typeof row.summary === "string" ? row.summary : undefined,
    createdAt: parseDate(row.created_at, "created_at", "mapAiBookingLead"),
    updatedAt: parseDate(row.updated_at, "updated_at", "mapAiBookingLead"),
  };
}
