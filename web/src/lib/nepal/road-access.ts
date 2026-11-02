/**
 * road_access holds one free-text string such as "20 ft blacktopped" or
 * "Highway frontage". The admin form edits it as two fields — width in feet
 * and a description — so these split and rejoin it without losing either part
 * of the values already stored.
 */

export function splitRoadAccess(value: string | null | undefined): {
  feet: string;
  description: string;
} {
  const raw = (value ?? "").trim();
  if (!raw) return { feet: "", description: "" };

  const m = raw.match(/^(\d+(?:\.\d+)?)\s*(?:ft\.?|feet|fit)\b\s*(.*)$/i);
  if (!m) return { feet: "", description: raw };
  return { feet: m[1], description: m[2].trim() };
}

export function joinRoadAccess(feet: string, description: string): string {
  const f = feet.trim();
  const d = description.trim();
  if (f && d) return `${f} ft ${d}`;
  if (f) return `${f} ft`;
  return d;
}
