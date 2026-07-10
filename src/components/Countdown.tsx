"use client";

import { useEffect, useState } from "react";

function parts(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { d, h, m, s };
}

export function Countdown({
  deadline,
  large = false,
}: {
  deadline: string;
  large?: boolean;
}) {
  const [t, setT] = useState<ReturnType<typeof parts> | null | "loading">(
    "loading"
  );

  useEffect(() => {
    setT(parts(deadline));
    const id = setInterval(() => setT(parts(deadline)), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (t === "loading")
    return <span className="text-sm text-ink-soft">&nbsp;</span>;
  if (t === null)
    return (
      <span
        className={`font-medium text-danger ${large ? "text-lg" : "text-sm"}`}
      >
        Deadline passed
      </span>
    );

  if (!large) {
    return (
      <span className="text-sm font-medium tabular-nums text-evergreen-700">
        {t.d > 0 ? `${t.d}d ${t.h}h left` : `${t.h}h ${t.m}m left`}
      </span>
    );
  }

  const cells = [
    { v: t.d, l: "days" },
    { v: t.h, l: "hrs" },
    { v: t.m, l: "min" },
    { v: t.s, l: "sec" },
  ];
  return (
    <div className="flex gap-3">
      {cells.map((c) => (
        <div
          key={c.l}
          className="flex min-w-16 flex-col items-center rounded-xl border border-ink/10 bg-cream px-3 py-2.5"
        >
          <span className="font-display text-2xl font-semibold tabular-nums text-evergreen-900">
            {String(c.v).padStart(2, "0")}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-soft">
            {c.l}
          </span>
        </div>
      ))}
    </div>
  );
}
