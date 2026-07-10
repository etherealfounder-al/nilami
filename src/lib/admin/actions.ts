"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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
  const supabase = await createClient();
  const id = (formData.get("id") as string) || null;
  const title = (formData.get("title") as string).trim();

  const row = {
    title,
    slug: (formData.get("slug") as string)?.trim() || slugify(title),
    type: formData.get("type") as string,
    province: (formData.get("province") as string).trim(),
    district: (formData.get("district") as string).trim(),
    municipality: (formData.get("municipality") as string).trim(),
    ward: num(formData.get("ward")),
    address: ((formData.get("address") as string) ?? "").trim(),
    land_area_aana: num(formData.get("land_area_aana")),
    land_area_sqm: num(formData.get("land_area_sqm")),
    building_floors: num(formData.get("building_floors")),
    built_year: num(formData.get("built_year")),
    bedrooms: num(formData.get("bedrooms")),
    bathrooms: num(formData.get("bathrooms")),
    road_access: ((formData.get("road_access") as string) ?? "").trim() || null,
    facing: ((formData.get("facing") as string) ?? "").trim() || null,
    description: ((formData.get("description") as string) ?? "").trim(),
    loan_ref: ((formData.get("loan_ref") as string) ?? "").trim(),
    is_published: formData.get("is_published") === "on",
  };

  let propertyId = id;
  if (id) {
    const { error } = await supabase.from("properties").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("properties")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    propertyId = data.id;
  }

  // Replace image set from submitted URL list
  const urls = ((formData.get("image_urls") as string) ?? "")
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean);
  await supabase.from("property_images").delete().eq("property_id", propertyId);
  if (urls.length) {
    const { error } = await supabase.from("property_images").insert(
      urls.map((url, i) => ({
        property_id: propertyId,
        url,
        alt: title,
        sort_order: i,
      }))
    );
    if (error) throw new Error(error.message);
  }

  revalidateAll();
  redirect("/admin/properties");
}

export async function deleteProperty(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function upsertAuction(formData: FormData) {
  const supabase = await createClient();
  const id = (formData.get("id") as string) || null;
  const minimum = num(formData.get("minimum_bid")) ?? 0;
  const pct = num(formData.get("bid_security_pct")) ?? 10;

  const row = {
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

  if (id) {
    const { error } = await supabase.from("auctions").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("auctions").insert(row);
    if (error) throw new Error(error.message);
  }
  revalidateAll();
  redirect("/admin/auctions");
}

export async function setAuctionStatus(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("auctions")
    .update({ status: formData.get("status") as string })
    .eq("id", formData.get("id") as string);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function addBidder(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("bidder_records").insert({
    auction_id: formData.get("auction_id") as string,
    full_name: (formData.get("full_name") as string).trim(),
    phone: ((formData.get("phone") as string) ?? "").trim(),
    email: ((formData.get("email") as string) ?? "").trim(),
    citizenship_no: ((formData.get("citizenship_no") as string) ?? "").trim(),
    deposit_amount: num(formData.get("deposit_amount")),
    notes: ((formData.get("notes") as string) ?? "").trim(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/bidders");
}

export async function setBidderStatus(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("bidder_records")
    .update({ deposit_status: formData.get("deposit_status") as string })
    .eq("id", formData.get("id") as string);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/bidders");
}

export async function deleteBidder(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("bidder_records")
    .delete()
    .eq("id", formData.get("id") as string);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/bidders");
}
