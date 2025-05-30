import SyncExternalStore from "@utils/SyncExternalStore.ts";
import { ChangeSet, Text, type ChangeSpec } from "@codemirror/state";
import { tagParser } from "@magicsandbox.ai/streaming";
//@ts-ignore
import { buildApp, exampleAppFiles } from "@magicsandbox.ai/dev";
import JSON5 from "json5";

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
  constructor() {
    super({ appIds: [exampleApp.id], selectedApp: exampleApp });
    this.apps = {
      [exampleApp.id]: exampleApp,
    };
    this.selectedApp = exampleApp;
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
  buildApp(esbuild: any, publish = false) {
    const magicContent = this.selectedApp.files["magic.json"]?.content;
    if (!magicContent) {
      throw new Error("Unexpected build error - magic.json is missing");
    }
    const magicObj = JSON5.parse(magicContent);
    const { appObj, context } = buildApp({
      appObj: magicObj,
      esbuild,
      esbuildOptions: {
        plugins: [bundleDepsPluginRef.current, importPluginRef.current],
        minify: false,
        sourcemap: true,
        ...(publish ? { minify: true, sourcemap: false } : {}),
      },
      context: esbuildContextRef.current,
      fileExists,
      readFile,
      processTailwind,
    });
  }
}

export { DevState };

function docFromString(content: string) {
  return Text.of(content.split("\n"));
}
