import { useTranslation } from "react-i18next";
import { CheckCircle2, Pencil, Phone, Save, User, UserPlus } from "lucide-react";
import { Modal } from "../../shared/components/Modal";

/**
 * Add / edit customer dialog. The two flows share one name + phone form with
 * only the title, icon, and submit label differing by mode. The page keeps
 * form state and the mutation handlers; this component only renders.
 */
export function CustomerFormDialog({
  mode,
  open,
  onClose,
  name,
  onNameChange,
  phone,
  onPhoneChange,
  busy,
  onSubmit,
}: {
  mode: "add" | "edit";
  open: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (v: string) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  busy: boolean;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = mode === "edit";

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="sm"
      title={
        <span className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            {isEdit ? <Pencil className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
          </span>
          <span>{isEdit ? t("Edit Customer") : t("Add Customer")}</span>
        </span>
      }
      description={isEdit ? t("Update Details") : t("Create New Client")}
      disableClose={busy}
      className="sm:rounded-[3rem]"
    >
      <div className="space-y-6 sm:space-y-8 sm:p-5">
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Full Name")}</label>
          <div className="relative">
            <User className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-6 py-4.5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
              placeholder={t("Enter customer name")}
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ms-2">{t("Phone Number")}</label>
          <div className="relative">
            <Phone className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="w-full rounded-[1.5rem] border border-border bg-muted/30 ps-14 pe-6 py-4.5 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-start shadow-inner"
              dir="ltr"
              placeholder="968XXXXXXXX"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
            />
          </div>
        </div>

        <button
          disabled={busy}
          onClick={onSubmit}
          className={
            isEdit
              ? "group relative w-full h-16 rounded-[2rem] bg-primary font-bold text-primary-foreground shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 overflow-hidden flex items-center justify-center gap-3"
              : "group relative w-full h-16 rounded-[2rem] bg-primary font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 overflow-hidden flex items-center justify-center gap-3"
          }
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          {isEdit ? <Save className="h-6 w-6 relative z-10" /> : <CheckCircle2 className="h-6 w-6 relative z-10" />}
          <span className="text-lg relative z-10">
            {isEdit ? (busy ? t("Saving...") : t("Save Changes")) : (busy ? t("Creating...") : t("Create Customer"))}
          </span>
        </button>
      </div>
    </Modal>
  );
}
