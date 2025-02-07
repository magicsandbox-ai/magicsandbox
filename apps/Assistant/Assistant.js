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
  formatSuggestedApps,
  formatLogs,
  inputSystemPrompt,
  initSystemPrompt,
  magicSystemPrompt,
} from "./prompts.js";
import { tagStreamParser } from "@magicsandbox.ai/streaming";

class Assistant {
  constructor({
    urlParams,
    userBalance,
    userBalanceRemainingDays,
    sandboxRef,
    settingsRef,
    toastsRef,
    setConfirm,
    setRisk,
    setMessages,
    setChatLoading,
    setApp,
  }) {
    this.urlParams = urlParams;
    this.userBalance = userBalance;
    this.userBalanceRemainingDays = userBalanceRemainingDays;
    this.sandboxRef = sandboxRef;
    this.settingsRef = settingsRef;
    this.toastsRef = toastsRef;
    this.setConfirm = setConfirm;
    this.setRisk = setRisk;
    this.setMessages = setMessages;
    this.setChatLoading = setChatLoading;
    this._setApp = setApp;
    this.app = null;
    this.abortController = new AbortController();
    this.budget = null;
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
  setDisplayMessage(message) {
    this.setMessages((messages) => {
      return [
        ...messages,
        { role: "display", tags: [{ content: `\n\n${message}` }] },
      ];
    });
  }
  async updateBudget(update = true) {
    if (!this.userBalanceRemainingDays || this.userBalance < 0.05) {
      const budget = Math.min(this.userBalance || 0.005, 0.005);
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
        this.userBalance /
          (this.userBalanceRemainingDays / avgDaysBetweenUsage),
        this.userBalance / 5,
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
      { app: "magicsandbox.Assistant" },
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
  async handleInput({ input, messages, initContext }) {
    try {
      const sandboxId = this.sandboxRef.current.getSandboxId();
      const abortSignal = this.abortController.signal;
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
      this.setMessages([
        ...newMessages,
        {
          role: "display", //this message gets overwritten below by the llm response
          tags: [{ content: "Working on it..." }],
        },
      ]);
      const userMessage = newMessages[newMessages.length - 1];
      if (messages.length === 0) {
        await this.updateBudget();
        if (abortSignal.aborted) return;
        const { result } = await requestFunction("magicsandbox.findApp", {
          input,
          maxCost: this.budget,
        });
        if (abortSignal.aborted) return;
        userMessage.tags.push({
          tag: "suggested_apps",
          content: formatSuggestedApps(result),
        });
      } else if (this.app) {
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
        if (selection?.length < 1000) {
          userMessage.tags.push({
            tag: "user_highlighted_text",
            content: `\n${selection}\n`,
          });
        }
      }
      let systemPrompt;
      if (!this.app) {
        systemPrompt = inputSystemPrompt;
      } else if (initContext) {
        systemPrompt = initSystemPrompt;
      } else {
        systemPrompt = magicSystemPrompt;
      }
      const llmBudget = await this.updateBudget(false);
      if (abortSignal.aborted) return;
      const llmMessages = [
        { role: "system", content: systemPrompt },
        ...newMessages
          .filter((message) => message.role !== "display")
          .map((message, i, filteredMessages) => ({
            role: message.role,
            content: formatMessage(message, i === filteredMessages.length - 1),
          })),
      ];
      console.log(llmMessages);
      const stream = await requestFunction(
        "magicsandbox.llm",
        { messages: llmMessages },
        { maxCost: llmBudget, stream: true },
      );
      const llmMessage = {
        role: "assistant",
        tags: [],
      };
      for await (const { tag, content } of tagStreamParser({
        stream,
        chunkProcessor: (chunk) => chunk.result,
      })) {
        if (abortSignal.aborted) return;
        llmMessage.tags.push({ tag, content });
        this.setMessages([...newMessages, llmMessage]);
      }
      for (const tag of llmMessage.tags) {
        if (tag.tag === "launch_app") {
          await this.handleApp({
            input,
            app: tag.content.trim(),
            messages: llmMessages,
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
          this.setMessages((messages) => {
            return [
              ...messages,
              {
                role: "user",
                tags: [{ tag: "logs", content: formatLogs(logs) }],
                promptToContinue: tag.tag === "intermediate_script",
              },
            ];
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
    try {
      const abortSignal = this.abortController.signal;
      const sandboxId = this.sandboxRef.current.getSandboxId();
      this.setDisplayMessage(`Loading ${app}...`);
      if (!messages) {
        // loading from a url
        // setDisplayMessage will cause ChatDisplay to briefly appear while the app loads
        // so we call setApp now to avoid the flash
        // we still need to call setApp in handleAppResult to get the resolved app version
        this.setApp(app);
      }
      const handleAppResult = async (result) => {
        this.setDisplayMessage(`${result.metadata.app} loaded`);
        this.setApp(result.metadata.app);
        this.sandboxRef.current.postMessage(sandboxId, result);
        if (input) {
          //if loaded from a url, there's no input and the init context is irrelevant
          let initContext;
          try {
            initContext = await this.sandboxRef.current.getInit(
              sandboxId,
              {
                input,
                budget: Math.max(this.budget - result.metadata.finalCost, 0),
                urlParams: this.urlParams,
              },
              10000,
            );
          } catch {
            //ignore
          }
          if (abortSignal.aborted) return;
          if (initContext) {
            this.handleInput({
              messages,
              initContext,
            });
          }
        }
      };
      if (this.budget === null) {
        await this.updateBudget();
        if (abortSignal.aborted) return;
      }
      try {
        const result = await requestApp(app, {
          maxCost: this.budget,
          updateUrl: true,
        });
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
                    maxCost: error.data.minCost,
                    updateUrl: true,
                  });
                  if (abortSignal.aborted) return;
                  await handleAppResult(result);
                } catch (error) {
                  this.handleError(error);
                }
              } else {
                this.setDisplayMessage(`${app} not opened`);
              }
            },
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      this.handleError(error);
    }
  }
  handleThumbsUp() {
    this.handleScore(1);
  }

  handleThumbsDown() {
    this.handleScore(-1);
  }
  async handleScore(score) {
    console.log(score);
    // try {
    //   await requestFunction(
    //     "magicsandbox.findApp",
    //     {
    //       score, //todo
    //       app: this.app,
    //     },
    //     { app: "magicsandbox.Assistant" },
    //   );
    // } catch (error) {
    //   console.error(error);
    // }
  }
  handleRequest(event) {
    window.clearTimeout(this.requestTimeoutId);
    event.sandboxId = this.sandboxRef.current.getSandboxId();
    this.requestQueue.push(event);
    this.requestTimeoutId = window.setTimeout(() => {
      this.requestTimeoutId = null;
      this.processRequestBatch();
    }, 50);
  }
  async processRequestBatch() {
    if (this.requestProcessing || this.requestQueue.length === 0) return;
    const abortSignal = this.abortController.signal;
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
          this.app,
        );
        if (validation) {
          this.sandboxRef.current.postMessage(event.sandboxId, {
            id,
            error: { validation },
          });
          event.error = true;
        }
      }
      batch = batch.filter((event) => !event.error);
      if (batch.length === 0) return;
      const riskResponses = this.risks.map((risk) => risk.handleBatch(batch));
      let approved,
        askedUser = false;
      const error = riskResponses.find((response) => response.error);
      if (error) {
        approved = false;
      } else if (riskResponses.some((response) => response.message)) {
        approved = await this.handleApprove(
          riskResponses.filter((r) => r.message),
        );
        if (abortSignal.aborted) return;
        askedUser = true;
        if (!approved) {
          this.handleScore(-0.1);
        }
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
              if (response?.[Symbol.asyncIterator]) {
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
        }, 50);
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
    this.userBalance = metadata.userBalance;
    this.userBalanceRemainingDays = metadata.userBalanceRemainingDays;
    this.risks.forEach((risk) => risk.handleMetadata(metadata, id));
  }

  reload() {
    this.abortController.abort();
    this.abortController = new AbortController();
    this.sandboxRef.current.reload();
    this.handleApprovePromise?.resolve(false);
    this.setConfirm(null);
    this.setRisk(null);
    this.setMessages([]);
    this.setChatLoading(false);
    this.setApp(null);
    this.budget = null;
    this.requestQueue = [];
    this.risks.forEach((risk) => risk.init());
  }
}

export { Assistant };
