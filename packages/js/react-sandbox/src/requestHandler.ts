import type { RefObject } from "react";
import type { SandboxRef } from "./Sandbox.js";
import type { RequestFunctionOptions } from "@magicsandbox.ai/types";

const minimumMinCost = 0.001;
const maximumMaxCost = 1;

type AppData = {
  app: string;
  options: Parameters<typeof requestApp>[1];
};

type FunctionData = {
  fn: string;
  args: unknown;
  options: RequestFunctionOptions;
};

type MetadataData = {
  identifier: string;
  includeMetadata: string[];
  options: Parameters<typeof requestMetadata>[2];
};

type PutDataData = {
  key: string;
  val: unknown;
  options: Parameters<typeof requestPutData>[2];
};

type DeleteDataData = {
  key: string;
  options: Parameters<typeof requestDeleteData>[1];
};

type GetDataData = {
  key: string;
  options: Parameters<typeof requestGetData>[1];
};

type GetAllDataData = {
  options: Parameters<typeof requestGetAllData>[0];
};

type GetAllKeysDataData = {
  options: Parameters<typeof requestGetAllKeysData>[0];
};

type FetchData = {
  resource: string;
  options: Parameters<typeof requestFetch>[1];
};

type OpenUrlData = {
  url: string;
};

type PublishData = {
  magicObj: unknown;
};

type DownloadData = {
  filename: string;
  content: Parameters<typeof requestDownload>[1];
};

type UrlParamsData = {
  params: Parameters<typeof requestUrlParams>[0];
};

type SandboxRequest =
  | { request: "app"; data: AppData }
  | { request: "function"; data: FunctionData }
  | { request: "metadata"; data: MetadataData }
  | { request: "putData"; data: PutDataData }
  | { request: "deleteData"; data: DeleteDataData }
  | { request: "getData"; data: GetDataData }
  | { request: "getAllData"; data: GetAllDataData }
  | { request: "getAllKeysData"; data: GetAllKeysDataData }
  | { request: "fetch"; data: FetchData }
  | { request: "openUrl"; data: OpenUrlData }
  | { request: "publish"; data: PublishData }
  | { request: "download"; data: DownloadData }
  | { request: "urlParams"; data: UrlParamsData };

