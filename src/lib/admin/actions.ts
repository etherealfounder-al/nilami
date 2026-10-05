"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getRealViewer,
  VIEW_AS_COOKIE,
  VIEW_AS_MAX_AGE,
} from "@/lib/admin/view-as";
import { parseLandArea } from "@/lib/nepal/land-area";
import { joinRoadAccess } from "@/lib/nepal/road-access";
import { getStaff } from "@/lib/admin/queries";
import { adminApi, api } from "@/lib/api";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

function num(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function upsertProperty(formData: FormData) {
  const id = (formData.get("id") as string) || null;
  const title = (formData.get("title") as string).trim();

  // The institution is decided by the API from the caller's token. The form's
  // organization_id is sent, but only a platform administrator's is honoured.
  const organizationId = (formData.get("organization_id") as string) || null;

  // A slug typed into the form is normalised too — stored verbatim it could
  // carry spaces or capitals, which produce a URL the listing page cannot
  // match once Next hands the segment over still percent-encoded.
  const propertySlug =
    slugify((formData.get("slug") as string) ?? "") || slugify(title);
  if (!propertySlug)
    throw new Error(
      "Could not build a slug from the title — please enter one in the Slug field."
    );

  const body = {
    organization_id: organizationId,
    title,
    slug: propertySlug,
    type: formData.get("type") as string,
    province: (formData.get("province") as string).trim(),
    district: (formData.get("district") as string).trim(),
    municipality: (formData.get("municipality") as string).trim(),
    ward: num(formData.get("ward")),
    address: ((formData.get("address") as string) ?? "").trim(),
    land_area_aana: parseLandArea(
      (formData.get("land_area_aana") as string) ?? ""
    ),
    land_area_sqm: num(formData.get("land_area_sqm")),
    building_floors: num(formData.get("building_floors")),
    built_year: num(formData.get("built_year")),
    bedrooms: num(formData.get("bedrooms")),
    bathrooms: num(formData.get("bathrooms")),
    road_access:
      joinRoadAccess(
        (formData.get("road_access_ft") as string) ?? "",
        (formData.get("road_access_note") as string) ?? ""
      ) || null,
    facing: ((formData.get("facing") as string) ?? "").trim() || null,
    description: ((formData.get("description") as string) ?? "").trim(),
    latitude: num(formData.get("latitude")),
    longitude: num(formData.get("longitude")),
    video_url: ((formData.get("video_url") as string) ?? "").trim() || null,
    is_published: formData.get("is_published") === "on",
    // The image set is replaced wholesale, in the same transaction as the row.
    image_urls: ((formData.get("image_urls") as string) ?? "")
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean),
  };

  await adminApi(
    id ? `/v1/admin/properties/${encodeURIComponent(id)}` : "/v1/admin/properties",
    { method: id ? "PUT" : "POST", body }
  );

  revalidateAll();
  redirect("/admin/properties");
}

export async function deleteProperty(formData: FormData) {
  const id = formData.get("id") as string;
  await adminApi(`/v1/admin/properties/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  revalidateAll();
}

export async function upsertAuction(formData: FormData) {
  const id = (formData.get("id") as string) || null;
  const minimum = num(formData.get("minimum_bid")) ?? 0;
  const pct = num(formData.get("bid_security_pct")) ?? 10;

  const body = {
    property_id: formData.get("property_id") as string,
    round: num(formData.get("round")) ?? 1,
    notice_number: ((formData.get("notice_number") as string) ?? "").trim(),
    published_date: (formData.get("published_date") as string) || null,
    submission_deadline: new Date(
      formData.get("submission_deadline") as string
    ).toISOString(),
    opening_datetime: new Date(
      formData.get("opening_datetime") as string
    ).toISOString(),
    opening_venue: ((formData.get("opening_venue") as string) ?? "").trim(),
    appraised_value: num(formData.get("appraised_value")) ?? 0,
    minimum_bid: minimum,
    bid_security_pct: pct,
    bid_security_amount:
      num(formData.get("bid_security_amount")) ??
      Math.round((minimum * pct) / 100),
    terms: ((formData.get("terms") as string) ?? "").trim(),
    required_documents: (
      (formData.get("required_documents") as string) ?? ""
    ).trim(),
    status: formData.get("status") as string,
    winning_amount: num(formData.get("winning_amount")),
    result_note: ((formData.get("result_note") as string) ?? "").trim() || null,
  };

  await adminApi(
    id ? `/v1/admin/auctions/${encodeURIComponent(id)}` : "/v1/admin/auctions",
    { method: id ? "PUT" : "POST", body }
  );
  revalidateAll();
  redirect("/admin/auctions");
}

export async function setAuctionStatus(formData: FormData) {
  const id = formData.get("id") as string;
  await adminApi(`/v1/admin/auctions/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { status: formData.get("status") as string },
  });
  revalidateAll();
}

export async function addBidder(formData: FormData) {
  await adminApi("/v1/admin/bidders", {
    method: "POST",
    body: {
      auction_id: formData.get("auction_id") as string,
      full_name: (formData.get("full_name") as string).trim(),
      phone: ((formData.get("phone") as string) ?? "").trim(),
      email: ((formData.get("email") as string) ?? "").trim(),
      citizenship_no: ((formData.get("citizenship_no") as string) ?? "").trim(),
      deposit_amount: num(formData.get("deposit_amount")),
      notes: ((formData.get("notes") as string) ?? "").trim(),
    },
  });
  revalidatePath("/admin/bidders");
}

