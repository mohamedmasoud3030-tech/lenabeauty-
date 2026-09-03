import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  History,
  Image as ImageIcon,
  Phone,
  Receipt,
  Save,
  Scissors,
  Sparkles,
  TrendingUp,
  User,
  Wallet,
  Clock,
} from "lucide-react";
import { Appointment, AppointmentStatus, Customer, CustomerEntitlement, Invoice, ServiceFile } from "../../domain/entities";
import { composeBeautyPassport } from "../../domain/passport";
import {
  getCustomerVisitPattern,
  getNextBestCustomerAction,
  getRetentionStatus,
  retentionVisitsFromHistory,
} from "../../domain/retention";
import { buildCustomerWallet } from "../../domain/wallet";
import { effectiveVisitStage } from "../../domain/visit";
import { getDisplayName, getInitials } from "../../shared/displayName";
import { formatSalonDate } from "../../shared/dateTime";
import { formatOMRAmount } from "../../shared/money";
import { Modal } from "../../shared/components/Modal";
import { ScreenState } from "../../shared/components/ScreenState";
import { getTierBySpend } from "../../domain/loyalty";
import { passportStageClass, passportStageLabel, retentionStatusClass } from "./helpers";

export interface InvoiceHistoryItem extends Invoice {
  items?: {
    id: string;
    service?: { name: string };
    product?: { name: string };
  }[];
}

