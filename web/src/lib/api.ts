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
