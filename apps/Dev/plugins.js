/* global requestFetch */

import { parse, getImport } from "./parser.js";
import { isEqual } from "es-toolkit";
import semver from "semver";
import { createDeferredPromise } from "@utils.js";

function sanitizeIdentifier(name) {
  return name.replace(/[^a-zA-Z0-9_$]/g, "_");
}

function countLines(s) {
  let c = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\n") {
      c++;
    }
  }
  return c;
}

function union(set1, set2) {
  const out = new Set(set1);
  set2.forEach((item) => out.add(item));
  return out;
}

/**
 * Returns {path: Set of imported names}
 */
function getImports(file) {
  const imports = {};
  parse(file, (node) => {
    const imp = getImport(node);
    if (imp) {
      const names = new Set(Object.keys(imp.names));
      if (imports[imp.path]) {
        imports[imp.path] = union(imports[imp.path], names);
      } else {
        imports[imp.path] = names;
      }
    }
  });
  return imports;
}

/**
Transforms a file by replacing imports with assignments from a global __deps object:
See test/plugins.js for expected output.

As a side effect, updates pkgImports with the imports in the file, to be used by transformToBundleDeps.

Note, there appears to be a bug in esbuild with reexporting namespaces in an IIFE, so we need to use global __deps rather than globalName:
https://esbuild.github.io/try/#YgAwLjI0LjAAe2J1bmRsZTogdHJ1ZSwgZ2xvYmFsTmFtZTogJ2RlcHMnfQBlAGVudHJ5LmpzAGltcG9ydCAqIGFzIF9fZmlsZTIgZnJvbSAnLi9maWxlMi5qcyc7CgpleHBvcnQge19fZmlsZTJ9OwAAZmlsZTIuanMAZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZigpIHtyZXR1cm4gMDt9CgpmdW5jdGlvbiBnKCkge3JldHVybiAxO30KCmV4cG9ydCB7Z30
^Actually, this is not true (I'm not sure why I thought so). So could try reexporting again
*/
function transformImports(file, pkgImports) {
  const out = [];
  parse(file, (node, i, nodes) => {
    out.push(file.slice(i === 0 ? 0 : nodes[i - 1].end + 1, node.start)); //preserve whitespace between nodes
    const imp = getImport(node);
    if (imp && !imp.path.startsWith("./")) {
      const names = new Set(Object.keys(imp.names));
      pkgImports[imp.path] = union(pkgImports[imp.path] || new Set(), names);
      const renames = Object.entries(imp.names).map(
        ([name, localName]) => `${name === "*" ? "'*'" : name}: ${localName}`,
      );
      if (renames.length > 0) {
        out.push(`const {${renames.join(", ")}} = __deps['${imp.path}'];\n`);
      } else {
        out.push("\n"); //replace import for side effects with new line
      }
      const newLinesToAdd = countLines(file.slice(node.start, node.end)); //need to preserve number of lines for sourcemaps
      for (let i = 0; i < newLinesToAdd; i++) {
        out.push("\n");
      }
    } else {
      out.push(file.slice(node.start, node.end + 1));
    }
  });
  return out.join("");
}

