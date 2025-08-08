// keep these in sync with llm/main.py - need a better way to do this
// todo use knowledge_cutoff in prompt

const models: Record<
  string,
  {
    name: string;
    input_cost_per_token?: number;
    output_cost_per_token?: number;
  }
> = {
  auto: {
    name: "Model: Auto",
  },
  "gpt-5-2025-08-07": {
    name: "GPT-5",
    input_cost_per_token: 1.25 / 1000000,
    output_cost_per_token: 10 / 1000000,
  },
  "claude-4-sonnet-20250514": {
    name: "Claude 4 Sonnet",
    input_cost_per_token: 3 / 1000000,
    output_cost_per_token: 15 / 1000000,
    //knowledge_cutoff: "October 2024",
  },
  "gemini-2.5-pro": {
    name: "Gemini 2.5 Pro",
    input_cost_per_token: 1.25 / 1000000,
    output_cost_per_token: 10 / 1000000,
  },
  "gpt-5-mini-2025-08-07": {
    name: "GPT-5 Mini",
    input_cost_per_token: 0.25 / 1000000,
    output_cost_per_token: 2 / 1000000,
  },
  "gemini-2.5-flash": {
    name: "Gemini 2.5 Flash",
    input_cost_per_token: 0.3 / 1000000,
    output_cost_per_token: 2.5 / 1000000,
  },
  "gpt-5-nano-2025-08-07": {
    name: "GPT-5 Nano",
    input_cost_per_token: 0.05 / 1000000,
    output_cost_per_token: 0.4 / 1000000,
  },
};

export { models };
