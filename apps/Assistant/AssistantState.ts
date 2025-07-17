import SyncExternalStore from "@utils/SyncExternalStore.ts";
import { createWelcomeConversation } from "./welcomeMessage.ts";
import type { Driver, State as DriverState } from "driver.js";
import type { RefObject } from "react";
import type { ToastType } from "@utils/Toast.ts";
import type { Risk, RiskUserApproval } from "./Risks.ts";

declare let setTimeout: WindowOrWorkerGlobalScope["setTimeout"];

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

export interface DiscoverApp {
  id: string;
  description: string | null;
  type: string | null;
  usage: number;
  relevance: number;
}

export interface Confirm {
  header: string;
  message: string;
  callback: (approved: boolean) => void;
}

export interface RiskState {
  riskResponses: RiskUserApproval[];
  callback: (approved: boolean) => void;
}

export interface User {
  name: string | undefined;
  balance: number;
  balanceRemainingDays: number | undefined; //number of days until balance resets, undefined for unauthenticated users
  paid: boolean;
  lastPublished: Date | undefined; //timestamp the user last published an App or Function
}

export interface AssistantRef {
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
    mockContent?: string[];
  }) => Promise<void>;
  toastsRef: RefObject<{
    addToast: (message: string, type: ToastType) => void;
  }>;
  handleFeedback: (feedback: boolean) => void;
  handleNewConversation: () => void;
  handleStopConversation: () => void;
  handleFavorite: (app: App) => void;
  handleApp: ({
    app,
    messages,
    mockContent,
  }: {
    app: string;
    messages?: Message[];
    mockContent?: string[];
  }) => void;
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
  handleRequest: (event: MessageEvent) => void;
  reload: () => void;
  risks: Risk[];
  app: AppState;
  budget: number;
  user: User;
  setShowChatHistory: (show: boolean) => void;
  driver: Driver;
  assistantState: AssistantState;
  setSeenTutorial: (seen: boolean) => void;
}

export type AssistantRefObject = RefObject<AssistantRef>;

