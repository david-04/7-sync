/// <reference path="node-modules.d.ts" />

const node = (() => {
    const crypto: typeof _NodeModuleTypes.crypto = require("crypto");
    const fs: typeof _NodeModuleTypes.fs = require("fs");
    const path: typeof _NodeModuleTypes.path = require("path");
    const process: typeof _NodeModuleTypes.process = require("process");
    return { crypto, fs, path, process };
})();
