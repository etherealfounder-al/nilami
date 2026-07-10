import { statusLabel } from "@/lib/format";
import type { Lang } from "@/lib/i18n/dictionaries";
import type { AuctionStatus } from "@/lib/types";

const styles: Record<AuctionStatus, string> = {
  draft: "bg-ink/8 text-ink-soft",
  upcoming: "bg-brass-100 text-brass-600",
  open: "bg-evergreen-100 text-evergreen-700",
  closed: "bg-ink/8 text-ink-soft",
  sold: "bg-evergreen-800 text-ivory",
  cancelled: "bg-danger-soft text-danger",
};

export function StatusBadge({
  status,
  lang = "en",
}: {
  status: AuctionStatus;
  lang?: Lang;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${styles[status]}`}
    >
      {status === "open" && (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-evergreen-600 opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-evergreen-600" />
        </span>
      )}
      {statusLabel(status, lang)}
    </span>
  );
}
