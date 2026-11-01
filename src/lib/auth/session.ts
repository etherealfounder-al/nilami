import "server-only";
import { cookies } from "next/headers";
import { api, ApiError } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";

export { SESSION_COOKIE } from "@/lib/auth/session-cookie";

/**
 * The browser's half of a session.
 *
 * The session itself is a row in the API's database; this cookie only carries
 * the opaque token that names it. Nothing here decides anything about
 * identity — it relays a value the API issued and the API verifies.
 *
 * The cookie is set on this origin rather than the API's, because the two are
 * different sites today: a cookie the API set would be third-party, which
 * Safari refuses outright. Once both are served from one origin this file
 * becomes unnecessary and the API's own cookie is the only one.
 */
type LoginResponse = { token: string; expires_at: string };

/** The token to relay to the API, or null when nobody is signed in. */
export async function sessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Exchanges a password for a session.
 *
 * The password travels from this server to the API and is never stored. The
 * API's refusals are already written for a person to read — wrong credentials,
 * not yet approved, too many attempts — so they are passed through rather than
 * replaced with a message of our own that would say less.
 */
export async function signIn(
  email: string,
  password: string
): Promise<{ error: string } | null> {
  let session: LoginResponse;
  try {
    session = await api<LoginResponse>("/v1/auth/login", {
      method: "POST",
      body: { email, password },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }

  const expires = new Date(session.expires_at);
  (await cookies()).set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
  return null;
}

/**
 * Ends the session on the server as well as in this browser.
 *
 * The API call comes first and its failure is swallowed: a user who pressed
 * sign out must end up signed out of this browser whatever the network did,
 * and a session row that outlives the cookie expires on its own.
 */
export async function signOutSession(): Promise<void> {
  const token = await sessionToken();
  if (token) {
    try {
      await api("/v1/auth/logout", { method: "POST", authenticated: true });
    } catch {
      // Deliberately ignored; the cookie goes regardless.
    }
  }
  (await cookies()).delete(SESSION_COOKIE);
}
