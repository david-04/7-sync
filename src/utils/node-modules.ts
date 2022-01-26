/// <reference path="node-modules.d.ts" />

const nodeModules = (() => {
    const fs: typeof _NodeModuleTypes.fs = require("fs");
    const path: typeof _NodeModuleTypes.path = require("path");
    const process: typeof _NodeModuleTypes.process = require("process");
    return { fs, path, process };
})();
