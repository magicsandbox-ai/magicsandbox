/* global requestSandbox, requestFunction, requestApp */

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
import { createDeferredPromise } from "@utils.js";

class Assistant {
  constructor({ sandboxRef, settingsRef, toastsRef, setConfirm, setMessage }) {
    this.sandboxRef = sandboxRef;
    this.settingsRef = settingsRef;
    this.toastsRef = toastsRef;
    this.setConfirm = setConfirm;
    this.setMessage = setMessage;
    this.budget = null;
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
  async handleInput({ input, magic, app, messages }) {
    try {
      if (magic) {
        await handleMagic({
          input,
          maxCost: this.budget, //todo need to subtract what's already been spent? what if app has not been called?
          assistant: this,
          messages,
        });
      } else {
        await handleApp({
          input,
          app,
          assistant: this,
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
  updateBudget() {
    this.budget = 0.1; //todo //can be mutated by FinancialRisk
  }
  handleThumbsUp() {
    this.handleScore(1);
  }
  handleThumbsDown() {
    this.handleScore(-1);
  }
  async handleScore(score) {
    try {
      await requestFunction("magicsandbox.scoreApp", {
        score,
        app: this.app,
      });
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
            .then(async (response) => {
              if (request === "app" || request === "function") {
                this.handleMetadata(response, id);
              }
              if (response?.[Symbol.asyncIterator]) {
                response = await this.sandboxRef.current.streamData(response);
              }
              this.sandboxRef.current.postMessage(event.sandboxId, {
                id,
                response,
              });
            })
            .catch((error) => {
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
      this.isProcessing = false;
      if (!this.requestTimeoutId) {
        this.requestTimeoutId = window.setTimeout(() => {
          this.processRequestBatch();
        }, 50);
      }
    }
  }
  async handleApprove(riskResponses) {
    const approved = createDeferredPromise();
    const callback = (response) => {
      //arrow function ensures `this` refers to Assistant
      this.setConfirm(null);
      approved.resolve(response);
    };
    this.setConfirm({
      riskResponses,
      callback,
    });
    return approved;
  }
  async handleMetadata(response, id) {
    let metadata;
    if (response?.[Symbol.asyncIterator]) {
      for await (const chunk of response) {
        if (chunk.metadata) {
          metadata = chunk.metadata;
        }
      }
    } else {
      metadata = response.metadata;
    }
    this.risks.forEach((risk) => risk.handleMetadata(metadata, id));
  }
}

async function handleApp({ input, app, assistant }) {
  assistant.sandboxRef.current.reload();
  const sandboxId = assistant.sandboxRef.current.getSandboxId();
  assistant.updateBudget();
  if (!app) {
    app = await requestFunction(assistant.settingsRef.current.findApp, {
      input,
      maxCost: assistant.budget,
      appWeights: assistant.settingsRef.current.appWeights,
    });
    //prompt tuning?
    //send weights / prompt tuning parameters as buffers? careful with how requestFunction serializes. maybe not worth it
  }
  assistant.setMessage(`Loading ${app}...`);
  const result = await requestApp(app, { maxCost: assistant.budget }); //todo subtract what's already been spent?
  assistant.app = result.metadata.app;
  assistant.risks.forEach((risk) => risk.init());
  assistant.sandboxRef.current.postMessage(sandboxId, {
    args: {
      input,
      budget: assistant.budget, //todo subtract what's already been spent? finalCost?
    },
    ...result,
  });
  assistant.setMessage(`${result.metadata.app} loaded`);
}

export { Assistant };
