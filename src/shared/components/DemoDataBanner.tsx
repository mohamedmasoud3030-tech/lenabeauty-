import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * DemoDataBanner
 * ---------------
 * Honest disclosure that a screen is rendering sample/demo data and is NOT
 * yet wired to the live Supabase backend.
 *
 * Rationale (docs/SALES_READY_RELEASE.md — "No Fake Operating Mode"):
 * data that does not persist must never be presented as real. Until the
 * Attendance / Advances / Payroll / Staff-Analytics backends exist, these
 * pages must clearly mark themselves as demo previews.
 */
export function DemoDataBanner() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div className="text-sm leading-relaxed">
        <p className="font-bold">{t("Demo data")}</p>
        <p className="opacity-90">
          {t(
            "This screen shows sample data for preview only. It is not yet connected to the database and nothing here is saved."
          )}
        </p>
      </div>
    </div>
  );
}

export default DemoDataBanner;
