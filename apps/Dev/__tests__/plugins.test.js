import { describe, expect, test } from "@jest/globals";
import {
  transformImports,
  transformToBundleDeps,
  getImports,
  normalizePath,
  parseNormalizedPath,
} from "../plugins.js";

/*
npm run jest -- apps/Dev

notes:
- note that transformImports updates pkgImports as a side effect, so the order of the tests is important
- preserving line numbers is important for sourcemaps

todos:
- add test for fetching dynamic imports
*/

const pkgImports = {};

const file1 = `/* global requestFunction */

import f, {f1} from 'react-dom/client';

import {
  g as g1,
  h,
  i,
} from 'pkg2';
import l, * as j from 'pkg3';
import 'pkg5';
import o from './file2.js';
n = import('pkg6');
console.log('rest of file1');`;

const expectedTransformedFile1 = `/* global requestFunction */

const {default: f, f1: f1} = __deps['react-dom/client'];

const {g: g1, h: h, i: i} = __deps['pkg2'];




const {default: l, '*': j} = __deps['pkg3'];

import o from './file2.js';
n = import('pkg6');
console.log('rest of file1');`;

const file2 = `import {g as g2, k} from 'pkg2';
import f from 'pkg4';
import * as m from 'pkg7';
console.log('rest of file2');`;

const expectedTransformedFile2 = `const {g: g2, k: k} = __deps['pkg2'];
const {default: f} = __deps['pkg4'];
const {'*': m} = __deps['pkg7'];
console.log('rest of file2');`;

describe("transformImports", () => {
  test("should generate the correct output", () => {
    expect(transformImports(file1, pkgImports)).toBe(expectedTransformedFile1);
    expect(transformImports(file2, pkgImports)).toBe(expectedTransformedFile2);
  });
});

const expectedBundleDeps = `import {default as __react_dom_client__default, f1 as __react_dom_client__f1} from 'react-dom/client';
import {g as __pkg2__g, h as __pkg2__h, i as __pkg2__i, k as __pkg2__k} from 'pkg2';
import * as __pkg3 from 'pkg3';
import {default as __pkg3__default} from 'pkg3';
import 'pkg5';
import {default as __pkg4__default} from 'pkg4';
import * as __pkg7 from 'pkg7';
window.__deps = {};
__deps['react-dom/client'] = {default: __react_dom_client__default, f1: __react_dom_client__f1};
__deps['pkg2'] = {g: __pkg2__g, h: __pkg2__h, i: __pkg2__i, k: __pkg2__k};
__deps['pkg3'] = {'*': __pkg3, default: __pkg3__default};
__deps['pkg4'] = {default: __pkg4__default};
__deps['pkg7'] = {'*': __pkg7};`;

describe("transformToBundleDeps", () => {
  test("should generate the correct output", () => {
    expect(transformToBundleDeps(pkgImports)).toBe(expectedBundleDeps);
  });
});

const getImportsFile = `import f, {f1} from 'react-dom/client';
import {g as g1, h, i} from 'pkg2';
import l, * as j from 'pkg3';
import 'pkg5';
import o from './file2.js';
n = import('pkg6');
const test = 1;
export { test };
export { default as function1, function2 } from "pkg10";
export { x } from "pkg11";
export { x as v } from "pkg12";
export * as ns from "pkg13";
export * from "pkg14";
`;

const expectedGetImports = {
  "react-dom/client": new Set(["default", "f1"]),
  pkg2: new Set(["g", "h", "i"]),
  pkg3: new Set(["default", "*"]),
  pkg5: new Set([]),
  "./file2.js": new Set(["default"]),
  pkg10: new Set(["default", "function2"]),
  pkg11: new Set(["x"]),
  pkg12: new Set(["x"]),
  pkg13: new Set(["*"]),
  pkg14: new Set(["*"]),
};

describe("getImports", () => {
  test("should generate the correct output", () => {
    expect(getImports(getImportsFile)).toEqual(expectedGetImports);
  });
});

function normalizeAndParsePath(path) {
  const normalizedPath = normalizePath(
    path,
    {
      //buildMetadata
      filesRef: {
        current: {},
      },
      cdn: "esm.sh",
    },
    {
      //parent
      url: null,
    },
  );
  return parseNormalizedPath(normalizedPath);
}

describe("normalizePath and parseNormalizedPath", () => {
  test("work", () => {
    expect(normalizeAndParsePath("/react@19.0.0/es2022/react.mjs")).toEqual({
      scope: undefined,
      package: "react",
      version: "19.0.0",
      file: undefined, //see comment in normalizePath
    });
    expect(normalizeAndParsePath("/scheduler@^0.25.0?target=es2022")).toEqual({
      scope: undefined,
      package: "scheduler",
      version: "^0.25.0",
      file: undefined,
    });
    expect(
      normalizeAndParsePath(
        "/highlight.js@~11.11.0/lib/languages/1c?target=es2022",
      ),
    ).toEqual({
      scope: undefined,
      package: "highlight.js",
      version: "~11.11.0",
      file: "lib/languages/1c",
    });
  });
});
