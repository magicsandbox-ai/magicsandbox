import {
  FinancialRisk,
  PublishRisk,
  PrivacyRisk,
  DataLossRisk,
  DownloadRisk,
  RateLimitRisk,
} from "./Risks.js";
import { handleMagic } from "./handleMagic.js";
import { validateAndDefaultRequest } from "@magicsandbox.ai/react-sandbox";
import { createDeferredPromise, formatAsDollars } from "@utils.js";

class Assistant {
  constructor({
    sandboxRef,
    settingsRef,
    toastsRef,
    setConfirm,
    setRisk,
    setMessage,
  }) {
    this.sandboxRef = sandboxRef;
    this.settingsRef = settingsRef;
    this.toastsRef = toastsRef;
    this.setConfirm = setConfirm;
    this.setRisk = setRisk;
    this.setMessage = setMessage;
    this.budget = null; //mutated by updateBudget and FinancialRisk
    this.app = null;
    this.requestTimeoutId = null;
    this.requestQueue = [];
    this.isProcessing = false;
    this.risks = [];
    //these add themselves to `this.risks`
    this.financialRisk = new FinancialRisk({ assistant: this });
    this.publishRisk = new PublishRisk({ assistant: this });
    this.privacyRisk = new PrivacyRisk({ assistant: this });
    this.dataLossRisk = new DataLossRisk({ assistant: this });
    this.downloadRisk = new DownloadRisk({ assistant: this });
    this.rateLimitRisk = new RateLimitRisk({ assistant: this });
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
    let avgDaysBetweenUsage = 0.2;
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
  async handleInput({ input, magic, app, messages, urlParams }) {
    try {
      await this.updateBudget();
      if (magic) {
        await handleMagic({
          input,
          maxCost: this.budget,
          assistant: this,
          messages,
        });
      } else {
        await this.handleApp({
          input,
          app,
          urlParams,
        });
      }
    } catch (error) {
      console.error(error);
      let message = "Error: please try again";
      let type = "error";
      if (error.name === "ToastError") {
        message = error.message;
        type = error.type;
      } else if (error.name === "RequestSandboxError") {
        message = error.message;
      }
      this.setMessage(`Error: ${message}`);
      this.toastsRef.current.addToast(message, type);
    }
  }
  async handleApp({ input, app: _app, urlParams }) {
    this.reload();
    const sandboxId = this.sandboxRef.current.getSandboxId();
    let budget = this.budget;
    let app;
    if (!_app) {
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
    } else {
      app = _app;
    }
    this.setMessage(`Loading ${app}...`);
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
      this.setMessage(`${result.metadata.app} loaded`);
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
              this.setMessage(`${app} not opened`);
            }
          },
        });
      } else {
        throw error;
      }
    }
    handleAppResult(result);
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
    if (this.isProcessing || this.requestQueue.length === 0) return;
    this.isProcessing = true;
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
        if (this.abortPromise) return;
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
      if (this.abortPromise) return;
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
              if (this.abortPromise) return;
              let finalResponse = response;
              if (response?.[Symbol.asyncIterator]) {
                finalResponse = this.sandboxRef.current.streamData(response);
              }
              this.sandboxRef.current.postMessage(event.sandboxId, {
                id,
                response: finalResponse,
              });
              if (request === "app" || request === "function") {
                await this.handleMetadata(response, id);
              }
            } catch (error) {
              if (this.abortPromise) return;
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
      this.isProcessing = false;
      if (!this.requestTimeoutId) {
        this.requestTimeoutId = window.setTimeout(() => {
          this.processRequestBatch();
        }, 50);
      }
      this.abortPromise?.resolve();
    }
  }
  async handleApprove(riskResponses) {
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
  async handleMetadata(response, id) {
    let metadata;
    if (response?.[Symbol.asyncIterator]) {
      for await (const chunk of response) {
        if (this.abortPromise) return;
        if (chunk.metadata) {
          metadata = chunk.metadata;
        }
      }
    } else {
      metadata = response.metadata;
    }
    this.risks.forEach((risk) => risk.handleMetadata(metadata, id));
  }
  async reload() {
    this.sandboxRef.current.reload();
    this.requestQueue = [];
    this.handleApprovePromise?.resolve(false);
    this.setRisk(null);
    this.setConfirm(null);
    if (this.isProcessing) {
      this.abortPromise = createDeferredPromise();
      await this.abortPromise;
      this.abortPromise = null;
    }
    this.app = null;
    this.risks.forEach((risk) => risk.init());
  }
}

export { Assistant };
