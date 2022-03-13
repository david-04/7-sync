export as namespace _NodeModuleTypes;

import _crypto = require("crypto");
export const crypto: typeof _crypto;

import _child_process = require("child_process");
export const child_process: typeof _child_process;

import _fs = require("fs");
export const fs: typeof _fs;

import _path = require("path");
export const path: typeof _path;

import _process = require("process");
export const process: typeof _process;

import _readline = require("readline");
export const readline: typeof _readline;
