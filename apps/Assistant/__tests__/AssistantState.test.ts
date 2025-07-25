import { describe, test, expect, jest } from "@jest/globals";
jest.unstable_mockModule("@magicsandbox.ai/docs/docs.md", () => ({
  default: "# Mock Documentation\n\n ## Sandbox\n\nWho doesn't like a sandbox?",
}));
const { AssistantState, AbortIdController } = await import(
  "../AssistantState.ts"
);
import type { App } from "../AssistantState.ts"; //todo remove this

/*
npm run jest -- apps/Assistant/__tests__/AssistantState.test.ts
*/

global.requestPutData = () => Promise.resolve(true);

describe("AssistantState", () => {
  test("works", () => {
    const initConversation = {
      conversationId: String(Date.now()),
      messages: [],
      summary: null,
      lastUpdated: Date.now(),
    };
    const assistantState = new AssistantState({
      initData: {},
      app: null,
      initConversation,
      initConversations: {
        [initConversation.conversationId]: initConversation,
      },
      showChatHistory: true,
      seenTutorial: false,
      docked: false,
    });
    expect(assistantState.app).toBe(null);
    assistantState.setApp(false);
    expect(assistantState.app).toBe(false);
    assistantState.setApp({
      id: "magicsandbox.Notes@0.1.0",
      app: "magicsandbox.Notes",
      description:
        "Take notes, create to-do lists, organize documents, and more",
      favorited: Date.now(),
    });
    expect((assistantState.app as App).app).toBe("magicsandbox.Notes");
    expect(assistantState.currentConversation.messages.length).toBe(0);
    assistantState.handleUpdateUserMessage({
      tags: [
        { tag: "logs", content: "alpha" },
        { tag: "user_request", content: "beta" },
      ],
    });
    expect(assistantState.currentConversation.messages.length).toBe(1);
    expect(assistantState.currentConversation.messages[0]!.tags).toEqual([
      { tag: "logs", content: "alpha" },
      { tag: "user_request", content: "beta" },
    ]);
    assistantState.handleUpdateUserMessage({
      tags: [{ tag: "app_context", content: "gamma" }],
    });
    expect(assistantState.currentConversation.messages.length).toBe(1);
    expect(assistantState.currentConversation.messages[0]!.tags).toEqual([
      { tag: "logs", content: "alpha" },
      { tag: "user_request", content: "beta" },
      { tag: "app_context", content: "gamma" },
    ]);
    assistantState.handleUpdateUserMessage({
      tags: [
        { tag: "logs", content: "delta" },
        { tag: "user_request", content: "epsilon" },
      ],
    });
    expect(assistantState.currentConversation.messages.length).toBe(1);
    expect(assistantState.currentConversation.messages[0]!.tags).toEqual([
      { tag: "logs", content: "alpha" },
      { tag: "app_context", content: "gamma" },
      { tag: "logs", content: "delta" },
      { tag: "user_request", content: "epsilon" },
    ]);
    assistantState.handleUpdateUserMessage({
      tags: [{ tag: "app_context", content: "zeta" }],
    });
    expect(assistantState.currentConversation.messages.length).toBe(1);
    expect(assistantState.currentConversation.messages[0]!.tags).toEqual([
      { tag: "logs", content: "alpha" },
      { tag: "logs", content: "delta" },
      { tag: "user_request", content: "epsilon" },
      { tag: "app_context", content: "zeta" },
    ]);
  });
});

describe("AbortIdController", () => {
  test("works", () => {
    const abortIdController = new AbortIdController();
    const testAbortSignal = abortIdController.signal("test");
    expect(testAbortSignal.aborted).toBe(false);
    abortIdController.abort("test");
    expect(testAbortSignal.aborted).toBe(true);
    const testAbortSignal2 = abortIdController.signal("test2");
    expect(testAbortSignal2.aborted).toBe(false);
    const nullAbortSignal = abortIdController.signal(null);
    expect(nullAbortSignal.aborted).toBe(false);
    abortIdController.abort(null);
    expect(testAbortSignal2.aborted).toBe(true);
    expect(nullAbortSignal.aborted).toBe(true);
  });
});
