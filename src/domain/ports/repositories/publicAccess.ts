import { DomainError, Result } from "./shared";

/**
 * Public (anonymous) surface: online booking + client portal.
 *
 * These contracts are implemented against SECURITY DEFINER RPCs that the
 * canonical migrations grant to the `anon` role. They must NEVER take a
 * membership-scoped center id from the caller's session — the page supplies
 * the target center explicitly, and the server re-validates every reference
 * (active service, active staff, slot availability, portal credentials).
 */

export interface PublicCenterInfo {
  name: string;
  currency: string;
  phone: string | null;
  address: string | null;
}

export interface PublicServiceOption {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}

export interface PublicStaffOption {
  id: string;
  name: string;
}

export interface PublicTakenSlot {
  dateTime: Date;
  employeeId: string | null;
}

export interface PublicBookingRequest {
  centerId: string;
  serviceId: string;
  employeeId: string;
  customerName: string;
  customerPhone: string;
  dateTime: Date;
  notes?: string;
}

export interface PublicBookingConfirmation {
  appointmentId: string;
  customerId: string;
  status: string;
}

export interface PortalAppointmentView {
  id: string;
  dateTime: Date;
  status: string;
  notes: string | null;
  employeeName: string | null;
  serviceName: string | null;
}

export interface PortalInvoiceView {
  id: string;
  serialNumber: string | null;
  date: Date;
  totalAmount: number;
  tax: number;
  paymentMethod: string;
}

export interface PortalProfile {
  customerId: string;
  name: string;
  phone: string | null;
  loyaltyPoints: number;
  totalSpent: number;
  appointments: PortalAppointmentView[];
  invoices: PortalInvoiceView[];
}

export interface PortalCredentials {
  centerId: string;
  phone: string;
  token: string;
}

export interface PublicAccessRepository {
  /** Booking page data (anon-safe reads). */
  getCenterInfo(centerId: string): Promise<Result<PublicCenterInfo, DomainError>>;
  listServices(centerId: string): Promise<Result<PublicServiceOption[], DomainError>>;
  listStaff(centerId: string): Promise<Result<PublicStaffOption[], DomainError>>;
  listTakenSlots(centerId: string, day: Date): Promise<Result<PublicTakenSlot[], DomainError>>;

  /** Anonymous booking create. The server owns every validation. */
  createBooking(request: PublicBookingRequest): Promise<Result<PublicBookingConfirmation, DomainError>>;

  /** Client portal: phone + per-customer code issued by the salon. */
  portalLogin(credentials: PortalCredentials): Promise<Result<{ customerId: string; name: string }, DomainError>>;
  portalProfile(credentials: PortalCredentials): Promise<Result<PortalProfile, DomainError>>;

  /** Self-service actions on a SCHEDULED appointment (portal credentials). */
  cancelBooking(credentials: PortalCredentials, appointmentId: string, reason?: string): Promise<Result<void, DomainError>>;
  rescheduleBooking(credentials: PortalCredentials, appointmentId: string, newDateTime: Date, reason?: string): Promise<Result<void, DomainError>>;
}
