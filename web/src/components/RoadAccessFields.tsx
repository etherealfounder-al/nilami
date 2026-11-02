import { useState } from "react";
import { joinRoadAccess, splitRoadAccess } from "../lib/nepal/road-access";
import { Field } from "./form";

/**
 * Road access, edited as width and surface.
 *
 * The column holds one string — "20 ft blacktopped", "Highway frontage" — and
 * that is what a notice prints, so it stays a string. Splitting it into two
 * fields is only to stop the width being written five different ways; the
 * parts are rejoined into the same shape on the way out, and anything that
 * does not match the pattern falls through to the description untouched rather
 * than being discarded.
 */
export function RoadAccessFields({ value }: { value: string | null | undefined }) {
  const initial = splitRoadAccess(value);
  const [feet, setFeet] = useState(initial.feet);
  const [description, setDescription] = useState(initial.description);

  return (
    <>
      {/* What the form submits: one value, assembled from the two above. */}
      <input type="hidden" name="road_access" value={joinRoadAccess(feet, description)} />

      <Field label="Road width" hint="In feet.">
        <input
          type="number"
          min={0}
          step="0.5"
          value={feet}
          onInput={(e) => setFeet((e.target as HTMLInputElement).value)}
          placeholder="20"
          class="field mt-1.5"
        />
      </Field>

      <Field label="Road surface" hint="Blacktopped, gravelled, earthen…">
        <input
          type="text"
          value={description}
          onInput={(e) => setDescription((e.target as HTMLInputElement).value)}
          placeholder="blacktopped"
          class="field mt-1.5"
        />
      </Field>
    </>
  );
}
