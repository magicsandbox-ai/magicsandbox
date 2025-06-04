import SyncExternalStore from "@utils/SyncExternalStore.ts";
import { ChangeSet } from "@codemirror/state";
import prettier from "prettier/standalone";
import babelParser from "prettier/plugins/babel";
import estreeParser from "prettier/plugins/estree";
import JSON5 from "json5";
import type * as Esbuild from "esbuild";
import { tagParser } from "@magicsandbox.ai/streaming";
import {
  buildApp,
  exampleAppFiles,
  updateMagicJson,
} from "@magicsandbox.ai/dev/browser";
import processTailwindBrowser, {
  type TailwindConfig,
} from "@magicsandbox.ai/tailwind-browser";
import { createBundleDepsPlugin, createImportPlugin } from "./plugins.ts";
import { ToastError } from "@utils/Toast.ts";
import { context } from "./context.ts";
//@ts-ignore
import docs from "@magicsandbox.ai/docs/docs.md";
import { getHeadings } from "@magicsandbox.ai/docs";
import { diffChars } from "diff";

type EsbuildApi = Esbuild.PluginBuild["esbuild"]; //not sure why this is on PluginBuild but it works

type ReadFile = (path: string) => string | undefined;

interface File {
  name: string;
  content: string;
  changeSet?: ChangeSet | undefined;
  editorState?: any;
  scroll?: {
    top: number;
    left: number;
  };
}

type SerializedFile = {
  name: string;
  content: string;
  changeSet?: any;
  editorState?: any;
};

function serializeFile(file: File): SerializedFile {
  return {
    name: file.name,
    content: file.content,
    changeSet: file.changeSet?.toJSON(),
    editorState: file.editorState,
  };
}

function deserializeFile(serializedFile: SerializedFile): File {
  let changeSet;
  if (serializedFile.changeSet) {
    changeSet = ChangeSet.fromJSON(serializedFile.changeSet);
  }
  return {
    name: serializedFile.name,
    content: serializedFile.content,
    changeSet,
    editorState: serializedFile.editorState,
  };
}

interface App {
  id: string;
  files: { [fileName: string]: File };
  selectedFileName: string;
  deletedFiles: { [fileName: string]: File };
}

type SerializedApp = {
  files: { [fileName: string]: SerializedFile };
};
type BackwardsCompatibleSerializedApp =
  | SerializedApp
  | { [fileName: string]: string };

function serializeApp(app: App): SerializedApp {
  return {
    files: Object.fromEntries(
      Object.entries(app.files).map(([fileName, file]) => [
        fileName,
        serializeFile(file),
      ]),
    ),
  };
}

function deserializeApp(
  appId: string,
  serializedApp: BackwardsCompatibleSerializedApp,
): App {
  let serializedFiles: { [fileName: string]: SerializedFile };
  if (
    serializedApp.files === undefined ||
    typeof serializedApp.files === "string"
  ) {
    serializedFiles = Object.fromEntries(
      Object.entries(serializedApp).map(([fileName, content]) => [
        fileName,
        { name: fileName, content },
      ]),
    );
  } else {
    serializedFiles = serializedApp.files;
  }
  const files = Object.fromEntries(
    Object.entries(serializedFiles).map(([fileName, serializedFile]) => [
      fileName,
      deserializeFile(serializedFile),
    ]),
  );
  return {
    id: appId,
    files,
    selectedFileName: "magic.json",
    deletedFiles: {},
  };
}

type Props = {
  appIds: string[];
  selectedApp: App;
};

const exampleFiles = {
  "magic.json": {
    name: "magic.json",
    content: exampleAppFiles["magic.json5"],
  },
  "index.js": {
    name: "index.js",
    content: exampleAppFiles["index.js"],
  },
};

const exampleApp = {
  id: "Example@0.1.0",
  files: exampleFiles,
  selectedFileName: "magic.json",
  deletedFiles: {},
};

