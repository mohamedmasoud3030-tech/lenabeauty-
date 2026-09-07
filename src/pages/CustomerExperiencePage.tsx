import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, MessageSquareHeart, Star } from "lucide-react";
import { useCases } from "../app/composition/useCases";
import { unwrap, formatError } from "../shared/hooks/useApplication";
import { useToast } from "../shared/components/Toast";
import { PageHeader } from "../shared/components/PageHeader";
import { ListState } from "../shared/components/ListState";
import type { Customer } from "../domain/entities";
import { clsx } from "clsx";

const fieldClass = "min-h-11 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

async function filesToPaths(files: FileList | null): Promise<string[]> {
  if (!files?.length) return [];
  const paths: string[] = [];
  for (const file of Array.from(files)) {
    const uploaded = await unwrap(useCases.customerExperience.uploadServiceImage(file));
    paths.push(uploaded.path);
  }
  return paths;
}

export default function CustomerExperiencePage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState("");
  const [publish, setPublish] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [beforeFiles, setBeforeFiles] = useState<FileList | null>(null);
  const [afterFiles, setAfterFiles] = useState<FileList | null>(null);
  const [referenceFiles, setReferenceFiles] = useState<FileList | null>(null);
  const [fileEpoch, setFileEpoch] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingReview, setSavingReview] = useState(false);
  const [savingFile, setSavingFile] = useState(false);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId),
    [customers, selectedCustomerId],
  );

  async function load() {
    setLoading(true);
    setLoadError(null);
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
    } catch (error) {
      setLoadError(formatError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function addReview() {
    if (!selectedCustomerId || savingReview) return;
    setSavingReview(true);
    try {
      await unwrap(useCases.customerExperience.createReview({
        customerId: selectedCustomerId,
        rating,
        comment,
        isPublished: publish,
      }));
      setComment("");
      showToast("success", t("Success"), t("Review added successfully"));
      await load();
    } catch (error) {
      showToast("error", t("Error"), formatError(error));
    } finally {
      setSavingReview(false);
    }
  }

  async function addServiceFile() {
    if (!selectedCustomerId || !title.trim() || savingFile) return;
    setSavingFile(true);
    try {
      const [beforeImages, afterImages, referenceImages] = await Promise.all([
        filesToPaths(beforeFiles),
        filesToPaths(afterFiles),
        filesToPaths(referenceFiles),
      ]);
      await unwrap(useCases.customerExperience.createServiceFile({
        customerId: selectedCustomerId,
        title: title.trim(),
        note: note.trim() || undefined,
        beforeImages,
        afterImages,
        referenceImages,
      }));
      setTitle("");
      setNote("");
      setBeforeFiles(null);
      setAfterFiles(null);
      setReferenceFiles(null);
      setFileEpoch((epoch) => epoch + 1);
      showToast("success", t("Success"), t("Service file added successfully"));
      await load();
    } catch (error) {
      const raw = formatError(error);
      const photoHint = raw === "validation.logo_type" || /photo|image|storage|bucket|2\s*MB/i.test(raw);
      showToast("error", t("Error"), photoHint ? t("Photo must be an image under 2MB") : (raw || t("Photo must be an image under 2MB")));
    } finally {
      setSavingFile(false);
    }
  }

  const customerReviews = reviews.filter((review) => review.customerId === selectedCustomerId);
  const customerFiles = files.filter((file) => file.customerId === selectedCustomerId);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        icon={<MessageSquareHeart className="h-7 w-7" />}
        title={t("Customer Experience")}
        subtitle={selectedCustomer?.name}
      />

      <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        {t("Record what the customer said after a visit, and keep photos in their file. This is the center's record, not a public website.")}
      </p>

      <label className="block space-y-1.5 max-w-lg">
        <span className="text-xs font-bold text-muted-foreground">{t("Choose customer")}</span>
        <select className={fieldClass} value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}>
          <option value="">{t("Choose customer")}</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
      </label>

      {loadError ? (
        <ListState loading={false} error={loadError} empty={false} onRetry={() => void load()} errorTitle={t("Failed to load experience")} emptyTitle={t("No reviews yet")} />
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3"><Star className="h-4 w-4 text-primary" /><h2 className="font-bold">{t("Add Review")}</h2></div>
        <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label={t("Add Review")}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className={clsx("h-11 w-11 rounded-xl border flex items-center justify-center", rating >= value ? "border-warning bg-warning/15 text-warning" : "border-border text-muted-foreground")}
              aria-pressed={rating >= value}
              aria-label={String(value)}
            >
              <Star className="h-4 w-4" fill={rating >= value ? "currentColor" : "none"} />
            </button>
          ))}
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-muted-foreground">{t("Customer feedback")}</span>
          <input className={fieldClass} value={comment} onChange={(event) => setComment(event.target.value)} />
        </label>
        <label className="mt-3 flex items-center gap-2 min-h-11 text-sm font-bold">
          <input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} className="h-4 w-4" />
          {t("Show in customer file")}
        </label>
        <button type="button" onClick={() => void addReview()} disabled={savingReview || !selectedCustomerId} className="mt-3 min-h-11 px-4 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50">
          {savingReview ? t("Processing...") : t("Save Review")}
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3"><ImagePlus className="h-4 w-4 text-primary" /><h2 className="font-bold">{t("Service File & Before/After")}</h2></div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">{t("Session title")}</span>
            <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">{t("Session notes")}</span>
            <input className={fieldClass} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">{t("Before photos")}</span>
            <input key={`before-${fileEpoch}`} className={fieldClass} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setBeforeFiles(event.target.files)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">{t("After photos")}</span>
            <input key={`after-${fileEpoch}`} className={fieldClass} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setAfterFiles(event.target.files)} />
          </label>
          <label className="block space-y-1.5 md:col-span-2">
            <span className="text-xs font-bold text-muted-foreground">{t("Reference photos")}</span>
            <input key={`reference-${fileEpoch}`} className={fieldClass} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setReferenceFiles(event.target.files)} />
          </label>
        </div>
        <button type="button" onClick={() => void addServiceFile()} disabled={savingFile || !selectedCustomerId || !title.trim()} className="mt-3 min-h-11 px-4 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50">
          {savingFile ? t("Processing...") : t("Save Service File")}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 font-bold">{t("Reviews")}</h2>
          <div className="space-y-3">
            {customerReviews.map((review) => (
              <div key={review.id} className="rounded-xl border border-border p-3 text-sm">
                <p className="font-semibold">{Array.from({ length: review.rating }).map((_, index) => "★").join("")}</p>
                <p className="text-muted-foreground">{review.comment || "—"}</p>
              </div>
            ))}
            <ListState loading={loading && customerReviews.length === 0} error={null} empty={customerReviews.length === 0} onRetry={() => void load()} loadingTitle={t("Loading experience...")} errorTitle={t("Failed to load experience")} emptyTitle={t("No reviews yet")} compact />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 font-bold">{t("Service Files")}</h2>
          <div className="space-y-3">
            {customerFiles.map((file) => (
              <div key={file.id} className="rounded-xl border border-border p-3 text-sm space-y-2">
                <p className="font-semibold">{file.title}</p>
                <p className="text-muted-foreground">{file.note || "—"}</p>
                <div className="flex flex-wrap gap-2">
                  {(file.images || []).map((image: any) => (
                    image.imageUrl?.startsWith("http") || image.imageUrl?.startsWith("blob:") || image.imageUrl?.startsWith("data:") ? (
                      <img key={image.id} src={image.imageUrl} alt={t(image.imageKind === "BEFORE" ? "Before" : image.imageKind === "AFTER" ? "After" : "Reference")} className="h-20 w-20 rounded-lg object-cover border border-border" />
                    ) : (
                      <span key={image.id} className="rounded-full bg-muted px-2 py-1 text-xs">{t(image.imageKind === "BEFORE" ? "Before" : image.imageKind === "AFTER" ? "After" : "Reference")}</span>
                    )
                  ))}
                </div>
              </div>
            ))}
            <ListState loading={loading && customerFiles.length === 0} error={null} empty={customerFiles.length === 0} onRetry={() => void load()} loadingTitle={t("Loading experience...")} errorTitle={t("Failed to load experience")} emptyTitle={t("No service files yet")} compact />
          </div>
        </div>
      </div>
    </div>
  );
}
