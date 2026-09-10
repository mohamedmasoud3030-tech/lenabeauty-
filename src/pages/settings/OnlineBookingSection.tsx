import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, Check, Copy, Globe, KeyRound } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

/**
 * Settings → Online Booking.
 *
 * The public booking page (#/book) and the client portal (#/portal) ship with
 * the app itself; this section only surfaces the links a salon actually
 * shares: copy/scan the booking link, and instructions for issuing a
 * customer's portal code from the Customers screen. No server state.
 */
export default function OnlineBookingSection({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<"booking" | "portal" | null>(null);

  const links = useMemo(() => {
    const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
    return {
      booking: `${base}#/book`,
      portal: `${base}#/portal`,
    };
  }, []);

  async function copyLink(which: "booking" | "portal") {
    try {
      await navigator.clipboard.writeText(links[which]);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard can be blocked (permissions/iframes); the raw link stays
      // selectable on screen as the manual fallback.
      setCopied(null);
    }
  }

  return (
    <div className={embedded ? "space-y-6" : "space-y-6 pb-10"}>
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CalendarDays className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">{t("Online Booking")}</h2>
          <p className="text-sm text-muted-foreground">{t("Let clients book themselves, 24/7, without calling you.")}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Booking link */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">{t("Public booking link")}</h3>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("Share this link on Instagram or WhatsApp. Anyone who opens it can pick a service, a specialist and a free time — it lands in your Appointments calendar as a scheduled visit.")}
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              dir="ltr"
              className="min-h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-xs font-bold text-foreground"
              value={links.booking}
              onFocus={(event) => event.target.select()}
            />
            <button
              type="button"
              onClick={() => void copyLink("booking")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90"
              aria-label={t("Copy booking link")}
            >
              {copied === "booking" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex justify-center rounded-xl bg-white p-4">
            <QRCodeSVG value={links.booking} size={148} level="M" />
          </div>
          <p className="text-center text-[11px] text-muted-foreground">{t("Scan to open the booking page")}</p>
        </div>

        {/* Client portal */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">{t("Client portal")}</h3>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("Each customer gets a personal code from the Customers screen. With their phone number and that code they can open the portal, see their visits and rewards, and cancel or move an upcoming appointment themselves.")}
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              dir="ltr"
              className="min-h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-xs font-bold text-foreground"
              value={links.portal}
              onFocus={(event) => event.target.select()}
            />
            <button
              type="button"
              onClick={() => void copyLink("portal")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90"
              aria-label={t("Copy portal link")}
            >
              {copied === "portal" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>• {t("Appointments created online appear instantly in your calendar.")}</li>
            <li>• {t("Customers can only cancel or reschedule a future scheduled appointment.")}</li>
            <li>• {t("Wrong code entries lock the portal for 15 minutes, exactly like a bank.")}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
