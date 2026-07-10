export type PropertyType = "land" | "house" | "apartment" | "commercial";
export type AuctionStatus =
  | "draft"
  | "upcoming"
  | "open"
  | "closed"
  | "sold"
  | "cancelled";
export type DepositStatus = "pending" | "verified" | "rejected" | "refunded";

export interface Organization {
  id: string;
  slug: string;
  name: string;
  name_np: string;
  logo_url: string | null;
  contact_email: string;
  contact_phone: string;
  address: string;
  address_np: string;
}

export interface PropertyImage {
  id: string;
  property_id: string;
  url: string;
  alt: string;
  sort_order: number;
}

export interface Property {
  id: string;
  slug: string;
  title: string;
  type: PropertyType;
  province: string;
  district: string;
  municipality: string;
  ward: number | null;
  address: string;
  land_area_aana: number | null;
  land_area_sqm: number | null;
  building_floors: number | null;
  built_year: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  road_access: string | null;
  facing: string | null;
  description: string;
  loan_ref: string;
  organization_id: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  images?: PropertyImage[];
  organization?: Organization;
}

export interface Auction {
  id: string;
  property_id: string;
  round: number;
  notice_number: string;
  published_date: string | null;
  submission_deadline: string;
  opening_datetime: string;
  opening_venue: string;
  appraised_value: number;
  minimum_bid: number;
  bid_security_amount: number;
  bid_security_pct: number | null;
  terms: string;
  required_documents: string;
  notice_pdf_url: string | null;
  status: AuctionStatus;
  winning_amount: number | null;
  result_note: string | null;
  created_at: string;
  updated_at: string;
  property?: Property;
}

export interface BidderRecord {
  id: string;
  auction_id: string;
  full_name: string;
  phone: string;
  email: string;
  citizenship_no: string;
  deposit_amount: number | null;
  deposit_proof_url: string | null;
  deposit_status: DepositStatus;
  notes: string;
  created_at: string;
  updated_at: string;
  auction?: Auction;
}
