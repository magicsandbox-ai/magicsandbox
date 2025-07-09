function createWelcomeConversation() {
  const content = `## Welcome to Magic Sandbox!

**I'm your AI assistant.** Think of Magic Sandbox as ChatGPT meets an App Store - I can help you work with Magic Sandbox apps created by the community.

Let's get started with a quick demo and I'll show you what I can do!`;
  return {
    conversationId: "0",
    messages: [
      {
        role: "assistant",
        tags: [{ content }],
        welcome: true,
      },
    ],
    summary: "Welcome to Magic Sandbox!",
    lastUpdated: Date.now(),
  };
}

export { createWelcomeConversation };