export async function setBidderStatus(formData: FormData) {
  const id = formData.get("id") as string;
  await adminApi(`/v1/admin/bidders/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { status: formData.get("deposit_status") as string },
  });
  revalidatePath("/admin/bidders");
}

export async function deleteBidder(formData: FormData) {
  const id = formData.get("id") as string;
  await adminApi(`/v1/admin/bidders/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  revalidatePath("/admin/bidders");
}

export async function approveStaff(formData: FormData) {
  const id = formData.get("id") as string;
  // The API approves the profile and confirms the account with Supabase, so
  // the person can sign in.
  await adminApi(`/v1/admin/staff/${encodeURIComponent(id)}/approve`, {
    method: "POST",
  });
  revalidatePath("/admin/staff");
}

export async function rejectStaff(formData: FormData) {
  const id = formData.get("id") as string;
  // The API deletes the Supabase account first, then the profile.
  await adminApi(`/v1/admin/staff/${encodeURIComponent(id)}/reject`, {
    method: "POST",
  });
  revalidatePath("/admin/staff");
}

/**
 * Proxy login: render the admin panel as another staff member sees it.
 *
 * Only a real platform admin may start one, and only into an approved
 * account. This does not change who is authenticated — the admin stays
 * signed in as themselves and writes still run with their own rights — it
 * changes which institution the panel is scoped to. See getAdminScope().
 */
export async function startViewAs(formData: FormData) {
  const viewer = await getRealViewer();
  if (!viewer?.isPlatformAdmin)
    throw new Error("Only the platform administrator can use proxy login.");

  const targetId = (formData.get("id") as string) || "";
  if (targetId === viewer.userId)
    throw new Error("You are already signed in as that account.");

  // The roster is the platform administrator's full view of every account.
  const target = (await getStaff()).find((p) => p.id === targetId);
  if (!target?.approved)
    throw new Error("That staff account is not approved, so it cannot be proxied into.");

  const store = await cookies();
  store.set(VIEW_AS_COOKIE, target.id as string, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VIEW_AS_MAX_AGE,
  });
  console.info(
    `[view-as] ${viewer.userId} started proxying into ${target.id} (${target.email})`
  );

  revalidatePath("/admin", "layout");
  redirect("/admin");
}

/** End a proxy session. Safe for anyone to call — it only clears their own cookie. */
export async function stopViewAs() {
  const store = await cookies();
  const wasViewing = store.get(VIEW_AS_COOKIE)?.value;
  store.delete(VIEW_AS_COOKIE);

  if (wasViewing) {
    const viewer = await getRealViewer();
    console.info(
      `[view-as] ${viewer?.userId ?? "unknown"} stopped proxying into ${wasViewing}`
    );
  }

  revalidatePath("/admin", "layout");
  redirect("/admin/staff");
}

/**
 * Save an institution's logo, website and contact details.
 *
 * The write goes through update_organization_branding, which re-checks the
 * caller server-side and touches only those columns — staff may edit their own
 * institution, a platform admin any, and neither can rename one or approve it
 * through this path.
 */
export async function updateOrganizationBranding(formData: FormData) {
  await adminApi("/v1/admin/institution", {
    method: "PATCH",
    body: {
      organization_id: (formData.get("organization_id") as string) ?? "",
      logo_url: (formData.get("logo_url") as string) ?? "",
      website: (formData.get("website") as string) ?? "",
      contact_email: (formData.get("contact_email") as string) ?? "",
      contact_phone: (formData.get("contact_phone") as string) ?? "",
      address: (formData.get("address") as string) ?? "",
      address_np: (formData.get("address_np") as string) ?? "",
    },
  });

  // The institution card is rendered on every listing page.
  revalidatePath("/auctions", "layout");
  revalidatePath("/admin/institution");
}

/**
 * A presigned upload for an image the browser then PUTs straight to R2, so
 * the bytes never pass through this server or the API.
 */
export async function createUpload(
  kind: "property" | "organization",
  contentType: string
): Promise<{ upload_url: string; public_url: string }> {
  return adminApi("/v1/admin/uploads", {
    method: "POST",
    body: { kind, content_type: contentType },
  });
}

/**
 * Register an institution from the public signup form. Unauthenticated by
 * design; the API caps and validates it.
 */
export async function requestOrganization(input: {
  name: string;
  name_np: string;
  contact_email: string;
  contact_phone: string;
  address: string;
}): Promise<{ id: string } | { error: string }> {
  try {
    return await api<{ id: string }>("/v1/organizations/requests", {
      method: "POST",
      body: input,
    });
  } catch (e) {
    return { error: (e as Error).message || "Could not register the institution." };
  }
}

/**
 * Create the profile for an account the signup form has just created in
 * Supabase. Only the id is sent: the API reads the account back from Supabase
 * and takes the institution and role from there, so nothing here is trusted.
 */
export async function provisionSignup(userId: string): Promise<{ ok: boolean }> {
  try {
    await api("/v1/pages/signup/profile", {
      method: "POST",
      body: { user_id: userId },
    });
    return { ok: true };
  } catch (e) {
    console.error("[signup] provisioning failed", userId, (e as Error).message);
    return { ok: false };
  }
}