export interface CustomerHistoryData {
  appointments: Appointment[];
  invoices: InvoiceHistoryItem[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  history: CustomerHistoryData | null;
  serviceFiles: ServiceFile[];
  entitlements: CustomerEntitlement[];
  notes: string;
  onNotesChange: (value: string) => void;
  savingNotes: boolean;
  onSaveNotes: () => void;
  showAllVisits: boolean;
  onToggleAllVisits: () => void;
  onReprint: (invoiceId: string) => void;
}

export function CustomerPassportModal({
  open,
  onClose,
  customer,
  history,
  serviceFiles,
  entitlements,
  notes,
  onNotesChange,
  savingNotes,
  onSaveNotes,
  showAllVisits,
  onToggleAllVisits,
  onReprint,
}: Props) {
  const { t, i18n } = useTranslation();

  const view = useMemo(() => {
    if (!history) return null;
    const now = Date.now();
    const upcoming = history.appointments
      .filter((a) => a.status === AppointmentStatus.SCHEDULED && new Date(a.dateTime).getTime() >= now)
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    const nextAppointment = upcoming[0];
    const passport = composeBeautyPassport({
      appointments: history.appointments,
      invoices: history.invoices,
      serviceFiles,
      nextAppointment,
      lifetimeSpend: customer?.totalSpent,
    });
    const retentionVisits = retentionVisitsFromHistory(history);
    const retentionAction = getNextBestCustomerAction(retentionVisits, new Date());
    const retentionStatus = getRetentionStatus(retentionVisits, new Date());
    const visitPattern = getCustomerVisitPattern(retentionVisits);
    const wallet = buildCustomerWallet({
      entitlements,
      loyaltyPoints: customer?.loyaltyPoints ?? 0,
      depositAmount: nextAppointment?.depositAmount ?? 0,
    });
    const walletBenefit = wallet.packages.length > 0 || wallet.giftCardBalance > 0
      ? {
          sessionCount: wallet.packages.reduce((sum, p) => sum + p.remainingUnits, 0),
          giftCardBalance: wallet.giftCardBalance,
        }
      : null;
    return {
      passport,
      nextAppointment,
      retentionAction,
      retentionStatus,
      visitPattern,
      wallet,
      walletBenefit,
      hasFutureBooking: !!nextAppointment,
    };
  }, [history, serviceFiles, entitlements, customer]);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <Sparkles className="h-5 w-5" />
          </span>
          <span>{t("passport.title")}</span>
        </span>
      }
      description={customer ? getDisplayName(customer, t("Unnamed")) : t("passport.subtitle")}
      disableClose={savingNotes}
      overlayClassName="print:hidden"
      className="sm:max-w-6xl sm:rounded-[3rem]"
    >
      <div className="sm:p-5">
        {!history || !view ? (
          <ScreenState state="loading" title={t("Fetching Data...")} compact />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-[1.5rem] border border-border bg-muted/30 p-4 sm:p-5">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0 uppercase">
                {getInitials(customer, "·")}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold truncate">{getDisplayName(customer, t("Unnamed"))}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {customer?.phone && (
                    <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /><span dir="ltr">{customer.phone}</span></span>
                  )}
                  <span>{t("Client ID")}: {customer?.id.slice(-6).toUpperCase()}</span>
                  {customer?.createdAt && (
                    <span>{t("passport.clientSince")} {formatSalonDate(customer.createdAt, i18n.language)}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {(() => {
                  const tier = getTierBySpend(customer?.totalSpent ?? 0);
                  return (
                    <span className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold border ${tier.bg} ${tier.color} ${tier.border}`}>
                      <span>{tier.icon}</span>
                      <span>{t(tier.labelKey)}</span>
                    </span>
                  );
                })()}
                <span className="inline-flex items-center gap-1 rounded-2xl px-4 py-2 text-xs font-bold border border-warning/20 bg-warning/10 text-warning">
                  <Sparkles className="h-3.5 w-3.5" /> {customer?.loyaltyPoints ?? 0} {t("pts")}
                </span>
                <span className="inline-flex items-center gap-1 rounded-2xl px-4 py-2 text-xs font-bold border border-success/20 bg-success/10 text-success">
                  <TrendingUp className="h-3.5 w-3.5" /> {formatOMRAmount(customer?.totalSpent ?? 0)} {t("OMR")}
                </span>
              </div>
            </div>

            <section className="space-y-2">
              <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> {t("passport.snapshot")}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-2">
                {[
                  { label: t("passport.lastVisit"), value: view.passport.summary.lastVisitISO ? formatSalonDate(view.passport.summary.lastVisitISO, i18n.language) : "—" },
                  { label: t("passport.nextAppointment"), value: view.passport.summary.nextAppointmentISO ? formatSalonDate(view.passport.summary.nextAppointmentISO, i18n.language) : "—" },
                  { label: t("passport.totalVisits"), value: String(view.passport.summary.totalVisits) },
                  { label: t("passport.lifetimeSpend"), value: `${formatOMRAmount(view.passport.summary.lifetimeSpend)} ${t("OMR")}` },
                  { label: t("passport.averageVisitValue"), value: view.passport.summary.averageVisitValue !== undefined ? formatOMRAmount(view.passport.summary.averageVisitValue) : "—" },
                  { label: t("passport.preferredEmployee"), value: view.passport.summary.preferredEmployeeName ?? "—" },
                  { label: t("passport.mostUsedService"), value: view.passport.summary.mostUsedServiceName ?? "—" },
                ].map((chip) => (
                  <div key={chip.label} className="rounded-xl border border-border bg-card p-3">
                    <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{chip.label}</div>
                    <div className="text-sm font-bold text-foreground truncate mt-0.5">{chip.value}</div>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <section className="rounded-[1.5rem] border border-border bg-card p-4">
                  <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" /> {t("passport.nextBooking")}
                  </h4>
                  {view.nextAppointment ? (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="font-bold text-foreground">{formatSalonDate(view.nextAppointment.dateTime, i18n.language)}</span>
                      {view.nextAppointment.service?.name && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground"><Scissors className="h-3.5 w-3.5" />{view.nextAppointment.service.name}</span>
                      )}
                      {view.nextAppointment.employee?.name && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground"><User className="h-3.5 w-3.5" />{view.nextAppointment.employee.name}</span>
                      )}
                      <span className={`rounded-lg px-2 py-1 text-[9px] font-bold border ${passportStageClass(effectiveVisitStage(view.nextAppointment))}`}>
                        {passportStageLabel(effectiveVisitStage(view.nextAppointment), t)}
                      </span>
                      {(view.nextAppointment.depositAmount ?? 0) > 0 && (
                        <span className="text-xs font-bold text-muted-foreground">{t("wallet.deposit")}: {formatOMRAmount(view.nextAppointment.depositAmount ?? 0)} {t("OMR")}</span>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm font-bold text-muted-foreground">{t("passport.noNextBooking")}</p>
                  )}
                </section>

                <section className="rounded-[1.5rem] border border-border bg-card p-4">
                  <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" /> {t("passport.retention")}
                  </h4>
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${retentionStatusClass(view.retentionStatus.status)}`}>
                        {t(`retention.status.${view.retentionStatus.status}`)}
                      </span>
                      {view.hasFutureBooking && (
                        <span className="rounded-lg border border-success/20 bg-success/10 px-2 py-1 text-[9px] font-bold text-success">
                          {t("retention.hasFutureBooking")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-foreground">{t(view.retentionAction.titleKey)}</p>
                    <p className="text-xs text-muted-foreground">{t(view.retentionAction.detailKey)}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-muted/30 p-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{t("retention.lastVisit")}</p>
                        <p className="text-xs font-bold text-foreground mt-0.5">{view.passport.summary.lastVisitISO ? formatSalonDate(view.passport.summary.lastVisitISO, i18n.language) : "—"}</p>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{t("retention.daysSince")}</p>
                        <p className="text-xs font-bold text-foreground mt-0.5">{view.retentionStatus.daysSinceLastVisit !== null ? view.retentionStatus.daysSinceLastVisit : "—"}</p>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{t("retention.normalInterval")}</p>
                        <p className="text-xs font-bold text-foreground mt-0.5">{view.visitPattern.averageDaysBetweenVisits !== null ? t("retention.daysValue", { count: view.visitPattern.averageDaysBetweenVisits }) : "—"}</p>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{t("retention.rebookingWindow")}</p>
                        <p className="text-xs font-bold text-foreground mt-0.5">{view.retentionStatus.rebookingWindow ? t("retention.daysRange", { min: view.retentionStatus.rebookingWindow.minDays, max: view.retentionStatus.rebookingWindow.maxDays }) : "—"}</p>
                      </div>
                    </div>
                    {view.walletBenefit && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-2">
                        <p className="text-[10px] font-bold text-primary">{t("retention.walletBenefit")}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {view.walletBenefit.sessionCount > 0 && t("retention.walletSessions", { count: view.walletBenefit.sessionCount })}
                          {view.walletBenefit.sessionCount > 0 && view.walletBenefit.giftCardBalance > 0 && " · "}
                          {view.walletBenefit.giftCardBalance > 0 && t("retention.walletGiftCard", { amount: formatOMRAmount(view.walletBenefit.giftCardBalance) })}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <section className="rounded-[1.5rem] border border-border bg-card p-4">
                <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" /> {t("passport.wallet")}
                </h4>
                <div className="mt-3 space-y-2">
                  {!view.wallet.hasValue ? (
                    <p className="text-xs font-bold text-muted-foreground">{t("passport.walletEmpty")}</p>
                  ) : (
                    <>
                      {view.wallet.giftCardBalance > 0 && (
                        <div className="flex items-center justify-between gap-2 text-xs font-bold"><span className="text-muted-foreground">{t("wallet.giftCard")}</span><span className="text-foreground">{formatOMRAmount(view.wallet.giftCardBalance)} {t("OMR")}</span></div>
                      )}
                      {view.wallet.rewardsPoints > 0 && (
                        <div className="flex items-center justify-between gap-2 text-xs font-bold"><span className="text-muted-foreground">{t("wallet.rewards")}</span><span className="text-foreground">{view.wallet.rewardsPoints} {t("pts")}</span></div>
                      )}
                      {view.wallet.depositAmount > 0 && (
                        <div className="flex items-center justify-between gap-2 text-xs font-bold"><span className="text-muted-foreground">{t("wallet.deposit")}</span><span className="text-foreground">{formatOMRAmount(view.wallet.depositAmount)} {t("OMR")}</span></div>
                      )}
                      {view.wallet.packages.map((p) => (
                        <div key={`${p.entitlementId}-${p.serviceId}`} className="flex items-center justify-between gap-2 text-xs font-bold">
                          <span className="text-muted-foreground truncate">{p.packageName}{p.serviceName ? ` · ${p.serviceName}` : ""}</span>
                          <span className="text-foreground shrink-0">{p.remainingUnits} {t("passport.sessionsLeft")}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </section>
            </div>

            <section className="space-y-2">
              <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <History className="h-3.5 w-3.5" /> {t("passport.timeline")}
              </h4>
              {view.passport.timeline.length === 0 ? (
                <p className="text-sm font-bold text-muted-foreground">{t("passport.noTimeline")}</p>
              ) : (
                <div className="space-y-2">
                  {(showAllVisits ? view.passport.timeline : view.passport.timeline.slice(0, 6)).map((visit) => (
                    <div key={visit.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0"><Receipt className="h-4 w-4 text-muted-foreground" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-foreground">{formatSalonDate(visit.dateTimeISO, i18n.language)}</span>
                          <span className={`rounded-lg px-2 py-0.5 text-[9px] font-bold border ${passportStageClass(visit.stage)}`}>{passportStageLabel(visit.stage, t)}</span>
                          {visit.amount !== undefined && <span className="text-xs font-bold text-success">{formatOMRAmount(visit.amount)} {t("OMR")}</span>}
                        </div>
                        {(visit.serviceName || visit.employeeName) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[10px] font-bold text-muted-foreground">
                            {visit.serviceName && <span className="inline-flex items-center gap-1"><Scissors className="h-3 w-3" />{visit.serviceName}</span>}
                            {visit.employeeName && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{visit.employeeName}</span>}
                          </div>
                        )}
                        {visit.images && visit.images.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{visit.images.map((img) => <img key={img} src={img} alt="" className="h-10 w-10 rounded-lg object-cover border border-border" />)}</div>}
                        {visit.notes && <p className="mt-1 text-[10px] text-muted-foreground">{visit.notes}</p>}
                      </div>
                      {visit.invoiceId && (
                        <button onClick={() => onReprint(visit.invoiceId!)} className="shrink-0 h-8 px-2.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary hover:text-primary-foreground transition-all">{t("Print")}</button>
                      )}
                    </div>
                  ))}
                  {view.passport.timeline.length > 6 && (
                    <button onClick={onToggleAllVisits} className="w-full h-10 rounded-xl border border-border bg-muted/30 text-xs font-bold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 touch-target">
                      {showAllVisits ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {showAllVisits ? t("passport.showLess") : t("passport.showAll")}
                    </button>
                  )}
                </div>
              )}
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-[1.5rem] border border-border bg-muted/30 p-4 space-y-3">
                <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"><FileText className="h-3.5 w-3.5" /> {t("passport.notes")}</h4>
                <textarea className="w-full h-40 rounded-xl border border-border bg-card p-4 text-sm font-medium text-foreground focus:ring-4 focus:ring-primary/10 outline-none resize-none transition-all" placeholder={t("Medical History / Preferences / Allergies")} value={notes} onChange={(e) => onNotesChange(e.target.value)} />
                <button onClick={onSaveNotes} disabled={savingNotes} className="w-full h-12 rounded-xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  <Save className="h-4 w-4" /><span>{savingNotes ? t("Saving...") : t("Save Changes")}</span>
                </button>
              </section>

              <section className="rounded-[1.5rem] border border-border bg-card p-4 space-y-3">
                <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" /> {t("passport.serviceFiles")}</h4>
                {serviceFiles.length === 0 ? (
                  <p className="text-xs font-bold text-muted-foreground">{t("passport.noServiceFiles")}</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-auto">
                    {serviceFiles.map((file) => (
                      <div key={file.id} className="rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-foreground truncate">{file.title}</span><span className="text-[9px] font-bold text-muted-foreground shrink-0">{formatSalonDate(file.createdAt, i18n.language)}</span></div>
                        {file.note && <p className="mt-1 text-[10px] text-muted-foreground">{file.note}</p>}
                        {file.images && file.images.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{file.images.map((img) => <img key={img.id} src={img.imageUrl} alt={file.title} className="h-10 w-10 rounded-lg object-cover border border-border" />)}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
