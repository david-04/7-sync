/* eslint-disable */
/// <reference path="node-modules.d.ts" />

const node = (() => ({
    crypto: require("crypto") as typeof _NodeModuleTypes.crypto,
    fs: require("fs") as typeof _NodeModuleTypes.fs,
    path: require("path") as typeof _NodeModuleTypes.path,
    process: require("process") as typeof _NodeModuleTypes.process,
    readline: require("readline") as typeof _NodeModuleTypes.readline
}))();
