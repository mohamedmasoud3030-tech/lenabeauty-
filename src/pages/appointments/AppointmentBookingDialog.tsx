import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Calendar as CalendarIcon, ChevronRight, Clock, Search, User,
  Scissors, CheckCircle2, UserPlus, XCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";
import { Modal } from "../../shared/components/Modal";
import { getDisplayName, getInitials } from "../../shared/displayName";
import { formatSalonDate, formatSalonTime } from "../../shared/dateTime";
import { AppointmentStatus, VisitStage } from "../../domain/entities";
import { effectiveVisitStage, allowedVisitStages } from "../../domain/visit";
import { Appt, Customer, Employee, Service, statusClass, visitStageLabel, visitActionLabel } from "./helpers";

/**
 * Booking / edit dialog for the appointments calendar. Purely presentational:
 * every value and action is supplied by the page (the orchestrator), which
 * keeps the form state, validation, and mutation authority.
 */
export function AppointmentBookingDialog({
  open,
  onClose,
  busy,
  editApptId,
  footer,
  slotDate,
  onSlotDateChange,
  customerQ,
  onCustomerQChange,
  customers,
  customerId,
  onSelectCustomer,
  onClearCustomer,
  customerSearchDone,
  creatingCustomer,
  onCreateCustomer,
  services,
  serviceId,
  onServiceChange,
  employees,
  employeeId,
  onEmployeeChange,
  depositAmount,
  onDepositChange,
  noShowFeeAmount,
  onNoShowFeeChange,
  noShowNote,
  onNoShowNoteChange,
  status,
  appts,
  chargeNoShowFee,
  onChargeNoShowFeeChange,
  onMarkNoShow,
  onCancelAppointment,
  onOpenPos,
  onAdvance,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  editApptId: string | null;
  footer: ReactNode;
  slotDate: Date | null;
  onSlotDateChange: (d: Date) => void;
  customerQ: string;
  onCustomerQChange: (q: string) => void;
  customers: Customer[];
  customerId: string;
  onSelectCustomer: (id: string, name: string) => void;
  onClearCustomer: () => void;
  customerSearchDone: boolean;
  creatingCustomer: boolean;
  onCreateCustomer: () => void;
  services: Service[];
  serviceId: string;
  onServiceChange: (id: string) => void;
  employees: Employee[];
  employeeId: string;
  onEmployeeChange: (id: string) => void;
  depositAmount: number;
  onDepositChange: (v: number) => void;
  noShowFeeAmount: number;
  onNoShowFeeChange: (v: number) => void;
  noShowNote: string;
  onNoShowNoteChange: (v: string) => void;
  status: AppointmentStatus;
  appts: Appt[];
  chargeNoShowFee: boolean;
  onChargeNoShowFeeChange: (v: boolean) => void;
  onMarkNoShow: () => void;
  onCancelAppointment: () => void;
  onOpenPos: (appt: Appt) => void;
  onAdvance: (appt: Appt, stage: VisitStage) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <CalendarIcon className="h-5 w-5" />
          </span>
          <span>{editApptId ? t("Edit Appointment") : t("Book Appointment")}</span>
        </span>
      }
      description={t("Fill in the details below")}
      footer={footer}
      disableClose={busy}
      className="sm:max-w-2xl sm:rounded-[3rem]"
    >
      <div className="space-y-6 sm:space-y-8 sm:p-5">
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-4 sm:gap-6 p-4 sm:p-6 rounded-[2rem] bg-muted/30 border border-border shadow-inner">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Date")}</label>
            <div className="relative">
              <CalendarIcon className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                dir="ltr"
                lang="en"
                className="w-full rounded-2xl border border-border bg-card ps-11 pe-4 py-3.5 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all text-start"
                value={slotDate ? `${slotDate.getFullYear()}-${String(slotDate.getMonth() + 1).padStart(2, '0')}-${String(slotDate.getDate()).padStart(2, '0')}` : ''}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [y, m, d] = e.target.value.split('-');
                  const newDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                  if (slotDate) newDate.setHours(slotDate.getHours(), slotDate.getMinutes());
                  onSlotDateChange(newDate);
                }}
              />
              {slotDate && (
                <p className="mt-1 ms-2 text-[11px] font-bold text-muted-foreground" dir="auto">{formatSalonDate(slotDate, i18n.language)}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Time")}</label>
            <div className="relative">
              <Clock className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="time"
                dir="ltr"
                lang="en"
                className="w-full rounded-2xl border border-border bg-card ps-11 pe-4 py-3.5 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all text-start"
                value={slotDate ? `${String(slotDate.getHours()).padStart(2, '0')}:${String(slotDate.getMinutes()).padStart(2, '0')}` : ''}
                onChange={(e) => {
                  if (!e.target.value || !slotDate) return;
                  const [h, m] = e.target.value.split(':');
                  const d = new Date(slotDate);
                  d.setHours(parseInt(h), parseInt(m));
                  onSlotDateChange(d);
                }}
              />
              {slotDate && (
                <p className="mt-1 ms-2 text-[11px] font-bold text-muted-foreground" dir="auto">{formatSalonTime(slotDate, i18n.language)}</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Customer")}</label>
          <div className="relative group">
            <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              className="w-full rounded-[1.5rem] border border-border bg-card py-4.5 ps-14 pe-6 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
              value={customerQ}
              onChange={(e) => onCustomerQChange(e.target.value)}
              placeholder={t("Search by name or phone...")}
            />
            <AnimatePresence>
              {customers.length > 0 && !customerId && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute bottom-full inset-x-0 mb-4 max-h-64 overflow-auto rounded-[2rem] border border-border shadow-2xl bg-card z-10 p-2"
                >
                  {customers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onSelectCustomer(c.id, c.name)}
                      className="flex w-full items-center justify-between px-6 py-4 rounded-2xl text-start text-sm hover:bg-muted transition-all group/item"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs group-hover/item:bg-primary group-hover/item:text-primary-foreground transition-colors">{getInitials(c, "·")}</div>
                        <div className="text-start">
                          <span className="font-bold text-foreground block">{getDisplayName(c, t("Unnamed"))}</span>
                          <span className="text-[10px] text-muted-foreground font-bold tracking-widest">{c.phone}</span>
                        </div>
                      </div>
                      <ChevronRight className={clsx("h-4 w-4 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-all", i18n.language === "ar" && "rotate-180")} />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {!customerId && customerQ.trim().length > 0 && customerSearchDone && customers.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4"
            >
              <p className="text-xs font-bold text-muted-foreground mb-2">{t("Customer not found")}</p>
              <button
                onClick={onCreateCustomer}
                disabled={creatingCustomer}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
              >
                <UserPlus className="h-4 w-4" />
                {creatingCustomer ? t("Creating...") : `${t("Create customer")}: ${customerQ.trim()}`}
              </button>
            </motion.div>
          )}
          {customerId && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/20"
            >
              <div className="flex items-center gap-3 min-w-0">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm font-bold text-foreground truncate">{customerQ}</span>
              </div>
              <button onClick={onClearCustomer} className="text-xs font-bold text-destructive hover:underline shrink-0 ms-2">{t("Remove")}</button>
            </motion.div>
          )}
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Service")}</label>
            <div className="relative">
              <Scissors className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <select
                className="w-full appearance-none rounded-[1.5rem] border border-border bg-card py-4.5 ps-14 pe-12 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all cursor-pointer"
                value={serviceId}
                onChange={(e) => onServiceChange(e.target.value)}
              >
                {services.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.durationMins} {t("min")})</option>)}
              </select>
              <ChevronRight className="absolute end-6 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none rotate-90" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Specialist")}</label>
            <div className="relative">
              <User className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <select
                className="w-full appearance-none rounded-[1.5rem] border border-border bg-card py-4.5 ps-14 pe-12 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all cursor-pointer"
                value={employeeId}
                onChange={(e) => onEmployeeChange(e.target.value)}
              >
                {employees.map((e) => <option key={e.id} value={e.id}>{getDisplayName(e, t("Unnamed"))}</option>)}
              </select>
              <ChevronRight className="absolute end-6 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none rotate-90" />
            </div>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Deposit Amount")}</label>
            <input
              type="number"
              min="0"
              step="0.001"
              className="w-full rounded-[1.5rem] border border-border bg-card py-4.5 px-6 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
              value={depositAmount}
              onChange={(e) => onDepositChange(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("No-Show Fee")}</label>
            <input
              type="number"
              min="0"
              step="0.001"
              className="w-full rounded-[1.5rem] border border-border bg-card py-4.5 px-6 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
              value={noShowFeeAmount}
              onChange={(e) => onNoShowFeeChange(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("No-Show Policy Note")}</label>
          <textarea
            className="w-full rounded-[1.5rem] border border-border bg-card py-4.5 px-6 text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all min-h-[96px] resize-y"
            value={noShowNote}
            onChange={(e) => onNoShowNoteChange(e.target.value)}
            placeholder={t("Optional deposit or no-show policy details") }
          />
        </div>

        {editApptId && (
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Status")}</label>
            <div className={clsx("rounded-[1.5rem] border px-6 py-4 text-sm font-bold", statusClass(status))}>
              {t(status)}
            </div>
          </div>
        )}

        {(() => {
          const appt = appts.find((a) => a.id === editApptId);
          if (!appt || appt.status !== AppointmentStatus.SCHEDULED) return null;
          const stage = effectiveVisitStage(appt) as VisitStage;
          const nextStages = allowedVisitStages(appt);
          const nextStage = nextStages[0];
          const isReadyForCheckout = stage === VisitStage.READY_FOR_CHECKOUT;
          return (
            <div className="rounded-[1.5rem] border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{t("visit.section")}</p>
                  <p className="text-sm font-bold text-foreground">{visitStageLabel(stage, t)}</p>
                </div>
                {isReadyForCheckout ? (
                  <button
                    type="button"
                    onClick={() => onOpenPos(appt)}
                    disabled={busy}
                    className="h-12 px-5 rounded-2xl bg-primary text-white font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-50 active:scale-95"
                  >
                    {t("visit.action.checkout")}
                  </button>
                ) : (
                  nextStage && (
                    <button
                      type="button"
                      onClick={() => void onAdvance(appt, nextStage)}
                      disabled={busy}
                      className="h-12 px-5 rounded-2xl bg-primary text-white font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-50 active:scale-95"
                    >
                      {visitActionLabel(stage, t)}
                    </button>
                  )
                )}
              </div>
              {isReadyForCheckout && (
                <p className="text-xs text-muted-foreground">
                  {t("visit.checkoutHint")}
                </p>
              )}
            </div>
          );
        })()}

        <div className="flex flex-col gap-4">
          {editApptId && status === AppointmentStatus.SCHEDULED && (
            <div className="rounded-[1.5rem] border border-warning/20 bg-warning/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-warning">{t("Mark as No-Show")}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {t("Manual no-show fee record")}: {Math.max(depositAmount, noShowFeeAmount).toFixed(2)} {t("OMR")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("Recording this amount does not create a payment or invoice.")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <input
                    type="checkbox"
                    checked={chargeNoShowFee}
                    onChange={(e) => onChargeNoShowFeeChange(e.target.checked)}
                  />
                  {t("Record no-show fee")}
                </label>
                <button
                  onClick={onMarkNoShow}
                  className="h-12 px-5 rounded-2xl bg-warning text-white font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
                  disabled={busy}
                >
                  {t("Mark as No-Show")}
                </button>
              </div>
            </div>
          )}

          {editApptId && status === AppointmentStatus.SCHEDULED && (
            <button
              onClick={onCancelAppointment}
              disabled={busy}
              className="h-12 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-destructive hover:text-white transition-all active:scale-95"
            >
              <XCircle className="h-4 w-4" />
              {t("Cancel Appointment")}
            </button>
          )}

        </div>
      </div>
    </Modal>
  );
}
