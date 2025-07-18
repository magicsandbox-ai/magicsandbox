import {
  FinancialRisk,
  PublishRisk,
  PrivacyRisk,
  DataLossRisk,
  DownloadRisk,
  RateLimitRisk,
} from "./Risks.ts";
import {
  validateAndDefaultRequest,
  createDeferredPromise,
} from "@magicsandbox.ai/react-sandbox";
import { formatAsDollars } from "./utils.ts";
import {
  formatMessage,
  formatFavoritedApps,
  formatLogs,
  prompt,
  createSummaryArgs,
} from "./prompt.ts";
import { tagStreamParser } from "@magicsandbox.ai/streaming";
import { models } from "./ModelPicker.tsx";
import { ToastError } from "@utils/Toast.ts";
import { mockLlm } from "./driver.ts";
import { createDriver } from "./driver.ts";

const includeMetadata = ["id", "description"];
const defaultInputBytesPerToken = 4;
const defaultOutputTokens = 500;
const defaultLlmCostThreshold = 0.1;

class Assistant {
  constructor({
    user,
    sandboxRef,
    appDataRef,
    toastsRef,
    modelRef,
    setConfirm,
    setRisk,
    setChatLoading,
    setAppData,
    initData,
    assistantState,
  }) {
    this.user = user;
    this.sandboxRef = sandboxRef;
    this.appDataRef = appDataRef;
    this.toastsRef = toastsRef;
    this.modelRef = modelRef;
    this.setConfirm = setConfirm;
    this.setRisk = setRisk;
    this.setChatLoading = setChatLoading;
    this.setAppData = setAppData;
    this.assistantState = assistantState;
    this.driver = createDriver(this, (state) =>
      assistantState.handleDriverStateChange(state),
    );
    if (assistantState.currentConversation.conversationId === "0") {
      this.driver.drive();
    }
    this.setApp(null);
    this.handleApprovePromises = {};
    this.appUsage = {
      daysBetweenCalls: 0.2,
      //assume 1/5 balance on apps, 5 times per day
      usagePerCall: Math.max(
        user?.balance / user?.balanceRemainingDays / 5 / 5 || 0.001,
        0.001,
      ),
      pendingUsage: 0,
      timeoutId: null,
      ...initData?.appUsage,
    };
    this.llmUsage = initData?.llmUsage || {
      daysBetweenCalls: 0.2,
      inputBytesPerToken: {}, //keyed by author.name
      outputTokens: {}, //keyed by author.name
      costThreshold: {}, //keyed by author.name
    };
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
  get app() {
    return this.assistantState.app;
  }
  setApp(app) {
    this.assistantState.setApp(app);
  }
  setShowChatHistory(show) {
    this.assistantState.setShowChatHistory(show);
  }
  get abortIdController() {
    return this.assistantState.abortIdController;
  }
  handleStopConversation() {
    this.assistantState.handleStopConversation();
  }
  handleNewConversation() {
    this.assistantState.handleNewConversation();
  }
  handleSwitchConversation(conversationId) {
    this.assistantState.handleSwitchConversation(conversationId);
  }
  handleUpdateConversation({ conversationId, messages, message, summary }) {
    this.assistantState.handleUpdateConversation({
      conversationId,
      messages,
      message,
      summary,
    });
  }
  async handleDeleteConversations(conversationIds) {
    this.assistantState.handleDeleteConversations(conversationIds);
  }
  setDisplayMessage(message) {
    this.handleUpdateConversation({
      message: { role: "display", tags: [{ content: `\n\n${message}` }] },
    });
  }
  handleAppUsage(finalCost) {
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
  getLlmExpectedCost(inputBytes, maxCompletionTokens, model) {
    const expectedInputTokens =
      inputBytes /
      (this.llmUsage.inputBytesPerToken[this.app?.app] ||
        defaultInputBytesPerToken);
    const expectedOutputTokens = Math.min(
      this.llmUsage.outputTokens[this.app?.app] || defaultOutputTokens,
      maxCompletionTokens,
    );
    let expectedCost;
    if (model) {
      expectedCost =
        models[model].input_cost_per_token * expectedInputTokens +
        models[model].output_cost_per_token * expectedOutputTokens;
    }
    return {
      expectedInputTokens,
      expectedOutputTokens,
      expectedCost,
    };
  }
  getLlmBudget(inputBytes, maxCompletionTokens) {
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
  async handleInput({
    input,
    messages = [],
    initContext,
    continueSystemPrompt,
    resetInput = () => {},
    mockContent,
  }) {
    let nextContinueSystemPrompt;
    try {
      const sandboxId = this.sandboxRef.current.getSandboxId();
      const conversationId =
        this.assistantState.currentConversation.conversationId;
      const abortSignal = this.abortIdController.signal(conversationId);
      abortSignal.aborted = false; //may have stopped the previous message, but reset now that we started again
      this.setChatLoading(true);
      if (mockContent) {
        messages = this.assistantState.currentConversation.messages; //todo clean this up
      }
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
      } else if (continueSystemPrompt) {
        //continuing after an intermediate_script, already created user message with logs
        newMessages = [...messages];
      } else {
        throw new Error("Invalid Assistant.handleInput call");
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
      if (!initContext && this.app) {
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
          content: `\n${context || `App did not provide context. The app is ${this.app.app}: ${this.app.description}`}\n`,
        });
        if (selection && selection.length < 1000) {
          userMessage.tags.push({
            tag: "user_highlighted_text",
            content: `\n${selection}\n`,
          });
        }
      } else if (!messages.find((message) => message.role === "user")) {
        userMessage.tags.push({
          tag: "favorited_apps",
          content: formatFavoritedApps(Object.values(this.appDataRef.current)),
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
        ...newMessages
          .filter((message) => message.role !== "display")
          .map((message, i, filteredMessages) => ({
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
      if (this.modelRef.current === "auto") {
        maxCost = this.getLlmBudget(inputBytes, maxCompletionTokens);
      } else {
        model = this.modelRef.current;
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
        this.handleUpdateConversation({ messages }); //reset messages
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
        this.assistantState.conversations[conversationId]?.summary === null;
      if (updateSummary) {
        const summaryArgs = createSummaryArgs(newMessages);
        if (summaryArgs) {
          llmArgs.push(summaryArgs);
          maxCost += summaryArgs.maxCost;
        }
      }
      let stream;
      if (mockContent?.[0]) {
        stream = mockLlm(model, mockContent[0]);
      } else {
        stream = await requestFunction("magicsandbox.llm@0.1", llmArgs, {
          maxCost,
          stream: true,
        });
      }
      const llmMessage = {
        role: "assistant",
        tags: [],
      };
      const newUserMessage = {
        role: "user",
        tags: [],
      };
      let summary = "";
      let promptTokens, completionTokens;
      const chunkProcessor = (chunk) => {
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
            this.toastsRef.current.addToast(
              cta
                ? `Assistant response reached max length. ${cta} to get longer responses.`
                : "Assistant response reached max length. Please try again.",
              "error",
            );
            newUserMessage.tags.push({
              tag: "logs",
              content: `Response reached max length. Please be more concise in your next response.${
                assistantCta
                  ? ` If the user seems confused or frustrated about the max length error, you can tell them that they can ${assistantCta} to get longer responses.`
                  : ""
              }`,
            });
          }
          return content;
        }
      };
      let lastTag;
      const scriptPromises = [];
      const handleScript = async (script) => {
        try {
          return await this.sandboxRef.current.executeScriptAndWaitForResponse({
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
        const app = this.appDataRef.current[openAppTag.content.trim()];
        if (app?.favorited) {
          await this.handleApp({
            app: app.app,
            messages: [...newMessages, llmMessage],
            mockContent: mockContent ? mockContent.slice(1) : undefined,
          });
        } else {
          this.handleUpdateConversation({
            message: {
              role: "user",
              tags: [
                {
                  tag: "logs",
                  content: "Error: Invalid app in <open_app> tags",
                },
              ],
              promptToContinue: "Error opening app. Try again?",
              continueSystemPrompt: nextContinueSystemPrompt,
            },
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
        const newUserMessage = {
          role: "user",
          tags: [{ tag: "logs", content: formatLogs(logs) }],
        };
        if (scriptResults.some((result) => result.error)) {
          newUserMessage.promptToContinue = "Something went wrong. Try again?";
          newUserMessage.continueSystemPrompt = nextContinueSystemPrompt;
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
            newUserMessage.promptToContinue = "Allow Assistant to continue?";
            newUserMessage.continueSystemPrompt = nextContinueSystemPrompt;
          } else {
            await this.handleInput({
              messages: [...newMessages, llmMessage, newUserMessage],
              continueSystemPrompt: nextContinueSystemPrompt,
              mockContent: mockContent ? mockContent.slice(1) : undefined,
            });
            return;
          }
        }
        this.handleUpdateConversation({
          message: newUserMessage,
        });
      }
    } catch (error) {
      console.error(error);
      this.handleUpdateConversation({
        message: {
          role: "user",
          tags: [
            {
              tag: "logs",
              content:
                "Error: unexpected error generating message. Please try again.",
            },
          ],
          promptToContinue: "Error generating message. Try again?",
          continueSystemPrompt: nextContinueSystemPrompt,
        },
      });
    } finally {
      this.setChatLoading(false);
    }
  }
  async handleApp({ app, messages, mockContent }) {
    let conversationId;
    try {
      conversationId = this.assistantState.currentConversation.conversationId;
      const abortSignal = this.abortIdController.signal(conversationId);
      const sandboxId = this.sandboxRef.current.getSandboxId();
      if (!messages) {
        // loading from a url or from home page
        // setDisplayMessage will cause ChatDisplay to briefly appear while the app loads
        // so we call setApp now with the special value of false (rather than null) to avoid the flash
        this.setApp(false);
      }
      let result;
      try {
        result = await requestApp(app, {
          includeMetadata: [...includeMetadata, "finalCost"],
        });
      } catch (error) {
        throw new ToastError(
          `Failed to load ${app}: ${error.message}`,
          "error",
        );
      }
      if (abortSignal.aborted) return;
      const appNoVersion = result.metadata.id.split("@")[0];
      requestUrlParams({ _app: appNoVersion }).catch(console.error);
      const appData = {
        ...this.appDataRef.current[appNoVersion],
        id: result.metadata.id,
        app: appNoVersion,
        description: result.metadata.description,
        recent: Date.now(),
      };
      this.setApp(appData);
      this.setAppData((currentAppData) => ({
        ...currentAppData,
        [appNoVersion]: appData,
      }));
      this.budget = 0;
      this.sandboxRef.current.postMessage(sandboxId, result);
      this.handleAppUsage(result.metadata.finalCost);
      let initContext;
      try {
        ({ result: initContext } = await this.sandboxRef.current.getInit({
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
        this.assistantState.setChatCollapsed(false);
        await this.handleInput({
          messages,
          initContext,
          mockContent,
        });
      }
    } catch (error) {
      this.handleError(error);
    }
  }
  handleRequest(event) {
    event.sandboxId = this.sandboxRef.current.getSandboxId();
    this.requestQueue.push(event);
    if (!this.requestTimeoutId) {
      this.requestTimeoutId = setTimeout(() => {
        this.requestTimeoutId = null;
        this.processRequestBatch();
      }, 16);
    }
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
        let validation;
        try {
          validateAndDefaultRequest(request, data, {
            assistant: true,
            app: this.app.id,
            includeMetadata: ["finalCost"],
          });
        } catch (error) {
          validation = error.message;
        }
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
        const { promise, callback } = this.handleApprove("risk");
        this.setRisk({
          riskResponses: riskResponses.filter((r) => r.message),
          callback,
        });
        approved = await promise;
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
        this.requestTimeoutId = setTimeout(() => {
          this.requestTimeoutId = null;
          this.processRequestBatch();
        }, 16);
      }
    }
  }
  handleApprove(id) {
    this.handleApprovePromises[id] = createDeferredPromise();
    const callback = (response) => {
      this.handleApprovePromises[id].resolve(response);
    };
    return { promise: this.handleApprovePromises[id], callback };
  }
  async handleMetadata(response, id, abortSignal) {
    let metadata;
    if (response[Symbol.asyncIterator]) {
      for await (const chunk of response) {
        if (abortSignal.aborted) return;
        if (chunk.metadata) {
          metadata = chunk.metadata;
        }
      }
    } else {
      metadata = response.metadata;
    }
    this.risks.forEach((risk) => risk.handleMetadata(metadata, id));
    this.handleAppUsage(metadata.finalCost);
  }
  handlePublish(magicObj) {
    const id = `${this.user.name}.${magicObj.name}@${magicObj.version}`;
    const app = id.split("@")[0];
    const appData = {
      ...this.appDataRef.current[app],
      id,
      app,
      description: magicObj.description,
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
    const newApp = {
      ...app,
      favorited,
      recent: Date.now(),
    };
    if (this.app?.app === app.app) {
      this.setApp(newApp);
    }
    this.setAppData((currentAppData) => ({
      ...currentAppData,
      [app.app]: newApp,
    }));
    this.toastsRef.current.addToast(
      `${app.app} ${favorited ? "favorited" : "unfavorited"}`,
      "info",
    );
  }
  handleFeedback(feedback) {
    const encoder = new TextEncoder();
    let messages = this.assistantState.currentConversation.messages;
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
  setSeenTutorial(seen) {
    this.assistantState.setSeenTutorial(seen);
  }
  reload() {
    this.sandboxRef.current.reload();
    Object.values(this.handleApprovePromises).forEach((promise) =>
      promise.resolve(false),
    );
    this.setConfirm(null);
    this.setRisk(null);
    this.handleNewConversation();
    this.setChatLoading(false);
    this.setApp(null);
    this.budget = null;
    this.requestQueue = [];
    this.risks.forEach((risk) => risk.init());
    this.assistantState.reload();
    const driverStep = this.driver.getActiveStep();
    if (driverStep?.element === "#driver-home") {
      this.driver.handleNextClick();
    }
  }
}

export { includeMetadata, Assistant };
