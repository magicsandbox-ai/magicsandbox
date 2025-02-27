import { formatAsDollars } from "./utils.js";

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
    try {
      this._handleBatch(batch);
      const pendingRequests = this.pendingRequests;
      if (
        this.pendingCost > 0 &&
        this.pendingCost + this.approvedCost > this.assistant.budget
      ) {
        const app = this.assistant.app.app;
        const pendingSpend = formatAsDollars(this.pendingCost);
        const approvedSpend = formatAsDollars(this.approvedCost);
        const totalSpend = formatAsDollars(
          this.pendingCost + this.approvedCost,
        );
        let newBudget;
        if (this.assistant.budget === 0) {
          newBudget = (this.pendingCost + this.approvedCost) * 3;
        } else {
          newBudget = this.assistant.budget * 3;
        }
        const callback = (approved, askedUser) => {
          this.handleApprove(approved, askedUser, pendingRequests, newBudget);
        };
        return {
          callback,
          message: `${app} is requesting to spend ${pendingSpend}, for a total of ${totalSpend}`,
          details: [
            `Spend so far: ${approvedSpend}`,
            `Pending spend: ${pendingSpend}`,
            `Next confirmation at: ${formatAsDollars(newBudget)}`,
          ],
        };
      }
      const callback = (approved, askedUser) => {
        this.handleApprove(approved, askedUser, pendingRequests);
      };
      return { callback };
    } finally {
      this.pendingRequests = {};
      this.pendingCost = 0;
    }
  }
  handleRequest(_, data, id) {
    this.pendingRequests[id] = data;
    this.pendingCost += data.options.maxCost;
  }
  handleApprove(approved, askedUser, pendingRequests, newBudget) {
    if (approved) {
      if (askedUser) {
        this.assistant.budget = newBudget;
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
    try {
      this._handleBatch(batch);
      if (this.publishRequests.length > 1) {
        return {
          error: "May only publish one Magic App or Function at a time",
        };
      } else if (this.publishRequests.length === 1) {
        const app = this.assistant.app.app;
        const now = new Date().toLocaleString().replace(/[^a-zA-Z0-9]/g, "_");
        return {
          message: `${app} is requesting to publish a Magic App or Function`,
          downloadDetails: {
            text: "Download Magic App JSON",
            filename: `${app}_publish_request_${now}.json`,
            content: JSON.stringify(this.publishRequests[0], null, 2),
          },
        };
      }
      return {};
    } finally {
      this.publishRequests = [];
    }
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
    try {
      this._handleBatch(batch);
      const app = this.assistant.app.app;
      const untrustedReads = Array.from(this.pendingReads).filter(
        (read) => isCrossAuthor(read, app) && !this.userApprovedReads.has(read),
      );
      if (untrustedReads.length > 0) {
        const callback = (approved, askedUser) => {
          this.handleApprove(approved, askedUser, untrustedReads);
        };
        const n = untrustedReads.length;
        const plural = n > 1 ? "s" : "";
        return {
          callback,
          message: `${app} is requesting to access your data from ${n} other App${plural}`,
          details: untrustedReads,
        };
      }
      return {};
    } finally {
      this.pendingReads = new Set();
    }
  }
  handleRequest(_, data) {
    this.pendingReads.add(data.options.app.split("@")[0]);
  }
  handleApprove(approved, askedUser, untrustedReads) {
    if (approved && askedUser) {
      this.userApprovedReads = union(
        this.userApprovedReads,
        new Set(untrustedReads),
      );
    }
  }
}

class DataLossRisk extends Risk {
  constructor(args) {
    super(args);
    this.handleRequests = new Set(["putData", "deleteData"]);
    this.lastAppBackups = {};
  }
  init() {
    this.pendingWrites = new Set();
    this.userApprovedWrites = new Set();
  }
  handleBatch(batch) {
    try {
      this._handleBatch(batch);
      const app = this.assistant.app.app;
      const pendingWrites = Array.from(this.pendingWrites);
      const untrustedWrites = pendingWrites.filter(
        (write) =>
          isCrossAuthor(write, app) && !this.userApprovedWrites.has(write),
      );
      const callback = async (approved, askedUser) => {
        await this.handleApprove(
          approved,
          askedUser,
          pendingWrites,
          untrustedWrites,
        );
      };
      if (untrustedWrites.length > 0) {
        const n = untrustedWrites.length;
        const plural = n > 1 ? "s" : "";
        return {
          callback,
          message: `${app} is requesting to overwrite your data for ${n} other App${plural}`,
          details: untrustedWrites,
        };
      }
      return { callback };
    } finally {
      this.pendingWrites = new Set();
    }
  }
  handleRequest(_, data) {
    this.pendingWrites.add(data.options.app.split("@")[0]);
  }
  async handleApprove(approved, askedUser, pendingWrites, untrustedWrites) {
    if (approved) {
      if (askedUser) {
        this.userApprovedWrites = union(
          this.userApprovedWrites,
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
        const app = this.assistant.app.app;
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
        this.requests - (Date.now() - this.lastTs) / 20,
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

function union(set1, set2) {
  const out = new Set(set1);
  set2.forEach((item) => out.add(item));
  return out;
}

function isCrossAuthor(app1, app2) {
  return app1.split(".")[0] !== app2.split(".")[0];
}

/**
 * Keeps one backup per app in each time range:
 *
 * [now - 10 mins ago], [10 mins ago - 30 mins ago], [30 mins ago - 70 mins ago], ..., [~3.5 days ago - 7 days ago]
 *
 * Takes a backup if one hasn't been taken in the last 10 mins
 *
 * - apps: string[]
 */
async function manageBackups(apps, toastsRef) {
  function errorHandler(error) {
    console.error(error);
    toastsRef.current.addToast("Assistant failed to backup data", "error");
  }
  try {
    const backups = await requestGetAllKeysData({
      app: "magicsandbox.Assistant",
      backup: true,
    });
    const appBackups = Object.fromEntries(apps.map((app) => [app, []]));
    const appsSet = new Set(apps);
    backups.forEach((key) => {
      const [app, ts] = key.split("@");
      if (appsSet.has(app)) {
        appBackups[app].push(ts);
      }
    });
    const backupsToTake = [];
    const backupsToDelete = [];
    Object.entries(appBackups).forEach(([app, tsArray]) => {
      tsArray.sort((a, b) => b - a); //descending
      let maxTs = Date.now();
      let minTs = maxTs - 1000 * 60 * 10;
      const minMinTs = Date.now() - 1000 * 60 * 60 * 24 * 7;
      if (tsArray[0] || 0 < minTs) {
        backupsToTake.push(app);
      }
      function updateMinMaxTs(minTs, maxTs) {
        const prevMinTs = minTs;
        minTs = minTs - (maxTs - minTs) * 2;
        return [minTs, prevMinTs];
      }
      let i = 0;
      while (i < tsArray.length) {
        const ts = tsArray[i];
        if (ts < minMinTs) {
          backupsToDelete.push(`${app}@${ts}`);
          i++;
        } else if (ts < minTs) {
          [minTs, maxTs] = updateMinMaxTs(minTs, maxTs);
        } else if (ts >= minTs && ts < maxTs) {
          [minTs, maxTs] = updateMinMaxTs(minTs, maxTs);
          i++;
        } else {
          backupsToDelete.push(`${app}@${ts}`);
          i++;
        }
      }
    });
    await Promise.all(
      backupsToTake.map(async (app) => {
        const data = await requestGetAllData({ app });
        if (data) {
          await requestPutData(`${app}@${Date.now()}`, data, {
            app: "magicsandbox.Assistant",
            evictionPolicy: "fifo",
            backup: true,
          });
        }
      }),
    );
    for (const key of backupsToDelete) {
      requestDeleteData(key, {
        app: "magicsandbox.Assistant",
        backup: true,
      }).catch(errorHandler);
    }
  } catch (error) {
    errorHandler(error);
  }
}

export {
  FinancialRisk,
  PublishRisk,
  PrivacyRisk,
  DataLossRisk,
  DownloadRisk,
  RateLimitRisk,
};
