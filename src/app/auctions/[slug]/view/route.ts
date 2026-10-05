import { cookies, headers } from "next/headers";
import { decodeSlug } from "@/lib/slug";
import { recordPropertyView } from "@/lib/queries";

/**
 * Records one view of a listing. Called once per page load by <ViewCount />.
 *
 * Counting happens here rather than while rendering the detail page for two
 * reasons: a Server Component may not set cookies (so it could not remember a
 * visitor), and Next prefetches page payloads, which would inflate the count.
 */

const COOKIE = "pv";
/** How long before the same visitor counts again for the same listing. */
const WINDOW_SECONDS = 6 * 60 * 60;

const BOT =
  /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|embedly|quora link preview|headlesschrome|lighthouse|preview|pingdom|monitor/i;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await params;
  // Decoded for the lookup; the cookie keeps the raw segment so its path
  // matches the URL the browser actually requests.
  const slug = decodeSlug(rawSlug);

  const ua = (await headers()).get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return Response.json({ counted: false });

  // The cookie is scoped to this listing's path, so it is only ever sent back
  // on requests for this listing instead of riding along on every request.
  const path = `/auctions/${rawSlug}`;
  const jar = await cookies();
  if (jar.get(COOKIE)) return Response.json({ counted: false });

  let views: number | null;
  try {
    views = await recordPropertyView(slug);
  } catch (cause) {
    console.error(`recording a view of ${slug} failed:`, cause);
    return Response.json({ counted: false }, { status: 500 });
  }
  // null means no published property carries this slug.
  if (views == null) return Response.json({ counted: false }, { status: 404 });

  jar.set(COOKIE, "1", {
    path,
    maxAge: WINDOW_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return Response.json({ counted: true, views });
}
