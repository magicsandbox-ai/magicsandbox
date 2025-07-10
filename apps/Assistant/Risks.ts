import { formatAsDollars } from "./utils.ts";
import type { Assistant, App } from "./AssistantState.ts";

const minimumMinCost = 0.001;

interface RiskProps {
  assistant: Assistant;
}

type RiskCallback = (approved: boolean, askedUser: boolean) => void;

//if batch should be approved
interface RiskApproval {
  callback?: RiskCallback;
}

//if batch should be denied
interface RiskDenial {
  callback?: RiskCallback;
  error: string;
}

//if user approval is needed
interface RiskUserApproval {
  callback?: RiskCallback;
  message: string;
  details?: string[];
  downloadDetails?: { text: string; filename: string; content: string };
}

type RiskResponse = RiskApproval | RiskDenial | RiskUserApproval;

abstract class Risk {
  assistant: Assistant;
  handleRequests: Set<string>;
  constructor({ assistant }: RiskProps) {
    this.assistant = assistant;
    assistant.risks.push(this);
    this.handleRequests = new Set();
    this.init();
  }
  init() {
    //pass
  }

  abstract handleBatch(batch: MessageEvent[]): RiskResponse;

  _handleBatch(batch: MessageEvent[]) {
    for (const event of batch) {
      const { id, msg } = event.data;
      const { request, data } = msg;
      if (this.handleRequests.has(request)) {
        this.handleRequest(request, data, id);
      }
    }
  }
  handleRequest(_request: string, _data: unknown, _id: number) {
    //pass
  }
  handleApprove() {
    //pass
  }
  handleMetadata() {
    //pass
  }
}

class FinancialRisk extends Risk {
  constructor(args: RiskProps) {
    super(args);
    this.handleRequests = new Set(["app", "function"]);
  }
  init() {
    this.pendingRequests = {};
    this.approvedRequests = {};
    this.pendingCost = 0;
    this.approvedCost = 0;
  }
  handleBatch(batch: MessageEvent[]) {
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
  handleRequest(request: string, data: unknown, id: number) {
    const newData = { ...data, options: { ...data.options } }; //avoid mutating data
    if (request === "app") {
      newData.options.maxCost = minimumMinCost;
    }
    this.pendingRequests[id] = newData;
    this.pendingCost += newData.options.maxCost;
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
          error: "May only publish one App or Function at a time",
        };
      } else if (this.publishRequests.length === 1) {
        const app = this.assistant.app.app;
        const now = new Date().toLocaleString().replace(/[^a-zA-Z0-9]/g, "_");
        const obj = this.publishRequests[0];
        const name =
          !obj.name || !obj.version
            ? "an App or Function"
            : `${obj.name}@${obj.version}`;
        return {
          message: `${app} is requesting to publish ${name}${!obj.private ? ". It will be publicly visible." : ""}`,
          downloadDetails: {
            text: "Download App JSON",
            filename: `${app}_publish_request_${now}.json`,
            content: JSON.stringify(obj, null, 2),
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
      if (this.pendingWrites.has("magicsandbox.assistant")) {
        return {
          error: "Cannot write to magicsandbox.Assistant",
        };
      }
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
    this.pendingWrites.add(data.options.app.split("@")[0].toLowerCase());
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
        await manageBackups(appsNeedingBackup, this.assistant);
        appsNeedingBackup.forEach((app) => {
          this.lastAppBackups[app] = Date.now();
        });
      }
    }
  }
}

class DownloadRisk extends Risk {
  downloadRequests: string[] = [];
  constructor(args: RiskProps) {
    super(args);
    this.handleRequests = new Set(["download"]);
  }
  init() {
    this.downloadRequests = [];
  }
  handleBatch(batch: MessageEvent[]): RiskResponse {
    try {
      this._handleBatch(batch);
      if (this.downloadRequests.length > 0) {
        const app = (this.assistant.app as App).app;
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
  handleRequest(_request: string, data: unknown) {
    this.downloadRequests.push(data.filename);
  }
}

class RateLimitRisk extends Risk {
  requests!: number;
  lastTs: number | undefined;
  constructor(args: RiskProps) {
    super(args);
    this.handleRequests = new Set([
      "app",
      "function",
      "metadata",
      "fetch",
      "openUrl",
      "publish",
      "download",
    ]);
  }
  init() {
    this.requests = 0;
  }
  handleBatch(batch: MessageEvent[]): RiskResponse {
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

function union<T>(set1: Set<T>, set2: Set<T>): Set<T> {
  const out = new Set(set1);
  set2.forEach((item) => out.add(item));
  return out;
}

function isCrossAuthor(app1: string, app2: string) {
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
async function manageBackups(apps: string[], assistant: Assistant) {
  function errorHandler(error: unknown) {
    console.error(error);
    assistant.toastsRef.current.addToast(
      "Assistant failed to backup data",
      "error",
    );
  }
  try {
    const backups = await requestGetAllKeysData({
      app: "magicsandbox.Assistant",
      backup: true,
    });
    const appBackups: Record<string, number[]> = Object.fromEntries(
      apps.map((app) => [app, []]),
    );
    const appsSet = new Set(apps);
    const backupsToTake: string[] = [];
    const backupsToDelete: string[] = [];
    backups.forEach((key) => {
      let [app, tsString] = key.split("@");
      if (!app || !tsString) {
        backupsToDelete.push(key);
        return;
      }
      const ts = Number(tsString);
      if (appsSet.has(app)) {
        appBackups[app]!.push(ts);
      }
    });
    Object.entries(appBackups).forEach(([app, tsArray]) => {
      tsArray.sort((a, b) => b - a); //descending
      let maxTs = Date.now();
      let minTs = maxTs - 1000 * 60 * 10;
      const minMinTs = Date.now() - 1000 * 60 * 60 * 24 * 7;
      if (tsArray[0] || 0 < minTs) {
        backupsToTake.push(app);
      }
      function updateMinMaxTs(minTs: number, maxTs: number): [number, number] {
        const prevMinTs = minTs;
        minTs = minTs - (maxTs - minTs) * 2;
        return [minTs, prevMinTs];
      }
      let i = 0;
      while (i < tsArray.length) {
        const ts = tsArray[i]!;
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
  type Risk,
  type RiskUserApproval,
  FinancialRisk,
  PublishRisk,
  PrivacyRisk,
  DataLossRisk,
  DownloadRisk,
  RateLimitRisk,
};