/**
Takes pkgImports from transformImports and returns a string that bundles all dependencies and populates a global __deps object. 
See test/plugins.js for expected output.

Note, there appears to be a bug in esbuild with reexporting namespaces in an IIFE, so we need to use global __deps rather than globalName:
https://esbuild.github.io/try/#YgAwLjI0LjAAe2J1bmRsZTogdHJ1ZSwgZ2xvYmFsTmFtZTogJ2RlcHMnfQBlAGVudHJ5LmpzAGltcG9ydCAqIGFzIF9fZmlsZTIgZnJvbSAnLi9maWxlMi5qcyc7CgpleHBvcnQge19fZmlsZTJ9OwAAZmlsZTIuanMAZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZigpIHtyZXR1cm4gMDt9CgpmdW5jdGlvbiBnKCkge3JldHVybiAxO30KCmV4cG9ydCB7Z30
^Actually, this is not true (I'm not sure why I thought so). So could try reexporting again
*/
function transformToBundleDeps(pkgImports) {
  //this function should not mutate pkgImports or else the comparison to prevPkgImports will not work
  const outputImports = [];
  const outputAssignments = [];
  Object.entries(pkgImports).forEach(([pkg, imports]) => {
    const sanitizedPkg = sanitizeIdentifier(pkg);
    const assignmentRenames = [];
    if (imports.size === 0) {
      outputImports.push(`import '${pkg}';`);
      return;
    }
    if (imports.has("*")) {
      outputImports.push(`import * as __${sanitizedPkg} from '${pkg}';`);
      assignmentRenames.push(`'*': __${sanitizedPkg}`);
    }
    const importsArray = Array.from(imports).filter(
      (importName) => importName !== "*",
    );
    const importRenames = importsArray.map(
      (importName) => `${importName} as __${sanitizedPkg}__${importName}`,
    );
    if (importRenames.length > 0) {
      //if only namespace import, we already pushed to outputImports above
      outputImports.push(`import {${importRenames.join(", ")}} from '${pkg}';`);
    }
    importsArray.forEach((importName) => {
      assignmentRenames.push(`${importName}: __${sanitizedPkg}__${importName}`);
    });
    outputAssignments.push(
      `__deps['${pkg}'] = {${assignmentRenames.join(", ")}};`,
    );
  });
  return `${outputImports.join("\n")}\nwindow.__deps = {};\n${outputAssignments.join("\n")}`;
}

function createBundleDepsPlugin(filesRef, appObjRef, esbuild, bundledDepsRef) {
  const plugin = {
    name: "bundleDeps",
    setup(build) {
      let prevPkgImports, pkgImports, prevAppObj;

      build.onStart(() => {
        pkgImports = {};
      });

      build.onResolve({ filter: /.*/ }, (args) => {
        const path = args.path;
        if (filesRef.current[path]) {
          return { path: path, namespace: "MagicApp" };
        } else if (path.startsWith("./") && filesRef.current[path.slice(2)]) {
          return { path: path.slice(2), namespace: "MagicApp" };
        }
      });

      build.onLoad({ filter: /.*/, namespace: "MagicApp" }, (args) => {
        return {
          contents: transformImports(filesRef.current[args.path], pkgImports), //pkgImports updated as side effect
          loader: "jsx",
        };
      });

      build.onEnd(async (result) => {
        if (
          !isEqual(pkgImports, prevPkgImports) ||
          !isEqual(appObjRef.current, prevAppObj)
        ) {
          if (Object.keys(pkgImports).length > 0) {
            const bundleDepsCode = transformToBundleDeps(pkgImports);
            const bundledDeps = await bundleDeps(
              bundleDepsCode,
              esbuild,
              build.initialOptions,
              appObjRef,
            );
            bundledDepsRef.current = bundledDeps; //could try to use `this` and save a ref but couldn't get it to work
          } else {
            bundledDepsRef.current = "";
          }
          prevPkgImports = pkgImports;
          prevAppObj = { ...appObjRef.current };
        }
        if (bundledDepsRef.current) {
          try {
            const bundledText = bundledDepsRef.current;
            const text = result.outputFiles[0].text;
            const sourceMapStart =
              text.lastIndexOf("//# sourceMappingURL=") + 50; //50 chars removes //# sourceMappingURL=data...base64,
            const decodedSourceMap = JSON.parse(
              atob(text.slice(sourceMapStart)),
            );
            let bundledLineCount = countLines(bundledText) + 1; //add 1 because we add one extra line break when concatenating
            const newSourceMap = {
              //https://tc39.es/source-map/#index-map
              version: 3,
              sections: [
                {
                  offset: { line: bundledLineCount, column: 0 },
                  map: { ...decodedSourceMap },
                },
              ],
            };
            const newText = text.slice(0, sourceMapStart);
            const encodedSourceMap = btoa(JSON.stringify(newSourceMap));
            result.outputFiles[0] = {
              text: `${bundledText}\n${newText}${encodedSourceMap}`,
            };
          } catch (e) {
            console.log("Error updating sourcemap", e);
          }
        }
      });
    },
  };
  return plugin;
}

