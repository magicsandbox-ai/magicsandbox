import {
  FinancialRisk,
  PublishRisk,
  PrivacyRisk,
  DataLossRisk,
  DownloadRisk,
  RateLimitRisk,
} from "./Risks.js";
import { validateAndDefaultRequest } from "@magicsandbox.ai/react-sandbox";
import { createDeferredPromise, formatAsDollars } from "@utils.js";
import {
  formatMessage,
  formatFavoritedApps,
  formatLogs,
  prompt,
} from "./prompt.js";
import { tagStreamParser } from "@magicsandbox.ai/streaming";
import { models } from "./ModelPicker.js";

class Assistant {
  constructor({
    user,
    sandboxRef,
    appDataRef,
    toastsRef,
    conversationsRef,
    currentConversationRef,
    conversationSummariesRef,
    modelRef,
    setConfirm,
    setRisk,
    setCurrentConversation,
    setConversationSummaries,
    setChatLoading,
    setCollapsed,
    setApp,
    setAppData,
  }) {
    this.user = user;
    this.sandboxRef = sandboxRef;
    this.appDataRef = appDataRef;
    this.toastsRef = toastsRef;
    this.conversationsRef = conversationsRef;
    this.currentConversationRef = currentConversationRef;
    this.conversationSummariesRef = conversationSummariesRef;
    this.modelRef = modelRef;
    this.setConfirm = setConfirm;
    this.setRisk = setRisk;
    this.setCurrentConversation = setCurrentConversation;
    this.setConversationSummaries = setConversationSummaries;
    this.setChatLoading = setChatLoading;
    this.setCollapsed = setCollapsed;
    this._setApp = setApp;
    this.setAppData = setAppData;
    this.app = null;
    this.abortIdController = new AbortIdController();
    this.budget = null;
    this.saveTimeoutIds = {};
    this.requestTimeoutId = null;
    this.requestQueue = [];
    this.requestProcessing = false;
    this.risks = [];
    //these add themselves to `this.risks`
    this.financialRisk = new FinancialRisk({ assistant: this });
    this.publishRisk = new PublishRisk({ assistant: this });
    this.privacyRisk = new PrivacyRisk({ assistant: this });
    this.dataLossRisk = new DataLossRisk({ assistant: this });
    this.downloadRisk = new DownloadRisk({ assistant: this });
    this.rateLimitRisk = new RateLimitRisk({ assistant: this });
  }
  setApp(app) {
    this._setApp(app);
    this.app = app;
  }
  handleStopConversation() {
    this.abortIdController.abort(
      this.currentConversationRef.current.conversationId,
    );
  }
  handleNewConversation() {
    this.handleStopConversation();
    const conversationId = Date.now();
    const conversation = {
      conversationId,
      messages: [],
      summary: null,
      lastUpdated: Date.now(),
    };
    this.conversationsRef.current[conversationId] = conversation;
    this.setCurrentConversation({
      conversationId,
      messages: conversation.messages,
    });
    this.setConversationSummaries((conversationSummaries) => [
      { conversationId, summary: conversation.summary },
      ...conversationSummaries,
    ]);
    document.getElementById("chat-input").focus();
  }
  handleSwitchConversation(conversationId) {
    if (conversationId !== this.currentConversationRef.current.conversationId) {
      this.handleStopConversation();
      const conversation = this.conversationsRef.current[conversationId];
      conversation.messages.push({
        role: "system",
        tags: [
          {
            content:
              "The user closed and then reopened the conversation, resetting all state. Any actions you took in previous messages, like launching an app or executing a script, are no longer valid. Continue to follow all previous system instructions and consider how to handle the next user request given that the state has been reset.",
          },
        ],
      });
      this.setCurrentConversation({
        conversationId,
        messages: conversation.messages,
      });
    }
  }
  handleUpdateConversation({ messages, message, summary }) {
    const conversationId = this.currentConversationRef.current.conversationId;
    const conversation = this.conversationsRef.current[conversationId];
    const messagesUpdated = messages !== undefined || message !== undefined;
    if (messagesUpdated) {
      conversation.lastUpdated = Date.now();
      if (messages !== undefined) {
        conversation.messages = messages;
      } else {
        conversation.messages.push(message);
      }
      this.setCurrentConversation({
        conversationId,
        messages: conversation.messages,
      });
    }
    const summaryUpdated = summary !== undefined;
    if (summaryUpdated) {
      conversation.summary = summary;
    }
    const latestConversation =
      this.conversationSummariesRef.current[0] === conversationId;
    if (messagesUpdated && !(!summaryUpdated && latestConversation)) {
      //if messages were updated, move the summary to the top
      //unless summary wasn't updated and it's already at the top - then do nothing
      this.setConversationSummaries((conversationSummaries) => [
        { conversationId, summary: conversation.summary },
        ...conversationSummaries.filter(
          (conversationSummary) =>
            conversationSummary.conversationId !== conversationId,
        ),
      ]);
    } else if (summaryUpdated) {
      //otherwise, if summary is updated, update in place
      this.setConversationSummaries((conversationSummaries) =>
        conversationSummaries.map((conversationSummary) =>
          conversationSummary.conversationId === conversationId
            ? { conversationId, summary: conversation.summary }
            : conversationSummary,
        ),
      );
    }
    this.conversationsRef.current[conversationId] = conversation;
    if (this.saveTimeoutIds[conversationId]) {
      clearTimeout(this.saveTimeoutIds[conversationId]);
    }
    this.saveTimeoutIds[conversationId] = setTimeout(() => {
      requestPutData(
        conversationId,
        this.conversationsRef.current[conversationId],
        {
          app: "magicsandbox.Assistant",
          evictionPolicy: "fifo",
        },
      ).catch(console.error);
      delete this.saveTimeoutIds[conversationId];
    }, 500);
  }
  setDisplayMessage(message) {
    this.handleUpdateConversation({
      message: { role: "display", tags: [{ content: `\n\n${message}` }] },
    });
  }
  async updateBudget(update = true) {
    const { userBalance, userBalanceRemainingDays } = this.user || {};
    if (!userBalanceRemainingDays || userBalance < 0.05) {
      const budget = Math.min(userBalance || 0.005, 0.005);
      if (update) {
        this.budget = budget;
      }
      return budget;
    }
    const usageData = await requestGetData("usageData", {
      app: "magicsandbox.Assistant",
    });
    const now = Date.now();
    let avgDaysBetweenUsage = 0.1;
    if (usageData) {
      const daysSinceLastUsage = (now - usageData.ts) / (1000 * 60 * 60 * 24);
      const alpha = 0.05;
      avgDaysBetweenUsage = Math.min(
        alpha * daysSinceLastUsage +
          (1 - alpha) * usageData.avgDaysBetweenUsage,
        1,
      );
    }
    const budget = Math.max(
      Math.min(
        userBalance / (userBalanceRemainingDays / avgDaysBetweenUsage),
        userBalance / 5,
        0.2, //todo allow configuring
      ),
      0.005,
    );
    if (update) {
      this.budget = budget;
    }
    requestPutData(
      "usageData",
      { avgDaysBetweenUsage, ts: now },
      { app: "magicsandbox.Assistant", evictionPolicy: "fifo" },
    ).catch(console.error);
    return budget;
  }
  handleError(error) {
    console.error(error);
    let message = "please try again";
    let type = "error";
    if (error.name === "ToastError") {
      message = error.message;
      type = error.type;
    }
    this.setDisplayMessage(`Error: ${message}`);
    this.toastsRef.current.addToast(`Error: ${message}`, type);
  }
  async handleInput({ input, messages = [], initContext }) {
    try {
      const conversationId = this.currentConversationRef.current.conversationId;
      const sandboxId = this.sandboxRef.current.getSandboxId();
      const abortSignal = this.abortIdController.signal(conversationId);
      abortSignal.aborted = false; //may have stopped the previous message, but reset now that we started again
      this.setChatLoading(true);
      const prevMessage = messages[messages.length - 1];
      let newMessages;
      if (input) {
        if (prevMessage?.role === "user") {
          // we already created a user message with the logs
          newMessages = [
            ...messages.slice(0, -1),
            {
              role: "user",
              tags: [
                ...prevMessage.tags,
                { tag: "user_request", content: `\n${input}\n` },
              ],
            },
          ];
        } else {
          newMessages = [
            ...messages,
            {
              role: "user",
              tags: [{ tag: "user_request", content: `\n${input}\n` }],
            },
          ];
        }
      } else if (initContext) {
        newMessages = [
          ...messages,
          {
            role: "user",
            tags: [{ tag: "app_context", content: `\n${initContext}\n` }],
          },
        ];
      } else {
        //continuing after an intermediate_script, already created user message with logs
        newMessages = [...messages];
      }
      this.handleUpdateConversation({
        messages: [
          ...newMessages,
          {
            role: "display", //this message gets overwritten below by the llm response
            tags: [{ content: "Working on it..." }],
          },
        ],
      });
      const userMessage = newMessages[newMessages.length - 1];
      if (messages.length === 0) {
        await this.updateBudget();
        if (abortSignal.aborted) return;
        userMessage.tags.push({
          tag: "favorited_apps",
          content: formatFavoritedApps(Object.values(this.appDataRef.current)),
        });
      } else if (!initContext && this.app) {
        let context, selection;
        try {
          ({ context, selection } = await this.sandboxRef.current.getContext(
            sandboxId,
            10000,
          ));
        } catch {
          //ignore
        }
        if (abortSignal.aborted) return;
        userMessage.tags.push({
          tag: "app_context",
          content: `\n${context || "App did not provide context"}\n`,
        });
        if (selection && selection.length < 1000) {
          userMessage.tags.push({
            tag: "user_highlighted_text",
            content: `\n${selection}\n`,
          });
        }
      }
      const llmBudget = await this.updateBudget(false);
      if (abortSignal.aborted) return;
      const llmMessages = [
        { role: "system", content: prompt({ app: this.app, initContext }) },
        ...newMessages
          .filter((message) => message.role !== "display")
          .map((message, i, filteredMessages) => ({
            role: message.role,
            content: formatMessage(message, i === filteredMessages.length - 1),
          })),
      ];
      console.log(llmMessages);
      async function* mockStream() {
        yield {
          result: {
            model: "claude-3-5-sonnet-20241022",
            content: `Hello world! ${Date.now()}`,
            summary: messages.length === 0 ? `Hello world ${Date.now()}` : null,
          },
        };
        for (let i = 0; i < 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          yield {
            result: { content: " test" },
          };
        }
      }
      const stream = mockStream();
      // const max_completion_tokens = 5000;
      // let model, maxCost;
      // if (this.modelRef.current === "auto") {
      //   maxCost = llmBudget;
      // } else {
      //   model = this.modelRef.current;
      //   const inputTokens = new TextEncoder().encode(
      //     JSON.stringify(messages),
      //   ).length; //one token per byte
      //   maxCost =
      //     models[model].input_cost_per_token * inputTokens +
      //     models[model].output_cost_per_token * max_completion_tokens;
      // }
      // const stream = await requestFunction(
      //   "magicsandbox.llm",
      //   {
      //     messages: llmMessages,
      //     model,
      //     max_completion_tokens,
      //     summarize: messages.length === 0,
      //   },
      //   { maxCost, stream: true },
      // );
      const llmMessage = {
        role: "assistant",
        tags: [],
      };
      const chunkProcessor = (chunk) => {
        const { model, content, summary } = chunk.result || {};
        if (model) {
          llmMessage.model = models[model]?.name || model;
        }
        if (summary) {
          this.handleUpdateConversation({ summary });
        }
        return content;
      };
      for await (const { tag, content } of tagStreamParser({
        stream,
        chunkProcessor,
        maxTagLength: 0, //mustdo delete this
      })) {
        if (abortSignal.aborted) return;
        const lastTag = llmMessage.tags[llmMessage.tags.length - 1];
        if (lastTag && lastTag.tag === tag) {
          lastTag.content += content;
        } else {
          llmMessage.tags.push({ tag, content });
        }
        this.handleUpdateConversation({
          messages: [...newMessages, llmMessage],
        });
      }
      for (const tag of llmMessage.tags) {
        if (!this.app && tag.tag === "launch_app") {
          await this.handleApp({
            input,
            app: tag.content.trim(),
            messages: [...newMessages, llmMessage],
          });
          break;
        } else if (
          tag.tag === "intermediate_script" ||
          tag.tag === "final_script"
        ) {
          let logs;
          try {
            ({ logs } =
              await this.sandboxRef.current.executeScriptAndWaitForResponse({
                sandboxId,
                script: tag.content,
                timeout: 30000,
              }));
          } catch (error) {
            console.error(error);
            logs = ["[Uncaught Error] Error: script timed out"];
          }
          if (abortSignal.aborted) return;
          this.handleUpdateConversation({
            messages: [
              ...newMessages,
              llmMessage,
              {
                role: "user",
                tags: [{ tag: "logs", content: formatLogs(logs) }],
                promptToContinue: tag.tag === "intermediate_script",
              },
            ],
          });
          break;
        }
      }
    } catch (error) {
      this.handleError(error);
    } finally {
      this.setChatLoading(false);
    }
  }
  async handleApp({ input, app, messages }) {
    let conversationId;
    try {
      conversationId = this.currentConversationRef.current.conversationId;
      const abortSignal = this.abortIdController.signal(conversationId);
      const sandboxId = this.sandboxRef.current.getSandboxId();
      this.setDisplayMessage(conversationId, `Loading ${app}...`);
      if (!messages) {
        // loading from a url
        // setDisplayMessage will cause ChatDisplay to briefly appear while the app loads
        // so we call setApp now with the special value of false (rather than null) to avoid the flash
        this.setApp(false);
      }
      const handleAppResult = async (result) => {
        this.setDisplayMessage(conversationId, `${result.metadata.id} loaded`);
        requestUrlParams({ _app: result.metadata.id }).catch(console.error);
        const app = result.metadata.id.split("@")[0];
        const appData = {
          ...this.appDataRef.current[app],
          id: result.metadata.id,
          app,
          description: result.metadata.description,
          minCost: result.metadata.minCost,
          status: result.metadata.status,
          recent: Date.now(),
        };
        this.setApp(appData);
        this.setAppData((currentAppData) => ({
          ...currentAppData,
          [app]: appData,
        }));
        this.sandboxRef.current.postMessage(sandboxId, result);
        let initContext;
        try {
          initContext = await this.sandboxRef.current.getInit({
            sandboxId,
            timeout: 10000,
          });
        } catch {
          //ignore
        }
        if (abortSignal.aborted) return;
        //if loaded from a url, there's no input and the init context is irrelevant
        if (input && initContext) {
          //by default, chat is collapsed after launching an app. but open it since assistant is going to send another message
          this.setCollapsed(false);
          this.handleInput({
            messages,
            initContext,
          });
        }
      };
      if (this.budget === null) {
        await this.updateBudget();
        if (abortSignal.aborted) return;
      }
      const requestAppOptions = {
        maxCost: this.budget,
        includeMetadata: [
          "id",
          "description",
          "minCost",
          "finalCost",
          "status",
        ],
      };
      try {
        const result = await requestApp(app, requestAppOptions);
        if (abortSignal.aborted) return;
        await handleAppResult(result);
      } catch (error) {
        if (abortSignal.aborted) return;
        if (error.data?.minCost) {
          //budget is lower than minCost, prompt user to approve
          this.setConfirm({
            header: `Open App ${app}?`,
            message: `${app} costs ${formatAsDollars(error.data.minCost)}, which is higher than your budget`,
            callback: async (response) => {
              this.setConfirm(null);
              if (response) {
                try {
                  const result = await requestApp(app, {
                    ...requestAppOptions,
                    maxCost: error.data.minCost,
                  });
                  if (abortSignal.aborted) return;
                  await handleAppResult(result);
                } catch (error) {
                  this.handleError(conversationId, error);
                }
              } else {
                this.setDisplayMessage(conversationId, `${app} not opened`);
              }
            },
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      this.handleError(conversationId, error);
    }
  }
  handleRequest(event) {
    window.clearTimeout(this.requestTimeoutId);
    event.sandboxId = this.sandboxRef.current.getSandboxId();
    this.requestQueue.push(event);
    this.requestTimeoutId = window.setTimeout(() => {
      this.requestTimeoutId = null;
      this.processRequestBatch();
    }, 16);
  }
  async processRequestBatch() {
    if (this.requestProcessing || this.requestQueue.length === 0) return;
    const abortSignal = this.abortIdController.signal(null);
    this.requestProcessing = true;
    let batch = [...this.requestQueue];
    this.requestQueue = [];
    try {
      for (const event of batch) {
        const { id, msg } = event.data;
        let { request, data } = msg;
        const validation = validateAndDefaultRequest(
          request,
          data,
          true,
          this.app.id,
        );
        if (validation) {
          this.sandboxRef.current.postMessage(event.sandboxId, {
            id,
            error: { message: validation },
          });
          event.error = true;
        }
      }
      batch = batch.filter((event) => !event.error);
      if (batch.length === 0) return;
      const riskResponses = this.risks.map((risk) => risk.handleBatch(batch));
      let approved,
        askedUser = false;
      const { error } = riskResponses.find((response) => response.error) || {};
      if (error) {
        approved = false;
      } else if (riskResponses.some((response) => response.message)) {
        approved = await this.handleApprove(
          riskResponses.filter((r) => r.message),
        );
        if (abortSignal.aborted) return;
        askedUser = true;
      } else {
        approved = true;
      }
      await Promise.all(
        riskResponses.map(
          ({ callback, message }) => callback?.(approved, message && askedUser), //askedUser is only true for the risks that returned a message
        ),
      );
      //careful with async callbacks - may have to pass in abortSignal
      //for now DataLossRisk is okay since it only updates lastAppBackups after awaiting
      if (abortSignal.aborted) return;
      for (const event of batch) {
        const { id, msg } = event.data;
        const { request, data } = msg;
        if (!approved) {
          this.sandboxRef.current.postMessage(event.sandboxId, {
            id,
            error: { message: error || "User denied the request" },
          });
        } else {
          requestSandbox(request, data)
            .then((response) => {
              if (abortSignal.aborted) return;
              let finalResponse = response;
              if (request === "urlParams") {
                finalResponse = Object.fromEntries(
                  Object.entries(response).filter(
                    ([key]) => !key.startsWith("_"), //params that start with _ are reserved
                  ),
                );
              } else if (response?.[Symbol.asyncIterator]) {
                finalResponse = this.sandboxRef.current.streamData(response);
              }
              this.sandboxRef.current.postMessage(event.sandboxId, {
                id,
                response: finalResponse,
              });
              if (request === "app" || request === "function") {
                this.handleMetadata(response, id, abortSignal).catch(
                  console.error,
                );
              } else if (request === "publish") {
                this.handlePublish(data.magicObj);
              }
            })
            .catch((error) => {
              if (abortSignal.aborted) return;
              this.sandboxRef.current.postMessage(event.sandboxId, {
                id,
                error: { message: error.message, data: error.data },
              });
            });
        }
      }
    } catch (error) {
      console.error(error);
      this.toastsRef.current.addToast("An unexpected error occurred", "error");
      for (const event of batch) {
        const { id } = event.data;
        this.sandboxRef.current.postMessage(event.sandboxId, {
          id,
          error: { message: "Unexpected Assistant error" },
        });
      }
    } finally {
      this.requestProcessing = false;
      if (!this.requestTimeoutId) {
        this.requestTimeoutId = window.setTimeout(() => {
          this.processRequestBatch();
        }, 16);
      }
    }
  }
  handleApprove(riskResponses) {
    this.handleApprovePromise = createDeferredPromise();
    const callback = (response) => {
      //arrow function ensures `this` refers to Assistant
      this.setRisk(null);
      this.handleApprovePromise.resolve(response);
    };
    this.setRisk({
      riskResponses,
      callback,
    });
    return this.handleApprovePromise;
  }
  async handleMetadata(response, id, abortSignal) {
    let metadata;
    if (response?.[Symbol.asyncIterator]) {
      for await (const chunk of response) {
        if (abortSignal.aborted) return;
        if (chunk.metadata) {
          metadata = chunk.metadata;
        }
      }
    } else {
      metadata = response.metadata;
    }
    this.user.userBalance = metadata.userBalance;
    this.user.userBalanceRemainingDays = metadata.userBalanceRemainingDays;
    this.risks.forEach((risk) => risk.handleMetadata(metadata, id));
  }
  handlePublish(magicObj) {
    const id = `${this.user.name}.${magicObj.name}@${magicObj.version}`;
    const app = id.split("@")[0];
    const appData = {
      ...this.appDataRef.current[app],
      id,
      app,
      description: magicObj.description,
      minCost: magicObj.minCost,
      status: magicObj.status,
      published: Date.now(),
      recent: Date.now(),
    };
    this.setAppData((currentAppData) => ({
      ...currentAppData,
      [app]: appData,
    }));
  }
  handleFavorite(app) {
    const favorited = app.favorited ? null : Date.now();
    const blocked = favorited ? null : app.blocked;
    const appData = {
      ...this.appDataRef.current[app.app],
      favorited,
      blocked,
      recent: Date.now(),
    };
    if (this.app?.app === app.app) {
      this.setApp(appData);
    }
    this.setAppData((currentAppData) => ({
      ...currentAppData,
      [app.app]: appData,
    }));
    this.toastsRef.current.addToast(
      `${app.app} ${favorited ? "favorited" : "unfavorited"}`,
      "info",
    );
  }
  handleBlock(app) {
    const blocked = app.blocked ? null : Date.now();
    const favorited = blocked ? null : app.favorited;
    const appData = {
      ...this.appDataRef.current[app.app],
      favorited,
      blocked,
      recent: Date.now(),
    };
    if (this.app?.app === app.app) {
      this.setApp(appData);
    }
    this.setAppData((currentAppData) => ({
      ...currentAppData,
      [app.app]: appData,
    }));
    this.toastsRef.current.addToast(
      `${app.app} ${blocked ? "blocked" : "unblocked"}`,
      "info",
    );
  }
  reload() {
    this.abortIdController.abort(null);
    this.abortIdController = new AbortIdController();
    this.sandboxRef.current.reload();
    this.handleApprovePromise?.resolve(false);
    this.setConfirm(null);
    this.setRisk(null);
    this.handleNewConversation();
    this.setChatLoading(false);
    this.setApp(null);
    this.budget = null;
    this.requestQueue = [];
    this.risks.forEach((risk) => risk.init());
  }
}

export { Assistant };

class AbortIdController {
  constructor() {
    this.signals = { null: { aborted: false } };
  }
  signal(id) {
    if (!this.signals[id]) {
      this.signals[id] = { aborted: false };
    }
    return this.signals[id];
  }
  abort(id) {
    if (id === null) {
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
