import { cookies } from "next/headers";
import { dictionaries, type Dict, type Lang } from "./dictionaries";

export async function getLang(): Promise<Lang> {
  const store = await cookies();
  return store.get("lang")?.value === "ne" ? "ne" : "en";
}

export async function getT(): Promise<{ lang: Lang; t: Dict }> {
  const lang = await getLang();
  return { lang, t: dictionaries[lang] };
}
