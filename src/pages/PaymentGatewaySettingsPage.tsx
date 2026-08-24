import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Banknote, Save } from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { PremiumCard, CardContent, CardHeader } from "../shared/components/PremiumCard";
import { ScreenState } from "../shared/components/ScreenState";
import { formatOMRAmount } from "../shared/money";

export default function PaymentGatewaySettingsPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({
    provider: "manual" as "manual" | "thawani" | "paytabs" | "stripe",
    isEnabled: false,
    isSandbox: true,
    publicKey: "",
    merchantIdentifier: "",
    webhookSecretHint: "",
    bookingDepositEnabled: false,
    bookingDepositType: "fixed" as "fixed" | "percentage",
    bookingDepositValue: 0,
    successUrl: "",
    cancelUrl: "",
  });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await useCases.settings.getPaymentGatewaySettings();
      if (!result.ok && result.error.code !== "NOT_FOUND") throw result.error;
      if (result.ok) {
        setForm({
          provider: result.data.provider,
          isEnabled: false,
          isSandbox: true,
          publicKey: result.data.publicKey || "",
          merchantIdentifier: result.data.merchantIdentifier || "",
          webhookSecretHint: result.data.webhookSecretHint || "",
          bookingDepositEnabled: result.data.bookingDepositEnabled,
          bookingDepositType: result.data.bookingDepositType,
          bookingDepositValue: result.data.bookingDepositValue,
          successUrl: result.data.successUrl || "",
          cancelUrl: result.data.cancelUrl || "",
        });
      }
    } catch (error) {
      console.error("Booking deposit settings load failed", error);
      setLoadError(t("Failed to load payment settings"));
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setLoading(true);
    try {
      await unwrap(useCases.settings.updatePaymentGatewaySettings({
        ...form,
        // Keep non-operational gateway activation disabled while preserving
        // any existing metadata. The visible controls below are only for the
        // booking-deposit rules that the appointment workflow can use today.
        isEnabled: false,
        isSandbox: true,
      }));
      showToast("success", t("Success"), t("Payment gateway settings saved successfully"));
    } catch (error) {
      console.error("Booking deposit settings save failed", error);
      showToast("error", t("Error"), t("Failed to save payment gateway settings"));
    } finally {
      setLoading(false);
    }
  }

  if (loadError) {
    return (
      <ScreenState
        state="error"
        title={t("Failed to load payment settings")}
        description={loadError}
        actionLabel={t("Retry")}
        onAction={() => void load()}
      />
    );
  }

  const depositValue = form.bookingDepositType === "percentage"
    ? `${form.bookingDepositValue}%`
    : `${formatOMRAmount(form.bookingDepositValue)} ${t("OMR")}`;

  return (
    <div className="space-y-6 sm:space-y-8">
      {!embedded ? (
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-14 sm:w-14 sm:rounded-2xl">
            <Banknote className="h-5 w-5 sm:h-7 sm:w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t("Booking Deposit")}</h1>
            <p className="text-sm text-muted-foreground">{t("Booking deposit configuration")}</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <PremiumCard variant="glass">
          <CardContent className="py-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Deposit Enabled")}</p>
            <div className={`mt-2 text-xl font-bold ${form.bookingDepositEnabled ? "text-success" : "text-muted-foreground"}`}>
              {form.bookingDepositEnabled ? t("Enabled") : t("Disabled")}
            </div>
          </CardContent>
        </PremiumCard>
        <PremiumCard variant="glass">
          <CardContent className="py-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Deposit Type")}</p>
            <div className="mt-2 text-xl font-bold text-foreground">
              {form.bookingDepositType === "fixed" ? t("Fixed") : t("Percentage")}
            </div>
          </CardContent>
        </PremiumCard>
        <PremiumCard variant="glass">
          <CardContent className="py-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Deposit Value")}</p>
            <div className="mt-2 text-xl font-bold text-primary">{depositValue}</div>
          </CardContent>
        </PremiumCard>
      </div>

      <PremiumCard variant="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-foreground">{t("Booking Deposit Rules")}</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Deposit Enabled")}</span>
              <select
                className="min-h-11 w-full rounded-xl border border-input bg-background px-4 py-3 font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                value={String(form.bookingDepositEnabled)}
                onChange={(event) => update("bookingDepositEnabled", event.target.value === "true")}
              >
                <option value="true">{t("Enabled")}</option>
                <option value="false">{t("Disabled")}</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Deposit Type")}</span>
              <select
                className="min-h-11 w-full rounded-xl border border-input bg-background px-4 py-3 font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                value={form.bookingDepositType}
                onChange={(event) => update("bookingDepositType", event.target.value as "fixed" | "percentage")}
              >
                <option value="fixed">{t("Fixed")}</option>
                <option value="percentage">{t("Percentage")}</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Deposit Value")}</span>
              <input
                type="number"
                min="0"
                step={form.bookingDepositType === "fixed" ? "0.001" : "0.1"}
                max={form.bookingDepositType === "percentage" ? "100" : undefined}
                className="min-h-11 w-full rounded-xl border border-input bg-background px-4 py-3 font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                value={form.bookingDepositValue}
                onChange={(event) => update("bookingDepositValue", Number(event.target.value) || 0)}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {loading ? t("Saving...") : t("Save Settings")}
          </button>
        </CardContent>
      </PremiumCard>
    </div>
  );
}
