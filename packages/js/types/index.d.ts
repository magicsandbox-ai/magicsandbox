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

interface SerializedResponse {
  body: any; // parsed according to responseType
  status: number;
  headers: { [headerName: string]: string };
}

declare global {
  function requestApp<TMetadataKeys extends keyof Metadata>(
    app: string,
    options?: {
      maxCost?: number;
      includeMetadata?: TMetadataKeys[];
    },
  ): Promise<{
    style?: string;
    html?: string;
    script?: string;
    metadata: Pick<Metadata, TMetadataKeys>;
  }>;

  // streaming
  function requestFunction<
    TArgs = any,
    TResult = any,
    TMetadataKeys extends keyof Metadata = keyof Metadata,
  >(
    fn: string,
    args: TArgs,
    options: {
      stream: true;
      maxCost?: number;
      includeMetadata?: TMetadataKeys[];
      includeUserInfo?: Array<keyof UserInfo>;
    },
  ): Promise<
    AsyncIterable<{
      result?: TResult;
      metadata?: Pick<Metadata, TMetadataKeys>;
    }>
  >;

  // non streaming
  function requestFunction<
    TArgs = any,
    TResult = any,
    TMetadataKeys extends keyof Metadata = keyof Metadata,
  >(
    fn: string,
    args: TArgs,
    options?: {
      stream?: false;
      maxCost?: number;
      includeMetadata?: TMetadataKeys[];
      includeUserInfo?: Array<keyof UserInfo>;
      app?: string; // Assistants only
    },
  ): Promise<{
    result: TResult;
    metadata: Pick<Metadata, TMetadataKeys>;
  }>;

  function requestMetadata<TMetadataKeys extends keyof Metadata>(
    identifier: string,
    includeMetadata?: TMetadataKeys[],
    options?: {
      kind?: "app" | "function";
      includePrivate?: boolean; // Assistants only
    },
  ): Promise<Pick<Metadata, TMetadataKeys>[]>;

  function requestPutData(
    key: string,
    val: Exclude<any, null>,
    options?: {
      app?: string;
      evictionPolicy?: "fifo";
      backup?: boolean; // Assistants only
    },
  ): Promise<true>;

  function requestDeleteData(
    key: string,
    options?: {
      app?: string;
      backup?: boolean; // Assistants only
    },
  ): Promise<true>;

  function requestGetData(
    key: string,
    options?: {
      app?: string;
      backup?: boolean; // Assistants only
    },
  ): Promise<any>;
}

export {};
