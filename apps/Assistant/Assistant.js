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
  magicSystemPrompt,
} from "./prompts.js";
import { tagStreamParser } from "@magicsandbox.ai/streaming";

class Assistant {
  constructor({
    sandboxRef,
    settingsRef,
    toastsRef,
    setConfirm,
    setRisk,
    setMessages,
    setChatLoading,
    setState,
  }) {
    this.sandboxRef = sandboxRef;
    this.settingsRef = settingsRef;
    this.toastsRef = toastsRef;
    this.setConfirm = setConfirm;
    this.setRisk = setRisk;
    this.setMessages = setMessages;
    this._setChatLoading = setChatLoading;
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
  setChatLoading(chatLoading) {
    this.chatLoading = chatLoading;
    this._setChatLoading(chatLoading);
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
  async updateBudget() {
    const { balance, balanceDays } = window.args;
    if (!balanceDays || balance < 0.05) {
      this.budget = Math.min(balance, 0.005);
      return;
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
    this.budget = Math.max(
      Math.min(
        balance / (balanceDays / avgDaysBetweenUsage),
        balance / 5,
        0.2, //todo allow configuring
      ),
      0.005,
    );
    requestPutData("magicsandbox.Assistant", "usageData", {
      avgDaysBetweenUsage,
      ts: now,
    }).catch(console.error);
  }
  handleError(error) {
    console.error(error);
    let message = "Error: please try again";
    let type = "error";
    if (error.name === "ToastError") {
      message = error.message;
      type = error.type;
    } else if (error.name === "RequestSandboxError") {
      message = error.message;
    }
    this.setDisplayContent(`Error: ${message}`);
    this.toastsRef.current.addToast(message, type);
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
      const requestFunctionMaxCost = 0.001; //todo??
      const { result } = await requestFunction(
        "magicsandbox.findApp",
        {
          input,
          maxCost: this.budget, //this is an argument for findApp
        },
        { maxCost: requestFunctionMaxCost }, //this is an option for requestFunction
      );
      if (abortSignal.aborted) return;
      const { apps } = result;
      newMessages[newMessages.length - 2].content = formatInput(input, apps);
      let message = "";
      let app = "";
      await this.handleChat({
        messages: newMessages,
        systemPrompt: inputSystemPrompt,
        streamHandler: (content, tag) => {
          if (tag === "app") {
            app += content;
          } else if (tag === "message") {
            message += content;
            this.setMessages((messages) => [
              ...messages.slice(0, -1),
              { role: "assistant", content: message, displayContent: message },
            ]);
          }
        },
      });
      if (app) {
        await this.handleApp({ app });
      }
    } catch (error) {
      this.handleError(error);
    }
  }
  async handleChat({ messages, systemPrompt, streamHandler }) {
    try {
      const abortSignal = this.abortController.signal;
      this.setChatLoading(true);
      await this.updateBudget();
      if (abortSignal.aborted) return;
      const stream = await requestFunction(
        "magicsandbox.llm",
        {
          messages: [
            { role: "system", content: systemPrompt },
            ...messages
              .filter((message) => message.content)
              .map((message) => ({
                role: message.role,
                content: message.content,
              })),
          ],
        },
        { maxCost: this.budget, stream: true },
      );
      for await (const { content, tag } of tagStreamParser({
        stream,
        chunkProcessor: (chunk) => chunk.result,
      })) {
        if (abortSignal.aborted) return;
        streamHandler(content, tag);
      }
    } finally {
      this.setChatLoading(false);
    }
  }
  async handleApp({ input, app: _app, urlParams }) {
    try {
      this.reload(); //todo
      const sandboxId = this.sandboxRef.current.getSandboxId();
      await this.updateBudget();
      let budget = this.budget;
      let app;
      if (!_app) {
        this.setDisplayContent(`Working on it...`);
        const requestFunctionMaxCost = 0.001;
        const { result } = await requestFunction(
          "magicsandbox.findApp",
          {
            input,
            maxCost: this.budget, //this is an argument for findApp
          },
          { maxCost: requestFunctionMaxCost }, //this is an option for requestFunction
        );
        //const { inputEmbedding, apps, inputId }
        const { apps } = result;
        budget -= requestFunctionMaxCost;
        this.financialRisk.approvedCost += requestFunctionMaxCost;
        app = apps[0].app;
        this.setDisplayContent(`Loading ${app}...`);
      } else {
        app = _app;
        this.setDisplayContent(`Loading ${app}...`);
      }
      const handleAppResult = (result) => {
        this.app = result.metadata.app;
        budget = Math.max(budget - result.metadata.finalCost, 0);
        this.sandboxRef.current.postMessage(sandboxId, {
          args: {
            input,
            budget,
            urlParams: urlParams || {},
          },
          ...result,
        });
        this.setDisplayContent(`${result.metadata.app} loaded`);
      };
      let result;
      try {
        result = await requestApp(app, { maxCost: budget, updateUrl: true });
      } catch (error) {
        if (_app && error.data?.minCost) {
          //if app was provided through bang or URL, but budget is lower than minCost, prompt user to approve
          this.setConfirm({
            header: `Open App ${app}?`,
            message: `${app} costs ${formatAsDollars(error.data.minCost)}, which is higher than your budget`,
            callback: async (response) => {
              this.setConfirm(null);
              if (response) {
                result = await requestApp(app, {
                  maxCost: error.data.minCost,
                  updateUrl: true,
                });
                handleAppResult(result);
              } else {
                this.setDisplayContent(`${app} not opened`);
              }
            },
          });
        } else {
          throw error;
        }
      }
      handleAppResult(result);
      return {};
    } catch (error) {
      this.handleError(error);
    }
  }
  async handleMagic({ input, messages }) {
    try {
      const sandboxId = this.sandboxRef.current.getSandboxId();
      const abortSignal = this.abortController.signal;
      this.setChatLoading(true);
      await this.updateBudget();
      if (abortSignal.aborted) return;
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
      let context, selection;
      if (!this.app) {
        context = "This is a blank page you can use to run scripts as needed.";
      } else {
        try {
          ({ context, selection } =
            await this.sandboxRef.current.postMessageAndWaitForResponse(
              sandboxId,
              { request: "context" },
              10000,
            ));
        } catch {
          context = "App did not provide context";
        }
      }
      if (abortSignal.aborted) return;
      const llmMessages = newMessages
        .filter((message) => message.content)
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));
      llmMessages[llmMessages.length - 1].content += formatContext(
        context,
        selection,
      );
      llmMessages.unshift({ role: "system", content: magicSystemPrompt });
      const stream = await requestFunction(
        "magicsandbox.llm",
        { messages: llmMessages },
        { maxCost: this.budget, stream: true },
      );
      let intermediateScript = false;
      let message = "";
      let script = "";
      let prevTag;
      for await (const { content, tag } of tagStreamParser({
        stream,
        chunkProcessor: (chunk) => chunk.result,
      })) {
        if (abortSignal.aborted) return;
        if (tag === "intermediate_script") {
          intermediateScript = true;
        }
        if (tag === "final_script" || tag === "intermediate_script") {
          if (tag !== prevTag) {
            message += `~~~magicscript${content.startsWith("\n") ? "" : "\n"}`;
          }
          script += content;
        } else if (
          prevTag === "final_script" ||
          prevTag === "intermediate_script"
        ) {
          message += `${script.endsWith("\n") ? "" : "\n"}~~~`;
        }
        prevTag = tag;
        message += content;
        this.setMessages((messages) => {
          return [
            ...messages.slice(0, -1),
            { role: "assistant", content: message, displayContent: message },
          ];
        });
      }
      if (script) {
        const { logs } =
          await this.sandboxRef.current.postMessageAndWaitForResponse(
            sandboxId,
            { request: "script", data: { script } },
            30000,
          );
        if (abortSignal.aborted) return;
        this.setMessages((messages) => {
          return [...messages, { role: "user", content: formatLogs(logs) }];
        });
      }
      return { intermediateScript };
    } catch (error) {
      this.handleError(error);
    } finally {
      this.setChatLoading(false);
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
    this.app = null;
    this.requestQueue = [];
    this.risks.forEach((risk) => risk.init());
  }
}

export { Assistant };
