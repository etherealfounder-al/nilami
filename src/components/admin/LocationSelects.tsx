"use client";

import { useState } from "react";
import { MapPicker } from "@/components/admin/MapPicker";
import {
  districtsOf,
  municipalitiesOf,
  PROVINCES,
} from "@/lib/nepal/administrative-divisions";
import { DISTRICT_COORDINATES } from "@/lib/nepal/district-coordinates";
import { Select } from "@/components/ui/Select";

/** Roughly the middle of Nepal, used until a district is chosen. */
const NEPAL_CENTRE: [number, number] = [28.3949, 84.124];

type Option = { value: string; label: string };

function LabelledSelect({
  name,
  label,
  value,
  onChange,
  options,
  placeholder,
  labelCls,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder: string;
  labelCls: string;
}) {
  // A value saved before these fields became dropdowns — or one the dataset
  // spells differently — must stay selectable, or editing an existing property
  // would silently blank it.
  const unlisted = value !== "" && !options.some((o) => o.value === value);

  return (
    <div className="space-y-1.5">
      <span className={labelCls}>{label}</span>
      <Select
        name={name}
        required
        aria-label={label}
        value={value}
        onValueChange={onChange}
        placeholder={placeholder}
        options={[
          ...(unlisted ? [{ value, label: `${value} — not in list` }] : []),
          ...options,
        ]}
      />
    </div>
  );
}

/**
 * Province → district → municipality, each narrowing the next. Renders three
 * bare <label> blocks so the parent form's grid keeps laying them out.
 */
export function LocationSelects({
  province: initialProvince = "",
  district: initialDistrict = "",
  municipality: initialMunicipality = "",
  latitude = null,
  longitude = null,
  labelCls,
}: {
  province?: string;
  district?: string;
  municipality?: string;
  latitude?: number | null;
  longitude?: number | null;
  labelCls: string;
}) {
  const [province, setProvince] = useState(initialProvince);
  const [district, setDistrict] = useState(initialDistrict);
  const [municipality, setMunicipality] = useState(initialMunicipality);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    latitude != null && longitude != null
      ? { lat: latitude, lng: longitude }
      : null
  );

  const centre = DISTRICT_COORDINATES[district] ?? NEPAL_CENTRE;

  const opts = (names: string[]) => names.map((n) => ({ value: n, label: n }));
  const shared = { labelCls };

  return (
    <>
      <LabelledSelect
        {...shared}
        name="province"
        label="Province"
        value={province}
        onChange={(v) => {
          setProvince(v);
          setDistrict("");
          setMunicipality("");
        }}
        options={opts(PROVINCES.map((p) => p.name))}
        placeholder="Select province…"
      />
      <LabelledSelect
        {...shared}
        name="district"
        label="District"
        value={district}
        onChange={(v) => {
          setDistrict(v);
          setMunicipality("");
        }}
        options={opts(districtsOf(province).map((d) => d.name))}
        placeholder={province ? "Select district…" : "Select a province first"}
      />
      <LabelledSelect
        {...shared}
        name="municipality"
        label="Local level"
        value={municipality}
        onChange={setMunicipality}
        options={opts(municipalitiesOf(province, district).map((m) => m.name))}
        placeholder={district ? "Select local level…" : "Select a district first"}
      />

      <div className="space-y-1.5 sm:col-span-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className={labelCls}>Location on map</span>
          <span className="text-[11px] text-ink-soft">
            {pin ? (
              <>
                {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}{" "}
                <button
                  type="button"
                  onClick={() => setPin(null)}
                  className="ml-1 font-medium text-danger hover:underline"
                >
                  clear
                </button>
              </>
            ) : (
              "Click the map to drop a pin (optional)"
            )}
          </span>
        </div>
        <MapPicker
          lat={pin?.lat ?? null}
          lng={pin?.lng ?? null}
          centre={centre}
          onPick={(lat, lng) => setPin({ lat, lng })}
        />
        <input type="hidden" name="latitude" value={pin?.lat ?? ""} />
        <input type="hidden" name="longitude" value={pin?.lng ?? ""} />
      </div>
    </>
  );
}
