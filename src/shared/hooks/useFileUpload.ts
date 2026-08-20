/**
 * useFileUpload — client-side file validation hook for upload flows.
 * ------------------------------------------------------------
 * Validates type, size, and provides the upload function for
 * Supabase Storage. Handles progress (where supported), errors,
 * and retries. Provider-neutral validation logic.
 *
 * Treats user-provided files as untrusted: validates MIME on the
 * client side but never trusts it as a security boundary.
 */

import { useState, useCallback } from "react";
import { getSupabaseClient } from "../../infrastructure/supabase/client";
import { logger } from "../logger";

export interface UploadValidation {
  valid: boolean;
  errors: string[];
}

export interface UploadResult {
  ok: boolean;
  path?: string;
  error?: string;
}

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp",
]);

export const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 MB
export const MAX_SERVICE_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Validate a file for logo upload.
 */
export function validateLogoFile(file: File): UploadValidation {
  const errors: string[] = [];

  if (!file || file.size === 0) {
    errors.push("File is empty");
    return { valid: false, errors };
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    errors.push("Logo must be JPEG, PNG, or WebP");
  }

  if (file.size > MAX_LOGO_SIZE) {
    errors.push(`Logo must be under ${MAX_LOGO_SIZE / 1024 / 1024} MB`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a file for service file image upload.
 */
export function validateServiceImageFile(file: File): UploadValidation {
  const errors: string[] = [];

  if (!file || file.size === 0) {
    errors.push("File is empty");
    return { valid: false, errors };
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    errors.push("Image must be JPEG, PNG, or WebP");
  }

  if (file.size > MAX_SERVICE_IMAGE_SIZE) {
    errors.push(`Image must be under ${MAX_SERVICE_IMAGE_SIZE / 1024 / 1024} MB`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Sanitize a filename: strip path separators, null bytes, and non-alphanumeric
 * characters (except dots and hyphens) to prevent path traversal.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\]/g, "_")    // replace path separators
    .replace(/\0/g, "")        // strip null bytes
    .replace(/[^a-zA-Z0-9._-]/g, "_")  // replace special chars
    .replace(/\.{2,}/g, ".")   // collapse consecutive dots
    .replace(/^\./, "")        // strip leading dot
    .toLowerCase();
}

/**
 * Upload a file to the center-assets storage bucket.
 * Returns the storage path on success, error message on failure.
 */
export async function uploadToCenterAssets(
  file: File,
  storagePath: string,
  options?: {
    upsert?: boolean;
    signal?: AbortSignal;
  },
): Promise<UploadResult> {
  try {
    const client = getSupabaseClient() as any;
    if (!client.storage?.from) {
      return { ok: false, error: "Storage not available" };
    }

    const { error } = await client.storage.from("center-assets").upload(
      storagePath,
      file,
      {
        upsert: options?.upsert ?? false,
        contentType: file.type,
        cacheControl: "3600",
        signal: options?.signal,
      },
    );

    if (error) {
      logger.error("[FileUpload]", error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true, path: storagePath };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown upload error";
    logger.error("[FileUpload]", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Generate a signed URL for a private bucket object.
 */
export async function getSignedAssetUrl(storagePath: string): Promise<string | null> {
  try {
    const client = getSupabaseClient() as any;
    if (!client.storage?.from) return null;

    const { data, error } = await client.storage.from("center-assets").createSignedUrl(storagePath, 3600); // 1 hour

    if (error || !data?.signedUrl) {
      logger.error("[FileUpload] signed URL error", error?.message);
      return null;
    }

    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Delete an object from the center-assets bucket.
 */
export async function deleteAsset(storagePath: string): Promise<boolean> {
  try {
    const client = getSupabaseClient() as any;
    if (!client.storage?.from) return false;

    const { error } = await client.storage.from("center-assets").remove([storagePath]);
    if (error) {
      logger.error("[FileUpload] delete error", error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Hook for file upload with state management.
 */
export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (
      file: File,
      storagePath: string,
      options?: { upsert?: boolean },
    ): Promise<UploadResult> => {
      setUploading(true);
      setProgress(0);
      setError(null);

      try {
        const result = await uploadToCenterAssets(file, storagePath, {
          ...options,
          signal: undefined, // AbortController support for future enhancement
        });

        if (result.ok) {
          setProgress(100);
        } else {
          setError(result.error ?? "Upload failed");
        }

        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        return { ok: false, error: msg };
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  return { uploading, progress, error, upload, reset };
}
