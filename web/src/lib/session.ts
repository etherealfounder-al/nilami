import { api, ApiError } from "./api";

export type Viewer = {
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

/** Anonymous and pending are kept apart: they belong on different screens. */
export type SessionState =
  | { status: "anonymous" }
  | { status: "pending" }
  | { status: "active"; viewer: Viewer };

export async function loadSession(): Promise<SessionState> {
  try {
    return { status: "active", viewer: await api<Viewer>("/v1/admin/me") };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return { status: "anonymous" };
    if (e instanceof ApiError && e.status === 403) return { status: "pending" };
    throw e;
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  await api("/v1/auth/login", { method: "POST", body: { email, password } });
}

export async function signOut(): Promise<void> {
  await api("/v1/auth/logout", { method: "POST" });
}
