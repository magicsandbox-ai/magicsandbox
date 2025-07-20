import { describe, test, expect } from "@jest/globals";
import {
  FinancialRisk,
  PublishRisk,
  PrivacyRisk,
  DataLossRisk,
  DownloadRisk,
  RateLimitRisk,
  type RiskResponse,
  type Risk,
} from "../Risks.ts";

/*
npm run jest -- apps/Assistant/__tests__/Risk.test.ts
*/

global.requestGetAllKeysData = () => Promise.resolve([]);
//@ts-ignore
global.requestGetAllData = () => Promise.resolve({});
global.requestPutData = () => Promise.resolve(true);
global.requestDeleteData = () => Promise.resolve(true);

let nextId = 1;

function makeAssistant(budget: number = 0) {
  nextId = 1;
  const mockAssistant: {
    app: {
      app: string;
    };
    budget: number;
    risks: Risk[];
  } = {
    app: {
      app: "magicsandbox.Test",
    },
    budget,
    risks: [],
  };
  [
    FinancialRisk,
    PublishRisk,
    PrivacyRisk,
    DataLossRisk,
    DownloadRisk,
    RateLimitRisk,
    //@ts-ignore
  ].map((risk) => new risk({ assistantState: mockAssistant }));
  return mockAssistant;
}

function makeMessageEvent(request: string, data: unknown) {
  return {
    data: {
      id: nextId++,
      msg: {
        request,
        data,
      },
    },
  };
}

function getRiskResponseType(riskResponse: RiskResponse) {
  if ("error" in riskResponse) {
    return "denial";
  } else if ("message" in riskResponse) {
    return "userApproval";
  } else {
    return "approval";
  }
}

describe("Risks", () => {
  test("should approve", () => {
    const assistant = makeAssistant(0.1); //budget should be sufficient for app and function
    const batch = [
      makeMessageEvent("app", undefined),
      makeMessageEvent("function", { options: { maxCost: 0.001 } }),
      makeMessageEvent("getData", {
        options: { app: "magicsandbox.SomeApp@1.0.0" },
      }),
      makeMessageEvent("getAllData", {
        options: { app: "magicsandbox.SomeApp@1.0.0" },
      }),
      makeMessageEvent("getAllKeysData", {
        options: { app: "magicsandbox.SomeApp@1.0.0" },
      }),
      makeMessageEvent("putData", {
        options: { app: "magicsandbox.SomeApp@1.0.0" },
      }),
      makeMessageEvent("deleteData", {
        options: { app: "magicsandbox.SomeApp@1.0.0" },
      }),
      makeMessageEvent("metadata", undefined),
      makeMessageEvent("fetch", undefined),
      makeMessageEvent("openUrl", undefined),
    ];
    assistant.risks.forEach((risk) => {
      risk.init();
    });
    assistant.risks.forEach((risk) => {
      const riskResponse = risk.handleBatch(batch as MessageEvent[]);
      expect(getRiskResponseType(riskResponse)).toBe("approval");
      riskResponse.callback?.(true, false);
    });
    assistant.risks.forEach((risk) => {
      risk.handleMetadata({ finalCost: 0.001 }, 1);
      risk.handleMetadata({ finalCost: 0.001 }, 2);
    });
  });
  test("should deny", () => {
    const assistant = makeAssistant();
    const batch = [
      //can't publish multiple
      makeMessageEvent("publish", { magicObj: {} }),
      makeMessageEvent("publish", { magicObj: {} }),
      //can't write to assistant
      makeMessageEvent("putData", {
        options: { app: "magicsandbox.ASSISTANT@1.0.0" },
      }),
      makeMessageEvent("deleteData", {
        options: { app: "magicsandbox.Assistant" },
      }),
    ];
    assistant.risks.forEach((risk) => {
      risk.init();
    });
    assistant.risks.forEach((risk) => {
      const riskResponse = risk.handleBatch(batch as MessageEvent[]);
      expect(getRiskResponseType(riskResponse)).toBe(
        risk instanceof PublishRisk || risk instanceof DataLossRisk
          ? "denial"
          : "approval",
      );
      riskResponse.callback?.(false, false);
    });
  });
  test("should ask user", () => {
    const assistant = makeAssistant();
    const batch = [
      makeMessageEvent("app", undefined),
      makeMessageEvent("function", { options: { maxCost: 0.001 } }),
      makeMessageEvent("publish", { magicObj: {} }),
      makeMessageEvent("getData", {
        options: { app: "magicsandbox.SomeApp@1.0.0" },
      }),
      makeMessageEvent("getAllData", {
        options: { app: "someauthor.SomeApp@1.0.0" },
      }),
      makeMessageEvent("putData", {
        options: { app: "magicsandbox.SomeApp@1.0.0" },
      }),
      makeMessageEvent("deleteData", {
        options: { app: "someauthor.SomeApp@1.0.0" },
      }),
      makeMessageEvent("download", { filename: "test.txt" }),
    ];
    assistant.risks.forEach((risk) => {
      risk.init();
    });
    assistant.risks.forEach((risk) => {
      const riskResponse = risk.handleBatch(batch as MessageEvent[]);
      expect(getRiskResponseType(riskResponse)).toBe(
        risk instanceof FinancialRisk ||
          risk instanceof PublishRisk ||
          risk instanceof PrivacyRisk ||
          risk instanceof DataLossRisk ||
          risk instanceof DownloadRisk
          ? "userApproval"
          : "approval",
      );
      riskResponse.callback?.(true, true);
    });
    assistant.risks.forEach((risk) => {
      risk.handleMetadata({ finalCost: 0.001 }, 1);
      risk.handleMetadata({ finalCost: 0.001 }, 2);
    });
  });
});
