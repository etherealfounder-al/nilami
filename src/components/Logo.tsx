import Link from "next/link";

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-baseline gap-2.5">
      <span
        aria-hidden
        className={`grid size-8 shrink-0 place-items-center rounded-full border self-center ${
          dark
            ? "border-brass-300/60 text-brass-300"
            : "border-evergreen-800/40 text-evergreen-800"
        }`}
      >
        {/* Gavel-strike mark */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2 12h6M5 12V7.5M2.5 2.5l4 4M4.5 1.5l4 4M1.5 4.5l4 4M8 6l4.5 4.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span
        className={`font-display text-2xl font-semibold tracking-tight ${
          dark ? "text-ivory" : "text-evergreen-900"
        }`}
      >
        Nilami
      </span>
      <span
        className={`hidden text-[10px] font-medium uppercase tracking-[0.22em] sm:inline ${
          dark ? "text-brass-300" : "text-brass-600"
        }`}
      >
        Asset Auctions
      </span>
    </Link>
  );
}
