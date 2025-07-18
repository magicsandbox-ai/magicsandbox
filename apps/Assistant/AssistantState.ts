import SyncExternalStore from "@utils/SyncExternalStore.ts";
import { createWelcomeConversation } from "./welcomeMessage.ts";
import {
  formatMessage,
  formatFavoritedApps,
  formatLogs,
  prompt,
  createSummaryArgs,
} from "./prompt.ts";
import { models } from "./models.ts";
import { mockLlm } from "./driver.ts";
import { tagStreamParser } from "@magicsandbox.ai/streaming";
import { ToastError, type ToastType } from "@utils/Toast.ts";
import type { Driver, State as DriverState } from "driver.js";
import type { Risk, RiskUserApproval } from "./Risks.ts";
import { type SandboxRef } from "@magicsandbox.ai/react-sandbox";
import type { Metadata } from "@magicsandbox.ai/types";

declare let setTimeout: WindowOrWorkerGlobalScope["setTimeout"];

const includeMetadata: (keyof Metadata)[] = ["id", "description"];

const defaultInputBytesPerToken = 4;
const defaultOutputTokens = 500;
const defaultLlmCostThreshold = 0.1;

export interface DatabaseSchema {
  docked?: boolean;
  appData?: AppData;
  selectedModel?: string;
  popularAppData?: {
    ts: number;
    apps: DiscoverApp[];
  };
  lastMetadataRefresh?: Date;
  seenTutorial?: boolean;
}