interface AppObj {
  html: string;
  style: string;
  script: string;
  cacheRequests: boolean;
  author: string;
  name: string;
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validates the request and adds default values by mutating `data`
 */
function validateAndDefaultRequest(
  request: any,
  data: any,
  options: {
    assistant?: boolean;
    app?: string;
    includeMetadata?: string[];
  } = {},
): SandboxRequest {
  try {
    const { assistant, app, includeMetadata } = options;
    const requiredKeys = {
      app: ["app"],
      function: ["fn", "args"],
      metadata: ["identifier", "includeMetadata"],
      putData: ["key", "val"],
      deleteData: ["key"],
      getData: ["key"],
      getAllData: [],
      getAllKeysData: [],
      fetch: ["resource"],
      openUrl: ["url"],
      publish: ["magicObj"],
      download: ["filename", "content"],
      urlParams: [],
    };
    if (!(request in requiredKeys)) {
      throw new ValidationError("Invalid request");
    }
    data = data || {};
    const missingKeys = requiredKeys[
      request as SandboxRequest["request"]
    ].filter((key) => data[key] === undefined);
    if (missingKeys.length > 0) {
      throw new ValidationError(
        `Missing required arguments: ${missingKeys.join(", ")}`,
      );
    }
    // todo more type checking - like making sure urlParams params is an object
    if (request === "app") {
      data.options = {
        includeMetadata: data.options?.includeMetadata || [],
      };
    } else if (request === "function") {
      data.options = {
        maxCost: data.options?.maxCost || minimumMinCost,
        stream: data.options?.stream || false,
        includeMetadata: data.options?.includeMetadata || [],
        includeUserInfo: data.options?.includeUserInfo || [],
      };
      if (
        typeof data.options.maxCost !== "number" ||
        data.options.maxCost < minimumMinCost ||
        data.options.maxCost > maximumMaxCost
      ) {
        throw new ValidationError(
          `Invalid maxCost: ${data.options.maxCost}. Must be a number between ${minimumMinCost} and ${maximumMaxCost}`,
        );
      }
      if (assistant && app) {
        data.options.app = app; //assistant provides app calling requestFunction
      }
    } else if (request === "metadata") {
      data.options = {
        kind: data.options?.kind,
        includePrivate: data.options?.includePrivate || false,
      };
      if (assistant) {
        data.options.includePrivate = false; //assistants should not allow apps to set includePrivate to true
      }
    } else if (
      assistant &&
      [
        "putData",
        "deleteData",
        "getData",
        "getAllData",
        "getAllKeysData",
      ].includes(request)
    ) {
      data.options = {
        ...data.options,
        app: data.options?.app || app, //assistant provides app calling requestData
      };
      delete data.options.backup; //assistants should not allow apps to access backup storage
    } else if (request === "fetch") {
      data.options = {
        ...data.options,
        responseType: data.options?.responseType || "auto",
      };
    } else if (assistant && request === "urlParams" && data.params) {
      data.params = Object.fromEntries(
        Object.entries(data.params).filter(([key]) => !key.startsWith("_")), //params that start with _ are reserved
      );
    }
    if (includeMetadata && (request === "app" || request === "function")) {
      for (const key of includeMetadata) {
        if (!data.options.includeMetadata.includes(key)) {
          data.options.includeMetadata.push(key);
        }
      }
    }
    return { request, data };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    console.error(error);
    throw new ValidationError("Unexpected error validating arguments");
  }
}

let requestAppCache: {
  cacheKey?: string;
  response?: unknown;
  error?: unknown;
} = {};
let requestFunctionCache: {
  cacheKey?: string;
  response?: unknown;
  error?: unknown;
} = {};
const requestDataCache: { [app: string]: { [key: string]: unknown } } = {};

async function requestHandler({
  event,
  sandboxRef,
  appObjRef,
}: {
  event: MessageEvent;
  sandboxRef: RefObject<SandboxRef | null>;
  appObjRef: RefObject<AppObj | undefined>;
}) {
  try {
    if (!(event.data.id && event.data.msg?.request)) return;
    if (!sandboxRef.current || !appObjRef.current) return; //should never happen
    const sandboxId = sandboxRef.current.getSandboxId();
    const { id, msg } = event.data;
    let sandboxRequest: SandboxRequest;
    try {
      sandboxRequest = validateAndDefaultRequest(msg.request, msg.data);
    } catch (error) {
      sandboxRef.current.postMessage(sandboxId, {
        id,
        error: {
          message: error instanceof Error ? error.message : "Unexpected error",
        },
      });
      return;
    }
    const { request, data } = sandboxRequest;
    let response: unknown, cacheKey: string | undefined;
    if (appObjRef.current.cacheRequests && request === "app") {
      cacheKey = data.app;
      if (cacheKey === requestAppCache.cacheKey) {
        sandboxRef.current.postMessage(sandboxId, {
          id,
          response: requestAppCache.response,
          error: requestAppCache.error,
        });
        return;
      }
    } else if (appObjRef.current.cacheRequests && request === "function") {
      cacheKey = JSON.stringify({
        fn: data.fn,
        args: data.args,
        options: data.options,
      });
      if (cacheKey === requestFunctionCache.cacheKey) {
        response = requestFunctionCache.response;
        if (isAsyncIterable(response)) {
          response = sandboxRef.current.streamData(response);
        }
        sandboxRef.current.postMessage(sandboxId, {
          id,
          response,
          error: requestFunctionCache.error,
        });
        return;
      }
    } else if (isDataRequest(request, data)) {
      if (!data.options?.app && appObjRef.current.author) {
        data.options = {
          ...data.options,
          app: `${appObjRef.current.author}.${appObjRef.current.name}`,
        };
      }
      let app, getAllData;
      if (data.options?.app) {
        app = data.options.app;
        getAllData = true;
      } else {
        app = appObjRef.current.name!;
        getAllData = false;
      }
      if (data.options?.backup) {
        app = `${app}~backup`;
        getAllData = false;
      }
      if (requestDataCache[app] === undefined) {
        //initialize requestDataRef[app]
        try {
          if (getAllData) {
            const allData = await requestGetAllData({ app });
            requestDataCache[app] = allData;
          } else {
            requestDataCache[app] = {};
          }
        } catch (e) {
          console.warn(`Failed to initialize data for ${app}:`, e);
          requestDataCache[app] = {};
        }
      }
      if (request === "putData") {
        if (data.val === null) {
          sandboxRef.current.postMessage(sandboxId, {
            id,
            error: { message: "Cannot put null data" },
          });
          return;
        }
        //todo enforce size limit? support evictionPolicy?
        //msgpack or structuredClone is not necessary here because data was already cloned by postMessage
        requestDataCache[app]![data.key] = data.val;
        sandboxRef.current.postMessage(sandboxId, { id, response: true });
        return;
      } else if (request === "deleteData") {
        delete requestDataCache[app]![data.key];
        sandboxRef.current.postMessage(sandboxId, { id, response: true });
        return;
      } else if (request === "getData") {
        response = requestDataCache[app]![data.key];
        sandboxRef.current.postMessage(sandboxId, { id, response });
        return;
      } else if (request === "getAllData") {
        response = requestDataCache[app] || {};
        sandboxRef.current.postMessage(sandboxId, { id, response });
        return;
      } else if (request === "getAllKeysData") {
        response = Object.keys(requestDataCache[app] || {});
        sandboxRef.current.postMessage(sandboxId, { id, response });
        return;
      }
    }
    let error;
    try {
      response = await requestSandbox(request, data);
    } catch (e) {
      if (e instanceof Error) {
        error = { message: e.message, data: "data" in e ? e.data : undefined };
      } else {
        error = { message: "Unexpected error" };
      }
    }
    if (request === "app") {
      requestAppCache = { cacheKey, response, error };
    } else if (request === "function") {
      requestFunctionCache = { cacheKey, response, error };
    }
    if (isAsyncIterable(response)) {
      response = sandboxRef.current.streamData(response);
    }
    sandboxRef.current.postMessage(sandboxId, { id, response, error });
  } catch (error) {
    console.error(error);
  }
}

export { validateAndDefaultRequest, requestHandler, type AppObj };

function isAsyncIterable<T>(value: any): value is AsyncIterable<T> {
  return value != null && typeof value[Symbol.asyncIterator] === "function";
}

function isDataRequest(
  request: string,
  //@ts-ignore
  data: unknown,
): data is
  | PutDataData
  | DeleteDataData
  | GetDataData
  | GetAllDataData
  | GetAllKeysDataData {
  return [
    "putData",
    "deleteData",
    "getData",
    "getAllData",
    "getAllKeysData",
  ].includes(request);
}