class DevState extends SyncExternalStore<Props> {
  apps: { [appId: string]: App };
  selectedApp: App;
  esbuildPromise: Promise<EsbuildApi>;
  bundleDepsPlugin: Esbuild.Plugin;
  importPlugin: Esbuild.Plugin;
  esbuildContext?: Esbuild.BuildContext;
  tailwindConfigContent?: string;
  constructor({
    esbuildPromise,
    initialApp = exampleApp,
  }: {
    esbuildPromise: Promise<EsbuildApi>;
    initialApp?: App;
  }) {
    super({ appIds: [initialApp.id], selectedApp: initialApp });
    this.apps = {
      [initialApp.id]: initialApp,
    };
    this.selectedApp = initialApp;
    this.esbuildPromise = esbuildPromise;
    this.bundleDepsPlugin = createBundleDepsPlugin(
      this.readFile,
      this.esbuildPromise,
    );
    this.importPlugin = createImportPlugin(this.readFile);
  }
  async initData() {
    //selectedApp is a string - should really be called selectedAppId but not changing it for backwards compatibility
    const { selectedApp, ...serializedApps } = await requestGetAllData();
    if (Object.keys(serializedApps).length === 0) return;
    this.apps = Object.fromEntries(
      Object.entries(serializedApps).map(([appId, serializedApp]) => [
        appId,
        deserializeApp(appId, serializedApp),
      ]),
    );
    this.set("appIds", Object.keys(this.apps));
    if (selectedApp in this.apps) {
      this.setSelectedApp(selectedApp, false);
    } else {
      this.setSelectedApp(Object.keys(this.apps)[0], false);
    }
  }
  errorHandler(error: any) {
    console.error(error);
  }
  putDataErrorHandler(error: any) {
    console.error(error);
    let message = "Unexpected error saving data";
    if (error.message === "Database size limit exceeded") {
      message =
        "Error saving data: maximum storage limit reached. Delete some apps to free up space.";
    }
    this.errorHandler(new ToastError(message, "error"));
  }
  //this should be an arrow function so this refers to the DevState instance even when used in a callback
  readFile: ReadFile = (path) => {
    if (this.selectedApp.files[path]) {
      return this.selectedApp.files[path].content;
    }
  };
  setSelectedApp(appId?: string, save = true) {
    if (appId) {
      if (this.apps[appId]) {
        this.selectedApp = this.apps[appId];
        if (save) {
          requestPutData("selectedApp", appId).catch((error) => {
            this.putDataErrorHandler(error);
          });
        }
      } else {
        throw new Error(`App ${appId} not found`);
      }
    }
    this.set("selectedApp", {
      ...this.selectedApp,
      files: { ...this.selectedApp.files },
      deletedFiles: { ...this.selectedApp.deletedFiles },
    });
  }
  deleteApp(appId: string) {
    delete this.apps[appId];
    if (Object.keys(this.apps).length === 0) {
      this.apps[exampleApp.id] = exampleApp;
    }
    const appIds = Object.keys(this.apps);
    this.set("appIds", appIds);
    this.setSelectedApp(appIds[0]);
    requestDeleteData(appId).catch((error) => {
      console.error(`Error deleting appId ${appId}`, error);
    });
  }
  addApp(
    appId: string,
    files?: Record<string, File>,
    selectedFileName?: string,
  ) {
    if (files && !files["magic.json"]) {
      throw new Error("magic.json is required");
    }
    const [name, version] = appId.split("@");
    if (!name || !version) {
      throw new Error("Invalid appId");
    }
    files = files || {
      "magic.json": {
        name: "magic.json",
        content: `{
  name: "${name}",
  version: "${version}",
}`,
      },
    };
    selectedFileName = selectedFileName || "magic.json";
    this.apps[appId] = {
      id: appId,
      files,
      selectedFileName,
      deletedFiles: {},
    };
    this.set("appIds", Object.keys(this.apps));
    this.setSelectedApp(appId);
  }
  selectFile(fileName: string) {
    if (this.selectedApp.files[fileName]) {
      this.selectedApp.selectedFileName = fileName;
      this.setSelectedApp();
    } else {
      throw new Error(`File ${fileName} not found`);
    }
  }
  addFile(fileName: string) {
    if (this.selectedApp.deletedFiles[fileName]) {
      this.selectedApp.files[fileName] =
        this.selectedApp.deletedFiles[fileName];
      delete this.selectedApp.deletedFiles[fileName];
    } else {
      this.selectedApp.files[fileName] = {
        name: fileName,
        content: "",
      };
    }
    this.setSelectedApp();
  }
  deleteFile(fileName: string) {
    if (this.selectedApp.files[fileName]) {
      if (this.selectedApp.selectedFileName === fileName) {
        this.selectedApp.selectedFileName = "magic.json";
      }
      this.selectedApp.deletedFiles[fileName] =
        this.selectedApp.files[fileName];
      delete this.selectedApp.files[fileName];
      this.setSelectedApp();
      console.log(
        `${fileName} deleted, add a file with the exact same name to recover the deleted code.`,
      );
    } else {
      throw new Error(`File ${fileName} not found`);
    }
  }
  updateFile(update: Partial<File>) {
    const selectedFile =
      this.selectedApp.files[this.selectedApp.selectedFileName];
    if (!selectedFile) {
      throw new Error(`File ${this.selectedApp.selectedFileName} not found`);
    }
    this.selectedApp.files[this.selectedApp.selectedFileName] = {
      ...selectedFile,
      ...update,
    };
    this.setSelectedApp();
  }
  updateFiles(update: { [fileName: string]: Partial<File> }, appId?: string) {
    const app = appId ? this.apps[appId] : this.selectedApp;
    if (!app) {
      throw new Error(`App ${appId} not found`);
    }
    for (const fileName in update) {
      app.files[fileName] = {
        //add name and content for type safety - if it's a new file, then update[fileName] can't be Partial<File> but must be File
        name: fileName,
        content: "",
        ...app.files[fileName],
        ...update[fileName],
      };
    }
    if (app.id === this.selectedApp.id) {
      this.setSelectedApp();
    }
  }
  getMagicObj() {
    const magicContent = this.selectedApp.files["magic.json"]?.content;
    if (!magicContent) {
      throw new Error("magic.json not found");
    }
    return JSON5.parse(magicContent);
  }
  async buildApp({ publish = false }: { publish?: boolean } = {}) {
    const buildAppPromise = this.buildAppImpl({ publish });
    globalThis.dispatchEvent(
      new CustomEvent("buildApp", {
        detail: buildAppPromise,
      }),
    );
    const { appObj, errorMessage } = await buildAppPromise;
    if (appObj && publish) {
      delete appObj.esbuildOptions; //plugins can't be serialized and cause an error
      requestPublish(appObj).catch((error) => {
        this.errorHandler(error);
      });
    }
    return { appObj, errorMessage };
  }
  async buildAppImpl({ publish }: { publish: boolean }) {
    const magicObj = this.getMagicObj();
    if (!magicObj.name || !magicObj.version) {
      throw new Error("magic.json must have name and version");
    }
    const appId = `${magicObj.name}@${magicObj.version}`;
    requestPutData(appId, serializeApp(this.selectedApp)).catch((error) => {
      this.putDataErrorHandler(error);
    });
    if (!(appId in this.apps)) {
      this.addApp(
        appId,
        this.selectedApp.files,
        this.selectedApp.selectedFileName,
      );
    }
    try {
      delete magicObj?.esbuildOptions?.plugins; //not supported
      const esbuild = await this.esbuildPromise;
      //@ts-ignore
      const { appObj, context, result } = await buildApp({
        appObj: magicObj,
        esbuild,
        esbuildOptions: {
          plugins: [this.bundleDepsPlugin, this.importPlugin],
          minify: false,
          sourcemap: true,
          ...(publish ? { minify: true, sourcemap: false } : {}),
        },
        context: this.esbuildContext,
        fileExists: (path: string) => this.readFile(path) !== undefined,
        readFile: this.readFile,
        processTailwind: this.processTailwind,
      });
      if (result.dependencies) {
        this.updateFiles(
          {
            "magic.json": {
              //@ts-ignore: todo need to fix browser types for dev
              content: updateMagicJson(
                this.selectedApp.files["magic.json"]!.content,
                (obj: any) => {
                  obj.dependencies = result.dependencies;
                },
              ),
            },
          },
          appId, //need to specify as the selected app may have changed during the build
        );
      }
      this.esbuildContext = context;
      return { appObj };
    } catch (error) {
      console.error(error);
      return {
        errorMessage:
          error instanceof Error
            ? error.message
            : "Unexpected error building app",
      };
    }
  }
  async runPrettier({ cursorOffset }: { cursorOffset: number }) {
    const selectedFileName = this.selectedApp.selectedFileName;
    const selectedFile = this.selectedApp.files[selectedFileName];
    //don't run prettier if there's a changeSet - makes the diffs hard to manage. todo could come back to this
    if (!selectedFile || selectedFile.changeSet) return {};
    if (
      selectedFileName.endsWith(".js") ||
      selectedFileName.endsWith(".jsx") ||
      selectedFileName.endsWith(".ts") ||
      selectedFileName.endsWith(".tsx") ||
      selectedFileName.endsWith(".json")
    ) {
      const { formatted, cursorOffset: newCursorOffset } =
        await prettier.formatWithCursor(selectedFile.content, {
          filepath:
            selectedFileName === "magic.json"
              ? "magic.json5"
              : selectedFileName,
          plugins: [babelParser, estreeParser],
          cursorOffset,
        });
      return { formatted, newCursorOffset };
    }
    return {};
  }
  //this should be an arrow function so this refers to the DevState instance even when used in a callback
  processTailwind = async (
    config: TailwindConfig,
    css: string,
    _skipBuild = false,
  ) => {
    //config is magic.json tailwindConfig, but if tailwind.config.js exists, use that instead
    let tailwindConfigFile: File | undefined;
    if (this.selectedApp.files["tailwind.config.js"]) {
      tailwindConfigFile = this.selectedApp.files["tailwind.config.js"];
    } else if (this.selectedApp.files["tailwind.config.mjs"]) {
      tailwindConfigFile = this.selectedApp.files["tailwind.config.mjs"];
    }
    if (tailwindConfigFile) {
      try {
        //if skipBuild is true, skip the build, or if file hasn't changed, skip the build
        const skipBuild =
          _skipBuild ||
          tailwindConfigFile.content === this.tailwindConfigContent;
        if (!skipBuild) {
          const esbuild = await this.esbuildPromise;
          const configResult = await esbuild.build({
            entryPoints: [tailwindConfigFile.name],
            write: false,
            plugins: [this.importPlugin],
            bundle: true,
            globalName: "__tailwindConfig",
          });
          eval?.(configResult.outputFiles[0]!.text); //indirect eval
          this.tailwindConfigContent = tailwindConfigFile.content;
        }
        //@ts-ignore
        config = globalThis.__tailwindConfig?.default || {};
      } catch (error) {
        this.errorHandler(
          new ToastError(`Error building ${tailwindConfigFile.name}`, "error"),
        );
      }
    }
    const excludeContent = new Set(config.excludeContent || []);
    config.content = Object.entries(this.selectedApp.files)
      .filter(
        ([filename]) =>
          (filename.endsWith(".js") ||
            filename.endsWith(".jsx") ||
            filename.endsWith(".ts") ||
            filename.endsWith(".tsx") ||
            filename.endsWith(".html")) &&
          !excludeContent.has(filename),
      )
      .map(([filename, file]) => {
        return {
          raw: file.content,
          extension: filename.split(".").pop(),
        };
      });
    //tailwind caches and skips if content hasn't changed, but it's not picking up changes in index.css (probably due to fs not working in browser)
    //so this is a hack to change content every time to force rerun and always pick up changes in index.css
    if (config.content.length > 0) {
      //@ts-ignore
      config.content[0].raw += Date.now();
    }
    return await processTailwindBrowser(config, css);
  };
  async getJs(tsFileName: string) {
    let loader: "tsx" | "ts";
    if (tsFileName.endsWith(".tsx")) {
      loader = "tsx";
    } else if (tsFileName.endsWith(".ts")) {
      loader = "ts";
    } else {
      throw new Error(`File ${tsFileName} is not a TypeScript file`);
    }
    const content = this.selectedApp.files[tsFileName]?.content;
    if (!content) {
      throw new Error(`File ${tsFileName} not found`);
    }
    const esbuild = await this.esbuildPromise;
    const result = await esbuild.transform(content, {
      loader,
      jsx: "preserve",
      sourcemap: "inline",
      sourcesContent: false,
      tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: true } },
    });
    return result.code;
  }
  async apiCreateApp(name: string, description: string, createString: string) {
    const version = "0.1.0";
    const existingNames = new Set(
      Object.keys(this.apps).map((appId) => appId.split("@")[0]!),
    );
    if (existingNames.has(name)) {
      name = getUniqueName(name, existingNames);
      assistant.warn(
        `User already has an App with this name, so renamed the App to: ${name}`,
      );
    }
    const appId = `${name}@${version}`;
    const files: { [fileName: string]: File } = {
      "magic.json": {
        name: "magic.json",
        content: `{
  name: "${name}",
  version: "${version}",
  description: "${description}",
  private: true,
}`,
      },
    };
    let invalidCreateString = false;
    for (const { tag, content } of tagParser(createString)) {
      if (tag === undefined) {
        if (content.trim() !== "") {
          invalidCreateString = true;
        }
        continue;
      }
      files[tag] = {
        name: tag,
        content: content.trim(),
      };
    }
    if (invalidCreateString) {
      assistant.warn(
        "Anything in the createString outside of a tag is ignored",
      );
    }
    this.addApp(appId, files);
    await this.buildApp();
  }
  async apiUpdateFiles(updateString: string) {
    let invalidUpdateString = false;
    const fileUpdates: { [fileName: string]: Partial<File> } = {};
    for (const { tag: fileName, content: fileUpdateString } of tagParser(
      updateString,
    )) {
      if (fileName === undefined) {
        if (fileUpdateString.trim() !== "") {
          invalidUpdateString = true;
        }
        continue;
      }
      if (!fileUpdateString.trim().startsWith("<find>")) {
        //update the whole file
        //we need to look specifically for <find> rather than use tagParser because the file might be HTML or JSX and the tags are false positives
        fileUpdates[fileName] = {
          content: fileUpdateString.trim(),
        };
      } else {
        if (!this.selectedApp.files[fileName]) {
          assistant.error(
            "File not found. Can only use <find> and <replace> tags for existing files:",
            fileName,
          );
          continue;
        }
        let prevContent = this.selectedApp.files[fileName].content;
        let find: string | undefined;
        let invalidFileUpdateString = false;
        for (const { tag, content } of tagParser(fileUpdateString)) {
          if (tag === undefined) {
            if (content.trim() !== "") {
              invalidFileUpdateString = true;
            }
            continue;
          }
          if (tag === "find") {
            if (find) {
              assistant.error("Consecutive <find> tag:", content);
            }
            find = content;
          } else if (tag === "replace") {
            if (find) {
              const newContent = prevContent.replace(
                find.trim(),
                content.trim(),
              );
              if (newContent === prevContent) {
                assistant.error("Could not find text to replace:", find);
              } else {
                prevContent = newContent;
              }
              find = undefined;
            } else {
              assistant.error("<replace> tag without <find> tag:", content);
            }
          }
        }
        if (find) {
          assistant.error("<find> tag without <replace> tag:", find);
        }
        if (invalidFileUpdateString) {
          assistant.warn(
            "When using <find> and <replace> tags, anything outside of a tag is ignored",
          );
        }
        fileUpdates[fileName] = {
          content: prevContent, //kind of confusing, but prevContent is set to newContent after the replace
        };
      }
    }
    if (invalidUpdateString) {
      assistant.warn(
        "Anything in the updateString outside of a tag is ignored",
      );
    }
    for (const [fileName, { content }] of Object.entries(fileUpdates)) {
      if (content === undefined) continue;
      const file = this.selectedApp.files[fileName];
      let changeSet = createChangeSet(file?.content || "", content);
      if (file?.changeSet) {
        changeSet = changeSet.compose(file.changeSet);
      }
      fileUpdates[fileName]!.changeSet = changeSet;
    }
    this.updateFiles(fileUpdates);
    await this.buildApp();
  }
  async apiAdditionalContext({
    files,
    code,
  }: {
    files?: string[];
    code?: string[];
  }) {
    const additionalContext = await context(this, { files, code });
    assistant.full(additionalContext);
    return additionalContext;
  }
  apiAdvancedDocs() {
    const processedDocs = getHeadings(docs, [
      "Apps",
      "Functions",
      "Publishing",
      "Advanced Topics",
    ]);
    const faqs = `# magicsandbox.Dev FAQs

## Why are my builds sometimes slow?

magicsandbox.Dev parses your import statements and bundles external dependencies like React separately. When you rebuild your App, if the external dependencies haven't changed, magicsandbox.Dev will skip bundling external dependencies, making the rebuild extremely fast. If your external dependencies have changed, magicsandbox.Dev will fetch and bundle them again, making the build slower.

## How do I debug my code?

When using magicsandbox.Dev, your code runs in an iframe that's nested several layers deep. Because of this, it can be difficult to find your code in the Sources tab in Chrome's devtools.

The easiest way to debug your code in Chrome is to add a \`debugger\` statement and run your code with devtools open, which will open your file in the Sources tab. Your files will all be prefixed with 'MagicApp', like 'MagicApp:index.js'.

## What is the \`magic.json\` syntax? It's not valid JSON.

The \`magic.json\` file can be written in JSON5.
  `;
    const advancedDocs = processedDocs + "\n\n" + faqs;
    assistant.full(advancedDocs);
    return advancedDocs;
  }
}