async function bundleDeps(bundleDepsCode, esbuild, options, appObjRef) {
  let result = await buildDeps(bundleDepsCode, esbuild, options, appObjRef);
  if (appObjRef.current.optimizedTreeShaking) {
    if (result.resolvedPaths) {
      result = await buildDeps(
        bundleDepsCode,
        esbuild,
        options,
        appObjRef,
        result.resolvedPaths,
      );
    } else {
      console.warn(
        `optimizedTreeShaking is not enabled for ${appObjRef.current.cdn}`, //todo show user
      );
    }
  }
  return result.outputFiles[0].text;
}

async function buildDeps(bundleDepsCode, esbuild, options, appObjRef, imports) {
  const result = await esbuild.build({
    ...options,
    entryPoints: ["bundleDepsCode.js"],
    plugins: [
      createImportPlugin(
        { current: { "bundleDepsCode.js": bundleDepsCode } }, //filesRef
        appObjRef,
        imports,
      ),
    ],
    globalName: undefined,
    //since there are two separate builds and sourcemaps, devtools only shows the sourcemap for the user files
    //which is better anyway, since the deps sourcemap is not useful because it's minified
    //so turn it off as an optimization
    sourcemap: false,
  });
  return result;
}

/*
optimizedTreeShaking:
- Only supported for cdn esm.sh
- Requires two builds: first build tracks imports for each resolvedPath, the second build uses the imports for tree shaking
- The reason we need two builds is because when we `import {x} from 'pkg'`, we don't know if a later dependency will `import {y} from 'pkg'`
- First build:
  - Import.handleContents calls getImports and saves it to Import.imports - at this point we don't know its children resolvedPaths
  - Import.handleResolve looks up its parent Import.imports and uses resolvedPath to save to BuildMetadata.resolvedPaths
  - build.onEnd saves BuildMetadata.resolvedPaths to result.resolvedPaths
- Second build:
  - BuildMetadata.imports is set to result.resolvedPaths from first build (todo could name these better)
  - getUrls uses BuildMetadata.imports to construct an esm.sh url that tree shakes
*/

/*
- For the build to be deterministic, each import must be resolved in order
- We do a breadth first search of the import tree
- So first we resolve import 1, import 2, import 3
- Then import 1.1 (first child of import 1), import 1.2, import 1.3, import 2.1, ...
- Each onResolve creates an Import and returns a promise
- The Import is queued on its parent. When the parent is marked ready, the promise is resolved
- Then we get the Import's contents, initialize its children queue, and use the contents in onLoad
- BuildMetadata is responsible for the import queue, package metadata, and tracking which paths have been resolved
- BuildMetadata creates a PackageMetadata for each package, which is responsible for resolving versions
*/

class BuildMetadata {
  constructor(filesRef, appObjRef, imports, log) {
    this.filesRef = filesRef;
    this.appObjRef = appObjRef;
    this.cdn = appObjRef.current.cdn || "esm.sh";
    this.log = log;
    this.importQueue = [];
    this.packageMetadataMap = {}; //{packageId: PackageMetadata}
    this.resolvedPaths = {}; //{resolvedPath: Set of imported names}
    this.imports = imports || {}; //{resolvedPath: Set of imported names}
  }
  addImport(imp) {
    if (this.canceled) {
      imp.onResolvePromise.reject(new Error("Build canceled"));
      return;
    }
    this.importQueue.push(imp);
    if (this.importQueue.length === 1) {
      imp.markChildrenReady();
    } else if (this.importQueue[this.importQueue.length - 2].done) {
      imp.markChildrenReady();
    }
  }
  resolve(imp) {
    this.log(`buildMetadata.resolve ${imp.args.path}`);
    let packageMetadata = this.packageMetadataMap[imp.packageId];
    if (!packageMetadata) {
      packageMetadata = new PackageMetadata(this, imp.packageId);
      this.packageMetadataMap[imp.packageId] = packageMetadata;
    }
    packageMetadata.resolve(imp);
  }
  cancelBuild() {
    //so build doesn't hang
    this.canceled = true;
    this.importQueue.forEach((imp) => {
      imp.onResolvePromise.reject(new Error("Build canceled"));
    });
  }
}

