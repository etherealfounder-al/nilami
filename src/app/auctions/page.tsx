import type { Metadata } from "next";
import Link from "next/link";
import { AuctionCard } from "@/components/AuctionCard";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { orgName } from "@/lib/i18n/dictionaries";
import { getT } from "@/lib/i18n/server";
import { isMobileRequest } from "@/lib/device";
import {
  DEFAULT_PAGE_SIZE_DESKTOP,
  DEFAULT_PAGE_SIZE_MOBILE,
  listingHref,
  PAGE_SIZES,
  parsePage,
  parsePageSize,
} from "@/lib/pagination";
import { getAuctionsPage } from "@/lib/queries";

export const metadata: Metadata = { title: "Auctions" };

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    type?: string;
    district?: string;
    org?: string;
    q?: string;
    page?: string;
    size?: string;
  }>;
}) {
  const { lang, t } = await getT();
  const params = await searchParams;
  // Twelve per page on a desktop grid, six on a phone's single column.
  const defaultSize = (await isMobileRequest())
    ? DEFAULT_PAGE_SIZE_MOBILE
    : DEFAULT_PAGE_SIZE_DESKTOP;
  const size = parsePageSize(params.size, defaultSize);

  // One request for the page: the cards, the total, and the values behind the
  // filter controls. This was three calls, and the first of them fetched every
  // non-draft auction in the table so the rest could be filtered out in
  // JavaScript afterwards.
  const {
    items,
    total,
    districts,
    organizations: orgs,
  } = await getAuctionsPage({
    ...params,
    size,
    page: parsePage(params.page, Infinity),
  });

  const TYPES = [
    { v: "", l: t.listing.allTypes },
    { v: "land", l: t.common.types.land },
    { v: "house", l: t.common.types.house },
    { v: "apartment", l: t.common.types.apartment },
    { v: "commercial", l: t.common.types.commercial },
  ];
  const STATUSES = [
    { v: "", l: t.listing.anyStatus },
    { v: "open", l: t.common.statuses.open },
    { v: "upcoming", l: t.common.statuses.upcoming },
    { v: "closed", l: t.common.statuses.closed },
    { v: "sold", l: t.common.statuses.sold },
  ];

  // Paging is the API's now; what is left is the arithmetic the controls need.
  const totalPages = Math.ceil(total / size);
  const page = parsePage(params.page, totalPages);
  const from = (page - 1) * size;
  const pageItems = items;

  // Paging params must not make the "Clear" link appear.
  const active = Object.entries(params).filter(
    ([k, v]) => v && k !== "page" && k !== "size"
  );
  const showSizeSelect = total > PAGE_SIZES[0] || size !== defaultSize;
  // Clearing drops the filters and the page, but keeps the reader's page size.
  const clearHref = listingHref(
    "/auctions",
    {},
    { size: size === defaultSize ? undefined : String(size) }
  );
  const selectCls =
    "h-11 w-full rounded-xl border border-ink/12 bg-ivory px-3 text-sm outline-none focus:border-evergreen-600 sm:w-auto";

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-5 pb-24">
        <div className="py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-600">
            {t.listing.kicker}
          </p>
          <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-evergreen-900 sm:text-5xl">
            {t.listing.title}
          </h1>
          <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">
            {t.listing.sub}
          </p>
        </div>

        {/* Filters */}
        <form
          method="GET"
          className="mb-10 flex flex-wrap items-center gap-3 rounded-2xl border border-ink/8 bg-white p-4 shadow-card"
        >
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={t.listing.searchPlaceholder}
            className="h-11 w-full flex-1 rounded-xl border border-ink/12 bg-ivory px-4 text-sm outline-none transition-colors focus:border-evergreen-600 sm:w-auto sm:min-w-52"
          />
          <select name="type" defaultValue={params.type ?? ""} className={selectCls}>
            {TYPES.map((o) => (
              <option key={o.v} value={o.v}>{o.l}</option>
            ))}
          </select>
          <select name="district" defaultValue={params.district ?? ""} className={selectCls}>
            <option value="">{t.listing.allDistricts}</option>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select name="org" defaultValue={params.org ?? ""} className={selectCls}>
            <option value="">{t.listing.allOrgs}</option>
            {orgs.map((o) => (
              <option key={o.slug} value={o.slug}>{orgName(o, lang)}</option>
            ))}
          </select>
          <select name="status" defaultValue={params.status ?? ""} className={selectCls}>
            {STATUSES.map((o) => (
              <option key={o.v} value={o.v}>{o.l}</option>
            ))}
          </select>
          {/* Applying filters starts over at page 1, but keeps the page size. */}
          {size !== defaultSize && (
            <input type="hidden" name="size" value={size} />
          )}
          <button
            type="submit"
            className="h-11 w-full rounded-xl bg-evergreen-800 px-6 text-sm font-semibold text-ivory transition-colors hover:bg-evergreen-700 sm:w-auto"
          >
            {t.listing.apply}
          </button>
          {active.length > 0 && (
            <Link
              href={clearHref}
              className="text-sm font-medium text-ink-soft underline-offset-4 hover:underline"
            >
              {t.listing.clear}
            </Link>
          )}
        </form>

        {total === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 bg-cream/60 p-16 text-center">
            <p className="font-display text-2xl text-evergreen-900">
              {t.listing.emptyTitle}
            </p>
            <p className="mt-2 text-ink-soft">{t.listing.emptySub}</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-ink-soft">
                {totalPages > 1
                  ? t.listing.showing(from + 1, from + pageItems.length, total)
                  : t.listing.count(total)}
              </p>
              {showSizeSelect && (
                <PageSizeSelect
                  basePath="/auctions"
                  params={params}
                  size={size}
                  sizes={PAGE_SIZES}
                  lang={lang}
                />
              )}
            </div>
            {/* On a phone the control sits above the cards, where it is
                reachable without scrolling the whole page first. */}
            <Pagination
              basePath="/auctions"
              params={params}
              page={page}
              totalPages={totalPages}
              lang={lang}
              variant="compact"
              className="mb-8 flex sm:hidden"
            />

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {pageItems.map((a, i) => (
                <AuctionCard
                  key={a.id}
                  auction={a}
                  property={a.property}
                  index={i}
                  lang={lang}
                />
              ))}
            </div>
            <Pagination
              basePath="/auctions"
              params={params}
              page={page}
              totalPages={totalPages}
              lang={lang}
              className="mt-14 hidden sm:flex"
            />
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
