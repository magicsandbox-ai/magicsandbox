import React from "react";

// keep these in sync with llm/main.py - need a better way to do this

const models = {
  auto: {
    name: "Auto Model Selection",
  },
  "claude-3-5-sonnet-20241022": {
    name: "Claude 3.5 Sonnet",
    input_cost_per_token: 3 / 1000000,
    output_cost_per_token: 15 / 1000000,
  },
  "gpt-4o-2024-08-06": {
    name: "GPT 4o",
    input_cost_per_token: 2.5 / 1000000,
    output_cost_per_token: 10 / 1000000,
  },
  "gpt-4o-mini-2024-07-18": {
    name: "GPT 4o Mini",
    input_cost_per_token: 0.15 / 1000000,
    output_cost_per_token: 0.6 / 1000000,
  },
  "gemini/gemini-1.5-flash-002": {
    name: "Gemini 1.5 Flash",
    input_cost_per_token: 0.075 / 1000000,
    output_cost_per_token: 0.3 / 1000000,
  },
  "gemini/gemini-1.5-flash-8b-001": {
    name: "Gemini 1.5 Flash 8B",
    input_cost_per_token: 0.0375 / 1000000,
    output_cost_per_token: 0.15 / 1000000,
  },
};

function ModelPicker({ model, setModel }) {
  return (
    <select
      className="w-full rounded-lg border border-stone-300 px-1 py-0.5 text-sm text-stone-500"
      value={model}
      onChange={(e) => setModel(e.target.value)}
    >
      {Object.entries(models).map(([key, value]) => (
        <option key={key} value={key}>
          {value.name}
        </option>
      ))}
    </select>
  );
}

export { ModelPicker, models };
