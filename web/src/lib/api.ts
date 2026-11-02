/**
 * Who the panel is currently viewing as, if anyone.
 *
 * Kept in sessionStorage rather than a cookie or the URL: it belongs to this
 * tab and this sitting, it must not follow a shared link, and it must not
 * outlive the window — a platform administrator who closes the tab should come
 * back as themselves. Every read is guarded, because storage throws in a
 * private window rather than returning nothing.
 */
const VIEW_AS_KEY = "nilami.viewAs";

export function viewAsTarget(): string | null {
  try {
    return sessionStorage.getItem(VIEW_AS_KEY);
  } catch {
    return null;
  }
}

export function setViewAsTarget(id: string | null) {
  try {
    if (id) sessionStorage.setItem(VIEW_AS_KEY, id);
    else sessionStorage.removeItem(VIEW_AS_KEY);
  } catch {
    // A panel that cannot remember is still usable; it simply stays itself.
  }
}

/**
 * The browser's client for the Nilami API.
 *
 * Same origin, so there is no base URL, no CORS and no token to carry: the
 * session cookie is httpOnly and the browser attaches it. Nothing in this file
 * can read the session, which is the point — a script that runs on this page
 * has no credential to steal.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  // Viewing as a member of staff.
  //
  // The server has always honoured this header and narrows the scope to that
  // account — only for a platform administrator, and only ever downward, which
  // a query test asserts. Nothing in the app sent it, so the panel could read
  // who it was proxying as and never say who that should be.
  const asStaff = viewAsTarget();
  if (asStaff) headers["X-View-As"] = asStaff;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
    // Explicit rather than relying on the default: this is the whole
    // authentication mechanism, and a future change to the default should not
    // silently sign everyone out.
    credentials: "same-origin",
  });

  if (response.status === 204) return undefined as T;

  if (!response.ok) {
    // The API answers with { error } whose message is safe to show; anything
    // else it logs itself rather than echoing to a browser.
    const detail = await response.text().catch(() => "");
    let message = detail || response.statusText;
    try {
      const parsed = JSON.parse(detail) as { error?: unknown };
      if (typeof parsed.error === "string") message = parsed.error;
    } catch {
      // Not JSON; keep the raw text.
    }
    throw new ApiError(response.status, message);
  }
  return (await response.json()) as T;
}
