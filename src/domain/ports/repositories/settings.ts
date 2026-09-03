import { CenterSettings, NotificationSettingsEntity, PaymentGatewaySettings } from "../../entities";
import { BackupPayload } from "../../../application/dto";
import { DomainError, Result } from "./shared";

export interface SettingsRepository {
  get(): Promise<Result<CenterSettings, DomainError>>;
  update(data: Partial<CenterSettings>): Promise<Result<CenterSettings, DomainError>>;
  uploadLogo(file: File): Promise<Result<{ logoPath: string }, DomainError>>;
  backup(): Promise<Result<{ message: string }, DomainError>>;
  exportData(): Promise<Result<any, DomainError>>;
  restore(data: BackupPayload): Promise<Result<void, DomainError>>;
  getNotificationSettings(): Promise<Result<NotificationSettingsEntity, DomainError>>;
  updateNotificationSettings(data: Partial<NotificationSettingsEntity>): Promise<Result<NotificationSettingsEntity, DomainError>>;
  getPaymentGatewaySettings(): Promise<Result<PaymentGatewaySettings, DomainError>>;
  updatePaymentGatewaySettings(data: Partial<PaymentGatewaySettings>): Promise<Result<PaymentGatewaySettings, DomainError>>;
}