class PackageMetadata {
  constructor(buildMetadata, packageId) {
    this.buildMetadata = buildMetadata;
    this.packageId = packageId;
    this.log = buildMetadata.log;
    this.versionPaths = {};
    this.peer = false;
    this.queue = [];
    this.isProcessing = false;
  }
  resolve(imp) {
    this.log(`packageMetadata.resolve ${imp.args.path}`);
    this.queue.push(imp);
    this.processNext();
  }
  processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    const imp = this.queue.shift();
    this.isProcessing = true;
    try {
      const { version, pathWithoutFile } = this.resolvePathWithoutFile(imp);
      imp.version = version; //just for debugging
      imp.resolvedPath = `${pathWithoutFile}${imp.parsedPath.file ? `/${imp.parsedPath.file}` : ""}`;
      imp
        .handleResolve()
        .then((pluginData) => {
          const version = pluginData?.pjson?.version;
          if (version) {
            imp.version = version;
            this.versionPaths[version] = pathWithoutFile;
          }
        })
        .catch((e) => {
          console.error(e);
          imp.onResolvePromise.reject(e);
        })
        .finally(() => {
          this.isProcessing = false;
          this.processNext();
        });
    } catch (e) {
      console.error(e);
      imp.onResolvePromise.reject(e);
      this.isProcessing = false;
      this.processNext();
    }
  }
  /**
   * Returns string in format [@scope/]package[@version]
   */
  resolvePathWithoutFile(imp) {
    const pjson = imp.args.pluginData?.pjson || {};
    const importer = pjson ? `${pjson.name}@${pjson.version}` : undefined; //todo better logging
    const { range, peer } = this.getRange(imp.parsedPath, pjson, importer);
    const versions = Object.keys(this.versionPaths);
    if (peer && !this.peer && versions.length > 1) {
      console.warn(
        `${this.packageId} is marked as a peer dependency, but already has resolved to multiple versions: ${versions.join(", ")}`,
      );
    }
    this.peer = Boolean(peer || this.peer);
    if (range) {
      if (versions.length > 0) {
        //use max existing version in range to deduplicate if possible
        const maxSatisfyingVersion = semver.maxSatisfying(versions, range, {
          loose: true,
        });
        if (maxSatisfyingVersion) {
          return {
            version: maxSatisfyingVersion,
            pathWithoutFile: this.versionPaths[maxSatisfyingVersion],
          };
        } else if (this.peer) {
          //no version satisfies range, but it's a peer, so use max and warn
          const maxVersion = semver.rsort(versions)[0];
          console.warn(
            `Ignoring ${importer} range ${range} when importing peer dependency ${this.packageId}, using ${maxVersion} instead`,
          );
          return {
            version: maxVersion,
            pathWithoutFile: this.versionPaths[maxVersion],
          };
        } else {
          //no existing version satifies range, not a peer, use range
          return { pathWithoutFile: `${this.packageId}@${range}` };
        }
      } else {
        //no existing versions - use range
        return { pathWithoutFile: `${this.packageId}@${range}` };
      }
    } else if (versions.length > 0) {
      //no range - use max existing version to deduplicate
      const version = semver.rsort(versions)[0];
      return { version, pathWithoutFile: this.versionPaths[version] };
    } else {
      //no range, no existing versions
      return { pathWithoutFile: this.packageId };
    }
  }
  getRange(parsedPath, pjson, importer) {
    const { overrides, dependencies } = this.buildMetadata.appObjRef.current;
    let range;
    let peer = false;
    if (overrides?.[importer]?.[this.packageId]) {
      range = overrides[importer][this.packageId];
    } else if (overrides?.[this.packageId]) {
      range = overrides[this.packageId];
    } else if (pjson?.peerDependencies?.[this.packageId]) {
      range = pjson.peerDependencies[this.packageId];
      peer = true;
    } else if (pjson?.dependencies?.[this.packageId]) {
      range = pjson.dependencies[this.packageId];
    } else if (pjson?.optionalDependencies?.[this.packageId]) {
      range = pjson.optionalDependencies?.[this.packageId];
    } else if (!pjson && dependencies?.[this.packageId]) {
      range = dependencies[this.packageId];
    } else if (parsedPath.version) {
      range = parsedPath.version;
    }
    /*
    jsdelivr supports semver (^18) and tags (latest) but not both (^18 || latest)
    constructing a range with the loose parameter will strip out tags if both semver and tags are present: ^18 || latest -> ^18
    but if only a tag is present, it will error, in which case we can just use the tag
    */
    try {
      range = new semver.Range(range, { loose: true });
    } catch {
      //only a tag is present, ignore
    }
    return { range, peer };
  }
}

