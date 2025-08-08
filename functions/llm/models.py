from .tokenizer import TiktokenTokenizer, VertexTokenizer, DefaultTokenizer

gpt_4o_tokenizer = TiktokenTokenizer("gpt-4o")
gemini_tokenizer = VertexTokenizer(
    "gemini-1.5-flash-002"
)  # google has not yet updated model to tokenizer map for gemini 2.0
default_tokenizer = DefaultTokenizer()

# keep these in sync with Assistant/ModelPicker (and the README) - need a better way to do this
supported_models = {
    "gpt-5-2025-08-07": {
        "max_input_tokens": 400000,
        "input_cost_per_token": 1.25 / 1000000,
        "output_cost_per_token": 10 / 1000000,
        "tokenizer": gpt_4o_tokenizer,
        "max_vision_tokens": 1445,
        "default_reasoning_effort": "minimal",
    },
    "claude-4-sonnet-20250514": {
        "max_input_tokens": 200000,
        "input_cost_per_token": 3 / 1000000,
        "output_cost_per_token": 15 / 1000000,
        "tokenizer": default_tokenizer,
        "max_vision_tokens": 1600,
        "supports_assistant_prefill": True,
    },
    "gemini-2.5-pro": {
        "api_name": "gemini/gemini-2.5-pro",
        "max_input_tokens": 200000,  # 1048576, #limit to 200k for now until figure out how to handle cost that depends on number of input tokens
        "input_cost_per_token": 1.25 / 1000000,
        "output_cost_per_token": 10 / 1000000,
        "tokenizer": gemini_tokenizer,
        "max_vision_tokens": 0,
        "multimodal_disabled": True,
        "default_thinking": {
            "type": "enabled",
            "budget_tokens": 128,
        },
    },
    "gpt-5-mini-2025-08-07": {
        "max_input_tokens": 400000,
        "input_cost_per_token": 0.25 / 1000000,
        "output_cost_per_token": 2 / 1000000,
        "tokenizer": gpt_4o_tokenizer,
        "max_vision_tokens": 1445,
        "default_reasoning_effort": "minimal",
    },
    "gemini-2.5-flash": {
        "api_name": "gemini/gemini-2.5-flash",
        "max_input_tokens": 1048576,
        "input_cost_per_token": 0.3 / 1000000,
        "output_cost_per_token": 2.5 / 1000000,
        "tokenizer": gemini_tokenizer,
        "max_vision_tokens": 0,
        "multimodal_disabled": True,
        "default_thinking": {
            "type": "enabled",
            "budget_tokens": 0,
        },
    },
    "gpt-5-nano-2025-08-07": {
        "max_input_tokens": 400000,
        "input_cost_per_token": 0.05 / 1000000,
        "output_cost_per_token": 0.4 / 1000000,
        "tokenizer": gpt_4o_tokenizer,
        "max_vision_tokens": 1445,
        "default_reasoning_effort": "minimal",
    },
    #########################################################
    # start supported but not default models
    #########################################################
    "claude-3-7-sonnet-20250219": {
        "max_input_tokens": 200000,
        "input_cost_per_token": 3 / 1000000,
        "output_cost_per_token": 15 / 1000000,
        "tokenizer": default_tokenizer,
        "max_vision_tokens": 1600,
        "supports_assistant_prefill": True,
    },
    "gpt-4.1-2025-04-14": {
        "max_input_tokens": 1047576,
        "input_cost_per_token": 2 / 1000000,
        "output_cost_per_token": 8 / 1000000,
        "tokenizer": gpt_4o_tokenizer,
        "max_vision_tokens": 1445,
    },
    "gpt-4.1-mini-2025-04-14": {
        "max_input_tokens": 1047576,
        "input_cost_per_token": 0.4 / 1000000,
        "output_cost_per_token": 1.6 / 1000000,
        "tokenizer": gpt_4o_tokenizer,
        "max_vision_tokens": 2489,
    },
    "gemini-2.0-flash-001": {
        "api_name": "gemini/gemini-2.0-flash-001",
        "max_input_tokens": 1048576,
        "input_cost_per_token": 0.1 / 1000000,
        "output_cost_per_token": 0.4 / 1000000,
        "tokenizer": gemini_tokenizer,
        "max_vision_tokens": 0,
        "multimodal_disabled": True,  # can't compute cost for audio/video so need to disable it
    },
    "gemini-2.0-flash-lite-001": {
        "api_name": "gemini/gemini-2.0-flash-lite-001",
        "max_input_tokens": 1048576,
        "input_cost_per_token": 0.075 / 1000000,
        "output_cost_per_token": 0.3 / 1000000,
        "tokenizer": gemini_tokenizer,
        "max_vision_tokens": 0,
        "multimodal_disabled": True,
    },
}

# THE ORDER OF THESE MATTERS. should be ordered from smartest to cheapest. last model is used no matter what with trim_messages
default_models = [
    "gpt-5-2025-08-07",
    "claude-4-sonnet-20250514",
    "gemini-2.5-pro",
    "gpt-5-mini-2025-08-07",
    "gemini-2.5-flash",
    "gpt-5-nano-2025-08-07",
]
