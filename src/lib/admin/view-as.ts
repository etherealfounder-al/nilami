import { cache } from "react";
import { adminApi } from "@/lib/api";

export {
  VIEW_AS_COOKIE,
  VIEW_AS_MAX_AGE,
} from "@/lib/admin/view-as-cookie";

export type ViewAsTarget = {
  id: string;
  fullName: string;
  email: string;
  organizationId: string | null;
  organizationName: string;
};

export type Viewer = {
  userId: string;
  organizationId: string | null;
  isPlatformAdmin: boolean;
  /** Set while a platform admin is proxying into another staff member. */
  viewingAs: ViewAsTarget | null;
  /** The institutions this viewer may act on, for the picker. */
  organizations: { id: string; name: string }[];
};

type ViewerResponse = {
  user_id: string;
  organization_id: string | null;
  is_platform_admin: boolean;
  viewing_as: {
    id: string;
    full_name: string;
    email: string;
    organization_id: string | null;
    organization_name: string;
  } | null;
  organizations: { id: string; name: string }[];
};

/**
 * Who is signed in, whose view they are seeing, and what they may act on.
 *
 * All three come from one request, so they cannot disagree. The API resolves
 * them from the verified token and from the view-as header it relays — this
 * process asserts nothing about identity, it only carries the proof.
 *
 * Cached per request, so a layout and the page inside it cost one call.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  let data: ViewerResponse;
  try {
    data = await adminApi<ViewerResponse>("/v1/admin/me");
  } catch {
    // Not signed in, not approved, or the API is unreachable. The panel's own
    // guards decide what to show; there is no viewer either way.
    return null;
  }
  return {
    userId: data.user_id,
    organizationId: data.organization_id,
    isPlatformAdmin: data.is_platform_admin,
    organizations: data.organizations,
    viewingAs: data.viewing_as && {
      id: data.viewing_as.id,
      fullName: data.viewing_as.full_name,
      email: data.viewing_as.email,
      organizationId: data.viewing_as.organization_id,
      organizationName: data.viewing_as.organization_name,
    },
  };
});

/**
 * The account actually signed in, ignoring any proxy.
 *
 * The security boundary that used to live here now lives in the API: the
 * view-as header is only ever honoured for a real approved platform
 * administrator, so setting it by hand can never widen anyone's access.
 */
export const getRealViewer = cache(async (): Promise<Viewer | null> => getViewer());

/** The staff member whose view is being rendered, or null. */
export const getViewAsTarget = cache(
  async (): Promise<ViewAsTarget | null> => (await getViewer())?.viewingAs ?? null
);