class AssistantState extends SyncExternalStore<{
  conversations: { [conversationId: string]: Conversation };
  currentConversation: Conversation;
  conversationSummaries: ConversationSummaries;
  app: AppState;
  showChatHistory: boolean;
  isDriverActive: boolean;
  showTutorialTooltip: boolean;
  chatInput: string;
  chatCollapsed: boolean;
}> {
  conversations: { [conversationId: string]: Conversation };
  currentConversation: Conversation;
  conversationSummaries: ConversationSummaries;
  app: AppState;
  seenTutorial: boolean;
  abortIdController: AbortIdController = new AbortIdController();
  saveTimeoutIds: { [conversationId: string]: number } = {};
  constructor({
    initConversation,
    initConversations,
    app,
    showChatHistory,
    seenTutorial,
  }: {
    initConversation: Conversation;
    initConversations: { [conversationId: string]: Conversation };
    app: AppState;
    showChatHistory: boolean;
    seenTutorial: boolean;
  }) {
    const conversationSummaries = Object.entries(initConversations)
      .sort(([, a], [, b]) => (b.lastUpdated || 0) - (a.lastUpdated || 0))
      .map(([conversationId, conversation]) => ({
        conversationId,
        summary: conversation.summary,
      }));
    super({
      currentConversation: initConversation,
      conversations: initConversations,
      conversationSummaries,
      app,
      showChatHistory,
      isDriverActive: false,
      showTutorialTooltip: !!app && !seenTutorial,
      chatInput: "",
      chatCollapsed: true,
    });
    this.currentConversation = initConversation;
    this.conversations = initConversations;
    this.conversationSummaries = conversationSummaries;
    this.app = app;
    this.seenTutorial = seenTutorial;
  }
  addToast(message: string, type: ToastType) {
    console.log("addToast", message, type);
  }
  setApp(app: AppState) {
    this.app = app;
    this.set("app", app);
  }
  setShowChatHistory(show: boolean) {
    this.set("showChatHistory", show);
  }
  setShowTutorialTooltip(show: boolean) {
    this.set("showTutorialTooltip", show);
  }
  setSeenTutorial(seen: boolean) {
    this.seenTutorial = seen;
    requestPutData("seenTutorial", seen, {
      app: "magicsandbox.Assistant",
      evictionPolicy: "fifo",
    }).catch(console.error);
  }
  handleDriverStateChange(state: DriverState) {
    this.set("isDriverActive", !!state.isInitialized);
  }
  setChatInput(input: string) {
    this.set("chatInput", input);
  }
  setChatCollapsed(collapsed: boolean) {
    this.set("chatCollapsed", collapsed);
  }
  setConversations(conversations: { [conversationId: string]: Conversation }) {
    this.conversations = conversations;
    this.set("conversations", conversations);
  }
  setCurrentConversation(conversation: Conversation) {
    this.currentConversation = conversation;
    this.set("currentConversation", conversation);
  }
  setConversationSummaries(conversationSummaries: ConversationSummaries) {
    this.conversationSummaries = conversationSummaries;
    this.set("conversationSummaries", conversationSummaries);
  }
  handleStopConversation() {
    this.abortIdController.abort(this.currentConversation.conversationId);
  }
  handleNewConversation() {
    this.handleStopConversation();
    const conversationId = String(Date.now()); //numeric keys are coerced to string, so make id a string to avoid bugs
    const conversation = {
      conversationId,
      messages: [],
      summary: null,
      lastUpdated: Date.now(),
    };
    this.setConversations({
      ...this.conversations,
      [conversationId]: conversation,
    });
    this.setCurrentConversation(conversation);
    this.setConversationSummaries([
      { conversationId, summary: conversation.summary },
      ...this.conversationSummaries,
    ]);
    document.getElementById("chat-input")?.focus();
  }
  handleSwitchConversation(conversationId: string) {
    if (conversationId === this.currentConversation.conversationId) {
      return;
    }
    const conversation = this.conversations[conversationId];
    if (!conversation) {
      return;
    }
    this.handleStopConversation();
    if (
      conversation.messages[conversation.messages.length - 1]?.role !== "system"
    ) {
      conversation.messages.push({
        role: "system",
        tags: [
          {
            content:
              "The user closed and then reopened the conversation, resetting all state. Any actions you took in previous messages, like opening an app or executing a script, are no longer valid. Continue to follow all previous system instructions and consider how to handle the next user request given that the state has been reset.",
          },
        ],
      });
    }
    this.setCurrentConversation({ ...conversation });
  }
  handleUpdateConversation({
    conversationId,
    messages,
    message,
    summary,
  }: {
    conversationId?: string;
    messages?: Message[];
    message?: Message;
    summary?: string;
  }) {
    if (conversationId === undefined) {
      conversationId = this.currentConversation.conversationId;
    }
    const conversation = this.conversations[conversationId];
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    const messagesUpdated = messages !== undefined || message !== undefined;
    if (messagesUpdated) {
      conversation.lastUpdated = Date.now();
      if (messages !== undefined) {
        conversation.messages = messages;
      } else {
        conversation.messages.push(message!);
      }
    }
    const summaryUpdated = summary !== undefined;
    if (summaryUpdated) {
      conversation.summary = summary;
    }
    const latestConversation =
      this.conversationSummaries[0]?.conversationId === conversationId;
    if (messagesUpdated && !(!summaryUpdated && latestConversation)) {
      //if messages were updated, move the summary to the top
      //unless summary wasn't updated and it's already at the top - then do nothing
      this.setConversationSummaries([
        { conversationId, summary: conversation.summary },
        ...this.conversationSummaries.filter(
          (conversationSummary) =>
            conversationSummary.conversationId !== conversationId,
        ),
      ]);
    } else if (summaryUpdated) {
      //otherwise, if summary is updated, update in place
      this.setConversationSummaries(
        this.conversationSummaries.map((conversationSummary) =>
          conversationSummary.conversationId === conversationId
            ? { conversationId, summary: conversation.summary }
            : conversationSummary,
        ),
      );
    }
    this.setConversations({
      ...this.conversations,
      [conversationId]: conversation,
    });
    if (conversationId === this.currentConversation.conversationId) {
      this.setCurrentConversation({ ...conversation });
    }
    //when a user loads an app, it creates a display message "Loading..."
    //don't bother saving these
    if (
      conversation.summary !== null ||
      conversation.messages.some((message) => message.role !== "display")
    ) {
      clearTimeout(this.saveTimeoutIds[conversationId]);
      this.saveTimeoutIds[conversationId] = setTimeout(() => {
        const conversationToSave = { ...conversation };
        conversationToSave.messages = conversationToSave.messages.map(
          (message) => ({
            ...message,
            tags: message.tags.map((tag) => {
              if (
                tag.tag === "app_context" ||
                tag.tag === "user_highlighted_text"
              ) {
                return { tag: tag.tag, content: "" }; //don't bother saving - waste of space
              }
              return tag;
            }),
          }),
        );
        requestPutData(conversationId, conversationToSave, {
          app: "magicsandbox.Assistant",
          evictionPolicy: "fifo",
        }).catch(console.error);
        delete this.saveTimeoutIds[conversationId];
      }, 500);
    }
  }
  async _handleDeleteConversation(conversationId: string) {
    if (conversationId === "0") {
      const welcomeConversation = createWelcomeConversation();
      this.handleUpdateConversation({
        conversationId,
        messages: welcomeConversation.messages,
      });
      return;
    }
    await requestDeleteData(conversationId, {
      app: "magicsandbox.Assistant",
    });
  }
  async handleDeleteConversations(conversationIds: string[] | null) {
    try {
      if (conversationIds === null) {
        conversationIds = Object.keys(this.conversations);
      }
      await Promise.all(
        conversationIds.map((conversationId) => {
          this._handleDeleteConversation(conversationId);
        }),
      );
    } catch (error) {
      console.error(error);
      this.addToast(`Error: failed to delete chat`, "error");
      return;
    }
    const conversationIdSet = new Set(conversationIds);
    conversationIdSet.delete("0"); //don't delete welcome conversation
    this.setConversations(
      Object.fromEntries(
        Object.entries(this.conversations).filter(
          ([conversationId]) => !conversationIdSet.has(conversationId),
        ),
      ),
    );
    this.setConversationSummaries(
      this.conversationSummaries.filter(
        (conversationSummary) =>
          !conversationIdSet.has(conversationSummary.conversationId),
      ),
    );
    if (conversationIdSet.has(this.currentConversation.conversationId)) {
      this.handleNewConversation();
    }
  }
  reload() {
    this.abortIdController.abort(null);
    this.abortIdController = new AbortIdController();
    if (!this.seenTutorial) {
      this.setShowTutorialTooltip(true);
    }
    this.setChatInput("");
    this.setChatCollapsed(true);
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
