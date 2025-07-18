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

import { createDriver } from "./driver.ts";

const defaultInputBytesPerToken = 4;
const defaultOutputTokens = 500;
const defaultLlmCostThreshold = 0.1;

class Assistant {
  constructor({
    user,
    sandboxRef,
    toastsRef,
    setConfirm,
    setRisk,
    initData,
    assistantState,
  }) {
    this.user = user;
    this.sandboxRef = sandboxRef;
    this.toastsRef = toastsRef;
    this.setConfirm = setConfirm;
    this.setRisk = setRisk;
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
  handleAppUsage(finalCost) {
    this.assistantState.handleAppUsage(finalCost);
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
    this.assistantState.handlePublish(magicObj);
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
    this.setApp(null);
    this.requestQueue = [];
    this.risks.forEach((risk) => risk.init());
    this.assistantState.reload();
    const driverStep = this.driver.getActiveStep();
    if (driverStep?.element === "#driver-home") {
      this.driver.handleNextClick();
    }
  }
}

export { Assistant };
