import { createClient } from "@/lib/supabase/server";

/**
 * The client for the Nilami API.
 *
 * Both values are deliberately *not* NEXT_PUBLIC_: only the Next.js server
 * talks to the API, so neither the hostname nor the credential is ever shipped
 * to a browser. That is what lets the API trust a single shared token — the
 * moment either leaked into the bundle, it would stop being a credential and
 * become a public fact, which is exactly how the Supabase anon key left the
 * database reachable from anyone's console.
 */
const BASE = process.env.API_BASE_URL;
const SERVICE_TOKEN = process.env.API_SERVICE_TOKEN;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Thrown when the caller asked for something that does not exist. */
export class NotFoundError extends ApiError {}

type Options = {
  /** Seconds Next may reuse this response. Omit for no caching. */
  revalidate?: number;
  /** Cache tags, so a write can invalidate exactly what it changed. */
  tags?: string[];
  /** Forward the signed-in user's token so the API can scope the response. */
  authenticated?: boolean;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

/**
 * The signed-in user's Supabase access token, or null.
 *
 * getSession is right here, where getUser would be wrong elsewhere: we are not
 * trusting this token, only relaying it. The API verifies the signature itself
 * against Supabase's public keys, so a bug in this process cannot promote
 * anyone — it can only fail to authenticate them.
 */
async function accessToken(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  if (!BASE || !SERVICE_TOKEN) {
    throw new Error(
      "API_BASE_URL and API_SERVICE_TOKEN must be set for the server to reach the API."
    );
  }

  const headers: Record<string, string> = {
    "X-Service-Token": SERVICE_TOKEN,
    Accept: "application/json",
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.authenticated) {
    const token = await accessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  // A page should never hang on a slow link to the VPS; failing in a few
  // seconds and showing an error beats a request that never returns.
  const signal = AbortSignal.timeout(8_000);

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
      // An authenticated response varies per user, so it must never be shared.
      cache: options.authenticated ? "no-store" : undefined,
      next:
        options.authenticated || options.revalidate === undefined
          ? undefined
          : { revalidate: options.revalidate, tags: options.tags },
    });
  } catch (cause) {
    throw new ApiError(503, `API unreachable: ${(cause as Error).message}`);
  }

  if (response.status === 404) {
    throw new NotFoundError(404, "not found");
  }
  if (!response.ok) {
    // The API returns { error } with a message safe to surface; anything else
    // is logged by the API itself rather than echoed to a visitor.
    const detail = await response.text().catch(() => "");
    throw new ApiError(response.status, detail || response.statusText);
  }
  return (await response.json()) as T;
}