class Import {
  constructor(args, buildMetadata, onResolvePromise, parent) {
    this.args = args;
    this.buildMetadata = buildMetadata;
    this.log = buildMetadata.log;
    this.onResolvePromise = onResolvePromise;
    this.onResolvePromise.catch((error) => {
      this.buildMetadata.cancelBuild();
      throw error;
    });
    this.parent = parent;
    this.normalizedPath = normalizePath(
      this.args.path,
      this.buildMetadata,
      this.parent,
    );
    this.parsedPath = parseNormalizedPath(this.normalizedPath);
    this.packageId = combinePathParts({
      scope: this.parsedPath.scope,
      package: this.parsedPath.package,
    });
    this.resolvedPath = undefined;
    this.version = undefined;
    this.url = undefined;
    this.imports = undefined; //{path: Set of imported names}
    this.children = undefined;
    this.ready = false;
    this.done = false;
    this.queueIndex = 0;
    this.processIndex = 0;
    this.importQueueIndex = this.buildMetadata.importQueue.length;
    this.buildMetadata.addImport(this);
  }
  toJSON() {
    return {
      path: this.args.path,
      normalizedPath: this.normalizedPath,
      resolvedPath: this.resolvedPath,
      version: this.version,
      url: this.url,
      children: this.children,
    };
  }
  resolve() {
    try {
      this.log(`Import.resolve ${this.args.path}`);
      //don't resolve esm.sh node polyfills
      if (this.packageId && this.packageId !== "node") {
        /*
        buildMetadata creates a PackageMetadata if needed and the resolve is added to PackageMetadata's queue
        this is so resolves can run in parallel as much as possible
        but multiple resolves for the same package cannot run in parallel, as the first resolved version may influence the second
        so PackageMetadata needs a queue. once it's ready, PackageMetadata will call handleResolve
        */
        this.buildMetadata.resolve(this);
      } else {
        this.resolvedPath = this.normalizedPath;
        this.handleResolve();
      }
    } catch (error) {
      console.error(error);
      this.onResolvePromise.reject(error);
    }
  }
  handleResolve() {
    try {
      this.log(`handleResolve ${this.args.path}`);
      const loaded = Boolean(
        this.buildMetadata.resolvedPaths[this.resolvedPath],
      );
      //
      this.buildMetadata.resolvedPaths[this.resolvedPath] = union(
        this.buildMetadata.resolvedPaths[this.resolvedPath] || new Set(),
        this.parent?.imports?.[this.args.path] || new Set(),
      );
      if (!loaded) {
        if (!this.packageId) {
          //local file
          const contents =
            this.buildMetadata.filesRef.current[this.resolvedPath.slice(1)]; //format is /file.js
          this.handleContents(contents);
          this.onResolvePromise.resolve({
            path: this.resolvedPath,
            namespace: "import",
            pluginData: { contents, import: this },
          });
          //we could return a promise here, but we don't use PackageMetadata for local files
          //so if we used PackageMetadata but are in this code path, there's a bug, and it's better to error
        } else {
          //fetch files
          const pluginDataPromise = handleFetch(
            this.resolvedPath,
            this.buildMetadata,
            this,
          )
            .then(([contentsResponse, pjsonResponse]) => {
              if (
                contentsResponse.status >= 400 ||
                pjsonResponse?.status >= 400
              ) {
                throw new Error(
                  `fetch error ${this.resolvedPath}: ${contentsResponse.status} ${pjsonResponse?.status}`,
                );
              }
              const contents = contentsResponse.body;
              this.handleContents(contents);
              const pjson = pjsonResponse?.body;
              return { contents, import: this, pjson };
            })
            .catch((e) => {
              console.error(e);
              this.buildMetadata.cancelBuild();
              throw e;
            });
          this.onResolvePromise.resolve({
            path: this.resolvedPath,
            namespace: "import",
            pluginData: pluginDataPromise,
          });
          return pluginDataPromise;
        }
      } else {
        //onLoad already ran for this.resolvedPath
        this.createChildrenQueue(0);
        this.onResolvePromise.resolve({
          path: this.resolvedPath,
          namespace: "import",
        });
        //return a promise because PackageMetadata.processNext is expecting one
        return Promise.resolve();
      }
    } catch (error) {
      console.error(error);
      this.onResolvePromise.reject(error);
    }
  }
  handleContents(contents) {
    const imports = getImports(contents); // {path: Set of imported names}
    //at this point we know the imports for each path, but not each resolvedPath, so just save imports on Import
    this.imports = imports;
    this.createChildrenQueue(Object.keys(imports).length);
  }
  createChildrenQueue(n) {
    this.log(`createChildrenQueue ${this.args.path}`);
    this.children = new Array(n);
    this.processChild();
  }
  queueChild(imp) {
    this.log(`queueChild ${this.args.path}`);
    if (this.queueIndex >= this.children.length) {
      console.warn("Potentially indeterministic build", this);
    }
    this.children[this.queueIndex] = imp;
    this.queueIndex++;
    this.processChild();
  }
  processChild() {
    if (!this.ready || this.children?.length === undefined) return;
    this.log(`processChild ${this.args.path}`);
    while (this.processIndex < this.children.length) {
      const child = this.children[this.processIndex];
      if (!child) {
        break;
      }
      child.resolve();
      this.processIndex++;
    }
    if (this.processIndex === this.children.length) {
      this.markDone();
    }
  }
  markChildrenReady() {
    if (this.ready) return;
    this.log(`markChildrenReady ${this.args.path}`);
    this.ready = true;
    this.processChild();
  }
  markDone() {
    if (this.done) return;
    this.log(`markDone ${this.args.path}`);
    this.done = true;
    if (this.importQueueIndex < this.buildMetadata.importQueue.length - 1) {
      this.buildMetadata.importQueue[
        this.importQueueIndex + 1
      ].markChildrenReady();
    }
  }
}

