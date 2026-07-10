"use client";

import Image from "next/image";
import { useState } from "react";
import type { PropertyImage } from "@/lib/types";

export function Gallery({
  images,
  title,
}: {
  images: PropertyImage[];
  title: string;
}) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return (
      <div className="grid aspect-[16/10] place-items-center rounded-3xl bg-parchment text-ink-soft">
        Photographs pending
      </div>
    );
  }
  const img = images[Math.min(active, images.length - 1)];
  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-parchment shadow-card">
        <Image
          key={img.id}
          src={img.url}
          alt={img.alt || title}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="rise object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-3">
          {images.map((im, i) => (
            <button
              key={im.id}
              onClick={() => setActive(i)}
              aria-label={`Photo ${i + 1}`}
              className={`relative aspect-[4/3] w-24 overflow-hidden rounded-xl border-2 transition-all ${
                i === active
                  ? "border-brass-500 opacity-100"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <Image
                src={im.url}
                alt={im.alt}
                fill
                sizes="96px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
