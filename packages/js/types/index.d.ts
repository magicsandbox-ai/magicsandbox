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

interface DatabaseSchema {
  [key: string]: any;
}

declare global {
  function requestApp<TMetadataKeys extends keyof Metadata = never>(
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

  function requestPutData<
    TSchema = DatabaseSchema,
    TKey extends keyof TSchema = keyof TSchema,
  >(
    key: TKey & string,
    val: TSchema[TKey],
    options?: {
      app?: string;
      evictionPolicy?: "fifo";
      backup?: boolean; // Assistants only
    },
  ): Promise<true>;

  function requestDeleteData<
    TSchema = DatabaseSchema,
    TKey extends keyof TSchema = keyof TSchema,
  >(
    key: TKey & string,
    options?: {
      app?: string;
      backup?: boolean; // Assistants only
    },
  ): Promise<true>;

  function requestGetData<
    TSchema = DatabaseSchema,
    TKey extends keyof TSchema = keyof TSchema,
  >(
    key: TKey & string,
    options?: {
      app?: string;
      backup?: boolean; // Assistants only
    },
  ): Promise<TSchema[TKey]>;

  function requestGetAllData<TSchema = DatabaseSchema>(options?: {
    app?: string;
    backup?: boolean; // Assistants only
  }): Promise<TSchema>;

  function requestGetAllKeysData<TSchema = DatabaseSchema>(options?: {
    app?: string;
    backup?: boolean; // Assistants only
  }): Promise<Array<keyof TSchema & string>>;

  function requestFetch<T = any>(
    resource: string | URL | Request,
    options?: Pick<
      RequestInit,
      "body" | "headers" | "integrity" | "method" | "priority" | "redirect"
    > & {
      responseType?: "auto" | "json" | "string" | "bytes";
    },
  ): Promise<{
    body: T; // parsed according to responseType
    status: number;
    headers: { [headerName: string]: string };
  }>;

  function requestOpenUrl(url: string): Promise<true>;

  function requestPublish(magicJson: any): Promise<true>;

  function requestDownload(filename: string, content: BlobPart): Promise<true>;

  function requestUrlParams(
    params?: {
      [key: string]: string | null;
    } | null,
  ): Promise<{ [key: string]: string }>;

  function requestSandbox(request: string, args?: any): Promise<any>;

  var assistant: {
    log: (...args: any[]) => void;
    full: (...args: any[]) => void;
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    info: (...args: any[]) => void;
    debug: (...args: any[]) => void;
  };
}

export {};
