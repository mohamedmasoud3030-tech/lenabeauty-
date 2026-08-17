/**
 * WhatsApp Service
 * ------------------------------------------------------------
 * SINGLE-SALON APPROACH (chosen here): wa.me deep links.
 *   - Free, needs NO API key, NO Meta app, NO server.
 *   - We open https://wa.me/<phone>?text=<message> in a new tab; the user's
 *     real WhatsApp (web/app) pre-fills the message and they tap send.
 *   - Perfect for a 1-3 person salon doing manual / semi-automated reminders
 *     and loyalty messages directly from the dashboard.
 *
 * ALTERNATIVE — Official WhatsApp Business Cloud API:
 *   - Enables fully automated, templated messages (no manual tap), delivery
 *     receipts, and bulk campaigns.
 *   - Requires a Meta Business account, a verified phone number + Phone Number
 *     ID, an approved message template, and a server-side secret. It is also
 *     subject to Meta's pricing and template policies.
 *   - That path is overkill (and costly/complex) for a single salon, so it is
 *     intentionally NOT wired here. To adopt it later, replace `sendMessage`
 *     with a server call to the Graph API using WHATSAPP_PHONE_NUMBER_ID /
 *     WHATSAPP_BUSINESS_ACCOUNT_ID / WHATSAPP_API_KEY (left as env placeholders).
 *
 * TRADEOFF SUMMARY: wa.me = zero cost, manual send, no PII leaves the device
 * beyond the message the user chooses to send. Business API = automated but
 * paid, regulated, and requires backend secrets. We ship wa.me.
 */

import { logger } from "../../shared/logger";

export interface WhatsAppMessage {
  to: string; // Phone number with country country code (e.g., +968XXXXXXXX)
  type: 'text' | 'template' | 'media';
  content: string;
  templateName?: string;
  parameters?: Record<string, string>;
  mediaUrl?: string;
}

export interface WhatsAppTemplate {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: 'ar' | 'en';
  content: string;
  variables: string[];
}

export interface WhatsAppNotificationLog {
  id: string;
  customerId: string;
  phone: string;
  type: 'loyalty_points' | 'tier_upgrade' | 'reward_expiring' | 'appointment_reminder' | 'special_offer';
  message: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  sentAt?: Date;
  deliveredAt?: Date;
  errorMessage?: string;
}

/**
 * Normalize a phone number to wa.me format: digits only, no leading '+',
 * with a leading '00' country prefix stripped.
 */
