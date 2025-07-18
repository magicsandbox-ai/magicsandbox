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
  "gpt-4.1-2025-04-14": {
    name: "GPT-4.1",
    input_cost_per_token: 2 / 1000000,
    output_cost_per_token: 8 / 1000000,
  },
  "gemini-2.5-flash": {
    name: "Gemini 2.5 Flash",
    input_cost_per_token: 0.3 / 1000000,
    output_cost_per_token: 2.5 / 1000000,
  },
  "gpt-4.1-mini-2025-04-14": {
    name: "GPT-4.1 Mini",
    input_cost_per_token: 0.4 / 1000000,
    output_cost_per_token: 1.6 / 1000000,
  },
  "gemini-2.0-flash-001": {
    name: "Gemini 2.0 Flash",
    input_cost_per_token: 0.1 / 1000000,
    output_cost_per_token: 0.4 / 1000000,
  },
  "gemini-2.0-flash-lite-001": {
    name: "Gemini 2.0 Flash Lite",
    input_cost_per_token: 0.075 / 1000000,
    output_cost_per_token: 0.3 / 1000000,
  },
};

export { models };