function createImportPlugin(filesRef, appObjRef, imports) {
  return {
    name: "import",
    setup(build) {
      let buildMetadata, start, log, intervalId;

      build.onStart(() => {
        if (appObjRef.current.debug) {
          log = console.log;
          intervalId = setInterval(() => {
            console.log(buildMetadata);
          }, 60000);
        } else {
          log = () => {};
        }
        buildMetadata = new BuildMetadata(filesRef, appObjRef, imports, log);
        start = Date.now();
        log("onStart");
      });

      build.onResolve({ filter: /.*/ }, (args) => {
        log(`onResolve ${args.path}`);
        const parent = args.pluginData?.import;
        const onResolvePromise = createDeferredPromise();
        const imp = new Import(args, buildMetadata, onResolvePromise, parent);
        if (!parent) {
          imp.resolve(); //this is the first onResolve, so run it now
        } else {
          parent.queueChild(imp);
        }
        return onResolvePromise;
      });

      build.onLoad({ filter: /.*/ }, async (args) => {
        log(`onLoad ${args.path}`);
        const { contents, ...pluginData } = await args.pluginData;
        //since onResolves run synchronously, once we hit the first onLoad we can mark the parent as done
        //this prevents the build from hanging if we provided the incorrect number of imports to createChildrenQueue
        const parent = pluginData?.import?.parent;
        if (parent?.done === false) {
          console.log("Marked parent as done", parent);
          parent.markDone();
        }
        return {
          contents: contents,
          loader: "jsx", //todo other file types?
          pluginData,
        };
      });

      build.onEnd((result) => {
        if (buildMetadata.cdn === "esm.sh") {
          result.resolvedPaths = buildMetadata.resolvedPaths;
        }
        log(`Build took ${Date.now() - start}ms`);
        clearInterval(intervalId);
        if (buildMetadata.canceled) {
          console.log(buildMetadata); //log no matter what if canceled
        } else {
          log(buildMetadata);
        }
        log(JSON.stringify(buildMetadata.importQueue[0], null, 2));
      });
    },
  };
}

