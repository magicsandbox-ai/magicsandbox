export interface Message {
  role: "user" | "assistant" | "display" | "system";
  tags: { tag?: string; content: string }[];
  promptToContinue?: string;
  continueSystemPrompt?: "chat" | "init" | "context";
  model?: string;
  welcome?: boolean;
}

export interface App {
  id: string;
  app: string;
  description: string;
  status: string;
  favorited?: number;
  recent?: number;
  published?: number;
}
