interface Metadata {
  id: string; //author.name@version
  author: string;
  name: string;
  version: string;
  major: number;
  minor: number;
  patch: number;
  kind: "app" | "function";
  description: string;
  documentation: string;
  type: string;
  minCost: number;
  finalCost: number;
  status: "active" | "deprecated" | "inactive";
  decode: "json" | "msgpack" | "string" | "bytes";
  usage: number; //number of times the App or Function has been used
}

interface UserInfo {
  userId?: string;
}

interface App {
  style?: string;
  html?: string;
  script?: string;
  metadata: object;
}

interface SerializedResponse {
  body: any; // parsed according to responseType
  status: number;
  headers: { [headerName: string]: string };
}

declare global {
  function requestFunction<TArgs, TResult>(
    fn: string,
    args: TArgs,
    options: {
      maxCost?: number;
      stream?: boolean;
      includeMetadata?: Array<keyof Metadata>;
      includeUserInfo?: Array<keyof UserInfo>;
    },
  ): Promise<{
    result: TResult;
    metadata: Pick<
      Metadata,
      (typeof options)["includeMetadata"] extends ReadonlyArray<infer K>
        ? K
        : never
    >;
  }>;
}

export {};
