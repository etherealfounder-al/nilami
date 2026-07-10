"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Lang } from "@/lib/i18n/dictionaries";

export function LanguageSwitcher({ lang, dark = false }: { lang: Lang; dark?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function set(next: Lang) {
    if (next === lang) return;
    document.cookie = `lang=${next};path=/;max-age=31536000;samesite=lax`;
    start(() => router.refresh());
  }

  const base =
    "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors";
  const active = dark
    ? "bg-brass-500 text-evergreen-950"
    : "bg-evergreen-800 text-ivory";
  const idle = dark
    ? "text-ivory/60 hover:text-ivory"
    : "text-ink-soft hover:text-evergreen-800";

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full border p-0.5 ${
        dark ? "border-ivory/20" : "border-ink/15"
      } ${pending ? "opacity-60" : ""}`}
      role="group"
      aria-label="Language"
    >
      <button type="button" onClick={() => set("en")} className={`${base} ${lang === "en" ? active : idle}`}>
        EN
      </button>
      <button type="button" onClick={() => set("ne")} className={`${base} ${lang === "ne" ? active : idle}`}>
        ने
      </button>
    </div>
  );
}
