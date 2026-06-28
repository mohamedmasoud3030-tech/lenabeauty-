import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { CreditCard, Save, ShieldCheck, Globe, Banknote } from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { PremiumCard, CardContent, CardHeader } from "../shared/components/PremiumCard";

export default function PaymentGatewaySettingsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
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
    try {
      const res = await useCases.settings.getPaymentGatewaySettings();
      if (res.ok) {
        setForm({
          provider: res.data.provider,
          isEnabled: res.data.isEnabled,
          isSandbox: res.data.isSandbox,
          publicKey: res.data.publicKey || "",
          merchantIdentifier: res.data.merchantIdentifier || "",
          webhookSecretHint: res.data.webhookSecretHint || "",
          bookingDepositEnabled: res.data.bookingDepositEnabled,
          bookingDepositType: res.data.bookingDepositType,
          bookingDepositValue: res.data.bookingDepositValue,
          successUrl: res.data.successUrl || "",
          cancelUrl: res.data.cancelUrl || "",
        });
      }
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
      await unwrap(useCases.settings.updatePaymentGatewaySettings(form));
      showToast("success", t("Success"), t("Payment gateway settings saved successfully"));
    } catch (err: any) {
      showToast("error", t("Error"), err.message || t("Failed to save payment gateway settings"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><CreditCard className="h-7 w-7" /></div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("Payment Gateway")}</h1>
          <p className="text-sm text-muted-foreground">{t("Configure online deposit collection for booking confirmations")}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <PremiumCard variant="glass"><CardContent className="py-6"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Provider")}</p><div className="mt-2 text-xl font-bold text-foreground uppercase">{form.provider}</div></CardContent></PremiumCard>
        <PremiumCard variant="glass"><CardContent className="py-6"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Environment")}</p><div className="mt-2 text-xl font-bold text-foreground">{form.isSandbox ? t("Sandbox") : t("Live")}</div></CardContent></PremiumCard>
        <PremiumCard variant="glass"><CardContent className="py-6"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Booking Deposit")}</p><div className="mt-2 text-xl font-bold text-foreground">{form.bookingDepositEnabled ? `${form.bookingDepositValue}${form.bookingDepositType === "percentage" ? "%" : ` ${t("OMR")}`}` : t("Disabled")}</div></CardContent></PremiumCard>
      </div>

      <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <PremiumCard variant="glass">
          <CardHeader><div className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /><h2 className="font-bold text-foreground">{t("Gateway Configuration")}</h2></div></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid md:grid-cols-3 gap-4">
              <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Provider")}</span><select className="w-full rounded-xl border border-border bg-card px-4 py-3 font-bold" value={form.provider} onChange={(e) => update("provider", e.target.value as any)}><option value="manual">Manual</option><option value="thawani">Thawani</option><option value="paytabs">PayTabs</option><option value="stripe">Stripe</option></select></label>
              <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Gateway Enabled")}</span><select className="w-full rounded-xl border border-border bg-card px-4 py-3 font-bold" value={String(form.isEnabled)} onChange={(e) => update("isEnabled", e.target.value === "true")}><option value="true">{t("Enabled")}</option><option value="false">{t("Disabled")}</option></select></label>
              <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Environment")}</span><select className="w-full rounded-xl border border-border bg-card px-4 py-3 font-bold" value={String(form.isSandbox)} onChange={(e) => update("isSandbox", e.target.value === "true")}><option value="true">{t("Sandbox")}</option><option value="false">{t("Live")}</option></select></label>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Public Key")}</span><input className="w-full rounded-xl border border-border bg-card px-4 py-3 font-bold" value={form.publicKey} onChange={(e) => update("publicKey", e.target.value)} placeholder="pk_live_..." /></label>
              <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Merchant Identifier")}</span><input className="w-full rounded-xl border border-border bg-card px-4 py-3 font-bold" value={form.merchantIdentifier} onChange={(e) => update("merchantIdentifier", e.target.value)} placeholder="merchant_123" /></label>
            </div>

            <label className="space-y-2 block"><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Webhook Secret Hint")}</span><input className="w-full rounded-xl border border-border bg-card px-4 py-3 font-bold" value={form.webhookSecretHint} onChange={(e) => update("webhookSecretHint", e.target.value)} placeholder={t("Store only a hint here; keep the real secret outside Git") as string} /></label>

            <div className="rounded-2xl border border-border p-5 bg-card/50 space-y-4">
              <div className="flex items-center gap-2"><Banknote className="h-5 w-5 text-primary" /><h3 className="font-bold text-foreground">{t("Booking Deposit Rules")}</h3></div>
              <div className="grid md:grid-cols-3 gap-4">
                <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Deposit Enabled")}</span><select className="w-full rounded-xl border border-border bg-card px-4 py-3 font-bold" value={String(form.bookingDepositEnabled)} onChange={(e) => update("bookingDepositEnabled", e.target.value === "true")}><option value="true">{t("Enabled")}</option><option value="false">{t("Disabled")}</option></select></label>
                <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Deposit Type")}</span><select className="w-full rounded-xl border border-border bg-card px-4 py-3 font-bold" value={form.bookingDepositType} onChange={(e) => update("bookingDepositType", e.target.value as any)}><option value="fixed">{t("Fixed")}</option><option value="percentage">{t("Percentage")}</option></select></label>
                <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Deposit Value")}</span><input type="number" min="0" step="0.001" className="w-full rounded-xl border border-border bg-card px-4 py-3 font-bold" value={form.bookingDepositValue} onChange={(e) => update("bookingDepositValue", Number(e.target.value) || 0)} /></label>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Success URL")}</span><input className="w-full rounded-xl border border-border bg-card px-4 py-3 font-bold" value={form.successUrl} onChange={(e) => update("successUrl", e.target.value)} placeholder="https://example.com/booking/success" /></label>
              <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Cancel URL")}</span><input className="w-full rounded-xl border border-border bg-card px-4 py-3 font-bold" value={form.cancelUrl} onChange={(e) => update("cancelUrl", e.target.value)} placeholder="https://example.com/booking/cancel" /></label>
            </div>

            <button onClick={save} disabled={loading} className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-50"><Save className="h-4 w-4" />{loading ? t("Saving...") : t("Save Payment Gateway Settings")}</button>
          </CardContent>
        </PremiumCard>

        <div className="space-y-6">
          <PremiumCard variant="glass">
            <CardHeader><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h2 className="font-bold text-foreground">{t("Security Checklist")}</h2></div></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{t("Never store real gateway secret keys in the repository or browser code.")}</p>
              <p>{t("Use sandbox mode until your merchant account is fully verified.")}</p>
              <p>{t("After saving settings, configure the real webhook secret and server-side checkout session on your deployment platform.")}</p>
            </CardContent>
          </PremiumCard>
          <PremiumCard variant="glass">
            <CardHeader><h2 className="font-bold text-foreground">{t("Current Product Scope")}</h2></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{t("This release persists your deposit rules and provider metadata in Supabase.")}</p>
              <p>{t("The final live charge step still needs your external merchant credentials and webhook deployment.")}</p>
              <p>{t("Until then, bookings can still use manual deposit/no-show workflows already implemented in appointments.")}</p>
            </CardContent>
          </PremiumCard>
        </div>
      </div>
    </div>
  );
}
