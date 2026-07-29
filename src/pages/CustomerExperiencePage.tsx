import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, MessageSquareHeart, RefreshCcw, Share2, Star } from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import type { Customer } from "../domain/entities";

export default function CustomerExperiencePage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [beforeImages, setBeforeImages] = useState("");
  const [afterImages, setAfterImages] = useState("");
  const [referenceImages, setReferenceImages] = useState("");
  const [loading, setLoading] = useState(true);

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === selectedCustomerId), [customers, selectedCustomerId]);

  async function load() {
    setLoading(true);
    try {
      const [customersRes, reviewsRes, filesRes] = await Promise.all([
        unwrap(useCases.customers.list()),
        unwrap(useCases.customerExperience.listReviews()),
        unwrap(useCases.customerExperience.listServiceFiles()),
      ]);
      setCustomers(customersRes);
      setReviews(reviewsRes);
      setFiles(filesRes);
      if (!selectedCustomerId && customersRes[0]?.id) setSelectedCustomerId(customersRes[0].id);
    } catch (err: any) {
      showToast("error", t("Error"), err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function addReview() {
    if (!selectedCustomerId) return;
    try {
      await unwrap(useCases.customerExperience.createReview({ customerId: selectedCustomerId, rating, comment, isPublished: true }));
      setComment("");
      await load();
      showToast("success", t("Success"), t("Review added successfully"));
    } catch (err: any) {
      showToast("error", t("Error"), err?.message || String(err));
    }
  }

  async function addServiceFile() {
    if (!selectedCustomerId || !title.trim()) return;
    try {
      await unwrap(useCases.customerExperience.createServiceFile({
        customerId: selectedCustomerId,
        title: title.trim(),
        note: note.trim() || undefined,
        beforeImages: beforeImages.split(/\n|,/).map((v) => v.trim()).filter(Boolean),
        afterImages: afterImages.split(/\n|,/).map((v) => v.trim()).filter(Boolean),
        referenceImages: referenceImages.split(/\n|,/).map((v) => v.trim()).filter(Boolean),
      }));
      setTitle(""); setNote(""); setBeforeImages(""); setAfterImages(""); setReferenceImages("");
      await load();
      showToast("success", t("Success"), t("Service file added successfully"));
    } catch (err: any) {
      showToast("error", t("Error"), err?.message || String(err));
    }
  }

  const customerReviews = reviews.filter((review) => review.customerId === selectedCustomerId);
  const customerFiles = files.filter((file) => file.customerId === selectedCustomerId);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold">{t("Customer Experience")}</h1>
        <p className="text-sm text-muted-foreground">{t("Manage reviews, before/after gallery, service files, and referral sharing")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3"><Share2 className="h-4 w-4 text-primary" /><h2 className="font-bold">{t("Customer Portal & Referral")}</h2></div>
          <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className="w-full rounded-xl border bg-background px-3 py-2 text-sm">
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
          {selectedCustomer && (
            <div className="mt-4 space-y-2 text-sm">
              <div><span className="font-semibold">{t("Phone")}: </span>{selectedCustomer.phone || "—"}</div>
              <div><span className="font-semibold">{t("Portal")}: </span>{window.location.origin}/portal</div>
              <button onClick={() => useCases.customers.rotatePortalToken(selectedCustomer.id)} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                <RefreshCcw className="h-4 w-4" /> {t("Rotate Portal Code")}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-4 md:col-span-2">
          <div className="flex items-center gap-2 mb-3"><MessageSquareHeart className="h-4 w-4 text-primary" /><h2 className="font-bold">{t("Add Review")}</h2></div>
          <div className="grid gap-3 md:grid-cols-3">
            <input value={rating} onChange={(e) => setRating(Number(e.target.value))} type="number" min={1} max={5} className="rounded-xl border bg-background px-3 py-2 text-sm" />
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("Customer feedback") as string} className="rounded-xl border bg-background px-3 py-2 text-sm md:col-span-2" />
          </div>
          <button onClick={addReview} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Star className="h-4 w-4" />{t("Save Review")}</button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-3"><ImagePlus className="h-4 w-4 text-primary" /><h2 className="font-bold">{t("Service File & Before/After")}</h2></div>
        <div className="grid gap-3 md:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("Session title") as string} className="rounded-xl border bg-background px-3 py-2 text-sm" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Session notes") as string} className="rounded-xl border bg-background px-3 py-2 text-sm" />
          <textarea value={beforeImages} onChange={(e) => setBeforeImages(e.target.value)} placeholder={t("Before image URLs, comma or new line separated") as string} className="min-h-28 rounded-xl border bg-background px-3 py-2 text-sm" />
          <textarea value={afterImages} onChange={(e) => setAfterImages(e.target.value)} placeholder={t("After image URLs, comma or new line separated") as string} className="min-h-28 rounded-xl border bg-background px-3 py-2 text-sm" />
          <textarea value={referenceImages} onChange={(e) => setReferenceImages(e.target.value)} placeholder={t("Reference image URLs, comma or new line separated") as string} className="min-h-28 rounded-xl border bg-background px-3 py-2 text-sm md:col-span-2" />
        </div>
        <button onClick={addServiceFile} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">{t("Save Service File")}</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-bold">{t("Reviews")}</h2>
          <div className="space-y-3">
            {customerReviews.map((review) => (
              <div key={review.id} className="rounded-xl border p-3 text-sm">
                <div className="font-semibold">{Array.from({ length: review.rating }).map((_, i) => "★").join("")}</div>
                <div className="text-muted-foreground">{review.comment || "—"}</div>
              </div>
            ))}
            {!customerReviews.length && !loading && <div className="text-sm text-muted-foreground">{t("No reviews yet")}</div>}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-bold">{t("Service Files")}</h2>
          <div className="space-y-3">
            {customerFiles.map((file) => (
              <div key={file.id} className="rounded-xl border p-3 text-sm">
                <div className="font-semibold">{file.title}</div>
                <div className="text-muted-foreground">{file.note || "—"}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {(file.images || []).map((img: any) => <span key={img.id} className="rounded-full bg-muted px-2 py-1">{img.imageKind}</span>)}
                </div>
              </div>
            ))}
            {!customerFiles.length && !loading && <div className="text-sm text-muted-foreground">{t("No service files yet")}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
