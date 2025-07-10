import { describe, test, expect } from "@jest/globals";
import {
  AssistantState,
  AbortIdController,
  type App,
} from "../AssistantState.ts";

/*
npm run jest -- apps/Assistant/__tests__/AssistantState.test.ts
*/

describe("AssistantState", () => {
  test("works", () => {
    const assistantState = new AssistantState({ app: null });
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
