import { useState } from "react";
import { formatRopaniAana, parseLandArea } from "../lib/nepal/land-area";
import { Field } from "./form";

/**
 * Land area, in the measure the paperwork uses.
 *
 * Nepali hill-region land is written ropani-aana-paisa-daam, and a notice that
 * says "1-0-0-0" is a different document from one that says "16". It is stored
 * as a decimal number of aana either way, so both forms are accepted here and
 * the entry is echoed back in both as it is typed — which is also how a typo
 * gets caught before it is saved.
 */
export function LandAreaField({ value }: { value: number | null | undefined }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const aana = parseLandArea(text);
  const invalid = text.trim() !== "" && aana === null;

  return (
    <Field
      label="Land area"
      hint={
        invalid
          ? "Enter aana (8.5) or ropani-aana-paisa-daam (1-0-0-0)."
          : aana === null
            ? "Aana, or ropani-aana-paisa-daam."
            : `${aana} aana · ${formatRopaniAana(aana)} ropani-aana-paisa-daam`
      }
    >
      <input
        name="land_area_aana"
        value={text}
        onInput={(e) => setText((e.target as HTMLInputElement).value)}
        placeholder="8.5 aana or 1-0-0-0"
        aria-invalid={invalid}
        class={`field mt-1.5 ${invalid ? "!border-bad" : ""}`}
      />
    </Field>
  );
}