export { DevState, type EsbuildApi, type ReadFile, createChangeSet };

function getUniqueName(name: string, existingNames: Set<string>) {
  const match = name.match(/\d+$/);
  let newName;
  if (match) {
    const number = parseInt(match[0]);
    newName = `${name.slice(0, match.index)}${number + 1}`;
  } else {
    newName = `${name}1`;
  }
  if (existingNames.has(newName)) {
    return getUniqueName(newName, existingNames);
  }
  return newName;
}

/**
 * Creates a ChangeSet with the changes needed to transform the newContent into the prevContent
 */
function createChangeSet(prevContent: string, newContent: string) {
  let changeSpec = [];
  if (prevContent === "") {
    changeSpec.push({
      from: 0,
      to: newContent.length,
    });
  } else {
    //since we want the changes to go from new to prev, we treat new as the old array
    //saves us from inverting the changeSet
    const diff = diffChars(newContent, prevContent);
    let ix = 0;
    for (const change of diff) {
      if (change.added) {
        changeSpec.push({
          from: ix,
          insert: change.value,
        });
      } else if (change.removed) {
        changeSpec.push({
          from: ix,
          to: ix + change.value.length,
        });
        ix += change.value.length;
      } else {
        ix += change.value.length;
      }
    }
  }
  return ChangeSet.of(changeSpec, newContent.length);
}