//todo not sure we ever use scope without package, so could combine them and simplify things

/**
 * Takes string in format [@scope/][package][@version][/file]
 * Returns {scope, package, version, file}
 */
function parseNormalizedPath(path) {
  const match = path.match(
    // scope         package  version      file
    /^(?:@([^/]+)\/)?([^@/]+)?(?:@([^/]+))?(?:\/(.+))?$/,
  );
  return match
    ? { scope: match[1], package: match[2], version: match[3], file: match[4] }
    : null;
}

/**
 * Returns string in format [@scope/][package][@version][/file]
 */
function combinePathParts({ scope, package: _package, version, file }) {
  scope = scope ? `@${scope}/` : "";
  _package = _package ? _package : "";
  version = version ? `@${version}` : "";
  file = file ? `/${file}` : "";
  return `${scope}${_package}${version}${file}`;
}

const esmShData = {
  //prefix removed in v136
  redirectHeader: "x-esm-path", //renamed to x-esm-path in v136
};

/**
 * Returns string in format [@scope/][package][@version][/file]
 */
function normalizePath(path, buildMetadata, parent) {
  //first check for local files
  //which can be in format 'file.js' or './file.js'
  //and return format '/file.js'
  const filesRef = buildMetadata.filesRef;
  if (filesRef.current[path]) {
    return `/${path}`;
  } else if (
    path.startsWith("./") &&
    filesRef.current[path.slice(2)] &&
    !parent?.url //esm.sh uses relative paths which could collide with local files
  ) {
    return path.slice(1);
  }
  const cdn = buildMetadata.cdn;
  if (cdn === "jsdelivr") {
    // /npm/@scope/package@version/file/+esm
    // /npm/react@19.0.0/+esm
    const match = path.match(/^\/npm\/(.+)\/\+esm$/);
    if (match) {
      return match[1];
    } else {
      //could be a bare user import like 'react'
      return path;
    }
  } else if (cdn === "esm.sh") {
    if (path.startsWith(".")) {
      // new URL('./pack.mjs', 'https://esm.sh/msgpackr@1.11.2/es2022/msgpackr.mjs').pathname
      // becomes: '/msgpackr@1.11.2/es2022/pack.mjs'
      // which will match first match below
      path = new URL(path, parent.url).pathname;
    }
    // /@scope/package@version/target/file
    // /react@19.0.0/es2022/react.mjs
    const match = path.match(
      //  scope          package version    target     file
      /^\/(?:@([^/]+)\/)?([^@]+)(?:@([^/]+))(\/[^/]+\/)(.+)$/,
    );
    if (match) {
      return combinePathParts({
        scope: match[1],
        package: match[2],
        version: match[3],
        //if package is 'react' and file is 'react.mjs', ignore the file
        file: match[5] === `${match[2]}.mjs` ? undefined : match[5],
      });
    }
    // /@scope/package@version/file?target
    // /scheduler@^0.25.0?target=es2022
    // /highlight.js@~11.11.0/lib/languages/1c?target=es2022
    const match2 = path.match(
      //  scope          package version     file
      /^\/(?:@([^/]+)\/)?([^@]+)(?:@([^?/]+))(?:\/([^?]+))?/,
    );
    if (match2) {
      return combinePathParts({
        scope: match2[1],
        package: match2[2],
        version: match2[3],
        file: match2[4],
      });
    }
    const match3 = path.match(/^\/node\/(.+)$/);
    if (match3) {
      return combinePathParts({
        package: "node",
        file: match3[1],
      });
    }
    //could be a bare user import like 'react'
    return path;
  } else {
    throw new Error(`Unknown cdn: ${cdn}`);
  }
}