export function normalizePhone(phone: string): string {
  let p = (phone || "").replace(/[^0-9]/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  return p;
}

/** Build a wa.me deep link that pre-fills the given message. */
export function buildWhatsAppLink(phone: string, message?: string): string {
  const num = normalizePhone(phone);
  const base = `https://wa.me/${num}`;
  const trimmed = message?.trim();
  return trimmed ? `${base}?text=${encodeURIComponent(trimmed)}` : base;
}

/** Open a wa.me link in a new tab (no-op outside the browser). */
export function openWhatsApp(phone: string, message?: string): void {
  if (typeof window === "undefined") return;
  window.open(buildWhatsAppLink(phone, message), "_blank", "noopener,noreferrer");
}

class WhatsAppService {
  private apiKey: string;
  private businessAccountId: string;
  private phoneNumberId: string;
  private sentLogs: WhatsAppNotificationLog[] = [];
  private baseUrl = 'https://graph.facebook.com/v18.0';

  constructor() {
    this.apiKey = process.env.WHATSAPP_API_KEY || '';
    this.businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  }

  /**
   * Send a loyalty points notification
   */
  async sendLoyaltyPointsNotification(
    customerId: string,
    phone: string,
    pointsEarned: number,
    totalPoints: number,
    tier: string
  ): Promise<WhatsAppNotificationLog> {
    const arabicMessage = `مبروك! 🎉 لقد حصلت على ${pointsEarned} نقطة من زيارتك.
رصيدك الحالي: ${totalPoints} نقطة
المستوى: ${this.getTierNameArabic(tier)}

استخدم نقاطك للحصول على مكافآت حصرية!`;

    return this.sendMessage(customerId, phone, 'loyalty_points', arabicMessage);
  }

  /**
   * Send a tier upgrade notification
   */
  async sendTierUpgradeNotification(
    customerId: string,
    phone: string,
    newTier: string,
    discount: number
  ): Promise<WhatsAppNotificationLog> {
    const arabicMessage = `تهانينا! 🌟 لقد ارتقيت إلى مستوى ${this.getTierNameArabic(newTier)}!
الآن تحصل على ${discount}% خصم على جميع الخدمات.

استمتع بمميزات جديدة حصرية لك!`;

    return this.sendMessage(customerId, phone, 'tier_upgrade', arabicMessage);
  }

  /**
   * Send appointment reminder
   */
  async sendAppointmentReminder(
    customerId: string,
    phone: string,
    appointmentDate: Date,
    serviceName: string,
    staffName: string
  ): Promise<WhatsAppNotificationLog> {
    const dateStr = this.formatDateArabic(appointmentDate);
    const timeStr = this.formatTimeArabic(appointmentDate);

    const arabicMessage = `تذكير موعدك ⏰
الخدمة: ${serviceName}
التاريخ: ${dateStr}
الوقت: ${timeStr}
الأخصائي: ${staffName}

تأكد من حضورك في الموعد المحدد`;

    return this.sendMessage(customerId, phone, 'appointment_reminder', arabicMessage);
  }

  /**
   * Send reward expiring notification
   */
  async sendRewardExpiringNotification(
    customerId: string,
    phone: string,
    rewardName: string,
    daysLeft: number
  ): Promise<WhatsAppNotificationLog> {
    const arabicMessage = `تنبيه مهم! ⏰
جائزتك "${rewardName}" ستنتهي خلال ${daysLeft} أيام فقط.

استخدمها الآن قبل انتهاء صلاحيتها!`;

    return this.sendMessage(customerId, phone, 'reward_expiring', arabicMessage);
  }

  /**
   * Send special offer
   */
  async sendSpecialOffer(
    customerId: string,
    phone: string,
    offerTitle: string,
    discount: number,
    validUntil: Date
  ): Promise<WhatsAppNotificationLog> {
    const dateStr = this.formatDateArabic(validUntil);

    const arabicMessage = `عرض خاص لك! 🎁
${offerTitle}
خصم ${discount}%
صالح حتى: ${dateStr}

استفد من العرض الآن!`;

    return this.sendMessage(customerId, phone, 'special_offer', arabicMessage);
  }

  /**
   * Send a generic message
   */
  private async sendMessage(
    customerId: string,
    phone: string,
    type: WhatsAppNotificationLog['type'],
    message: string
  ): Promise<WhatsAppNotificationLog> {
    const log: WhatsAppNotificationLog = {
      id: `whatsapp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customerId,
      phone,
      type,
      message,
      status: 'pending',
      sentAt: new Date(),
    };

    try {
      // Single-salon path: open a wa.me deep link so the user can send the
      // pre-filled message from their real WhatsApp. No API key required.
      const link = buildWhatsAppLink(phone, message);
      openWhatsApp(phone, message);
      // Opening a pre-filled link is not evidence that the user pressed Send,
      // and it is never a delivery receipt. Keep the event pending/unverified.
      log.status = 'pending';
      log.errorMessage = link; // generated manual link; no delivery claim
    } catch (error) {
      log.status = 'failed';
      log.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }

    // Local audit trail of messages this session (not a server-persisted log).
    await this.logNotification(log);

    return log;
  }

  /**
   * Log notification to database
   */
  private async logNotification(log: WhatsAppNotificationLog): Promise<void> {
    logger.log('[WhatsApp Log]', { id: log.id, type: log.type, status: log.status });
    this.sentLogs.unshift(log);
    this.sentLogs = this.sentLogs.slice(0, 200);
  }

  /**
   * Get tier name in Arabic
   */
  private getTierNameArabic(tier: string): string {
    const tierMap: Record<string, string> = {
      bronze: 'برونزي',
      silver: 'فضي',
      gold: 'ذهبي',
      platinum: 'بلاتيني',
    };
    return tierMap[tier.toLowerCase()] || tier;
  }

  /**
   * Format date in Arabic
   */
  private formatDateArabic(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return date.toLocaleDateString('ar-OM', options);
  }

  /**
   * Format time in Arabic
   */
  private formatTimeArabic(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };
    return date.toLocaleTimeString('ar-OM', options);
  }

  /**
   * Get notification history for a customer
   */
  async getNotificationHistory(customerId: string): Promise<WhatsAppNotificationLog[]> {
    logger.log(`Fetching notification history for customer: ${customerId}`);
    return this.sentLogs.filter((log) => log.customerId === customerId);
  }

  /**
   * Opt-in/Opt-out customer from notifications
   */
  async updateNotificationPreference(
    customerId: string,
    phone: string,
    optIn: boolean
  ): Promise<void> {
    logger.log(
      `Customer ${customerId} ${optIn ? 'opted in' : 'opted out'} from WhatsApp notifications`
    );
    // This would update the database
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(
    notifications: Array<{
      customerId: string;
      phone: string;
      message: string;
      type: WhatsAppNotificationLog['type'];
    }>
  ): Promise<WhatsAppNotificationLog[]> {
    const results: WhatsAppNotificationLog[] = [];

    for (const notification of notifications) {
      const result = await this.sendMessage(
        notification.customerId,
        notification.phone,
        notification.type,
        notification.message
      );
      results.push(result);

      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    successRate: number;
  }> {
    const totalSent = this.sentLogs.filter((log) => log.status === 'sent' || log.status === 'delivered').length;
    const totalDelivered = this.sentLogs.filter((log) => log.status === 'delivered').length;
    const totalFailed = this.sentLogs.filter((log) => log.status === 'failed').length;
    return {
      totalSent,
      totalDelivered,
      totalFailed,
      successRate: totalSent === 0 ? 0 : (totalDelivered / totalSent) * 100,
    };
  }

  /** Whether an automated provider with verifiable delivery is configured. */
  isConfigured(): boolean {
    return false;
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppService();

export default WhatsAppService;
