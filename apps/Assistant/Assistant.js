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
  formatInput,
  formatLogs,
  formatContext,
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
    setState,
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
    this.setState = setState;
    this.abortController = new AbortController();
    this.budget = null;
    this.app = null;
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
  setDisplayContent(newDisplayContent) {
    this.setMessages((messages) => {
      const message = messages[messages.length - 1];

      if (message?.role !== "assistant") {
        return [
          ...messages,
          {
            role: "assistant",
            displayContent: newDisplayContent,
          },
        ];
      }
      return [
        ...messages.slice(0, -1),
        {
          ...message,
          displayContent: newDisplayContent,
        },
      ];
    });
  }
  async updateBudget(update = true) {
    if (!this.userBalanceRemainingDays || this.userBalance < 0.05) {
      const budget = Math.min(this.userBalance, 0.005);
      if (update) {
        this.budget = budget;
      }
      return budget;
    }
    const usageData = await requestGetData(
      "magicsandbox.Assistant",
      "usageData",
    );
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
    requestPutData("magicsandbox.Assistant", "usageData", {
      avgDaysBetweenUsage,
      ts: now,
    }).catch(console.error);
    return budget;
  }
  handleError(error) {
    console.error(error);
    let message = "please try again";
    let type = "error";
    if (error.name === "ToastError") {
      message = error.message;
      type = error.type;
    } else if (error.name === "RequestSandboxError") {
      message = error.message;
    }
    this.setDisplayContent(`Error: ${message}`);
    this.toastsRef.current.addToast(`Error: ${message}`, type);
  }
  async handleInput({ input, messages }) {
    try {
      const abortSignal = this.abortController.signal;
      const newMessages = [
        ...messages,
        { role: "user", displayContent: input },
        { role: "assistant", displayContent: "Working on it..." },
      ];
      this.setMessages(newMessages);
      let apps;
      if (messages.length === 0) {
        await this.updateBudget();
        if (abortSignal.aborted) return;
        const { result } = await requestFunction("magicsandbox.findApp", {
          input,
          maxCost: this.budget,
        });
        if (abortSignal.aborted) return;
        apps = result.apps;
      }
      newMessages[newMessages.length - 2].content = formatInput(input, apps);
      let messageContent = "";
      let messageDisplayContent = "";
      let app = "";
      let finalMessages;
      await this.handleChat({
        messages: newMessages,
        systemPrompt: inputSystemPrompt,
        streamHandler: (content, tag, originalContent) => {
          messageContent += originalContent;
          if (tag === "app") {
            app += content;
          } else {
            messageDisplayContent += content;
          }
          finalMessages = [
            ...newMessages.slice(0, -1),
            {
              role: "assistant",
              content: messageContent,
              displayContent: messageDisplayContent,
            },
          ];
          this.setMessages(finalMessages);
        },
      });
      if (abortSignal.aborted) return;
      if (app) {
        this.setMessages((messages) => {
          //this is a hack to prevent handleApp from overwriting the current assistant message when it calls setDisplayContent
          return [...messages, { role: "assistant" }];
        });
        await this.handleApp({
          input,
          app: app.trim(),
          messages: finalMessages,
        });
      }
    } catch (error) {
      this.handleError(error);
    }
  }
  async handleChat({ messages, systemPrompt, streamHandler }) {
    try {
      const abortSignal = this.abortController.signal;
      this.setChatLoading(true);
      const budget = await this.updateBudget(false);
      if (abortSignal.aborted) return;
      messages = [
        { role: "system", content: systemPrompt },
        ...messages
          .filter((message) => message.content)
          .map((message) => ({
            role: message.role,
            content: message.content,
          })),
      ];
      console.log(messages);
      const stream = await requestFunction(
        "magicsandbox.llm",
        { messages },
        { maxCost: budget, stream: true },
      );
      for await (const { content, tag, originalContent } of tagStreamParser({
        stream,
        chunkProcessor: (chunk) => chunk.result,
      })) {
        if (abortSignal.aborted) return;
        streamHandler(content, tag, originalContent);
      }
    } finally {
      this.setChatLoading(false);
    }
  }
  async handleApp({ input, app, messages }) {
    try {
      const abortSignal = this.abortController.signal;
      const sandboxId = this.sandboxRef.current.getSandboxId();
      this.setDisplayContent(`Loading ${app}...`);
      const handleAppResult = async (result) => {
        this.app = result.metadata.app;
        this.setDisplayContent(`${result.metadata.app} loaded`);
        this.setState("app");
        this.sandboxRef.current.postMessage(sandboxId, result);
        try {
          const context = await this.sandboxRef.current.getInit(
            sandboxId,
            {
              input,
              budget: Math.max(this.budget - result.metadata.finalCost, 0),
              urlParams: this.urlParams,
            },
            10000,
          );
          if (abortSignal.aborted) return;
          if (input && context) {
            //if loaded from a url, there's no input and we don't want to handleInit
            await this.handleInit({
              messages,
              context,
              app: result.metadata.app,
            });
          }
        } catch {
          //ignore
        }
      };
      if (this.budget === null) {
        await this.updateBudget();
        if (abortSignal.aborted) return;
      }
      let result;
      try {
        result = await requestApp(app, {
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
                  result = await requestApp(app, {
                    maxCost: error.data.minCost,
                    updateUrl: true,
                  });
                  if (abortSignal.aborted) return;
                  await handleAppResult(result);
                } catch (error) {
                  this.handleError(error);
                }
              } else {
                this.setDisplayContent(`${app} not opened`);
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
  async handleInit({ messages, context, app }) {
    try {
      //add the context for the llm call, but it's never saved with setMessages
      //so future llm calls will not have it (which is what we want)
      const prevMessage = messages[messages.length - 1];
      let newMessages;
      if (prevMessage?.role === "user") {
        newMessages = [
          ...messages.slice(0, -1),
          {
            role: "user",
            content: `${prevMessage.content}\n${formatContext(context)}`,
            displayContent: prevMessage.displayContent,
          },
        ];
      } else {
        newMessages = [
          ...messages,
          { role: "user", content: formatContext(context) }, //todo how to remove this for later calls?
        ];
      }
      newMessages.push({
        role: "assistant",
        displayContent: `Initializing ${app}...`,
      });
      await this.handleScript({
        messages: newMessages,
        systemPrompt: initSystemPrompt,
      });
    } catch (error) {
      this.handleError(error);
    }
  }
  async handleScript({ messages, systemPrompt }) {
    try {
      const sandboxId = this.sandboxRef.current.getSandboxId();
      const abortSignal = this.abortController.signal;
      let messageContent = "";
      let messageDisplayContent = "";
      let script = "";
      let intermediateScript = false;
      let prevTag;
      await this.handleChat({
        messages,
        systemPrompt,
        streamHandler: (content, tag, originalContent) => {
          messageContent += originalContent;
          if (tag === "intermediate_script") {
            intermediateScript = true;
          }
          if (tag === "final_script" || tag === "intermediate_script") {
            if (tag !== prevTag) {
              messageDisplayContent += `~~~magicscript${content.startsWith("\n") ? "" : "\n"}`;
            }
            script += content;
          } else if (
            prevTag === "final_script" ||
            prevTag === "intermediate_script"
          ) {
            messageDisplayContent += `${script.endsWith("\n") ? "" : "\n"}~~~`;
          }
          prevTag = tag;
          messageDisplayContent += content;
          this.setMessages((messages) => {
            return [
              ...messages.slice(0, -1),
              {
                role: "assistant",
                content: messageContent,
                displayContent: messageDisplayContent,
              },
            ];
          });
        },
      });
      if (abortSignal.aborted) return;
      if (script) {
        let logs;
        try {
          ({ logs } =
            await this.sandboxRef.current.executeScriptAndWaitForResponse({
              sandboxId,
              script,
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
              content: formatLogs(logs),
              promptToContinue: intermediateScript,
            },
          ];
        });
      }
    } catch (error) {
      this.handleError(error);
    }
  }
  async handleMagic({ input, messages }) {
    try {
      const sandboxId = this.sandboxRef.current.getSandboxId();
      const abortSignal = this.abortController.signal;
      const prevMessage = messages[messages.length - 1];
      let newMessages;
      if (prevMessage?.role === "user") {
        //we've already created a message with the logs, so append the user input
        //we may not have input if the previous message had an intermediate_script, so handle that too
        newMessages = [
          ...messages.slice(0, -1),
          {
            role: "user",
            content: input
              ? `${prevMessage.content}\n${formatInput(input)}`
              : prevMessage.content,
            displayContent: input,
          },
        ];
      } else {
        if (!input) {
          throw new Error("Invalid handleMagic call");
        }
        newMessages = [
          ...messages,
          {
            role: "user",
            content: formatInput(input),
            displayContent: input,
          },
        ];
      }
      newMessages.push({
        role: "assistant",
        displayContent: "Working on it...",
      });
      this.setMessages(newMessages);
      let contextResult;
      try {
        contextResult = await this.sandboxRef.current.getContext(
          sandboxId,
          10000,
        );
      } catch {
        //ignore
      }
      if (abortSignal.aborted) return;
      //add the context for the llm call, but it's never saved with setMessages
      //so future llm calls will not have it (which is what we want)
      newMessages[newMessages.length - 2].content += formatContext(
        contextResult?.context || "App did not provide context",
        contextResult?.selection,
      );
      await this.handleScript({
        messages: newMessages,
        systemPrompt: magicSystemPrompt,
      });
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
    try {
      await requestFunction(
        "magicsandbox.findApp",
        {
          score, //todo
          app: this.app,
        },
        { app: "magicsandbox.Assistant" },
      );
    } catch (error) {
      console.error(error);
    }
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
        const validation = validateAndDefaultRequest(request, data, true);
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
      await Promise.all(
        batch.map(async (event) => {
          const { id, msg } = event.data;
          const { request, data } = msg;
          if (!approved) {
            this.sandboxRef.current.postMessage(event.sandboxId, {
              id,
              error: { message: error || "User denied the request" },
            });
          } else {
            if (request === "function") {
              data.options.app = this.app;
            }
            try {
              const response = await requestSandbox(request, data);
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
                await this.handleMetadata(response, id, abortSignal);
              }
            } catch (error) {
              if (abortSignal.aborted) return;
              this.sandboxRef.current.postMessage(event.sandboxId, {
                id,
                error: { message: error.message, data: error.data },
              });
            }
          }
        }),
      );
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
    this.setState("home");
    this.budget = null;
    this.app = null;
    this.requestQueue = [];
    this.risks.forEach((risk) => risk.init());
  }
}

export { Assistant };
