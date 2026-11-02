import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Field } from "./form";
import { Select } from "./Select";

type Municipality = { name: string; nameNp: string; type: string; wards: number };
type District = { name: string; nameNp: string; municipalities: Municipality[] };
type Province = { name: string; nameNp: string; districts: District[] };

/**
 * Province → district → local level, each narrowing the next.
 *
 * These were three free-text boxes, which is how a property ends up filed in
 * "Kathmandu " or "kathmandu" and silently drops out of the public district
 * filter — the filter matches the stored string exactly, so a typo here is a
 * listing nobody browsing by district will ever see.
 *
 * The dataset is fetched rather than bundled: 103 KB for one screen would
 * otherwise be carried by every page of the panel. It is loaded once and
 * cached by the browser for a day.
 */
export function LocationSelects({
  province,
  district,
  municipality,
  ward,
}: {
  province?: string;
  district?: string;
  municipality?: string;
  ward?: number | null;
}) {
  const { data, isPending } = useQuery({
    queryKey: ["nepal-divisions"],
    queryFn: async () => {
      const res = await fetch("/assets/nepal-divisions.json");
      if (!res.ok) throw new Error("could not load the district list");
      return (await res.json()) as Province[];
    },
    staleTime: Infinity,
  });

  const [p, setP] = useState(province ?? "");
  const [d, setD] = useState(district ?? "");
  const [m, setM] = useState(municipality ?? "");

  const provinces = data ?? [];
  const districts = provinces.find((x) => x.name === p)?.districts ?? [];
  const municipalities = districts.find((x) => x.name === d)?.municipalities ?? [];
  const wards = municipalities.find((x) => x.name === m)?.wards;

  /*
   * An existing property may hold a value the list does not — a municipality
   * renamed since this dataset was compiled, or one typed in by hand while
   * these were free-text boxes. Keeping it as an option means editing such a
   * property does not silently rewrite its location to something else.
   */
  const keep = (list: { name: string }[], value: string) =>
    value && !list.some((x) => x.name === value) ? [{ name: value }, ...list] : list;

  return (
    <>
      <Field label="Province">
        <Select
          name="province"
          required
          disabled={isPending}
          value={p}
          placeholder={isPending ? "Loading…" : "Choose a province"}
          class="mt-1.5"
          onChange={(v) => {
            setP(v);
            setD(""); setM("");
          }}
          options={keep(provinces, p).map((x) => ({ value: x.name, label: x.name }))}
        />
      </Field>

      <Field label="District">
        <Select
          name="district"
          required
          disabled={!p}
          value={d}
          placeholder={p ? "Choose a district" : "Choose a province first"}
          class="mt-1.5"
          onChange={(v) => {
            setD(v);
            setM("");
          }}
          options={keep(districts, d).map((x) => ({ value: x.name, label: x.name }))}
        />
      </Field>

      <Field label="Local level">
        <Select
          name="municipality"
          required
          disabled={!d}
          value={m}
          placeholder={d ? "Choose a municipality" : "Choose a district first"}
          class="mt-1.5"
          onChange={(v) => {
            setM(v);
            
          }}
          options={keep(municipalities, m).map((x) => ({ value: x.name, label: x.name }))}
        />
      </Field>

      <Field
        label="Ward"
        hint={wards ? `This local level has ${wards} wards.` : undefined}
      >
        <input
          type="number"
          name="ward"
          min={1}
          max={wards ?? 35}
          value={ward ?? ""}
          class="field mt-1.5"
        />
      </Field>
    </>
  );
}
