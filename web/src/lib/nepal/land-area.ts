/**
 * Nepali hill-region land measure: ropani – aana – paisa – daam.
 *
 *   1 ropani = 16 aana,  1 aana = 4 paisa,  1 paisa = 4 daam
 *
 * Areas are stored as a decimal number of aana, so a "1-0-0-0" entry becomes
 * 16 and can be rendered back in ropani-aana-paisa-daam form exactly.
 */

export const AANA_PER_ROPANI = 16;
export const PAISA_PER_AANA = 4;
export const DAAM_PER_PAISA = 4;

/**
 * Accepts either a plain number of aana ("8.5") or ropani-aana-paisa-daam
 * ("1-0-0-0", "1-4-2", "2 - 8 - 0 - 0"). Returns aana, or null if unparseable.
 */
export function parseLandArea(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;

  if (raw.includes("-")) {
    const parts = raw.split("-").map((p) => p.trim());
    if (parts.length < 2 || parts.length > 4) return null;
    // Every segment must be a plain non-negative number, so "-5" is rejected
    // rather than read as an empty ropani followed by 5 aana.
    if (!parts.every((p) => /^\d+(?:\.\d+)?$/.test(p))) return null;
    const [ropani = 0, aana = 0, paisa = 0, daam = 0] = parts.map(Number);
    return (
      ropani * AANA_PER_ROPANI +
      aana +
      paisa / PAISA_PER_AANA +
      daam / (PAISA_PER_AANA * DAAM_PER_PAISA)
    );
  }

  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Renders aana back as "ropani-aana-paisa-daam", e.g. 16 → "1-0-0-0". */
export function formatRopaniAana(aana: number): string {
  const totalDaam = Math.round(aana * PAISA_PER_AANA * DAAM_PER_PAISA);
  const daamPerRopani = AANA_PER_ROPANI * PAISA_PER_AANA * DAAM_PER_PAISA;

  const ropani = Math.floor(totalDaam / daamPerRopani);
  let rest = totalDaam % daamPerRopani;
  const a = Math.floor(rest / (PAISA_PER_AANA * DAAM_PER_PAISA));
  rest %= PAISA_PER_AANA * DAAM_PER_PAISA;
  const paisa = Math.floor(rest / DAAM_PER_PAISA);
  const daam = rest % DAAM_PER_PAISA;

  return `${ropani}-${a}-${paisa}-${daam}`;
}
