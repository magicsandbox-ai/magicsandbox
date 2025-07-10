import SyncExternalStore from "@utils/SyncExternalStore.ts";
import type { RefObject } from "react";
import type { ToastsRef } from "@components/Toasts.tsx";
import type { Risk, RiskUserApproval } from "./Risks.ts";

export interface Message {
  role: "user" | "assistant" | "display" | "system";
  tags: { tag?: string; content: string }[];
  promptToContinue?: string;
  continueSystemPrompt?: "chat" | "init" | "context";
  model?: string;
  welcome?: boolean;
}

export interface Conversation {
  conversationId: string;
  messages: Message[];
  summary: string | null;
  lastUpdated: number;
}

export type ConversationsRefObject = RefObject<{
  [conversationId: string]: Conversation;
}>;

export interface CurrentConversation {
  conversationId: string;
  messages: Message[];
}

export type ConversationSummaries = {
  conversationId: string;
  summary: string | null;
}[];

export interface App {
  id: string; //author.name@version
  app: string; //author.name - todo this is kind of confusing
  description: string | null;
  favorited?: number;
  recent?: number;
  published?: number;
}

export type AppState = App | false | null; //false is a signal to indicate an app is loading, so don't show a flash of the home page or full screen chat

export type AppData = { [app: string]: App };

export interface Confirm {
  header: string;
  message: string;
  callback: (approved: boolean) => void;
}

export interface RiskState {
  // riskResponses: {
  //   callback?: (approved: boolean, askedUser: boolean) => void;
  //   message?: string;
  //   details?: string[];
  //   downloadDetails?: { filename: string; content: string; text: string };
  //   error?: string;
  // }[];
  riskResponses: RiskUserApproval[];
  callback: (approved: boolean) => void;
}

export interface Assistant {
  handleInput: ({
    input,
    messages,
    initContext,
    continueSystemPrompt,
    resetInput,
    mockContent,
  }: {
    input?: string;
    messages?: Message[];
    initContext?: string;
    continueSystemPrompt?: "chat" | "init" | "context";
    resetInput?: () => void;
    mockContent?: string;
  }) => void;
  toastsRef: RefObject<ToastsRef>;
  handleFeedback: (feedback: boolean) => void;
  handleNewConversation: () => void;
  handleStopConversation: () => void;
  handleFavorite: (app: App) => void;
  handleApp: ({ app, messages }: { app: string; messages?: Message[] }) => void;
  handleSwitchConversation: (conversationId: string) => void;
  handleDeleteConversations: (conversationIds: string[] | null) => void;
  handleUpdateConversation: ({
    conversationId,
    messages,
    message,
    summary,
  }: {
    conversationId?: string;
    messages?: Message[];
    message?: Message;
    summary?: string;
  }) => void;
  risks: Risk[];
  app: AppState;
}

export type AssistantRefObject = RefObject<Assistant>;

class AssistantState extends SyncExternalStore<{
  app: AppState;
}> {
  app: AppState;
  constructor({ app }: { app: AppState }) {
    super({ app });
    this.app = app;
  }
  setApp(app: AppState) {
    this.app = app;
    this.set("app", app);
  }
}

class AbortIdController {
  //special signal - can only be aborted by aborting all signals
  private nullSignal: { aborted: boolean };
  private signals: { [id: string]: { aborted: boolean } };
  constructor() {
    this.nullSignal = { aborted: false };
    this.signals = {};
  }
  signal(id: string | null) {
    if (id === null) {
      return this.nullSignal;
    }
    if (!this.signals[id]) {
      this.signals[id] = { aborted: false };
    }
    return this.signals[id];
  }
  abort(id: string | null) {
    if (id === null) {
      this.nullSignal.aborted = true;
      Object.values(this.signals).forEach((signal) => {
        signal.aborted = true;
      });
    } else {
      if (this.signals[id]) {
        this.signals[id].aborted = true;
      }
    }
  }
}

export { AssistantState, AbortIdController };
