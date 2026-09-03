import { Appointment, VisitStage } from "../../entities";
import { DomainError, Result } from "./shared";

export interface AppointmentRepository {
  list(range: { fromISO: string; toISO: string }): Promise<Result<Appointment[], DomainError>>;
  getById(id: string): Promise<Result<Appointment, DomainError>>;
  create(data: Partial<Appointment>): Promise<Result<Appointment, DomainError>>;
  update(id: string, data: Partial<Appointment>): Promise<Result<Appointment, DomainError>>;
  markNoShow(id: string, input?: { chargeNoShowFee?: boolean; note?: string }): Promise<Result<{ appointment: Appointment; chargedAmount: number }, DomainError>>;
  transitionVisit(id: string, stage: VisitStage): Promise<Result<Appointment, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
}
