/**
 * The Nilami mark as a map pin, so a marker reads as our logo and not as a
 * generic dot.
 *
 * The geometry is the one the old app used — a teardrop with the gavel-strike
 * from the logo set in its head — but the paint now comes from the theme
 * rather than the two fixed colours it was drawn in, so one pin serves both
 * grounds. Plain HTML strings, because Leaflet's divIcon takes markup.
 */

/** Teardrop outline: head centred at (16, 16.5) with r=14.5, tip at (16, 43.5). */
const PIN_BODY =
  "M16 43.5C16 43.5 30.5 27.5 30.5 16.5 30.5 8.5 24 2 16 2S1.5 8.5 1.5 16.5c0 11 14.5 27 14.5 27Z";

/** The gavel-strike from the mark, scaled and centred inside the pin head. */
const gavel = (stroke: string) => `
  <g stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" fill="none"
     transform="translate(7.6 8.4) scale(1.2)">
    <path d="M2 12h6"/><path d="M5 12V7.5"/>
    <path d="M2.5 2.5l4 4"/><path d="M4.5 1.5l4 4"/>
    <path d="M1.5 4.5l4 4"/><path d="M8 6l4.5 4.5"/>
  </g>`;

/** Aspect of the teardrop, used to derive a height from any pin width. */
export const PIN_RATIO = 44 / 32;

export function pinSize(width: number) {
  return { width, height: Math.round(width * PIN_RATIO) };
}

/**
 * A logo pin. The coordinate sits at the tip, so anchor it at
 * `[width / 2, height]`.
 */
export function logoPin(width = 40): string {
  const { width: w, height: h } = pinSize(width);
  return `
    <svg width="${w}" height="${h}" viewBox="0 0 32 44" fill="none"
         xmlns="http://www.w3.org/2000/svg"
         style="display:block;filter:drop-shadow(0 2px 3px rgb(0 0 0 / .35))">
      <path d="${PIN_BODY}" fill="var(--color-accent)"
            stroke="var(--color-canvas)" stroke-width="2"/>
      ${gavel("var(--color-on-accent)")}
    </svg>`;
}
