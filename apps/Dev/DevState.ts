import SyncExternalStore from "@utils/SyncExternalStore.ts";
import {
  ChangeSet,
  Text,
  type ChangeSpec,
  type EditorState,
} from "@codemirror/state";
import { historyField } from "@codemirror/commands";
import { tagParser } from "@magicsandbox.ai/streaming";
//@ts-ignore
import { buildApp, exampleAppFiles } from "@magicsandbox.ai/dev";
import processTailwindBrowser, {
  type TailwindConfig,
} from "@magicsandbox.ai/tailwind-browser";
import JSON5 from "json5";
import type * as Esbuild from "esbuild";
import { createBundleDepsPlugin, createImportPlugin } from "./plugins.ts";

type EsbuildApi = Esbuild.PluginBuild["esbuild"]; //not sure why this is on PluginBuild but it works

type ReadFile = (path: string) => string | undefined;

interface File {
  name: string;
  content: string;
  changeSet?: ChangeSet | undefined;
  editorState?: EditorState;
  editorStateJson?: any;
  scroll?: {
    top: number;
    left: number;
  };
}

interface App {
  id: string;
  files: { [fileName: string]: File };
  selectedFile: File;
  deletedFiles: { [fileName: string]: File };
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
  selectedFile: exampleFiles["magic.json"],
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
  constructor({ esbuildPromise }: { esbuildPromise: Promise<EsbuildApi> }) {
    super({ appIds: [exampleApp.id], selectedApp: exampleApp });
    this.apps = {
      [exampleApp.id]: exampleApp,
    };
    this.selectedApp = exampleApp;
    this.esbuildPromise = esbuildPromise;
    this.bundleDepsPlugin = createBundleDepsPlugin(
      this.readFile,
      this.esbuildPromise,
    );
    this.importPlugin = createImportPlugin(this.readFile);
  }
  readFile: ReadFile = (path) => {
    if (this.selectedApp.files[path]) {
      return this.selectedApp.files[path].content;
    }
  };
  errorHandler(error: any) {
    console.error(error);
  }
  setSelectedApp(appId?: string) {
    if (appId) {
      if (this.apps[appId]) {
        this.selectedApp = this.apps[appId];
        requestPutData("selectedApp", appId).catch((error) => {
          console.error(`Error saving selectedApp ${appId}`, error);
        });
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
  addApp(appId: string, files?: Record<string, File>, selectedFile?: File) {
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
    selectedFile = selectedFile || files["magic.json"]!;
    this.apps[appId] = {
      id: appId,
      files,
      selectedFile,
      deletedFiles: {},
    };
    this.set("appIds", Object.keys(this.apps));
    this.setSelectedApp(appId);
  }
  selectFile(fileName: string) {
    if (this.selectedApp.files[fileName]) {
      if (this.selectedApp.selectedFile.editorState) {
        this.selectedApp.selectedFile.editorStateJson =
          this.selectedApp.selectedFile.editorState.toJSON(editorStateFields);
      }
      this.selectedApp.selectedFile = this.selectedApp.files[fileName];
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
    this.selectedApp.selectedFile = {
      ...this.selectedApp.selectedFile,
      ...update,
    };
    this.setSelectedApp();
  }
  updateFiles(update: { [fileName: string]: Partial<File> }) {
    for (const fileName in update) {
      this.selectedApp.files[fileName] = {
        //add name and content for type safety - if it's a new file, then update[fileName] can't be Partial<File> but must be File
        name: fileName,
        content: "",
        ...this.selectedApp.files[fileName],
        ...update[fileName],
      };
    }
    this.setSelectedApp();
  }
  async buildApp(publish = false) {
    const magicContent = this.selectedApp.files["magic.json"]?.content;
    if (!magicContent) {
      throw new Error("Unexpected build error - magic.json is missing");
    }
    const magicObj = JSON5.parse(magicContent);
    const esbuild = await this.esbuildPromise;
    const { appObj, context } = await buildApp({
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
    this.esbuildContext = context;
    return appObj;
  }
  async processTailwind(
    config: TailwindConfig,
    css: string,
    _skipBuild = false,
  ) {
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
        this.errorHandler(error);
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
  }
  apiUpdateFiles(updateString: string) {
    let invalidUpdateString = false;
    const fileUpdates: { [fileName: string]: Partial<File> } = {};
    const changeSpecs: Record<string, ChangeSpec> = {};
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
        if (this.selectedApp.files[fileName]) {
          changeSpecs[fileName] = [
            {
              from: 0,
              to: this.selectedApp.files[fileName].content.length,
              insert: fileUpdateString,
            },
          ];
        } else {
          changeSpecs[fileName] = [
            {
              from: 0,
              insert: fileUpdateString,
            },
          ];
        }
        fileUpdates[fileName] = {
          content: fileUpdateString,
        };
      } else {
        if (!this.selectedApp.files[fileName]) {
          assistant.error(
            "File not found. Can only use <find> and <replace> tags for existing files:",
            fileName,
          );
          continue;
        }
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
              const prevContent = this.selectedApp.files[fileName].content;
              const newContent = prevContent.replace(
                find.trim(),
                content.trim(),
              );
              if (newContent === prevContent) {
                assistant.error("Could not find text to replace:", find);
              } else {
                fileUpdates[fileName] = {
                  content: newContent,
                };
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
      }
    }
    if (invalidUpdateString) {
      assistant.warn(
        "Anything in the updateString outside of a tag is ignored",
      );
    }
    for (const [fileName, changeSpec] of Object.entries(changeSpecs)) {
      const originalDoc = docFromString(
        this.selectedApp.files[fileName]?.content || "",
      );
      const newChangeSet = ChangeSet.of(changeSpec, originalDoc.length);
      //we store the changeSet to get from the current document to the original document, so we need to invert it
      const invertedChangeSet = newChangeSet.invert(originalDoc);
      const existingChangeSet = this.selectedApp.files[fileName]?.changeSet;
      let updateChangeSet: ChangeSet;
      if (existingChangeSet) {
        //then if there is already an existing changeSet, we compose them
        updateChangeSet = invertedChangeSet.compose(existingChangeSet);
      } else {
        updateChangeSet = invertedChangeSet;
      }
      if (!fileUpdates[fileName]) {
        //we shouldn't have a changeSet if we're not also updating the content
        throw new Error(`Unexpected error updating ${fileName}`);
      }
      fileUpdates[fileName].changeSet = updateChangeSet;
    }
    this.updateFiles(fileUpdates);
  }
}

const editorStateFields = { history: historyField };

export { DevState, editorStateFields, type EsbuildApi, type ReadFile };

function docFromString(content: string) {
  return Text.of(content.split("\n"));
}

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
