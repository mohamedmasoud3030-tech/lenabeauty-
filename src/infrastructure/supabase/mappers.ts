import { 
  Customer, Employee, Service, Appointment, Product, Expense, Invoice, InvoiceItem, CenterSettings,
  AppointmentStatus, GiftCard, GiftCardTransaction, ServicePackage, ServicePackageItem,
  CustomerEntitlement, EntitlementLedgerEntry, PackageEntitlementUnit,
  NotificationSettingsEntity, PaymentGatewaySettings, CustomerReview, ServiceFile, ServiceFileImage, CustomerNotificationEvent, AccountingJournalEntry, AiBookingLead,
  AttendanceRecord, AttendanceStatus, AttendanceMethod, EmployeeAdvance, AdvanceStatus, PayrollRun, PayrollLineItem
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
  const categoryRelation = Array.isArray(row.service_categories)
    ? row.service_categories[0]
    : row.service_categories;
  const categoryName = categoryRelation && typeof categoryRelation === "object" &&
    typeof (categoryRelation as Record<string, unknown>).name === "string"
      ? (categoryRelation as Record<string, unknown>).name as string
      : undefined;
  const pricingMode = row.pricing_mode === "STARTING_FROM" ? "STARTING_FROM" : "FIXED";
  return {
    id: row.id,
    name: row.name,
    categoryId: typeof row.category_id === "string" ? row.category_id : "",
    categoryName,
    price: Number(row.price),
    pricingMode,
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
        reorderLevel: row.reorder_level !== undefined && row.reorder_level !== null ? Number(row.reorder_level) : undefined,
        price: Number(row.price),
        cost: Number(row.cost),
        isActive: typeof row.is_active === "boolean" ? row.is_active : true,
        trackInventory: typeof row.track_inventory === "boolean" ? row.track_inventory : true,
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
    const customerRelation = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    const employeeRelation = Array.isArray(row.employees) ? row.employees[0] : row.employees;
    const serviceRelation = Array.isArray(row.services) ? row.services[0] : row.services;
    const customer = customerRelation && typeof customerRelation === "object"
      && typeof (customerRelation as Record<string, unknown>).id === "string"
      && typeof (customerRelation as Record<string, unknown>).name === "string"
      ? {
          id: (customerRelation as Record<string, unknown>).id as string,
          name: (customerRelation as Record<string, unknown>).name as string,
          phone: typeof (customerRelation as Record<string, unknown>).phone === "string"
            ? (customerRelation as Record<string, unknown>).phone as string
            : undefined,
        }
      : undefined;
    const employee = employeeRelation && typeof employeeRelation === "object"
      && typeof (employeeRelation as Record<string, unknown>).id === "string"
      && typeof (employeeRelation as Record<string, unknown>).name === "string"
      ? {
          id: (employeeRelation as Record<string, unknown>).id as string,
          name: (employeeRelation as Record<string, unknown>).name as string,
        }
      : undefined;
    const service = serviceRelation && typeof serviceRelation === "object"
      && typeof (serviceRelation as Record<string, unknown>).id === "string"
      && typeof (serviceRelation as Record<string, unknown>).name === "string"
      ? {
          id: (serviceRelation as Record<string, unknown>).id as string,
          name: (serviceRelation as Record<string, unknown>).name as string,
          categoryId: typeof (serviceRelation as Record<string, unknown>).category_id === "string"
            ? (serviceRelation as Record<string, unknown>).category_id as string
            : undefined,
          price: Number((serviceRelation as Record<string, unknown>).price ?? 0),
          durationMinutes: Number((serviceRelation as Record<string, unknown>).duration_minutes ?? 30),
          durationMins: Number((serviceRelation as Record<string, unknown>).duration_minutes ?? 30),
        }
      : undefined;

    return {
        id: row.id,
        customerId: row.customer_id,
        employeeId: typeof row.employee_id === "string" ? row.employee_id : undefined,
        serviceId: typeof row.service_id === "string" ? row.service_id : undefined,
        dateTime: parseDate(row.date_time, "date_time", "mapAppointment"),
        durationMinutesSnapshot: row.duration_minutes_snapshot !== undefined && row.duration_minutes_snapshot !== null
          ? Number(row.duration_minutes_snapshot)
          : undefined,
        status: status,
        customer,
        employee,
        service,
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
        postalCode: typeof row.postal_code === "string" ? row.postal_code : undefined,
        displayName: typeof row.display_name === "string" ? row.display_name : undefined,
        displayNameAr: typeof row.display_name_ar === "string" ? row.display_name_ar : undefined,
        brandEmail: typeof row.brand_email === "string" ? row.brand_email : undefined,
        brandTaxNumber: typeof row.brand_tax_number === "string" ? row.brand_tax_number : undefined,
        brandRegistrationNumber: typeof row.brand_registration_number === "string" ? row.brand_registration_number : undefined,
        brandPrimaryColor: typeof row.brand_primary_color === "string" ? row.brand_primary_color : undefined,
        brandSecondaryColor: typeof row.brand_secondary_color === "string" ? row.brand_secondary_color : undefined,
        brandAccentColor: typeof row.brand_accent_color === "string" ? row.brand_accent_color : undefined,
        brandFooterText: typeof row.brand_footer_text === "string" ? row.brand_footer_text : undefined,
        brandFooterTextAr: typeof row.brand_footer_text_ar === "string" ? row.brand_footer_text_ar : undefined,
        brandLogoBase64: typeof row.brand_logo_base64 === "string" ? row.brand_logo_base64 : undefined
    };
}

export function mapInvoiceItem(row: unknown): InvoiceItem {
  assertRowObject(row, "mapInvoiceItem");
  if (typeof row.id !== "string" || row.price === undefined || row.quantity === undefined) {
      throw createMappingError("mapInvoiceItem", "Missing or invalid required fields (id, price, quantity)");
  }
  return {
    id: row.id,
    invoiceId: typeof row.invoice_id === "string" ? row.invoice_id : "",
    serviceId: typeof row.service_id === "string" ? row.service_id : undefined,
    productId: typeof row.product_id === "string" ? row.product_id : undefined,
    packageId: typeof row.package_id === "string" ? row.package_id : undefined,
    giftCardId: typeof row.gift_card_id === "string" ? row.gift_card_id : undefined,
    price: Number(row.price),
    quantity: Number(row.quantity),
    createdAt: row.created_at ? parseDate(row.created_at, "created_at", "mapInvoiceItem") : new Date(0)
  };
}

export function mapInvoice(row: unknown): Invoice {
  assertRowObject(row, "mapInvoice");
  if (typeof row.id !== "string" || typeof row.customer_id !== "string" || row.total_amount === undefined || typeof row.payment_method !== "string") {
      throw createMappingError("mapInvoice", "Missing or invalid required fields (id, customer_id, total_amount, payment_method)");
  }
  const employeeRelation = Array.isArray(row.employees) ? row.employees[0] : row.employees;
  const staffName = employeeRelation && typeof employeeRelation === "object" &&
    typeof (employeeRelation as Record<string, unknown>).name === "string"
      ? (employeeRelation as Record<string, unknown>).name as string
      : undefined;
  // Additive financial columns are zero for pre-phase-3 rows. Detect that
  // shape so historical receipts preserve their original aggregate discount
  // and paid amount while all new invoices use the detailed breakdown.
  const isLegacyFinancialRow = Number(row.subtotal_amount ?? 0) === 0 && Number(row.total_amount) > 0;
  return {
    id: row.id,
    serialNumber: typeof row.serial_number === "string" ? row.serial_number : undefined,
    date: parseDate(row.date || row.created_at, "date or created_at", "mapInvoice"),
    subtotalAmount: Number(row.subtotal_amount ?? 0),
    totalAmount: Number(row.total_amount),
    discount: Number(row.discount || 0),
    manualDiscount: isLegacyFinancialRow ? Number(row.discount ?? 0) : Number(row.manual_discount ?? 0),
    tierDiscount: Number(row.tier_discount ?? 0),
    loyaltyDiscount: isLegacyFinancialRow ? Number(row.loyalty_points_used ?? 0) : Number(row.loyalty_discount ?? 0),
    giftCardDiscount: Number(row.gift_card_discount ?? 0),
    entitlementRedemption: Number(row.entitlement_redemption ?? 0),
    tax: row.tax !== undefined && row.tax !== null ? Number(row.tax) : undefined,
    taxRate: row.tax_rate !== undefined && row.tax_rate !== null ? Number(row.tax_rate) : undefined,
    amountPaid: isLegacyFinancialRow ? Number(row.total_amount) : Number(row.amount_paid ?? row.total_amount ?? 0),
    status: row.status === "VOID" ? "VOID" : "PAID",
    loyaltyPointsUsed: Number(row.loyalty_points_used || 0),
    paymentMethod: row.payment_method,
    customerId: row.customer_id,
    employeeId: typeof row.employee_id === "string" ? row.employee_id : undefined,
    staffName,
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
    // Roles are authorization data and therefore come only from server-owned
    // app_metadata. user_metadata is user-editable in Supabase and must never
    // grant application privileges.
    const roleStr = session.user.app_metadata?.role;
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

export function mapPackageEntitlementUnit(row: unknown): PackageEntitlementUnit {
  assertRowObject(row, "mapPackageEntitlementUnit");
  if (typeof row.id !== "string" || typeof row.center_id !== "string" ||
      typeof row.entitlement_id !== "string" || typeof row.service_id !== "string") {
    throw createMappingError("mapPackageEntitlementUnit", "Missing or invalid required fields");
  }
  return {
    id: row.id,
    centerId: row.center_id,
    entitlementId: row.entitlement_id,
    serviceId: row.service_id,
    totalUnits: Number(row.total_units) || 0,
    usedUnits: Number(row.used_units) || 0,
    serviceName: typeof (row.services as any)?.name === "string" ? (row.services as any).name : undefined,
    createdAt: parseDate(row.created_at, "created_at", "mapPackageEntitlementUnit")
  };
}

export function mapCustomerEntitlement(row: unknown): CustomerEntitlement {
  assertRowObject(row, "mapCustomerEntitlement");
  if (typeof row.id !== "string" || typeof row.center_id !== "string" ||
      typeof row.kind !== "string" || typeof row.original_value !== "number") {
    throw createMappingError("mapCustomerEntitlement", "Missing or invalid required fields (id, center_id, kind, original_value)");
  }
  if (row.kind !== "GIFT_CARD" && row.kind !== "PACKAGE") {
    throw createMappingError("mapCustomerEntitlement", `Invalid entitlement kind (${row.kind})`);
  }
  const status = typeof row.status === "string" ? row.status : "ACTIVE";
  if (!["ACTIVE", "PARTIALLY_REDEEMED", "FULLY_REDEEMED", "EXPIRED", "REFUNDED", "VOID"].includes(status)) {
    throw createMappingError("mapCustomerEntitlement", `Invalid entitlement status (${status})`);
  }
  return {
    id: row.id,
    centerId: row.center_id,
    customerId: typeof row.customer_id === "string" ? row.customer_id : undefined,
    kind: row.kind as "GIFT_CARD" | "PACKAGE",
    giftCardId: typeof row.gift_card_id === "string" ? row.gift_card_id : undefined,
    packageId: typeof row.package_id === "string" ? row.package_id : undefined,
    sourceInvoiceId: typeof row.source_invoice_id === "string" ? row.source_invoice_id : undefined,
    originalValue: Number(row.original_value) || 0,
    remainingValue: Number(row.remaining_value) || 0,
    status: status as CustomerEntitlement["status"],
    expiresAt: parseOptionalDate(row.expires_at, "expires_at", "mapCustomerEntitlement"),
    legacyFlag: Boolean(row.legacy_flag),
    createdAt: parseDate(row.created_at, "created_at", "mapCustomerEntitlement"),
    updatedAt: parseDate(row.updated_at, "updated_at", "mapCustomerEntitlement"),
    units: Array.isArray(row.package_entitlement_units)
      ? (row.package_entitlement_units as unknown[]).map(mapPackageEntitlementUnit)
      : undefined,
    sourceInvoiceSerial: typeof (row.source_invoice as any)?.serial_number === "string"
      ? (row.source_invoice as any).serial_number
      : undefined,
    instrumentName: typeof (row.service_packages as any)?.name === "string"
      ? (row.service_packages as any).name
      : typeof (row.gift_cards as any)?.code === "string"
        ? `Gift Card ${(row.gift_cards as any).code}`
        : undefined,
    giftCardCode: typeof (row.gift_cards as any)?.code === "string" ? (row.gift_cards as any).code : undefined,
    customerName: typeof (row.customers as any)?.name === "string" ? (row.customers as any).name : undefined,
  };
}

export function mapEntitlementLedgerEntry(row: unknown): EntitlementLedgerEntry {
  assertRowObject(row, "mapEntitlementLedgerEntry");
  if (typeof row.id !== "string" || typeof row.center_id !== "string" ||
      typeof row.entitlement_id !== "string" || typeof row.entry_type !== "string") {
    throw createMappingError("mapEntitlementLedgerEntry", "Missing or invalid required fields (id, center_id, entitlement_id, entry_type)");
  }
  const validTypes = ["ISSUE", "FUND", "REDEEM", "REFUND", "ADJUSTMENT", "EXPIRY", "VOID"];
  if (!validTypes.includes(row.entry_type)) {
    throw createMappingError("mapEntitlementLedgerEntry", `Invalid ledger entry type (${row.entry_type})`);
  }
  return {
    id: row.id,
    centerId: row.center_id,
    entitlementId: row.entitlement_id,
    entryType: row.entry_type as EntitlementLedgerEntry["entryType"],
    amount: Number(row.amount) || 0,
    units: typeof row.units === "number" ? row.units : undefined,
    serviceId: typeof row.service_id === "string" ? row.service_id : undefined,
    invoiceId: typeof row.invoice_id === "string" ? row.invoice_id : undefined,
    actorId: typeof row.actor_id === "string" ? row.actor_id : undefined,
    reason: typeof row.reason === "string" ? row.reason : undefined,
    legacyFlag: Boolean(row.legacy_flag),
    createdAt: parseDate(row.created_at, "created_at", "mapEntitlementLedgerEntry"),
    actorName: typeof (row.employees as any)?.name === "string" ? (row.employees as any).name : undefined,
    invoiceSerial: typeof (row.invoices as any)?.serial_number === "string" ? (row.invoices as any).serial_number : undefined,
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

// ===== Staff operations (Phase 1) =====

export function mapAttendanceRecord(row: unknown): AttendanceRecord {
  assertRowObject(row, "mapAttendanceRecord");
  if (typeof row.id !== "string" || typeof row.center_id !== "string" || typeof row.employee_id !== "string") {
    throw createMappingError("mapAttendanceRecord", "Missing or invalid required fields (id, center_id, employee_id)");
  }
  const rawStatus = typeof row.status === "string" ? row.status.toUpperCase() : "PRESENT";
  if (!["PRESENT", "LATE", "ABSENT", "HALF_DAY"].includes(rawStatus)) {
    throw createMappingError("mapAttendanceRecord", `Invalid attendance status (${rawStatus})`);
  }
  const rawMethod = typeof row.method === "string" ? row.method.toUpperCase() : "MANUAL";
  const method: AttendanceMethod = ["MANUAL", "BIOMETRIC", "MOBILE"].includes(rawMethod)
    ? (rawMethod as AttendanceMethod)
    : "MANUAL";
  return {
    id: row.id,
    centerId: row.center_id,
    employeeId: row.employee_id,
    employeeName: typeof row.employee_name === "string" ? row.employee_name : undefined,
    date: parseDate(row.date, "date", "mapAttendanceRecord"),
    checkInTime: typeof row.check_in_time === "string" ? row.check_in_time : undefined,
    checkOutTime: typeof row.check_out_time === "string" ? row.check_out_time : undefined,
    method,
    workHours: Number(row.work_hours) || 0,
    status: rawStatus as AttendanceStatus,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    createdAt: parseDate(row.created_at, "created_at", "mapAttendanceRecord"),
    updatedAt: parseDate(row.updated_at, "updated_at", "mapAttendanceRecord"),
  };
}

export function mapEmployeeAdvance(row: unknown): EmployeeAdvance {
  assertRowObject(row, "mapEmployeeAdvance");
  if (typeof row.id !== "string" || typeof row.center_id !== "string" || typeof row.employee_id !== "string") {
    throw createMappingError("mapEmployeeAdvance", "Missing or invalid required fields (id, center_id, employee_id)");
  }
  const rawStatus = typeof row.status === "string" ? row.status.toUpperCase() : "PENDING";
  if (!["PENDING", "APPROVED", "REJECTED", "DEDUCTED"].includes(rawStatus)) {
    throw createMappingError("mapEmployeeAdvance", `Invalid advance status (${rawStatus})`);
  }
  return {
    id: row.id,
    centerId: row.center_id,
    employeeId: row.employee_id,
    employeeName: typeof row.employee_name === "string" ? row.employee_name : undefined,
    amount: Number(row.amount) || 0,
    reason: typeof row.reason === "string" ? row.reason : "",
    advanceDate: parseDate(row.advance_date || row.created_at, "advance_date", "mapEmployeeAdvance"),
    status: rawStatus as AdvanceStatus,
    deductedInRunId: typeof row.deducted_in_run_id === "string" ? row.deducted_in_run_id : undefined,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    createdAt: parseDate(row.created_at, "created_at", "mapEmployeeAdvance"),
    updatedAt: parseDate(row.updated_at, "updated_at", "mapEmployeeAdvance"),
  };
}

export function mapPayrollRun(row: unknown): PayrollRun {
  assertRowObject(row, "mapPayrollRun");
  if (typeof row.id !== "string" || typeof row.center_id !== "string" || typeof row.period_month !== "string") {
    throw createMappingError("mapPayrollRun", "Missing or invalid required fields (id, center_id, period_month)");
  }
  return {
    id: row.id,
    centerId: row.center_id,
    periodMonth: row.period_month,
    runDate: parseDate(row.run_date || row.created_at, "run_date", "mapPayrollRun"),
    notes: typeof row.notes === "string" ? row.notes : undefined,
    createdAt: parseDate(row.created_at, "created_at", "mapPayrollRun"),
    updatedAt: parseDate(row.updated_at, "updated_at", "mapPayrollRun"),
  };
}

export function mapPayrollLineItem(row: unknown): PayrollLineItem {
  assertRowObject(row, "mapPayrollLineItem");
  if (typeof row.id !== "string" || typeof row.center_id !== "string" || typeof row.payroll_run_id !== "string" || typeof row.employee_id !== "string") {
    throw createMappingError("mapPayrollLineItem", "Missing or invalid required fields (id, center_id, payroll_run_id, employee_id)");
  }
  return {
    id: row.id,
    centerId: row.center_id,
    payrollRunId: row.payroll_run_id,
    employeeId: row.employee_id,
    employeeName: typeof row.employee_name === "string" ? row.employee_name : undefined,
    baseSalary: Number(row.base_salary) || 0,
    advancesDeducted: Number(row.advances_deducted) || 0,
    netSalary: Number(row.net_salary) || 0,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    createdAt: parseDate(row.created_at, "created_at", "mapPayrollLineItem"),
    updatedAt: parseDate(row.updated_at, "updated_at", "mapPayrollLineItem"),
  };
}
