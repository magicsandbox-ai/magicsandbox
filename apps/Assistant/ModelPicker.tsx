import React, { useSyncExternalStore } from "react";
import { models } from "./models.ts";
import type { AssistantState } from "./AssistantState.ts";

function ModelPicker({ assistantState }: { assistantState: AssistantState }) {
  const model = useSyncExternalStore(
    assistantState.subscribe("model"),
    assistantState.getSnapshot("model"),
  );
  return (
    <select
      className="w-full rounded-lg border border-stone-300 px-1 py-0.5 text-sm text-stone-500"
      value={model}
      onChange={(e) => assistantState.setModel(e.target.value)}
    >
      {Object.entries(models).map(([key, value]) => (
        <option key={key} value={key}>
          {value.name}
        </option>
      ))}
    </select>
  );
}

export { ModelPicker };
