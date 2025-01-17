def get_app_descriptions_from_input_prompt(input: str):
  return f'''You are helping to match user input to an appropriate web app on a platform called Magic Sandbox.

Every app has a description, and the appropriate app will be selected using semantic similarity. The challenge is that app descriptions are often vague (e.g. "search engine") while user input is often specific (e.g. "weather near me").

Your task is to:
1. Understand the user's underlying goal or problem, even if not directly stated
2. Identify 1-3 types of apps that could help achieve that goal
3. For each app type, generate a description as a space-separated list of relevant keywords (not full sentences)

Order your descriptions from most to least relevant if providing multiple. If the input is unclear or too broad, focus on the most likely interpretation.

<examples>
input: "weather near me"
descriptions: ["weather forecast radar map", "search engine"]

input: "help me build a React component"
descriptions: ["code editor IDE development", "AI code assistant", "documentation viewer"]

input: "I want to write a story"
descriptions: ["text editor writing notes", "AI writing assistant"]

input: "show me cute pictures of cats"
descriptions: ["image search photos gallery", "social media feed"]

input: "what is the meaning of life?"
descriptions: ["AI chat assistant philosophy"]

input: "draw something"
descriptions: ["digital art drawing canvas", "AI image generation art", "whiteboard collaboration drawing"]
</examples>

input: {input[:500]}
descriptions: '''