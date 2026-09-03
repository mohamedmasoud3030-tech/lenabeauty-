import { AiBookingLead, Appointment, CustomerReview, ServiceFile } from "../../entities";
import { ClientPortalProfile, ClientPortalSession, CreateAiBookingLeadInput, CreateCustomerReviewInput, CreateServiceFileInput } from "../../../application/dto";
import { DomainError, Result } from "./shared";

export interface PublicService { id: string; name: string; price: number; durationMinutes: number; }
export interface PublicStaff { id: string; name: string; }
export interface PublicCenterInfo { name: string; currency: string; phone?: string; address?: string; }
export interface BookingInput { serviceId: string; employeeId?: string; customerName: string; customerPhone: string; dateTimeISO: string; notes?: string; }

export interface CustomerExperienceRepository {
  listReviews(): Promise<Result<CustomerReview[], DomainError>>;
  createReview(input: CreateCustomerReviewInput): Promise<Result<CustomerReview, DomainError>>;
  listServiceFiles(customerId?: string): Promise<Result<ServiceFile[], DomainError>>;
  createServiceFile(input: CreateServiceFileInput): Promise<Result<ServiceFile, DomainError>>;
}

export interface AdvancedRepository {
  listAiBookingLeads(): Promise<Result<AiBookingLead[], DomainError>>;
  createAiBookingLead(input: CreateAiBookingLeadInput): Promise<Result<AiBookingLead, DomainError>>;
}

export interface BookingRepository {
  listServices(): Promise<Result<PublicService[], DomainError>>;
  listStaff(): Promise<Result<PublicStaff[], DomainError>>;
  getCenterInfo(): Promise<Result<PublicCenterInfo, DomainError>>;
  getTakenSlots(dayISO: string): Promise<Result<{ dateTimeISO: string; employeeId?: string }[], DomainError>>;
  createBooking(input: BookingInput): Promise<Result<{ appointmentId: string }, DomainError>>;
  cancelBooking(input: { appointmentId: string; phone: string; token: string; reason?: string }): Promise<Result<{ appointment: Appointment }, DomainError>>;
  rescheduleBooking(input: { appointmentId: string; phone: string; token: string; newDateTimeISO: string; newEmployeeId?: string; reason?: string }): Promise<Result<{ appointment: Appointment }, DomainError>>;
  clientPortalLogin(phone: string, token: string): Promise<Result<ClientPortalSession, DomainError>>;
  getClientPortalProfile(customerId: string, phone: string, token: string): Promise<Result<ClientPortalProfile, DomainError>>;
}
