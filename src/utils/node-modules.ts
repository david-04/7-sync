/* eslint-disable */
/// <reference path="node-modules.d.ts" />

const node = (() => ({
    crypto: require("crypto") as typeof _NodeModuleTypes.crypto,
    child_process: require("child_process") as typeof _NodeModuleTypes.child_process,
    fs: require("fs") as typeof _NodeModuleTypes.fs,
    path: require("path") as typeof _NodeModuleTypes.path,
    process: require("process") as typeof _NodeModuleTypes.process,
    readline: require("readline") as typeof _NodeModuleTypes.readline
}))();
