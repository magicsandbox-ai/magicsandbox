import type { RefObject } from "react";
import type { SandboxRef } from "./Sandbox.js";

const minimumMinCost = 0.001;
const maximumMaxCost = 1;

type AppData = {
  app: string;
  options: Parameters<typeof requestApp>[1];
};

type FunctionData = {
  fn: string;
  args: unknown;
  options: Parameters<typeof requestFunction>[1];
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

type SandboxRequest = {
  app: AppData;
  function: FunctionData;
  metadata: MetadataData;
  putData: PutDataData;
  deleteData: DeleteDataData;
  getData: GetDataData;
  getAllData: GetAllDataData;
  getAllKeysData: GetAllKeysDataData;
  fetch: FetchData;
  openUrl: OpenUrlData;
  publish: PublishData;
  download: DownloadData;
  urlParams: UrlParamsData;
};

type SandboxRequestType = keyof SandboxRequest;

interface AppObj {
  html: string;
  style: string;
  script: string;
  cacheRequests: boolean;
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
): { request: SandboxRequestType; data: SandboxRequest[SandboxRequestType] } {
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
    const missingKeys = requiredKeys[request].filter(
      (key) => data[key] === undefined,
    );
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
      if (data.options.maxCost > maximumMaxCost) {
        throw new ValidationError(
          `maxCost must be less than or equal to ${maximumMaxCost}`,
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

const requestAppCache: {
  cacheKey?: string;
  response?: unknown;
  error?: unknown;
} = {};
const requestFunctionCache: {
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
    const { request, data } = msg;
    try {
      validateAndDefaultRequest(request, data);
    } catch (error) {
      sandboxRef.current.postMessage(sandboxId, {
        id,
        error: {
          message: error instanceof Error ? error.message : "Unexpected error",
        },
      });
      return;
    }
    let response: unknown, cacheKey: string | undefined;
    if (appObjRef.current.cacheRequests && request === "app") {
      cacheKey = data.app;
      if (cacheKey === requestAppRef.current.cacheKey) {
        sandboxRef.current.postMessage(sandboxId, {
          id,
          response: requestAppRef.current.response,
          error: requestAppRef.current.error,
        });
        return;
      }
    } else if (appObjRef.current.cacheRequests && request === "function") {
      cacheKey = JSON.stringify({
        function: data.function,
        args: data.args,
        options: data.options,
      });
      if (cacheKey === requestFunctionRef.current.cacheKey) {
        response = requestFunctionRef.current.response;
        if (response?.[Symbol.asyncIterator]) {
          response = sandboxRef.current.streamData(response);
        }
        sandboxRef.current.postMessage(sandboxId, {
          id,
          response,
          error: requestFunctionRef.current.error,
        });
        return;
      }
    } else if (
      [
        "putData",
        "deleteData",
        "getData",
        "getAllData",
        "getAllKeysData",
      ].includes(request)
    ) {
      if (!data.options?.app && appObjRef.current.author) {
        data.options = {
          ...data.options,
          app: `${appObjRef.current.author}.${appObjRef.current.name}`,
        };
      }
      const app = data.options?.app;
      if (requestDataRef.current[app] === undefined) {
        //initialize requestDataRef[app]
        try {
          if (app) {
            const allData = await requestSandbox("getAllData", {
              options: { app },
            });
            requestDataRef.current[app] = allData || {};
          } else {
            requestDataRef.current[app] = {};
          }
        } catch (e) {
          console.warn(`Failed to initialize data for ${app}:`, e);
          requestDataRef.current[app] = {};
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
        //todo enforce size limit? use msgpack? support evictionPolicy?
        requestDataRef.current[app] = requestDataRef.current[app] || {};
        requestDataRef.current[app][data.key] = structuredClone(data.val);
        sandboxRef.current.postMessage(sandboxId, { id, response: true });
        return;
      } else if (request === "deleteData") {
        delete requestDataRef.current[app]?.[data.key];
        sandboxRef.current.postMessage(sandboxId, { id, response: true });
        return;
      } else if (request === "getData") {
        response = requestDataRef.current[app]?.[data.key];
        sandboxRef.current.postMessage(sandboxId, { id, response });
        return;
      } else if (request === "getAllData") {
        response = requestDataRef.current[app] || {};
        sandboxRef.current.postMessage(sandboxId, { id, response });
        return;
      } else if (request === "getAllKeysData") {
        response = Object.keys(requestDataRef.current[app] || {});
        sandboxRef.current.postMessage(sandboxId, { id, response });
        return;
      }
    }
    let error;
    try {
      response = await requestSandbox(request, data);
    } catch (e) {
      error = { message: e.message, data: e.data };
    }
    if (request === "app") {
      requestAppRef.current = { cacheKey, response, error };
    } else if (request === "function") {
      requestFunctionRef.current = { cacheKey, response, error };
    }
    if (response?.[Symbol.asyncIterator]) {
      response = sandboxRef.current.streamData(response);
    }
    sandboxRef.current.postMessage(sandboxId, { id, response, error });
  } catch (error) {
    console.error(error);
  }
}

export { validateAndDefaultRequest, requestHandler, type AppObj };
