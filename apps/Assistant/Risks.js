import { formatAsDollars } from "@utils.js";
import { manageBackups } from "./utils.js";

/**
 * - init (optional)
 * - handleBatch
 * - handleRequest (optional):
 * - handleApprove (optional)
 * - handleMetadata (optional)
 */
class Risk {
  constructor({ assistant }) {
    this.assistant = assistant;
    assistant.risks.push(this);
    this.init();
  }
  init() {
    //pass
  }
  _handleBatch(batch) {
    for (const event of batch) {
      const { id, msg } = event.data;
      const { request, data } = msg;
      if (this.handleRequests.has(request)) {
        this.handleRequest(request, data, id);
      }
    }
  }
  /**
   * Processes a batch and determines if the batch should be approved, denied, or if user approval is needed.
   * - Returns an object with the following keys if the batch should be approved:
   *   - callback?: function(approved, askedUser)
   * - Returns an object with the following keys if the batch should be denied:
   *   - callback?: function(approved, askedUser)
   *   - error: string
   * - Returns an object with the following keys if user approval is needed:
   *   - callback?: function(approved, askedUser)
   *   - message: string
   *   - details?: string[]
   *   - downloadDetails?: object
   *     - text: string, used in the download button
   *     - filename: string, will be passed to requestDownload
   *     - content: string, will be passed to requestDownload
   */
  handleBatch() {
    throw new Error("Not implemented");
  }
  handleMetadata() {
    //pass
  }
}

class FinancialRisk extends Risk {
  constructor(args) {
    super(args);
    this.handleRequests = new Set(["app", "function"]);
  }
  init() {
    this.pendingRequests = {};
    this.approvedRequests = {};
    this.pendingCost = 0;
    this.approvedCost = 0;
  }
  handleBatch(batch) {
    this._handleBatch(batch);
    const callback = (approved, askedUser) => {
      this.handleApprove(approved, askedUser, { ...this.pendingRequests });
    };
    if (this.pendingCost + this.approvedCost > this.assistant.budget) {
      const app = this.assistant.context.app.split("@")[0];
      const pendingSpend = formatAsDollars(this.pendingCost);
      const approvedSpend = formatAsDollars(this.approvedCost);
      const totalSpend = formatAsDollars(this.pendingCost + this.approvedCost);
      const budget = formatAsDollars(this.assistant.budget);
      return {
        callback,
        message: `${app} is requesting to spend ${pendingSpend}, for a total of ${totalSpend}`,
        details: [
          `Budget: ${budget}`,
          `Approved spend: ${approvedSpend}`,
          `Pending spend: ${pendingSpend}`,
        ],
      };
    }
    this.pendingRequests = {};
    this.pendingCost = 0;
    return { callback };
  }
  handleRequest(_, data, id) {
    this.pendingRequests[id] = data;
    this.pendingCost += data.options.maxCost;
  }
  handleApprove(approved, askedUser, pendingRequests) {
    if (approved) {
      if (askedUser) {
        this.assistant.budget = this.assistant.budget * 2;
      }
      Object.entries(pendingRequests).forEach(([id, data]) => {
        this.approvedRequests[id] = data;
        this.approvedCost += data.options.maxCost;
      });
    }
  }
  handleMetadata(metadata, id) {
    if (this.approvedRequests[id]) {
      this.approvedCost +=
        metadata.finalCost - this.approvedRequests[id].options.maxCost;
    } else {
      console.error(`Unknown FinancialRisk request id: ${id}`);
    }
  }
}

class PublishRisk extends Risk {
  constructor(args) {
    super(args);
    this.handleRequests = new Set(["publish"]);
  }
  init() {
    this.publishRequests = [];
  }
  handleBatch(batch) {
    this._handleBatch(batch);
    if (this.publishRequests.length > 1) {
      return { error: "May only publish one Magic App or Function at a time" };
    } else if (this.publishRequests.length === 1) {
      const app = this.assistant.context.app.split("@")[0];
      const now = new Date().toLocaleString().replace(/[^a-zA-Z0-9]/g, "_");
      return {
        message: `${app} is requesting to publish a Magic App or Function`,
        downloadDetails: {
          text: "View JSON",
          filename: `${app}_publish_request_${now}.json`,
          content: JSON.stringify(this.publishRequests[0], null, 2),
        },
      };
    }
    this.publishRequests = [];
    return {};
  }
  handleRequest(_, data) {
    this.publishRequests.push(data.magicObj);
  }
}

