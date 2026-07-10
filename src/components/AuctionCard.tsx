import Image from "next/image";
import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { StatusBadge } from "@/components/StatusBadge";
import { nprCompact, typeLabel } from "@/lib/format";
import { dictionaries, orgName, type Lang } from "@/lib/i18n/dictionaries";
import type { Auction, Property } from "@/lib/types";

export function AuctionCard({
  auction,
  property,
  index = 0,
  lang = "en",
}: {
  auction: Auction;
  property: Property;
  index?: number;
  lang?: Lang;
}) {
  const t = dictionaries[lang];
  const cover = property.images?.[0];
  return (
    <Link
      href={`/auctions/${property.slug}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift rise rise-${(index % 3) + 1}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-parchment">
        {cover && (
          <Image
            src={cover.url}
            alt={cover.alt || property.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <StatusBadge status={auction.status} lang={lang} />
          <span className="rounded-full bg-ink/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-ivory backdrop-blur-sm">
            {typeLabel(property.type, lang)}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">
            {property.municipality}, {property.district}
          </p>
          <h3 className="font-display mt-1 text-xl font-semibold leading-snug text-evergreen-900 group-hover:text-evergreen-700">
            {property.title}
          </h3>
          {property.organization && (
            <p className="mt-1 text-xs font-medium text-brass-600">
              {orgName(property.organization, lang)}
            </p>
          )}
        </div>
        <div className="rule" />
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-soft">
              {t.common.minimumBid}
            </p>
            <p className="font-display text-2xl font-semibold text-evergreen-800">
              {nprCompact(auction.minimum_bid, lang)}
              <span className="ml-1 text-xs font-normal text-ink-soft">
                {t.common.npr}
              </span>
            </p>
          </div>
          {auction.status === "open" ? (
            <Countdown deadline={auction.submission_deadline} lang={lang} />
          ) : auction.status === "sold" && auction.winning_amount ? (
            <span className="text-sm font-medium text-brass-600">
              {t.common.soldDot} · {nprCompact(auction.winning_amount, lang)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
