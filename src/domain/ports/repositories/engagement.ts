import { AiBookingLead, CustomerReview, ServiceFile } from "../../entities";
import { CreateAiBookingLeadInput, CreateCustomerReviewInput, CreateServiceFileInput } from "../../../application/dto";
import { DomainError, Result } from "./shared";

export interface CustomerExperienceRepository {
  listReviews(): Promise<Result<CustomerReview[], DomainError>>;
  createReview(input: CreateCustomerReviewInput): Promise<Result<CustomerReview, DomainError>>;
  listServiceFiles(customerId?: string): Promise<Result<ServiceFile[], DomainError>>;
  createServiceFile(input: CreateServiceFileInput): Promise<Result<ServiceFile, DomainError>>;
  uploadServiceImage(file: File): Promise<Result<{ path: string; url: string }, DomainError>>;
}

export interface AdvancedRepository {
  listAiBookingLeads(): Promise<Result<AiBookingLead[], DomainError>>;
  createAiBookingLead(input: CreateAiBookingLeadInput): Promise<Result<AiBookingLead, DomainError>>;
  updateAiBookingLeadStatus(id: string, status: AiBookingLead["status"]): Promise<Result<AiBookingLead, DomainError>>;
}
