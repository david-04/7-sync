export as namespace _NodeModuleTypes;

import _fs = require("fs");
export const fs: typeof _fs;

import _path = require("path");
export const path: typeof _path;

import _process = require("process");
export const process: typeof _process;
