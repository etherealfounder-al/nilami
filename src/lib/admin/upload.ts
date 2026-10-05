import { createUpload } from "@/lib/admin/actions";

/** The image types the API will sign an upload for. */
export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Upload one image straight from the browser to R2.
 *
 * The server only signs the request (for this exact content type, under a key
 * it chooses); the bytes go browser → Cloudflare and never touch our servers.
 * Returns the public CDN URL to store with the record.
 */
export async function uploadImage(
  file: File,
  kind: "property" | "organization"
): Promise<string> {
  if (!(UPLOAD_TYPES as readonly string[]).includes(file.type)) {
    throw new Error("Only JPEG, PNG and WebP images can be uploaded.");
  }
  const { upload_url, public_url } = await createUpload(kind, file.type);
  const res = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`storage refused the upload (${res.status})`);
  return public_url;
}
