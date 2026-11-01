// Inside api/ because Go's embed cannot reach outside its own module, and
// this file is the one both readers share. The Next app is the temporary
// side of that arrangement: once the public pages render from Go, only the
// server reads these.
import enRaw from "../../../api/locales/en.json";
import neRaw from "../../../api/locales/ne.json";

export type Lang = "en" | "ne";

/**
 * Translations live in locales/*.json, not here.
 *
 * The Go server renders the public pages and needs the same strings; a copy on
 * each side drifts, and the drift shows up as one language quietly falling
 * behind. JSON is the only format both can read, which rules out the functions
 * this file used to hold — so the fourteen strings that interpolate are format
 * strings now, and the wrappers below restore the call signatures the pages
 * already use.
 */

/** A template, or one per plural form where the language distinguishes. */
type Template = string | { one: string; other: string };

/**
 * Fills {placeholders}. Numbers are grouped Indian-style, which is what a
 * Nepali reader expects and what the old `views` entry did by hand; below a
 * thousand it changes nothing, so applying it everywhere is safe.
 *
 * The plural form is chosen on `n`, the only count any of these carry.
 */
function fmt(t: Template, vars: Record<string, string | number>): string {
  const template = typeof t === "string" ? t : vars.n === 1 ? t.one : t.other;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = vars[key];
    if (v === undefined) return "";
    return typeof v === "number" ? v.toLocaleString("en-IN") : v;
  });
}

type Raw = typeof enRaw;

/**
 * The dictionary as the pages use it: the raw strings, with the formatted
 * entries replaced by functions of the same shape they had before.
 */
function build(raw: Raw) {
  return {
    ...raw,
    common: {
      ...raw.common,
      closedOn: (d: string) => fmt(raw.common.closedOn, { d }),
      goToPhoto: (n: number) => fmt(raw.common.goToPhoto, { n }),
      photoOf: (n: number, total: number) =>
        fmt(raw.common.photoOf, { n, total }),
      countdown: {
        ...raw.common.countdown,
        leftDH: (d: number, h: number) =>
          fmt(raw.common.countdown.leftDH, { d, h }),
        leftHM: (h: number, m: number) =>
          fmt(raw.common.countdown.leftHM, { h, m }),
      },
    },
    home: {
      ...raw.home,
      mapCount: (n: number) => fmt(raw.home.mapCount, { n }),
    },
    listing: {
      ...raw.listing,
      count: (n: number) => fmt(raw.listing.count, { n }),
      gotoPage: (n: number) => fmt(raw.listing.gotoPage, { n }),
      pageOf: (n: number, total: number) =>
        fmt(raw.listing.pageOf, { n, total }),
      showing: (from: number, to: number, total: number) =>
        fmt(raw.listing.showing, { from, to, total }),
    },
    detail: {
      ...raw.detail,
      roundN: (n: number) => fmt(raw.detail.roundN, { n }),
      security: (pct: string) => fmt(raw.detail.security, { pct }),
      views: (n: number) => fmt(raw.detail.views, { n }),
      share: {
        ...raw.detail.share,
        message: (title: string) => fmt(raw.detail.share.message, { title }),
      },
    },
  };
}

const en = build(enRaw);
const ne = build(neRaw as unknown as Raw);

export const dictionaries = { en, ne };
export type Dict = typeof en;

/**
 * An institution's name in the reader's language, falling back to the one it
 * always has. Not a dictionary entry: the text comes from the row, not from a
 * translation file.
 */
export function orgName(
  org: { name: string; name_np?: string | null } | null | undefined,
  lang: Lang
): string {
  if (!org) return "—";
  return lang === "ne" && org.name_np ? org.name_np : org.name;
}