/**
 * Returns Promise<[contentsResponse, pjsonResponse]>
 */
function handleFetch(resolvedPath, buildMetadata, imp) {
  const { fileUrl, pjsonUrl } = getUrls(resolvedPath, buildMetadata);
  imp.url = fileUrl;
  const filePromise = requestFetch(fileUrl, { responseType: "string" }).then(
    (response) => {
      if (
        buildMetadata.cdn === "esm.sh" &&
        response.headers[esmShData.redirectHeader]
      ) {
        //need to follow these redirects for optimizedTreeShaking to work
        //otherwise initial page marks everything as imported
        //see: https://esm.sh/v135/lucide-react@0.468.0?exports=Sparkle
        const redirectUrl = `https://esm.sh${response.headers[esmShData.redirectHeader]}`;
        imp.url = redirectUrl;
        return requestFetch(redirectUrl, { responseType: "string" });
      }
      return response;
    },
  );
  const pjsonPromise = pjsonUrl
    ? requestFetch(pjsonUrl, { responseType: "json" })
    : Promise.resolve();
  return Promise.all([filePromise, pjsonPromise]);
}

function getUrls(resolvedPath, buildMetadata) {
  const resolvedParsedPath = parseNormalizedPath(resolvedPath);
  const resolvedPathWithoutFile = combinePathParts({
    scope: resolvedParsedPath.scope,
    package: resolvedParsedPath.package,
    version: resolvedParsedPath.version,
  });
  const cdn = buildMetadata.cdn;
  if (cdn === "jsdelivr") {
    return {
      fileUrl: `https://cdn.jsdelivr.net/npm/${resolvedPath}/+esm`,
      pjsonUrl: `https://cdn.jsdelivr.net/npm/${resolvedPathWithoutFile}/package.json`,
    };
  } else if (cdn === "esm.sh") {
    if (resolvedParsedPath.package === "node") {
      //esm.sh node polyfills are in format /node/file.js
      return {
        fileUrl: `https://esm.sh/node/${resolvedParsedPath.file}`,
      };
    }
    let exports = "";
    if (buildMetadata.imports[resolvedPath]) {
      const imports = buildMetadata.imports[resolvedPath];
      if (imports.size > 0 && !imports.has("*")) {
        exports = `?exports=${Array.from(imports).join(",")}`;
      }
    }
    return {
      fileUrl: `https://esm.sh/${resolvedPath}${exports}`,
      pjsonUrl: `https://esm.sh/${resolvedPathWithoutFile}/package.json`,
    };
  } else {
    throw new Error(`Unknown cdn: ${cdn}`);
  }
}

export {
  createBundleDepsPlugin,
  createImportPlugin,
  transformImports,
  transformToBundleDeps,
  getImports,
};
