import { adminApi } from "@/lib/api";
import type { Auction, Organization, Property, PropertyImage } from "@/lib/types";

/**
 * The admin panel's reads.
 *
 * None of these takes an institution. The API resolves the caller's scope from
 * their token and applies it in SQL, so there is no filter here for a page to
 * forget — which is what the old getAdminScope() required of every query.
 */

export type DashboardSummary = {
  properties: number;
  published: number;
  auctions: number;
  open: number;
  closing_soon: number;
  bidders: number;
  pending_deposits: number;
  recent: {
    id: string;
    notice_number: string;
    status: string;
    submission_deadline: string;
    updated_at: string;
    title: string;
    slug: string;
  }[];
};

export const getDashboard = () =>
  adminApi<DashboardSummary>("/v1/admin/dashboard");

export type AdminPropertyRow = {
  id: string;
  slug: string;
  title: string;
  type: string;
  district: string;
  municipality: string;
  is_published: boolean;
  created_at: string;
  organization_id: string;
  organization_name: string;
  image_count: number;
  cover_url: string | null;
  auction_count: number;
  view_count: number;
};

export const getAdminProperties = () =>
  adminApi<AdminPropertyRow[]>("/v1/admin/properties");

export type AdminAuctionRow = {
  id: string;
  notice_number: string;
  round: number;
  status: string;
  /** Corrected for a deadline that has passed; see the public index. */
  display_status: string;
  submission_deadline: string;
  opening_datetime: string;
  minimum_bid: number;
  winning_amount: number | null;
  updated_at: string;
  property: {
    id: string;
    slug: string;
    title: string;
    district: string;
    is_published: boolean;
    view_count: number;
  };
  organization_name: string;
  bidder_count: number;
};

export const getAdminAuctions = () =>
  adminApi<AdminAuctionRow[]>("/v1/admin/auctions");

export const getAdminProperty = (id: string) =>
  adminApi<Property & { images: PropertyImage[] }>(
    `/v1/admin/properties/${encodeURIComponent(id)}`
  );

export const getAdminAuction = (id: string) =>
  adminApi<Auction & { property: Pick<Property, "id" | "slug" | "title" | "district" | "is_published"> }>(
    `/v1/admin/auctions/${encodeURIComponent(id)}`
  );

export type BidderRecord = {
  id: string;
  auction_id: string;
  full_name: string;
  phone: string;
  email: string;
  citizenship_no: string;
  deposit_amount: number | null;
  deposit_proof_url: string | null;
  deposit_status: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export const getBidders = (auctionId: string) =>
  adminApi<BidderRecord[]>(
    `/v1/admin/auctions/${encodeURIComponent(auctionId)}/bidders`
  );

export type StaffRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  approved: boolean;
  created_at: string;
  organization_id: string | null;
  organization_name: string | null;
  /** Null for a platform admin, who belongs to no institution. */
  organization_approved: boolean | null;
};

export const getStaff = () => adminApi<StaffRow[]>("/v1/admin/staff");

/**
 * The institution to edit. A platform admin may name one; staff always get
 * their own, whichever id they ask for.
 */
export const getInstitution = (requested?: string) =>
  adminApi<Organization | null>(
    `/v1/admin/institution${requested ? `?org=${encodeURIComponent(requested)}` : ""}`
  );

export const getInstitutionOptions = () =>
  adminApi<{ id: string; name: string; slug: string; approved: boolean }[]>(
    "/v1/admin/institutions"
  );