class PrivacyRisk extends Risk {
  constructor(args) {
    super(args);
    this.handleRequests = new Set(["getData", "getAllData", "getAllKeysData"]);
  }
  init() {
    this.pendingReads = new Set();
    this.userApprovedReads = new Set();
  }
  handleBatch(batch) {
    this._handleBatch(batch);
    const app = this.assistant.context.app.split("@")[0];
    const untrustedReads = Array.from(this.pendingReads).filter(
      (read) => isCrossAuthor(read, app) && !this.userApprovedReads.has(read),
    );
    if (untrustedReads.length > 0) {
      const callback = (approved, askedUser) => {
        this.handleApprove(approved, askedUser, untrustedReads);
      };
      return {
        callback,
        message: `${app} is requesting to read ${untrustedReads[0]}'s data`,
      };
    }
    this.pendingReads = new Set();
    return {};
  }
  handleRequest(_, data) {
    this.pendingReads.add(data.app.split("@")[0]);
  }
}

class DataLossRisk extends Risk {
  constructor(args) {
    super(args);
    this.handleRequests = new Set(["putData", "deleteData"]);
  }
  init() {
    this.pendingWrites = new Set();
    this.userApprovedWrites = new Set();
    this.lastAppBackups = {};
  }
  handleBatch(batch) {
    this._handleBatch(batch);
    const app = this.assistant.context.app.split("@")[0];
    const untrustedWrites = Array.from(this.pendingWrites).filter(
      (write) =>
        isCrossAuthor(write, app) && !this.userApprovedWrites.has(write),
    );
    const callback = async (approved, askedUser) => {
      await this.handleApprove(
        approved,
        askedUser,
        Array.from(this.pendingWrites),
        untrustedWrites,
      );
    };
    if (untrustedWrites.length > 1) {
      return { error: "May only make one cross author write at a time" };
    } else if (untrustedWrites.length > 0) {
      return {
        callback,
        message: `${app} is requesting to overwrite ${untrustedWrites[0]}'s data`,
      };
    }
    this.pendingWrites = new Set();
    return { callback };
  }
  handleRequest(_, data) {
    this.pendingWrites.add(data.app.split("@")[0]);
  }
  async handleApprove(approved, askedUser, pendingWrites, untrustedWrites) {
    if (approved) {
      if (askedUser) {
        this.userApprovedWrites = this.userApprovedWrites.union(
          new Set(untrustedWrites),
        );
      }
      //even though manageBackups checks if backups are needed, we still don't want to run getAllKeysData too often
      //manageBackups still needs to check if a backup is needed because the db is shared across tabs
      const appsNeedingBackup = pendingWrites.filter(
        (app) => (this.lastAppBackups[app] || 0) < Date.now() - 1000 * 60 * 10,
      );
      if (appsNeedingBackup.length > 0) {
        await manageBackups(appsNeedingBackup, this.assistant.toastsRef);
        appsNeedingBackup.forEach((app) => {
          this.lastAppBackups[app] = Date.now();
        });
      }
    }
  }
}

class DownloadRisk extends Risk {
  constructor(args) {
    super(args);
    this.handleRequests = new Set(["download"]);
  }
  init() {
    this.downloadRequests = [];
  }
  handleBatch(batch) {
    try {
      this._handleBatch(batch);
      if (this.downloadRequests.length > 0) {
        const app = this.assistant.context.app.split("@")[0];
        const n = this.downloadRequests.length;
        const plural = n > 1 ? "s" : "";
        return {
          message: `${app} is requesting to download ${n} file${plural}`,
          details: this.downloadRequests,
        };
      }
      return {};
    } finally {
      this.downloadRequests = [];
    }
  }
  handleRequest(_, data) {
    this.downloadRequests.push(data.filename);
  }
}

class RateLimitRisk extends Risk {
  constructor(args) {
    super(args);
    this.handleRequests = new Set([
      "app",
      "function",
      "fetch",
      "openUrl",
      "publish",
      "download",
    ]);
  }
  init() {
    this.requests = 0;
  }
  handleBatch(batch) {
    if (this.lastTs) {
      this.requests = Math.max(
        0,
        this.requests - (Date.now() - this.lastTs) / 200,
      );
    }
    this.lastTs = Date.now();
    this._handleBatch(batch);
    if (this.requests > 1000) {
      return { error: "Rate limit exceeded" };
    }
    return {};
  }
  handleRequest() {
    this.requests++;
  }
}

function isCrossAuthor(app1, app2) {
  return app1.split(".")[0] !== app2.split(".")[0];
}

export {
  FinancialRisk,
  PublishRisk,
  PrivacyRisk,
  DataLossRisk,
  DownloadRisk,
  RateLimitRisk,
};