export interface Message {
  role: "user" | "assistant" | "system";
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

interface AppUsage {
  daysBetweenCalls: number;
  usagePerCall: number;
  pendingUsage: number;
  timeoutId?: number;
}

interface LlmUsage {
  daysBetweenCalls: number;
  inputBytesPerToken: { [app: string]: number };
  outputTokens: { [app: string]: number };
  costThreshold: { [app: string]: number };
}

interface LlmResult {
  model?: string;
  content: string;
  finish_reason?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
  index: number;
}

export interface AssistantRef {
  handleRequest: (event: MessageEvent) => void;
  reload: () => void;
  risks: Risk[];
  driver: Driver;
  assistantState: AssistantState;
}

const defaultAppData: AppData = {
  "magicsandbox.Notes": {
    id: "magicsandbox.Notes", //missing version, which is potentially problematic. but currently id is only used in validateAndDefaultRequest
    app: "magicsandbox.Notes",
    description: "Take notes, create to-do lists, organize documents, and more",
    favorited: Date.now(),
  },
  "magicsandbox.Sheets": {
    id: "magicsandbox.Sheets",
    app: "magicsandbox.Sheets",
    description: "Create and edit spreadsheets",
    favorited: Date.now(),
  },
  "magicsandbox.Dev": {
    id: "magicsandbox.Dev",
    app: "magicsandbox.Dev",
    description: "Develop, preview, and publish a Magic Sandbox App",
    favorited: Date.now(),
  },
};

class AssistantState extends SyncExternalStore<{
  conversations: { [conversationId: string]: Conversation };
  currentConversation: Conversation;
  conversationSummaries: ConversationSummaries;
  app: AppState;
  appData: AppData;
  showChatHistory: boolean;
  isDriverActive: boolean;
  showTutorialTooltip: boolean;
  chatInput: string;
  chatCollapsed: boolean;
  chatLoading: boolean;
  model: string;
}> {
  conversations: { [conversationId: string]: Conversation };
  currentConversation: Conversation;
  conversationSummaries: ConversationSummaries;
  app: AppState;
  appData: AppData;
  seenTutorial: boolean;
  model: string;
  abortIdController: AbortIdController = new AbortIdController();
  saveTimeoutIds: { [conversationId: string]: number } = {};
  sandboxRef?: SandboxRef;
  budget: number = 0;
  constructor({
    initData,
    initConversation,
    initConversations,
    app,
    showChatHistory,
    seenTutorial,
  }: {
    initData: DatabaseSchema;
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
    const appData = initData.appData || defaultAppData;
    const model =
      initData.selectedModel && models[initData.selectedModel]
        ? initData.selectedModel
        : "auto";
    super({
      currentConversation: initConversation,
      conversations: initConversations,
      conversationSummaries,
      app,
      appData,
      showChatHistory,
      isDriverActive: false,
      showTutorialTooltip: !!app && !seenTutorial,
      chatInput: "",
      chatCollapsed: true,
      chatLoading: false,
      model,
    });
    this.currentConversation = initConversation;
    this.conversations = initConversations;
    this.conversationSummaries = conversationSummaries;
    this.app = app;
    this.appData = appData;
    this.seenTutorial = seenTutorial;
    this.model = model;
  }
  addToast(message: string, type: ToastType) {
    console.log("addToast", message, type);
  }
  putData(key: string, val: unknown) {
    requestPutData(key, val, {
      app: "magicsandbox.Assistant",
      evictionPolicy: "fifo",
    }).catch(console.error);
  }
  setApp(app: AppState) {
    this.app = app;
    this.set("app", app);
  }
  setAppData(appData: AppData) {
    this.appData = appData;
    this.set("appData", appData);
    this.putData("appData", appData);
  }
  setShowChatHistory(show: boolean) {
    this.set("showChatHistory", show);
  }
  setShowTutorialTooltip(show: boolean) {
    this.set("showTutorialTooltip", show);
  }
  setSeenTutorial(seen: boolean) {
    this.seenTutorial = seen;
    this.putData("seenTutorial", seen);
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
  setChatLoading(loading: boolean) {
    this.set("chatLoading", loading);
  }
  setModel(model: string) {
    this.model = model;
    this.set("model", model);
    this.putData("selectedModel", model);
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
      this.putData(conversationId, conversationToSave);
      delete this.saveTimeoutIds[conversationId];
    }, 500);
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
  handleUpdateUserMessage(message: Partial<Message>) {
    const lastMessage =
      this.currentConversation.messages[
        this.currentConversation.messages.length - 1
      ];
    if (lastMessage?.role !== "user") {
      this.handleUpdateConversation({
        message: {
          tags: [],
          ...message,
          role: "user",
        },
      });
    } else {
      const newTags = [...lastMessage.tags];
      if (message.tags) {
        newTags.push(...message.tags);
      }
      this.handleUpdateConversation({
        messages: [
          ...this.currentConversation.messages.slice(0, -1),
          {
            ...lastMessage,
            ...message,
            tags: newTags,
            role: "user",
          },
        ],
      });
    }
  }
  handleAppUsage(finalCost: number) {
    this.appUsage.pendingUsage += finalCost;
    clearTimeout(this.appUsage.timeoutId);
    this.appUsage.timeoutId = setTimeout(() => {
      this._handleAppUsage(); //batch to avoid too many reads/writes
    }, 16);
  }
  async _handleAppUsage() {
    //note: need to smooth daysBetweenCalls and usagePerCall separately
    //correct: appUsagePerDay = avg(usagePerCall) / avg(daysBetweenCalls)
    //incorrect: appUsagePerDay = avg(usagePerCall / daysBetweenCalls)
    try {
      //need to grab latest in case user is using multiple tabs
      const { ts, daysBetweenCalls, usagePerCall } =
        (await requestGetData("appUsage", {
          app: "magicsandbox.Assistant",
        })) || {};
      const now = Date.now();
      if (ts) {
        const daysSinceLastUsage = (now - ts) / (1000 * 60 * 60 * 24);
        const alpha = 0.05;
        this.appUsage.daysBetweenCalls =
          alpha * daysSinceLastUsage + (1 - alpha) * daysBetweenCalls;
        this.appUsage.usagePerCall =
          alpha * this.appUsage.pendingUsage + (1 - alpha) * usagePerCall;
      }
      await requestPutData(
        "appUsage",
        {
          ts: now,
          daysBetweenCalls: this.appUsage.daysBetweenCalls,
          usagePerCall: this.appUsage.usagePerCall,
        },
        {
          app: "magicsandbox.Assistant",
          evictionPolicy: "fifo",
        },
      );
      this.appUsage.pendingUsage = 0;
    } catch (error) {
      console.error(error);
    }
  }
  async handleLlmUsage({
    inputBytes,
    promptTokens,
    completionTokens,
    userApproved,
  }) {
    //note: need to smooth daysBetweenCalls rather than llmCallsPerDay
    //correct: llmCallsPerDay = 1 / avg(daysBetweenCalls)
    //incorrect: llmCallsPerDay = avg(1 / daysBetweenCalls)
    try {
      const {
        ts,
        daysBetweenCalls,
        inputBytesPerToken,
        outputTokens,
        costThreshold,
      } =
        (await requestGetData("llmUsage", {
          app: "magicsandbox.Assistant",
        })) || {};
      const now = Date.now();
      if (ts) {
        const daysSinceLastUsage = (now - ts) / (1000 * 60 * 60 * 24);
        let alpha = 0.05;
        this.llmUsage.daysBetweenCalls = daysBetweenCalls;
        this.llmUsage.inputBytesPerToken = inputBytesPerToken;
        this.llmUsage.outputTokens = outputTokens;
        this.llmUsage.costThreshold = costThreshold;
        if (userApproved === false) {
          this.llmUsage.costThreshold[this.app.app] =
            (this.llmUsage.costThreshold[this.app.app] ||
              defaultLlmCostThreshold) * 0.5;
        } else {
          this.llmUsage.daysBetweenCalls =
            alpha * daysSinceLastUsage + (1 - alpha) * daysBetweenCalls;
          if (this.app) {
            if (promptTokens && completionTokens) {
              const newInputBytesPerToken = inputBytes / promptTokens;
              const oldInputBytesPerToken =
                this.llmUsage.inputBytesPerToken[this.app.app] ||
                defaultInputBytesPerToken;
              alpha = newInputBytesPerToken < oldInputBytesPerToken ? 0.5 : 0.1; //more aggressive for decrease (potentially malicious)
              this.llmUsage.inputBytesPerToken[this.app.app] =
                alpha * newInputBytesPerToken +
                (1 - alpha) * oldInputBytesPerToken;
              const newOutputTokens = completionTokens;
              const oldOutputTokens =
                this.llmUsage.outputTokens[this.app.app] || defaultOutputTokens;
              alpha = newOutputTokens > oldOutputTokens ? 0.5 : 0.1; //more aggressive for increase (potentially malicious)
              this.llmUsage.outputTokens[this.app.app] =
                alpha * newOutputTokens + (1 - alpha) * oldOutputTokens;
            } else {
              console.error("missing promptTokens or completionTokens");
            }

            if (userApproved) {
              this.llmUsage.costThreshold[this.app.app] =
                (this.llmUsage.costThreshold[this.app.app] ||
                  defaultLlmCostThreshold) * 1.2;
            }
          }
        }
      }
      await requestPutData(
        "llmUsage",
        {
          ts: now,
          daysBetweenCalls: this.llmUsage.daysBetweenCalls,
          inputBytesPerToken: this.llmUsage.inputBytesPerToken,
          outputTokens: this.llmUsage.outputTokens,
          costThreshold: this.llmUsage.costThreshold,
        },
        {
          app: "magicsandbox.Assistant",
          evictionPolicy: "fifo",
        },
      );
    } catch (error) {
      console.error(error);
    }
  }
  getLlmExpectedCost(
    inputBytes: number,
    maxCompletionTokens: number,
    modelName?: string,
  ) {
    const app = this.app ? this.app.app : undefined;
    const expectedInputTokens =
      inputBytes /
      (this.llmUsage.inputBytesPerToken[app] || defaultInputBytesPerToken);
    const expectedOutputTokens = Math.min(
      this.llmUsage.outputTokens[app] || defaultOutputTokens,
      maxCompletionTokens,
    );
    let expectedCost;
    const model = modelName ? models[modelName] : undefined;
    if (model && model.input_cost_per_token && model.output_cost_per_token) {
      expectedCost =
        model.input_cost_per_token * expectedInputTokens +
        model.output_cost_per_token * expectedOutputTokens;
    }
    return {
      expectedInputTokens,
      expectedOutputTokens,
      expectedCost,
    };
  }
  getLlmBudget(inputBytes: number, maxCompletionTokens: number) {
    const { balance, balanceRemainingDays } = this.user || {};
    if (!balanceRemainingDays || balance <= 0.05) {
      if (!balance && balance !== 0) {
        console.error("missing balance");
      }
      return Math.min(Math.max(balance || 0.01, 0.001), 0.01);
    }
    /*
    solve for llmBudget in this equation, where llmFinalCostPct is the finalCost as a percentage of llmBudget
    balance / balanceRemainingDays = appUsagePerDay + (llmCallsPerDay * llmBudget * llmFinalCostPct)
    llmFinalCostPct is driven by:
    - not using all of maxCompletionTokens
    - "rounding down" to a cheaper model, e.g. maxCost is .1, model A costs .15, model B costs .05 - we "round down" to model B
    */
    const appUsagePerDay =
      this.appUsage.usagePerCall / this.appUsage.daysBetweenCalls;
    const llmCallsPerDay = 1 / this.llmUsage.daysBetweenCalls;
    const { expectedInputTokens, expectedOutputTokens } =
      this.getLlmExpectedCost(inputBytes, maxCompletionTokens);
    const expectedTokenCostPct = //output tokens are ~4x more expensive
      (expectedInputTokens + expectedOutputTokens * 4) /
      (expectedInputTokens + maxCompletionTokens * 4);
    const llmFinalCostPct = expectedTokenCostPct * 0.5; //0.5 is fudge factor to account for "rounding down" - todo do something smarter
    const llmBudget =
      (balance / balanceRemainingDays - appUsagePerDay) /
      (Math.max(llmCallsPerDay, 1) * llmFinalCostPct);
    if (!llmBudget && llmBudget !== 0) {
      console.error("missing llmBudget");
    }
    return Math.min(Math.max(llmBudget || 0.005, 0.005), balance, 0.5);
  }
  async handleInput({
    input,
    initContext,
    continueSystemPrompt,
    resetInput = () => {},
    mockContent,
  }: {
    input?: string;
    initContext?: string;
    continueSystemPrompt?: Message["continueSystemPrompt"];
    resetInput?: () => void;
    mockContent?: string[];
  }) {
    let nextContinueSystemPrompt: Message["continueSystemPrompt"] | undefined;
    try {
      if (!this.sandboxRef) {
        throw new Error("Sandbox not initialized");
      }
      const sandboxId = this.sandboxRef.getSandboxId();
      const conversationId = this.currentConversation.conversationId;
      const abortSignal = this.abortIdController.signal(conversationId);
      abortSignal.aborted = false; //may have stopped the previous message, but reset now that we started again
      this.setChatLoading(true);
      const originalMessages = [...this.currentConversation.messages];
      if (input) {
        this.handleUpdateUserMessage({
          tags: [{ tag: "user_request", content: `\n${input}\n` }],
        });
      } else if (initContext) {
        this.handleUpdateUserMessage({
          tags: [{ tag: "app_context", content: `\n${initContext}\n` }],
        });
      } else if (!continueSystemPrompt) {
        throw new Error("Invalid AssistantState.handleInput call");
      }
      if (!initContext && this.app) {
        let context, selection;
        try {
          ({ context, selection } = await this.sandboxRef.getContext(
            sandboxId,
            10000,
          ));
        } catch {
          //ignore
        }
        if (abortSignal.aborted) return;
        this.handleUpdateUserMessage({
          tags: [
            {
              tag: "app_context",
              content: `\n${context || `App did not provide context. The app is ${this.app.app}: ${this.app.description}`}\n`,
            },
          ],
        });
        if (selection && selection.length < 1000) {
          this.handleUpdateUserMessage({
            tags: [
              {
                tag: "user_highlighted_text",
                content: `\n${selection}\n`,
              },
            ],
          });
        }
      } else if (!originalMessages.find((message) => message.role === "user")) {
        this.handleUpdateUserMessage({
          tags: [
            {
              tag: "favorited_apps",
              content: formatFavoritedApps(Object.values(this.appData)),
            },
          ],
        });
      }
      if (abortSignal.aborted) return;
      let systemPrompt;
      ({ systemPrompt, continueSystemPrompt: nextContinueSystemPrompt } =
        prompt({
          app: this.app,
          initContext,
          continueSystemPrompt,
        }));
      const llmMessages = [
        {
          role: "system",
          content: systemPrompt,
        },
        ...newMessages.map((message, i, filteredMessages) => ({
          role: message.role,
          content: formatMessage(message, i === filteredMessages.length - 1),
        })),
      ];
      const inputBytes = new TextEncoder().encode(
        JSON.stringify(llmMessages),
      ).length;
      let maxCompletionTokens;
      let showMaxLengthCta = true;
      if (this.user?.balance > 0.5) {
        maxCompletionTokens = 10000;
        showMaxLengthCta = false;
      } else if (this.user?.balance > 0.05) {
        maxCompletionTokens = 5000;
      } else {
        maxCompletionTokens = 2000;
      }
      let model, maxCost;
      let approved = true;
      let askedUser = false;
      if (this.model === "auto") {
        maxCost = this.getLlmBudget(inputBytes, maxCompletionTokens);
      } else {
        model = this.model;
        maxCost =
          models[model].input_cost_per_token * inputBytes + //assume one token per byte
          models[model].output_cost_per_token * maxCompletionTokens;
        if (this.app) {
          const { expectedCost } = this.getLlmExpectedCost(
            inputBytes,
            maxCompletionTokens,
            model,
          );
          if (
            expectedCost >
            (this.llmUsage.costThreshold[this.app.app] ||
              defaultLlmCostThreshold)
          ) {
            const { promise, callback } = this.handleApprove(conversationId);
            this.setConfirm({
              header: "Approve Chat Cost?",
              message: `${this.app.app} provided a lot of information, which increases cost. This chat is expected to cost ${formatAsDollars(expectedCost)}.`,
              callback,
            });
            approved = await promise;
            askedUser = true;
          }
        }
      }
      if (abortSignal.aborted) return;
      if (!approved) {
        this.handleUpdateConversation({ messages: originalMessages }); //reset messages
        resetInput();
        this.handleLlmUsage({ userApproved: false });
        return;
      }
      const llmArgs = [
        {
          messages: llmMessages,
          model,
          max_completion_tokens: maxCompletionTokens,
          maxCost,
        },
      ];
      const updateSummary =
        this.conversations[conversationId]?.summary === null;
      if (updateSummary) {
        const summaryArgs = createSummaryArgs(newMessages);
        if (summaryArgs) {
          llmArgs.push(summaryArgs);
          maxCost += summaryArgs.maxCost;
        }
      }
      let stream: AsyncIterable<{ result?: LlmResult }>;
      if (mockContent?.[0]) {
        stream = mockLlm(model, mockContent[0]);
      } else {
        stream = await requestFunction<LlmResult>(
          "magicsandbox.llm@0.1",
          llmArgs,
          {
            maxCost,
            stream: true,
          },
        );
      }
      const llmMessage: Message = {
        role: "assistant",
        tags: [],
      };
      let summary = "";
      let promptTokens, completionTokens;
      const chunkProcessor = (chunk: { result?: LlmResult }) => {
        const { model, content, usage, finish_reason, index } =
          chunk.result || {};
        if (index === 1) {
          summary += content;
        } else {
          if (model) {
            llmMessage.model = models[model]?.name || model;
          }
          if (usage) {
            ({
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
            } = usage);
          }
          if (finish_reason === "length") {
            let cta, assistantCta;
            if (!this.user?.name) {
              cta = "Sign up for a free account";
              assistantCta = "sign up for a free account";
            } else if (!this.user?.paid) {
              cta = "Upgrade to Magic Sandbox Plus";
              assistantCta = "upgrade to Magic Sandbox Plus";
            } else if (showMaxLengthCta) {
              cta = "Add balance to your account";
              assistantCta = "add balance to their account";
            }
            this.addToast(
              cta
                ? `Assistant response reached max length. ${cta} to get longer responses.`
                : "Assistant response reached max length. Please try again.",
              "error",
            );
            this.handleUpdateUserMessage({
              tags: [
                {
                  tag: "logs",
                  content: `Response reached max length. Please be more concise in your next response.${
                    assistantCta
                      ? ` If the user seems confused or frustrated about the max length error, you can tell them that they can ${assistantCta} to get longer responses.`
                      : ""
                  }`,
                },
              ],
            });
          }
          return content;
        }
      };
      let lastTag;
      const scriptPromises = [];
      const handleScript = async (script: string) => {
        if (!this.sandboxRef) {
          throw new Error("Sandbox not initialized");
        }
        try {
          return await this.sandboxRef.executeScriptAndWaitForResponse({
            sandboxId,
            script,
            timeout: 30000,
          });
        } catch (e) {
          console.error(e);
          const logs = ["[Uncaught Error] Error: script timed out"];
          const error = new Error("Error: script timed out");
          return { logs, error };
        }
      };
      for await (const { tag, content } of tagStreamParser({
        stream,
        chunkProcessor,
        validTags: ["intermediate_script", "final_script", "open_app"],
      })) {
        if (abortSignal.aborted) return;
        lastTag = llmMessage.tags[llmMessage.tags.length - 1];
        if (lastTag && lastTag.tag === tag) {
          lastTag.content += content;
        } else {
          llmMessage.tags.push({ tag, content });
          if (
            lastTag?.tag === "intermediate_script" ||
            lastTag?.tag === "final_script"
          ) {
            //if the script is finished, we want to start executing it now
            //but we'll let the assistant continue to respond and await the scriptPromises once the assistant is done
            scriptPromises.push(handleScript(lastTag.content));
          }
        }
        this.handleUpdateConversation({
          messages: [...newMessages, { ...llmMessage }], //create new llmMessage since Message component is memoized
        });
      }
      //if the script is the final tag, we didn't run it above, so we need to run it now
      lastTag = llmMessage.tags[llmMessage.tags.length - 1];
      if (
        lastTag?.tag === "intermediate_script" ||
        lastTag?.tag === "final_script"
      ) {
        scriptPromises.push(handleScript(lastTag.content));
      }
      if (!mockContent?.[0]) {
        this.handleLlmUsage({
          inputBytes,
          promptTokens,
          completionTokens,
          userApproved: askedUser ? true : null,
        });
      }
      if (updateSummary) {
        this.handleUpdateConversation({ summary });
      }
      //only use first open_app tag
      const openAppTag = llmMessage.tags.find((tag) => tag.tag === "open_app");
      if (openAppTag && !this.app) {
        const app = this.appData[openAppTag.content.trim()];
        if (app?.favorited) {
          await this.handleApp({
            app: app.app,
            messages: [...newMessages, llmMessage],
            mockContent: mockContent ? mockContent.slice(1) : undefined,
          });
        } else {
          this.handleUpdateUserMessage({
            tags: [
              {
                tag: "logs",
                content: "Error: Invalid app in <open_app> tags",
              },
            ],
            promptToContinue: "Error opening app. Try again?",
            continueSystemPrompt: nextContinueSystemPrompt,
          });
        }
        return;
      }
      const scriptTags = llmMessage.tags.filter(
        (tag) =>
          tag.tag === "intermediate_script" || tag.tag === "final_script",
      );
      if (scriptTags.length > 0) {
        const scriptResults = await Promise.all(scriptPromises);
        //if (abortSignal.aborted) return; //at this point just finish
        const logs = scriptResults.map((result) => result.logs).flat();
        this.handleUpdateUserMessage({
          tags: [
            {
              tag: "logs",
              content: formatLogs(logs),
            },
          ],
        });
        if (scriptResults.some((result) => result.error)) {
          this.handleUpdateUserMessage({
            promptToContinue: "Something went wrong. Try again?",
            continueSystemPrompt: nextContinueSystemPrompt,
          });
        } else if (
          scriptTags.some((tag) => tag.tag === "intermediate_script")
        ) {
          const prevAssistantMessage = messages.findLast(
            (message) => message.role === "assistant",
          );
          if (
            prevAssistantMessage?.tags.some(
              ({ tag }) => tag === "intermediate_script",
            )
          ) {
            //if two intermediate scripts in a row, prompt user to approve
            this.handleUpdateUserMessage({
              promptToContinue: "Allow Assistant to continue?",
              continueSystemPrompt: nextContinueSystemPrompt,
            });
          } else {
            await this.handleInput({
              messages: [...newMessages, llmMessage, nextUserMessage],
              continueSystemPrompt: nextContinueSystemPrompt,
              mockContent: mockContent ? mockContent.slice(1) : undefined,
            });
            return;
          }
        }
      }
    } catch (error) {
      console.error(error);
      nextUserMessage.tags.push({
        tag: "logs",
        content:
          "Error: unexpected error generating message. Please try again.",
      });
      nextUserMessage.promptToContinue = "Error generating message. Try again?";
      nextUserMessage.continueSystemPrompt = nextContinueSystemPrompt;
    } finally {
      this.setChatLoading(false);
      if (
        nextUserMessage.tags.length > 0 ||
        nextUserMessage.promptToContinue ||
        nextUserMessage.continueSystemPrompt
      ) {
        this.handleUpdateConversation({
          message: nextUserMessage,
        });
      }
    }
  }
  async handleApp({
    app,
    mockContent,
  }: {
    app: string;
    mockContent?: string[];
  }) {
    if (!this.sandboxRef) {
      throw new Error("Sandbox not initialized");
    }
    try {
      const conversationId = this.currentConversation.conversationId;
      const abortSignal = this.abortIdController.signal(conversationId);
      const sandboxId = this.sandboxRef.getSandboxId();
      this.setApp(false); //indicates app is loading
      let result;
      try {
        result = await requestApp(app, {
          includeMetadata: [...includeMetadata, "finalCost"],
        });
      } catch (error) {
        throw new ToastError(
          `Failed to load ${app}: ${error instanceof Error ? error.message : "Unexpected error"}`,
          "error",
        );
      }
      if (abortSignal.aborted) return;
      const appNoVersion = result.metadata.id.split("@")[0]!;
      requestUrlParams({ _app: appNoVersion }).catch(console.error);
      const appData = {
        ...this.appData[appNoVersion],
        id: result.metadata.id,
        app: appNoVersion,
        description: result.metadata.description,
        recent: Date.now(),
      };
      this.setApp(appData);
      this.setAppData({
        ...this.appData,
        [appNoVersion]: appData,
      });
      this.budget = 0;
      this.sandboxRef.postMessage(sandboxId, result);
      this.handleAppUsage(result.metadata.finalCost);
      let initContext;
      try {
        ({ result: initContext } = await this.sandboxRef.getInit({
          sandboxId,
          timeout: 10000,
        }));
      } catch {
        //ignore
      }
      if (abortSignal.aborted) return;
      //if loaded from a url, there's no input and the init context is irrelevant
      if (messages && initContext) {
        //by default, chat is collapsed after opening an app. but open it since assistant is going to send another message
        this.setChatCollapsed(false);
        await this.handleInput({
          initContext,
          mockContent,
        });
      }
    } catch (error) {
      this.handleError(error);
    }
  }
  handleError(error: unknown) {
    console.error(error);
    let message = "please try again";
    let type: ToastType = "error";
    if (error instanceof ToastError) {
      message = error.message;
      type = error.type;
    }
    this.addToast(`Error: ${message}`, type);
  }
  handlePublish(magicObj: any) {
    //todo type
    const id = `${this.user.name}.${magicObj.name}@${magicObj.version}`;
    const app = id.split("@")[0]!;
    const appData = {
      ...this.appData[app],
      id,
      app,
      description: magicObj.description,
      published: Date.now(),
      recent: Date.now(),
    };
    this.setAppData({
      ...this.appData,
      [app]: appData,
    });
  }
  handleFavorite(app: App) {
    const favorited = app.favorited ? undefined : Date.now();
    const newApp = {
      ...app,
      favorited,
      recent: Date.now(),
    };
    if (this.app && this.app.app === app.app) {
      this.setApp(newApp);
    }
    this.setAppData({
      ...this.appData,
      [app.app]: newApp,
    });
    this.addToast(
      `${app.app} ${favorited ? "favorited" : "unfavorited"}`,
      "info",
    );
  }
  handleFeedback(feedback: boolean) {
    const encoder = new TextEncoder();
    let messages = this.currentConversation.messages;
    const messagesLength = encoder.encode(JSON.stringify(messages)).length;
    if (messagesLength > 100000) {
      messages = messages.map((message, i) => ({
        role: message.role,
        tags:
          i === messages.length - 1
            ? message.tags
            : message.tags.filter(
                ({ tag }) =>
                  tag !== "app_context" && tag !== "user_highlighted_text",
              ),
        model: message.model,
      }));
    }
    requestSandbox("feedback", {
      feedback: feedback ? "positive" : "negative",
      app: this.app ? this.app.id : "magicsandbox.Assistant@0.4.0", //todo how to avoid hardcoding version?
      messages,
      ts: Date.now(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    });
  }
  reload() {
    this.abortIdController.abort(null);
    this.abortIdController = new AbortIdController();
    if (!this.seenTutorial) {
      this.setShowTutorialTooltip(true);
    }
    this.setChatInput("");
    this.setChatCollapsed(true);
    this.setChatLoading(false);
    this.budget = 0;
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

export { includeMetadata, AssistantState, AbortIdController };
