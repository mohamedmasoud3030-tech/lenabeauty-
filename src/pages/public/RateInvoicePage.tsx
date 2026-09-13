import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, Receipt, Scissors, Star, User } from "lucide-react";
import clsx from "clsx";
import { useCases } from "../../app/composition/useCases";
import { formatPublicError } from "../../shared/hooks/useApplication";
import { formatOMRAmount } from "../../shared/money";
import { formatSalonDate } from "../../shared/dateTime";
import { PublicShell, usePublicDirection } from "./PublicShell";
import { PRODUCT_NAME } from "../../config/brand";
import type { InvoiceRatingLookup, InvoiceRatingSaved } from "../../domain/ports/repositories";

/**
 * Receipt rating (#/rate?invoice=<id>) — the QR printed on every receipt
 * opens this page. Possession of the invoice id (printed on the paper) is
 * the credential; the server owns every lookup and the one-rating-per-visit
 * upsert. The customer experiences the service, so the customer rates it.
 */
export default function RateInvoicePage() {
  usePublicDirection();
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get("invoice");

  const [lookup, setLookup] = useState<InvoiceRatingLookup | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<InvoiceRatingSaved | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!invoiceId) {
      setLoadError(t("We couldn't find this visit. Please ask the salon to reprint the receipt."));
      return;
    }
    setLoadError(null);
    void (async () => {
      const result = await useCases.public.lookupInvoiceRating(invoiceId);
      if (cancelled) return;
      if (!result.ok) {
        // formatPublicError maps the server's snake_case codes
        // (invoice_not_found, ...) to their i18n messages.
        setLoadError(formatPublicError(result.error, t("The request could not be completed. Please try again.")));
        return;
      }
      setLookup(result.data);
      setRating(result.data.existingRating);
      // The center's own currency display comes from the public center info.
      const center = await useCases.public.getCenterInfo(result.data.centerId);
      if (!cancelled && center.ok) setCurrency(center.data.currency || null);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const submit = useCallback(
    async (value: number) => {
      if (!invoiceId || saving) return;
      setSaving(true);
      setActionError(null);
      const result = await useCases.public.rateFromInvoice(invoiceId, value, comment);
      if (result.ok) {
        setSaved(result.data);
        setRating(value);
      } else {
        setActionError(formatPublicError(result.error, t("The request could not be completed. Please try again.")));
      }
      setSaving(false);
    },
    [invoiceId, saving, comment, t],
  );

  function onStarTap(value: number) {
    // Clean tap (no comment typed) submits immediately — the whole point of
    // the receipt QR is a two-second rating. A typed comment switches to the
    // explicit submit button.
    if (comment.trim()) {
      setRating(value);
      return;
    }
    void submit(value);
  }

  const needsExplicitSubmit = Boolean(comment.trim());

  const visitDate = useMemo(
    () => (lookup ? formatSalonDate(lookup.date, i18n.language) : ""),
    [lookup, i18n.language],
  );

  return (
    <PublicShell
      centerName={lookup?.centerName || PRODUCT_NAME}
      highlight={t("Rate your visit")}
    >
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
        {loadError && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-bold text-destructive">
            {loadError}
          </div>
        )}

        {!loadError && !lookup && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm font-bold text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("Loading...")}
          </div>
        )}

        {lookup && !loadError && (
          <>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Receipt className="h-4 w-4 text-primary" />
                {t("Your visit")}
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                {lookup.serviceName && (
                  <p className="flex items-center gap-2 font-bold text-foreground">
                    <Scissors className="h-3.5 w-3.5 text-primary" />
                    {lookup.serviceName}
                  </p>
                )}
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span dir="ltr">{visitDate}</span>
                </p>
                {lookup.employeeName && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5 text-primary" />
                    {lookup.employeeName}
                  </p>
                )}
                <p className="flex items-center gap-2 font-bold text-foreground">
                  {t("Total")}
                  <span dir="ltr">{formatOMRAmount(lookup.totalAmount)} {currency ?? ""}</span>
                </p>
              </div>
            </div>

            {saved ? (
              <div className="rounded-2xl border border-success/30 bg-success/10 p-5 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
                <p className="mt-2 text-sm font-bold text-foreground">{t("Thanks for your feedback!")}</p>
                <div className="mt-2 flex items-center justify-center gap-1" aria-label={t("Rating")}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star
                      key={value}
                      className={clsx("h-5 w-5", saved.rating >= value ? "text-warning" : "text-muted-foreground/40")}
                      fill={saved.rating >= value ? "currentColor" : "none"}
                    />
                  ))}
                </div>
                {saved.comment && <p className="mt-2 text-xs text-muted-foreground">"{saved.comment}"</p>}
                <p className="mt-3 text-xs text-muted-foreground">{t("You can change your rating any time.")}</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <p className="text-sm font-bold text-foreground">{t("How was this visit?")}</p>
                {rating && !needsExplicitSubmit && (
                  <p className="mt-1 text-xs text-muted-foreground">{t("Your previous rating")}</p>
                )}
                <div className="mt-3 flex items-center justify-center gap-2" role="group" aria-label={t("Rating")}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onStarTap(value)}
                      disabled={saving}
                      aria-label={`${t("Rating")} ${value}`}
                      aria-pressed={rating === value}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border transition disabled:opacity-50"
                    >
                      <Star
                        className={clsx("h-6 w-6", rating !== null && value <= rating ? "text-warning" : "text-muted-foreground")}
                        fill={rating !== null && value <= rating ? "currentColor" : "none"}
                      />
                    </button>
                  ))}
                </div>

                <label htmlFor="rate-comment" className="mt-4 block text-xs font-bold text-muted-foreground">
                  {t("Optional comment")}
                </label>
                <textarea
                  id="rate-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-border bg-muted/30 p-3 text-sm outline-none focus:ring-4 focus:ring-primary/10"
                />
                {needsExplicitSubmit && (
                  <button
                    type="button"
                    onClick={() => rating && void submit(rating)}
                    disabled={saving || rating === null}
                    className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {saving ? t("Saving rating...") : t("Submit rating")}
                  </button>
                )}

                {actionError && (
                  <p className="mt-3 text-xs font-bold text-destructive">{actionError}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PublicShell>
  );
}
