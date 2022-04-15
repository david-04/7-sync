var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class Application {
    constructor(logger) {
        this.logger = logger;
    }
    static main() {
        return __awaiter(this, void 0, void 0, function* () {
            const application = new Application(new Logger(LogLevel.ERROR, new NullOutputStream()));
            try {
                process.exit(yield application.run(process.argv.slice(2)));
            }
            catch (exception) {
                if (exception instanceof FriendlyException) {
                    if (0 === exception.exitCode) {
                        console.log(`${exception.message}`);
                    }
                    else {
                        console.error(`ERROR: ${exception.message}`);
                    }
                    application.logger.error(exception.message);
                }
                else {
                    console.error(exception);
                    application.logger.error(`${exception}`);
                }
                node.process.exit(exception instanceof FriendlyException ? exception.exitCode : 1);
            }
        });
    }
    run(argv) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.info("Parsing the command line options");
            const options = CommandLineParser.parse(argv);
            if (!options.config.endsWith(".cfg")) {
                throw new FriendlyException(`"${options.config}" does not end with .cfg`);
            }
            this.logger.debug("Extracted command line options:", options);
            switch (options.command) {
                case CommandLineParser.DEFAULT_OPTIONS.init.command:
                    yield SetupWizard.initialize(options);
                    return 0;
                case CommandLineParser.DEFAULT_OPTIONS.reconfigure.command:
                    yield SetupWizard.reconfigure(options);
                    return 0;
                case CommandLineParser.DEFAULT_OPTIONS.sync.command:
                    return this.sync(yield Context.of(options));
            }
            throw new Error(`Internal error: Missing handler for ${context.options.command}`);
        });
    }
    sync(context) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                context.sevenZip.runSelfTest();
                const metadataManager = new MetadataManager(context);
                const { json, mustSaveImmediately } = yield metadataManager.loadOrInitializeDatabase();
                const database = DatabaseAssembler.assemble(context, json);
                if (mustSaveImmediately && !metadataManager.updateIndex(database).isUpToDate) {
                    throw new FriendlyException("Failed to save the database");
                }
                else {
                    database.markAsSaved();
                }
                const message = context.options.dryRun ? "Starting the dry run" : "Starting the synchronization";
                context.logger.info(message);
                context.print(message);
                return Synchronizer.run(context, metadataManager, database);
            }
            catch (exception) {
                if (exception instanceof FriendlyException) {
                    exception.message
                        .split(/\r?\n/)
                        .map(line => line.trim())
                        .filter(line => line)
                        .forEach(line => context.logger.error(line));
                }
                else {
                    context.logger.error(firstLineOnly(exception));
                }
                context.console.log("");
                throw exception;
            }
        });
    }
}
let hasStarted = false;
process.on("beforeExit", () => {
    if (!hasStarted) {
        hasStarted = true;
        Application.main();
    }
});
const APPLICATION_VERSION = "0.9.0";
const COPYRIGHT_OWNER = "David Hofmann";
const COPYRIGHT_YEARS = "2022";
class Context {
    constructor(options, config, files, logger, console, filenameEnumerator, sevenZip) {
        this.options = options;
        this.config = config;
        this.files = files;
        this.logger = logger;
        this.console = console;
        this.filenameEnumerator = filenameEnumerator;
        this.sevenZip = sevenZip;
        this.print = (message) => this.console.log(message);
    }
    static of(options) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const password = (_a = options.password) !== null && _a !== void 0 ? _a : node.process.env["SEVEN_SYNC_PASSWORD"];
            delete options.password;
            const console = options.silent ? new NullOutputStream() : new ConsoleOutputStream();
            const files = Context.getFileNames(options.config);
            yield Logger.purge(files.log, 9);
            const logger = Context.getLogger(files.log, false);
            logger.separator();
            try {
                logger.info(`7-sync started in ${FileUtils.getAbsolutePath(".")}`);
                const config = Context.getConfig(files.config, options, logger);
                const validatedPassword = yield this.getValidatedPassword(config.password, password);
                const sevenZip = new SevenZip(config.sevenZip, validatedPassword, logger, console);
                const filenameEnumerator = new FilenameEnumerator(logger);
                logger.info(`Source .......... ${config.source}`);
                logger.info(`Destination ..... ${config.destination}`);
                logger.info(`Configuration ... ${FileUtils.getAbsolutePath(files.config)}`);
                logger.info(`Log file ........ ${FileUtils.getAbsolutePath(files.log)}`);
                logger.info(`7-Zip command ... ${config.sevenZip}`);
                logger.info(`Dry-run ......... ${options.dryRun}`);
                return new Context(options, config, files, logger, console, filenameEnumerator, sevenZip);
            }
            catch (exception) {
                logger.error(exception instanceof FriendlyException ? exception.message : firstLineOnly(exception));
                throw exception;
            }
        });
    }
    static getFileNames(configFile) {
        const result = ConfigValidator.validateConfigFile(configFile, true);
        if (true === result) {
            return {
                config: FileUtils.getAbsolutePath(configFile),
                log: FileUtils.getAbsolutePath(FileUtils.resolve(configFile, configFile.replace(/(\.cfg)?$/, ".log")))
            };
        }
        else {
            throw new FriendlyException(result);
        }
    }
    static getLogger(file, verbose) {
        return new Logger(verbose ? LogLevel.DEBUG : LogLevel.INFO, new FileOutputStream(file, true));
    }
    static getConfig(configFile, options, logger) {
        const json = JsonParser.loadAndValidateConfig(options, logger).finalConfig;
        const validationResult = ConfigValidator.validateConfiguration(configFile, json);
        if (true === validationResult) {
            return json;
        }
        else {
            throw new FriendlyException(`Invalid configuration: ${validationResult}`);
        }
    }
    static getValidatedPassword(saltedHash, password) {
        return __awaiter(this, void 0, void 0, function* () {
            password = password !== null && password !== void 0 ? password : yield this.promptForPassword(saltedHash);
            if (!PasswordHelper.validatePassword(password, saltedHash)) {
                throw new FriendlyException("Invalid password");
            }
            return password;
        });
    }
    static promptForPassword(saltedHash) {
        return __awaiter(this, void 0, void 0, function* () {
            return InteractivePrompt.prompt({
                question: "Please enter the password.",
                isPassword: true,
                useStderr: true,
                validate: input => {
                    console.error("");
                    const isCorrect = PasswordHelper.validatePassword(input, saltedHash);
                    if (!isCorrect) {
                        console.error("Invalid password. Please try again.");
                    }
                    return isCorrect;
                }
            });
        });
    }
}
class RootDirectory {
    constructor(absolutePath) {
        this.absolutePath = absolutePath;
    }
}
class Subdirectory extends RootDirectory {
    constructor(parent, name) {
        super(node.path.join(parent.absolutePath, name));
        this.name = name;
        this.relativePath = parent instanceof Subdirectory ? node.path.join(parent.relativePath, name) : name;
    }
}
class MappedDirectoryBase {
    constructor(source, destination, _last) {
        this.source = source;
        this.destination = destination;
        this._last = _last;
        this._files = readonly({
            bySourceName: new Map(),
            byDestinationName: new Map()
        });
        this.files = readonly({
            bySourceName: new ImmutableMap(this._files.bySourceName),
            byDestinationName: new ImmutableMap(this._files.byDestinationName)
        });
        this._subdirectories = readonly({
            bySourceName: new Map(),
            byDestinationName: new Map()
        });
        this.subdirectories = readonly({
            bySourceName: new ImmutableMap(this._subdirectories.bySourceName),
            byDestinationName: new ImmutableMap(this._subdirectories.byDestinationName)
        });
    }
    get last() {
        return this._last;
    }
    set last(last) {
        this._last = last;
        this.markAsModified();
    }
    add(fileOrSubdirectory) {
        this.markAsModified();
        if (fileOrSubdirectory instanceof MappedFile) {
            this.addTo(this._files.bySourceName, fileOrSubdirectory.source.name, fileOrSubdirectory);
            this.addTo(this._files.byDestinationName, fileOrSubdirectory.destination.name, fileOrSubdirectory);
        }
        else {
            this.addTo(this._subdirectories.bySourceName, fileOrSubdirectory.source.name, fileOrSubdirectory);
            this.addTo(this._subdirectories.byDestinationName, fileOrSubdirectory.destination.name, fileOrSubdirectory);
        }
    }
    addTo(map, key, value) {
        if (map.has(key)) {
            const type = value instanceof MappedFile ? "File" : "Subdirectory";
            const path = value.source.relativePath;
            throw new Error(`Internal error: ${type} ${path} has already been added to the database`);
        }
        else {
            map.set(key, value);
        }
    }
    delete(fileOrSubdirectory) {
        this.markAsModified();
        if (fileOrSubdirectory instanceof MappedFile) {
            this.deleteFrom(this._files.bySourceName, fileOrSubdirectory.source.name, fileOrSubdirectory);
            this.deleteFrom(this._files.byDestinationName, fileOrSubdirectory.destination.name, fileOrSubdirectory);
        }
        else {
            this.deleteFrom(this._subdirectories.bySourceName, fileOrSubdirectory.source.name, fileOrSubdirectory);
            this.deleteFrom(this._subdirectories.byDestinationName, fileOrSubdirectory.destination.name, fileOrSubdirectory);
        }
    }
    deleteFrom(map, key, value) {
        const mapValue = map.get(key);
        if (undefined === mapValue) {
            throw new Error(`Internal error: Directory entry ${key} does not exist`);
        }
        else if (mapValue !== value) {
            throw new Error(`Internal error: ${key} points to the wrong directory entry`);
        }
        else {
            map.delete(key);
        }
    }
    countChildren(statistics) {
        const realStatistics = statistics !== null && statistics !== void 0 ? statistics : { files: 0, subdirectories: 0 };
        realStatistics.files += this._files.byDestinationName.size;
        realStatistics.subdirectories += this._subdirectories.byDestinationName.size;
        this._subdirectories.byDestinationName.forEach((subdirectory) => subdirectory.countChildren(realStatistics));
        return realStatistics;
    }
}
class MappedRootDirectory extends MappedDirectoryBase {
    constructor(source, destination, last) {
        super(source, destination, last);
        this._hasUnsavedChanges = true;
    }
    hasUnsavedChanges() {
        return this._hasUnsavedChanges;
    }
    wasSavedWithinTheLastSeconds(seconds) {
        return undefined === this.lastSavedAtMs
            ? false
            : new Date().getTime() - this.lastSavedAtMs <= seconds * 1000;
    }
    markAsSaved(saved = true) {
        this.lastSavedAtMs = new Date().getTime();
        this._hasUnsavedChanges = !saved;
    }
    markAsModified() {
        this._hasUnsavedChanges = true;
    }
}
class MappedSubdirectory extends MappedDirectoryBase {
    constructor(parent, source, destination, last) {
        super(source, destination, last);
        this.parent = parent;
    }
    markAsModified() {
        this.parent.markAsModified();
    }
}
class FriendlyException extends Error {
    constructor(message, exitCode = 1) {
        super(message);
        this.exitCode = exitCode;
    }
}
class InternalError extends Error {
    constructor(message) {
        super(`Internal error: ${message}`);
    }
}
class File {
    constructor(parent, name) {
        this.parent = parent;
        this.name = name;
        this.absolutePath = node.path.join(parent.absolutePath, name);
        this.relativePath = parent instanceof Subdirectory ? node.path.join(parent.relativePath, name) : name;
    }
}
class MappedFile {
    constructor(parent, source, destination, created, modified, size) {
        this.parent = parent;
        this.source = source;
        this.destination = destination;
        this.created = created;
        this.modified = modified;
        this.size = size;
    }
}
class ImmutableMap {
    constructor(map) {
        this.map = map;
    }
    has(key) {
        return this.map.has(key);
    }
    values() {
        return Array.from(this.map.values());
    }
    sorted() {
        return Array.from(this.map.entries()).sort((entry1, entry2) => {
            const name1 = entry1[0].toLowerCase();
            const name2 = entry2[0].toLowerCase();
            if (name1 < name2) {
                return -1;
            }
            else if (name1 === name2) {
                return 0;
            }
            else {
                return 1;
            }
        }).map(entry => entry[1]);
    }
}
class Optional {
    constructor(value) {
        this.value = value;
        if (null === this.value) {
            this.value = undefined;
        }
    }
    static create(value) {
        if (undefined === value || null === value) {
            return Optional.EMPTY;
        }
        else {
            return new Optional(value);
        }
    }
    static of(value) {
        return Optional.create(value);
    }
    static empty() {
        return Optional.create();
    }
    get() {
        return this.value;
    }
    getOrThrow() {
        if (undefined === this.value) {
            throw new Error("The Optional is empty");
        }
        else {
            return this.value;
        }
    }
    getOrDefault(defaultValue) {
        if (undefined === this.value) {
            return defaultValue;
        }
        else {
            return this.value;
        }
    }
    getOrCalculate(supplier) {
        if (undefined === this.value) {
            return supplier();
        }
        else {
            return this.value;
        }
    }
    isPresent() {
        return undefined !== this.value;
    }
    isEmpty() {
        return undefined === this.value;
    }
    ifPresent(action) {
        if (undefined !== this.value) {
            action(this.value);
        }
        return this;
    }
    ifEmpty(action) {
        if (undefined === this.value) {
            action();
        }
        return this;
    }
    map(mapper) {
        return undefined === this.value ? Optional.EMPTY : Optional.create(mapper(this.value));
    }
    flatMap(mapper) {
        if (undefined === this.value) {
            return Optional.EMPTY;
        }
        else {
            const optional = mapper(this.value);
            if (optional instanceof Optional) {
                return optional;
            }
            else {
                throw new Error("The mapping function did not return an Optional instance");
            }
        }
    }
    filter(filter) {
        if (undefined !== this.value && filter(this.value)) {
            return this;
        }
        else {
            return Optional.EMPTY;
        }
    }
}
Optional.EMPTY = new Optional();
const README_URL_BASE = "https://github.com/david-04/7-sync/blob/main/README.md";
const README_URL_WARNINGS = `${README_URL_BASE}#user-content-errors`;
const README_URL_RESTORE = `${README_URL_BASE}#user-content-restoring-backups`;
const README_FILE_CONTENT = `

    -------------------------------------------------------------------------------
    7-sync restore/recovery instructions
    -------------------------------------------------------------------------------

    This is an extract from the 7-sync manual. It can be found here:

    https://github.com/david-04/7-sync/blob/main/README.md#user-content-restoring-backups

    The following instructions explain how to restore some or all files from this
    backup.

    1. If the backup is stored in the cloud, download it first.

    - To restore the whole backup, download all files and directories.
    - To only restore selected files, open 7-sync-file-index.txt (stored in the
        same archive: ___INDEX___2022-04-10-07-25-47-394.7z). Look up the
        respective files and directories and download them from the cloud storage
        as required.

    2. Place all files that need to be unzipped/restored in one folder.

    3. Open 7-Zip and navigate to the folder containing the encrypted files.

    4. In the "View" menu, enable the "Flat View" option. This will show all files
    from all subdirectories in one list.

    5. Select all the files (but no directories).

    - Click on the first file in the list.
    - Scroll down to the bottom of the list.
    - While pressing the "Shift" key, click on the last file in the list.

    6. Click on the "Extract" button in the toolbar and configure how and where to
    extract the files:

    - Set the "Extract to" field to the directory where to place the decrypted
        files. The path must NOT contain "*" (like for example C:\Restore\*\).
        Also untick the checkbox right under this field. Otherwise, 7-Zip creates
        a separate subdirectory for each file being unzipped.
    - Set the "Path mode" to "Full pathnames".
    - Tick "Eliminate duplication of root folder".
    - Enter the password.

    7. Click on "OK". If the password is correct, 7-Zip will unpack all files.

`.trim().replace(/\n {4}/g, "\n").replace(/\r/g, "").trim() + "\n";
class SuccessAndFailureStats {
    constructor(...statistics) {
        this.success = 0;
        this.failed = 0;
        statistics.forEach(item => {
            this.success += item.success;
            this.failed += item.failed;
        });
    }
    get total() {
        return this.success + this.failed;
    }
}
class FileAndDirectoryStats {
    constructor(...statistics) {
        this.files = new SuccessAndFailureStats(...statistics.map(item => item.files));
        this.directories = new SuccessAndFailureStats(...statistics.map(item => item.directories));
    }
    get total() {
        return this.files.total + this.directories.total;
    }
    get success() {
        return this.files.success + this.directories.success;
    }
}
class SyncStats {
    constructor() {
        this.copied = new FileAndDirectoryStats();
        this.deleted = new FileAndDirectoryStats();
        this.orphans = new FileAndDirectoryStats();
        this.purged = new FileAndDirectoryStats();
        this.unprocessable = readonly({
            source: { symlinks: 0, other: 0 },
            destination: { symlinks: 0, other: 0 }
        });
        this.index = {
            hasLingeringOrphans: false,
            isUpToDate: true
        };
    }
    get success() {
        return this.copied.success
            || this.deleted.success
            || this.orphans.success
            || this.purged.success;
    }
}
var _a;
class CommandLineParser {
    static showUsageAndExit() {
        this.exitWithMessage(`
              Create an encrypted copy of a directory using 7-Zip.
            |
            | Usage: 7-sync [command] [options]
            |
            | Commands:
            |
            |   ${this.DEFAULT_OPTIONS.init.command}                        create a new configuration file
            |   ${this.DEFAULT_OPTIONS.reconfigure.command}                 change the configuration file
            |   ${this.DEFAULT_OPTIONS.sync.command}                        sync files (or perform a dry run)
            |
            | Options:
            |
            |   --${this.OPTIONS.sevenZip}=<7_ZIP_EXECUTABLE>  the 7-Zip executable to use
            |   --${this.OPTIONS.config}=<CONFIG_FILE>      use the given configuration file (default: ${this.DEFAULT_CONFIG_FILE})
            |   --${this.OPTIONS.dryRun}                   perform a trial run without making any changes
            |   --${this.OPTIONS.help}                      display this help and exit
            |   --${this.OPTIONS.password}=<PASSWORD>       use this password instead of prompting for it
            |   --${this.OPTIONS.silent}                    suppress console output
            |   --${this.OPTIONS.version}                   display version information and exit
            |
            | The password can also be stored as environment variable SEVEN_SYNC_PASSWORD.
            |
            | Full documentation: ${README_URL_BASE}
        `.trim().replace(/^\s+/gm, "").replace(/^\| ?/gm, ""));
    }
    static showVersionAndExit() {
        this.exitWithMessage(`
            7-sync ${APPLICATION_VERSION}
            Copyright (c) ${COPYRIGHT_YEARS} ${COPYRIGHT_OWNER}
            License: MIT <https://opensource.org/licenses/MIT>
        `.trim().replace(/^\s+/gm, ""));
    }
    static parse(argv) {
        if (argv.filter(parameter => parameter.match(/^--?(v|version)$/)).length) {
            this.showVersionAndExit();
        }
        else if (argv.filter(parameter => parameter.match(/^--?(h|help)$/)).length) {
            this.showUsageAndExit();
        }
        const { commands, options } = this.splitParameters(argv);
        if (0 === commands.length) {
            this.exitWithError('Missing command');
        }
        else if (1 < commands.length) {
            this.exitWithError(`More than one command specified: ${commands.join(", ")}`);
        }
        else {
            return this.assembleOptions(commands[0], options);
        }
    }
    static splitParameters(argv) {
        const options = new Map();
        const commands = new Array();
        argv.forEach(argument => {
            if (argument.startsWith("--")) {
                const index = argument.indexOf("=");
                const key = 3 <= index ? argument.substring(2, index).trim() : argument.substring(2).trim();
                const value = 3 <= index ? argument.substring(index + 1) : true;
                options.set(key, "string" === typeof value && this.OPTIONS.password !== key ? value.trim() : value);
            }
            else {
                this.getInternalKey(this.DEFAULT_OPTIONS, argument, false);
                commands.push(argument);
            }
        });
        return { options, commands };
    }
    static assembleOptions(command, suppliedOptions) {
        const mergedOptions = Object.assign({}, this.getDefaultOptions(command));
        suppliedOptions.forEach((suppliedValue, suppliedKey) => {
            this.setOption(command, mergedOptions, suppliedKey, suppliedValue);
        });
        return mergedOptions;
    }
    static getDefaultOptions(command) {
        const defaultOptionsMap = this.DEFAULT_OPTIONS;
        const defaultOptions = defaultOptionsMap[this.getInternalKey(this.DEFAULT_OPTIONS, command, false)];
        if (defaultOptions) {
            return defaultOptions;
        }
        else {
            this.exitWithError(`Internal error - no default options for command "${command}"`);
        }
    }
    static setOption(command, defaultOptions, suppliedKey, suppliedValue) {
        const defaultKey = this.getInternalKey(this.OPTIONS, suppliedKey, true);
        if ("command" === suppliedKey || !(defaultKey in defaultOptions)) {
            this.exitWithError(`Command "${command}" does not support option --${suppliedKey}`);
        }
        const defaultValue = defaultOptions[defaultKey];
        if ("boolean" === typeof defaultValue) {
            if ("boolean" !== typeof suppliedValue) {
                this.exitWithError(`Option --${suppliedKey} can't have a value assigned`);
            }
        }
        else {
            if ("string" !== typeof suppliedValue || !suppliedValue) {
                this.exitWithError(`Option --${suppliedKey} requires a value`);
            }
        }
        defaultOptions[defaultKey] = suppliedValue;
    }
    static getInternalKey(mapping, suppliedKey, isOption) {
        for (const internalKey of Object.keys(mapping)) {
            const mappedValue = mapping[internalKey];
            const externalKey = "string" === typeof mappedValue ? mappedValue : mappedValue.command;
            if (suppliedKey === externalKey) {
                return internalKey;
            }
        }
        if (isOption) {
            this.exitWithError(`Invalid option --${suppliedKey}`);
        }
        else {
            this.exitWithError(`Invalid argument "${suppliedKey}"`);
        }
    }
    static as(value) {
        return value;
    }
    static exitWithError(message) {
        throw new FriendlyException(`
            ${message}
            Try '7-sync --${this.OPTIONS.help}' for more information
        `.trim().replace(/^\s+/gm, ""));
    }
    static exitWithMessage(message) {
        throw new FriendlyException(message, 0);
    }
}
_a = CommandLineParser;
CommandLineParser.DEFAULT_CONFIG_FILE = "7-sync.cfg";
CommandLineParser.DEFAULT_7_ZIP_EXECUTABLE = "7z";
CommandLineParser.OPTIONS = {
    config: "config",
    dryRun: "dry-run",
    password: "password",
    sevenZip: "7-zip",
    silent: "silent",
    help: "help",
    version: "version"
};
CommandLineParser.SHARED_DEFAULT_OPTIONS = {
    config: _a.DEFAULT_CONFIG_FILE
};
CommandLineParser.DEFAULT_OPTIONS = {
    sync: _a.as(Object.assign(Object.assign({ command: "sync" }, _a.SHARED_DEFAULT_OPTIONS), { dryRun: false, password: undefined, sevenZip: undefined, silent: false })),
    init: _a.as(Object.assign({ command: "init" }, _a.SHARED_DEFAULT_OPTIONS)),
    reconfigure: _a.as(Object.assign({ command: "reconfigure" }, _a.SHARED_DEFAULT_OPTIONS))
};
class ConfigValidator {
    static validateConfiguration(configFile, json) {
        var _a;
        return (_a = [
            this.validateConfigFile(configFile, true),
            this.validateSourceDirectory(configFile, json.source),
            this.validateDestinationDirectory(configFile, json.source, json.destination)
        ].find(result => true !== result && undefined !== result)) !== null && _a !== void 0 ? _a : true;
    }
    static validateConfigFile(config, mustExist) {
        const directory = FileUtils.getParent(config);
        if (mustExist && !FileUtils.exists(config)) {
            return `Config file "${config}" does not exist`;
        }
        else if (mustExist && !FileUtils.existsAndIsFile(config)) {
            return `Config file "${config}" is not a regular file`;
        }
        else if (!config.endsWith(".cfg")) {
            return `${config} does not end with .cfg`;
        }
        else if (FileUtils.existsAndIsFile(config)) {
            return true;
        }
        else if (FileUtils.exists(config)) {
            return `${config} is not a regular file`;
        }
        else if (FileUtils.existsAndIsDirectory(directory)) {
            return true;
        }
        else if (FileUtils.exists(directory)) {
            return `Directory ${directory} is not a directory`;
        }
        else {
            return `Directory ${directory} does not exist`;
        }
    }
    static validateSourceDirectory(config, source) {
        const resolvedSource = FileUtils.resolve(config, source !== null && source !== void 0 ? source : "");
        if (!FileUtils.exists(resolvedSource)) {
            return `Source directory ${resolvedSource} does not exist`;
        }
        else if (!FileUtils.existsAndIsDirectory(resolvedSource)) {
            return `${resolvedSource} is not a directory`;
        }
        else if (FileUtils.isParentChild(resolvedSource, config)) {
            return "The source directory must not contain the configuration file";
        }
        else {
            return true;
        }
    }
    static validateDestinationDirectory(config, source, destination) {
        const resolvedSource = FileUtils.resolve(config, source !== null && source !== void 0 ? source : "");
        const resolvedDestination = FileUtils.resolve(config, destination !== null && destination !== void 0 ? destination : "");
        if (!FileUtils.exists(resolvedDestination)) {
            return `Destination directory ${resolvedDestination} does not exist`;
        }
        else if (!FileUtils.existsAndIsDirectory(resolvedDestination)) {
            return `${resolvedDestination} is not a directory`;
        }
        else if (FileUtils.equals(resolvedSource, resolvedDestination)) {
            return "The destination directory can't be the same as the source directory";
        }
        else if (FileUtils.isParentChild(resolvedDestination, config)) {
            return "The destination directory must not contain the configuration file";
        }
        else if (FileUtils.isParentChild(resolvedDestination, resolvedSource)) {
            return "The source directory must not be inside the destination directory";
        }
        else if (FileUtils.isParentChild(resolvedSource, resolvedDestination)) {
            return "The destination directory must not be inside the source directory.";
        }
        else {
            return true;
        }
    }
}
class DatabaseAssembler {
    constructor(context) {
        this.context = context;
    }
    static assemble(context, database) {
        return new DatabaseAssembler(context).assembleDatabase(database);
    }
    assembleDatabase(json) {
        const source = new RootDirectory(this.context.config.source);
        const destination = new RootDirectory(this.context.config.destination);
        this.assertThatDirectoriesExist(source, destination);
        try {
            const database = new MappedRootDirectory(source, destination, json.last);
            this.assembleFilesAndSubdirectories(database, json);
            return database;
        }
        catch (exception) {
            rethrow(exception, message => `Failed to assemble database - ${message}`);
        }
    }
    assembleFilesAndSubdirectories(directory, json) {
        json.files.forEach(file => directory.add(this.assembleFile(directory, file)));
        json.directories.forEach(subdirectory => directory.add(this.assembleDirectory(directory, subdirectory)));
    }
    assembleDirectory(parent, json) {
        const source = new Subdirectory(parent.source, json.source);
        const destination = new Subdirectory(parent.destination, json.destination);
        const mappedDirectory = new MappedSubdirectory(parent, source, destination, json.last);
        this.assembleFilesAndSubdirectories(mappedDirectory, json);
        return mappedDirectory;
    }
    assembleFile(directory, json) {
        const source = new File(directory.source, json.source);
        const destination = new File(directory.destination, json.destination);
        return new MappedFile(directory, source, destination, json.created, json.modified, json.size);
    }
    assertThatDirectoriesExist(...directories) {
        directories.map(directory => directory.absolutePath).forEach(directory => {
            if (!FileUtils.exists(directory)) {
                throw new FriendlyException(`Directory ${directory} does not exist`);
            }
            else if (!FileUtils.existsAndIsDirectory(directory)) {
                throw new FriendlyException(`${directory} is not a directory`);
            }
        });
    }
}
class DatabaseSerializer {
    static serializeDatabase(database) {
        return tryCatchRethrowFriendlyException(() => this.serialize(database), error => `Failed to serialize the database - ${error}`);
    }
    static serialize(database) {
        const json = {
            directories: database.subdirectories.bySourceName.sorted().map(directory => this.directoryToJson(directory)),
            files: database.files.bySourceName.sorted().map(file => this.fileToJson(file)),
            last: database.last
        };
        JsonValidator.validateDatabase(json);
        return JSON.stringify(json);
    }
    static directoryToJson(directory) {
        return {
            source: directory.source.name,
            destination: directory.destination.name,
            directories: directory.subdirectories.bySourceName.sorted().map(subDirectory => this.directoryToJson(subDirectory)),
            files: directory.files.bySourceName.sorted().map(file => this.fileToJson(file)),
            last: directory.last
        };
    }
    static fileToJson(file) {
        return {
            source: file.source.name,
            destination: file.destination.name,
            created: file.created,
            modified: file.modified,
            size: file.size
        };
    }
}
class FileListingCreator {
    static create(database) {
        return this.recurseInto(database, []).join("\n") + "\n";
    }
    static recurseInto(directory, lines) {
        this.addToIndex(directory, lines);
        directory.subdirectories.bySourceName.sorted().forEach(subdirectory => this.recurseInto(subdirectory, lines));
        directory.files.bySourceName.sorted().forEach(file => this.addToIndex(file, lines));
        return lines;
    }
    static addToIndex(fileOrDirectory, lines) {
        if (fileOrDirectory instanceof MappedSubdirectory || fileOrDirectory instanceof MappedFile) {
            lines.push(`${fileOrDirectory.source.relativePath} => ${fileOrDirectory.destination.relativePath}`);
        }
    }
}
class FileManager {
    constructor(context, database) {
        this.context = context;
        this.database = database;
        this.print = context.print;
        this.logger = context.logger;
        this.isDryRun = context.options.dryRun;
    }
    createDirectory(directory, source) {
        const paths = this.getSourceAndDestinationPaths(directory, source, "");
        this.print(`+ ${paths.source.relativePath}`);
        const pathInfo = this.getLogFilePathInfo("mkdir", paths.destination.absolutePath, paths.source.absolutePath);
        let newDestinationDirectory;
        if (this.isDryRun) {
            this.logger.info(`Would create directory ${pathInfo}`);
            newDestinationDirectory = new Subdirectory(directory.destination, paths.destination.filename);
        }
        else {
            this.logger.info(`Creating directory ${pathInfo}`);
            try {
                node.fs.mkdirSync(paths.destination.absolutePath);
                if (!FileUtils.exists(paths.destination.absolutePath)) {
                    throw new Error("No exception was raised");
                }
                newDestinationDirectory = new Subdirectory(directory.destination, paths.destination.filename);
            }
            catch (exception) {
                this.logger.error(`Failed to create directory ${paths.destination.absolutePath} - ${firstLineOnly(exception)}`);
                this.print("===> FAILED");
            }
        }
        return newDestinationDirectory
            ? this.storeNewSubdirectory(directory, source.name, newDestinationDirectory, paths.next)
            : undefined;
    }
    storeNewSubdirectory(parent, sourceName, destination, last) {
        const source = new Subdirectory(parent.source, sourceName);
        const newMappedSubdirectory = new MappedSubdirectory(parent, source, destination, "");
        parent.add(newMappedSubdirectory);
        parent.last = last;
        return newMappedSubdirectory;
    }
    zipFile(parentDirectory, source) {
        const paths = this.getSourceAndDestinationPaths(parentDirectory, source, ".7z");
        this.print(`+ ${paths.source.relativePath}`);
        const pathInfo = this.getLogFilePathInfo("cp", paths.destination.absolutePath, paths.source.absolutePath);
        let success = true;
        if (this.isDryRun) {
            this.logger.info(`Would zip ${pathInfo}`);
        }
        else {
            this.logger.info(`Zipping ${pathInfo}`);
            success = this.zipFileAndLogErrors(pathInfo, paths.source.relativePath, paths.destination.absolutePath);
        }
        return success
            ? this.storeNewFile(parentDirectory, source.name, paths.destination.filename, paths.next)
            : undefined;
    }
    zipFileAndLogErrors(pathInfo, sourceRelativePath, destinationAbsolutePath) {
        try {
            const result = this.context.sevenZip.zipFile(this.database.source.absolutePath, sourceRelativePath, destinationAbsolutePath);
            if (!result.success) {
                this.logger.error(result.consoleOutput);
                this.logger.error(`Failed to zip ${pathInfo}: ${result.errorMessage}`);
                this.print("===> FAILED");
            }
            return result.success;
        }
        catch (exception) {
            this.logger.error(`Failed to zip ${pathInfo} - ${firstLineOnly(exception)}`);
            this.print("===> FAILED");
            return false;
        }
    }
    storeNewFile(parent, sourceName, destinationName, last) {
        const properties = FileUtils.getProperties(node.path.join(parent.source.absolutePath, sourceName));
        const newMappedFile = new MappedFile(parent, new File(parent.source, sourceName), new File(parent.destination, destinationName), properties.birthtimeMs, properties.ctimeMs, properties.size);
        parent.add(newMappedFile);
        parent.last = last;
        return newMappedFile;
    }
    deleteFile(options) {
        const isMetadataArchive = !options.source
            && this.database.destination.absolutePath === node.path.dirname(options.destination)
            && MetadataManager.isMetadataArchiveName(node.path.basename(options.destination));
        return this.deleteFileOrDirectory(Object.assign(Object.assign({}, options), { type: "file", isMetadataArchive: isMetadataArchive, suppressConsoleOutput: options.suppressConsoleOutput || isMetadataArchive }));
    }
    deleteDirectory(options) {
        return this.deleteFileOrDirectory(Object.assign(Object.assign({}, options), { type: "directory" }));
    }
    deleteFileOrDirectory(options) {
        const isOrphan = undefined !== options.orphanDisplayPath;
        if (!options.suppressConsoleOutput) {
            if (options.orphanDisplayPath) {
                this.print(`- ${options.orphanDisplayPath} (orphan)`);
            }
            else {
                this.print(`- ${this.getConsolePathInfo("rm", options.destination, options.source)}`);
            }
        }
        const pathInfo = this.getLogFilePathInfo("rm", options.destination, options.source);
        const reason = options.reason ? ` ${options.reason}` : "";
        if (isOrphan && !options.isMetadataArchive) {
            this.logger.warn(this.isDryRun
                ? `Would delete orphaned ${options.type} ${pathInfo}${reason}`
                : `Deleting orphaned ${options.type} ${pathInfo}${reason}`);
        }
        else {
            this.logger.info(this.isDryRun
                ? `Would delete ${options.type} ${pathInfo}${reason}`
                : `Deleting ${options.type} ${pathInfo}${reason}`);
        }
        const success = this.doDeleteFileOrDirectory(options.destination, "directory" === options.type);
        if (!success && !options.suppressConsoleOutput) {
            this.print("===> FAILED");
        }
        return success;
    }
    doDeleteFileOrDirectory(path, isDirectory) {
        if (!this.isDryRun) {
            try {
                node.fs.rmSync(path, isDirectory ? { recursive: true, force: true } : {});
                if (FileUtils.exists(path)) {
                    throw new FriendlyException("No exception was raised but the file is still present");
                }
            }
            catch (exception) {
                this.logger.error(`Failed to delete ${path} - ${firstLineOnly(exception)}`);
                return false;
            }
        }
        return true;
    }
    getSourceAndDestinationPaths(directory, source, suffix) {
        const sourceAbsolute = node.path.join(directory.source.absolutePath, source.name);
        const sourceRelative = node.path.relative(this.database.source.absolutePath, sourceAbsolute);
        const next = this.getNextAvailableFilename(directory, "", suffix);
        const destinationAbsolute = node.path.join(directory.destination.absolutePath, next.filename);
        const destinationRelative = node.path.relative(this.database.destination.absolutePath, destinationAbsolute);
        return {
            source: {
                absolutePath: sourceAbsolute,
                relativePath: sourceRelative
            },
            destination: {
                filename: next.filename,
                absolutePath: destinationAbsolute,
                relativePath: destinationRelative
            },
            next: next.enumeratedName
        };
    }
    getLogFilePathInfo(operation, destinationPath, sourcePath) {
        if ("cp" === operation) {
            return sourcePath ? `${sourcePath} => ${destinationPath}` : destinationPath;
        }
        else {
            return sourcePath ? `${destinationPath} (mirroring ${sourcePath})` : destinationPath;
        }
    }
    getConsolePathInfo(operation, destinationPath, sourcePath) {
        const source = sourcePath ? node.path.relative(this.database.source.absolutePath, sourcePath) : undefined;
        const destination = node.path.relative(this.database.destination.absolutePath, destinationPath);
        if ("rm" === operation) {
            return source !== null && source !== void 0 ? source : `${destination} (orphan)`;
        }
        else {
            return source;
        }
    }
    getNextAvailableFilename(directory, prefix, suffix) {
        return this.context.filenameEnumerator.getNextAvailableFilename(directory.destination.absolutePath, directory.last, prefix, suffix);
    }
}
class FilenameEnumerator {
    constructor(logger) {
        this.logger = logger;
        const uniqueLetters = FilenameEnumerator.getUniqueLetters(FilenameEnumerator.LETTERS);
        const array = uniqueLetters.array;
        this.allLetters = uniqueLetters.set;
        if (0 < array.length) {
            this.firstLetter = array[0];
            this.nextLetter = FilenameEnumerator.getNextLetterMap(array);
            this.letterToIndex = FilenameEnumerator.getLetterToIndexMap(array);
        }
        else {
            throw new Error("Internal error: No letters have been passed to the FilenameEnumerator");
        }
    }
    static getUniqueLetters(letters) {
        const set = new Set();
        const array = letters.split("")
            .filter(letter => !letter.match(/\s/))
            .filter(letter => {
            if (set.has(letter)) {
                return false;
            }
            else {
                set.add(letter);
                return true;
            }
        });
        return { set, array };
    }
    static getNextLetterMap(letters) {
        const map = new Map();
        for (let index = 1; index < letters.length; index++) {
            map.set(letters[index - 1], letters[index]);
        }
        return map;
    }
    static getLetterToIndexMap(letters) {
        const map = new Map();
        for (let index = 0; index < letters.length; index++) {
            map.set(letters[index], index);
        }
        return map;
    }
    calculateNext(last) {
        const array = last.split("");
        for (let index = array.length - 1; 0 <= index; index--) {
            const nextLetter = this.nextLetter.get(array[index]);
            if (nextLetter) {
                array[index] = nextLetter;
                return array.join("");
            }
            else {
                array[index] = this.firstLetter;
            }
        }
        return array.join("") + this.firstLetter;
    }
    getNextAvailableFilename(path, last, prefix, suffix) {
        let next = last;
        while (true) {
            next = next ? this.calculateNext(next) : this.firstLetter;
            const filename = prefix + next + suffix;
            const filenameWithPath = node.path.join(path, filename);
            if (FileUtils.exists(filenameWithPath)) {
                this.logger.warn(`The next filename is already occupied: ${path} => ${filename}`);
            }
            else if (!MetadataManager.isMetadataArchiveName(next)) {
                return { enumeratedName: next, filename, filenameWithPath };
            }
        }
    }
    recalculateLastFilename(last, filenames) {
        return filenames
            .map(filename => filename.endsWith(".7z") ? filename.substring(0, filename.length - 3) : filename)
            .filter(basename => this.isEnumeratedName(basename))
            .reduce((a, b) => this.getLastFilename(a, b), this.isEnumeratedName(last) ? last : "");
    }
    isEnumeratedName(filenameWithoutExtension) {
        for (let index = 0; index < filenameWithoutExtension.length; index++) {
            if (!this.allLetters.has(filenameWithoutExtension.charAt(index))) {
                return false;
            }
        }
        return true;
    }
    getLastFilename(name1, name2) {
        const lengthDifference = name1.length - name2.length;
        if (lengthDifference) {
            return lengthDifference < 0 ? name2 : name1;
        }
        else {
            for (let index = 0; index < name1.length; index++) {
                const letterDifference = this.compareEnumeratedLetters(name1.charAt(index), name2.charAt(index));
                if (0 !== letterDifference) {
                    return letterDifference < 0 ? name2 : name1;
                }
            }
            return name1;
        }
    }
    compareEnumeratedLetters(letter1, letter2) {
        const index1 = this.letterToIndex.get(letter1);
        const index2 = this.letterToIndex.get(letter2);
        if (undefined === index1 || undefined === index2) {
            throw new InternalError(`Not an enumerated letter: ${undefined === index1 ? letter1 : letter2}`);
        }
        else {
            return index1 - index2;
        }
    }
}
FilenameEnumerator.LETTERS = "abcdefghijkmnpqrstuvwxyz123456789";
var _a;
class InteractivePrompt {
    static prompt(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const effectiveOptions = Object.assign(Object.assign({}, this.DEFAULT_OPTIONS), options);
            const print = effectiveOptions.useStderr ? console.error : console.log;
            this.displayQuestion(print, effectiveOptions.question);
            while (true) {
                const answer = yield this.readLine(Object.assign({}, effectiveOptions));
                const result = this.mapAndValidate(answer, effectiveOptions);
                if (result.isPresent()) {
                    if (!effectiveOptions.suppressExtraEmptyLineAfterInput) {
                        print("");
                    }
                    return result.getOrThrow();
                }
            }
        });
    }
    static promptYesNo(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const print = options.useStderr ? console.error : console.log;
            const array = "string" === typeof options.question ? [options.question] : [...options.question];
            if (array.length) {
                array[array.length - 1] += " [y/n]";
            }
            this.displayQuestion(print, array);
            while (true) {
                const answer = yield this.prompt(Object.assign(Object.assign({}, options), { suppressExtraEmptyLineAfterInput: true }));
                if (answer.match(/^y(es)?$/)) {
                    print("");
                    return true;
                }
                else if (answer.match(/^n(o)?$/)) {
                    print("");
                    return false;
                }
                else {
                    print("Please enter y or n");
                }
            }
        });
    }
    static displayQuestion(print, question) {
        const message = (Array.isArray(question) ? question : [question])
            .filter(line => null !== line && undefined !== line)
            .join("\n")
            .replace(/^\s*/mg, "")
            .replace(/(\r?\n)+/g, "\n")
            .trim();
        if (message) {
            print(message);
        }
    }
    static mapAndValidate(answer, options) {
        var _b;
        if (!((_b = options.isPassword) !== null && _b !== void 0 ? _b : false)) {
            answer = answer.trim();
        }
        if (0 === answer.length && undefined !== options.defaultAnswer) {
            return Optional.of(options.defaultAnswer);
        }
        if (0 === answer.length && !options.acceptBlankInput) {
            return Optional.empty();
        }
        if (options.validate && !options.validate(answer)) {
            return Optional.empty();
        }
        return Optional.of(answer);
    }
    static readLine(options) {
        const readlineInterface = node.readline.createInterface({
            input: process.stdin,
            output: options.useStderr ? process.stderr : process.stdout
        });
        if (options.isPassword) {
            readlineInterface._writeToOutput = (text) => {
                if (text === this.PROMPT) {
                    (options.useStderr ? process.stderr : process.stdout).write(this.PROMPT);
                }
            };
        }
        return new Promise(resolve => readlineInterface.question(this.PROMPT, answer => {
            readlineInterface.close();
            resolve(answer);
        }));
    }
}
_a = InteractivePrompt;
InteractivePrompt.PROMPT = "> ";
InteractivePrompt.as = (value) => value;
InteractivePrompt.DEFAULT_OPTIONS = {
    question: _a.as(""),
    acceptBlankInput: _a.as(false),
    isPassword: _a.as(false),
    validate: _a.as(undefined),
    defaultAnswer: _a.as(undefined),
    suppressExtraEmptyLineAfterInput: _a.as(false),
    useStderr: _a.as(false)
};
class JsonParser {
    static loadAndValidateConfig(options, logger) {
        const file = options.config;
        if (!FileUtils.existsAndIsFile(file)) {
            throw new FriendlyException(`Configuration file ${file} does not exist`);
        }
        if (!file.endsWith(".cfg")) {
            throw new FriendlyException(`The configuration file ${file} does not end with .cfg`);
        }
        try {
            logger.debug(`Loading configuration file ${FileUtils.getAbsolutePath(file)}`);
            const originalConfig = this.loadFile(file);
            logger.debug(originalConfig);
            logger.debug("Applying command line parameters");
            logger.debug(options);
            logger.debug("Merging configuration and command line parameters");
            const mergedConfig = Object.assign({}, originalConfig);
            this.overwriteConfigWithCommandLineOptions(mergedConfig, options);
            logger.debug(mergedConfig);
            logger.debug("Converting relative paths to absolute paths");
            const finalConfig = Object.assign(Object.assign({}, mergedConfig), { source: FileUtils.getAbsolutePath(FileUtils.resolve(file, mergedConfig.source)), destination: FileUtils.getAbsolutePath(FileUtils.resolve(file, mergedConfig.destination)) });
            logger.debug(finalConfig);
            logger.debug("Validating the configuration");
            JsonValidator.validateConfig(finalConfig);
            return { originalConfig, finalConfig };
        }
        catch (exception) {
            rethrow(exception, message => `Failed to load configuration file ${file}: ${message}`);
        }
    }
    static overwriteConfigWithCommandLineOptions(config, options) {
        for (const key of Object.keys(options)) {
            if (Object.prototype.hasOwnProperty.call(config, key) && undefined !== options[key]) {
                config[key] = options[key];
            }
        }
    }
    static parseAndValidateDatabase(json, zipFile, databaseFile, destination) {
        return tryCatchRethrowFriendlyException(() => {
            const database = this.parseJson(json);
            JsonValidator.validateDatabase(database);
            return database;
        }, error => [
            `${databaseFile} in ${zipFile} is corrupt.`,
            error,
            `To force a full re-sync, delete everything from ${destination}`
        ].join("\n"));
    }
    static loadFile(file) {
        const json = tryCatchRethrowFriendlyException(() => node.fs.readFileSync(file).toString(), error => `Failed to load ${file}: ${error}`);
        return this.parseJson(json);
    }
    static parseJson(json) {
        return tryCatchRethrowFriendlyException(() => JSON.parse(json), error => `${error}`);
    }
}
class Validator {
    throw(path, message) {
        const location = path ? ` at ${path}` : "";
        throw new FriendlyException(`${message}${location}`);
    }
}
class NonEmptyStringValidator extends Validator {
    validate(path, value) {
        if ("string" !== typeof value) {
            this.throw(path, `Expected a string but found ${typeof value}`);
        }
        else if (!value) {
            this.throw(path, `String is empty`);
        }
    }
}
class StringValidator extends Validator {
    validate(path, value) {
        if ("string" !== typeof value) {
            this.throw(path, `Expected a string but found ${typeof value}`);
        }
    }
}
class NumberValidator extends Validator {
    constructor(min, max) {
        super();
        this.min = min;
        this.max = max;
    }
    validate(path, value) {
        if ("number" !== typeof value) {
            this.throw(path, `Expected a number but found ${typeof path}`);
        }
        else if (undefined !== this.min && value < this.min) {
            this.throw(path, `Expected a minimum value of ${this.min} but found ${value}`);
        }
        else if (undefined !== this.max && this.max < value) {
            this.throw(path, `Expected a maximum value of ${this.max} but found ${value}`);
        }
    }
}
class ObjectValidator extends Validator {
    constructor(propertyValidators) {
        super();
        this.propertyValidators = propertyValidators;
    }
    setValidator(key, validator) {
        this.propertyValidators[key] = validator;
    }
    validate(path, value) {
        if ("object" !== typeof value) {
            this.throw(path, `Expected an object but found ${typeof value}`);
        }
        else if (null === value) {
            this.throw(path, `Expected an object but found null`);
        }
        else if (Array.isArray(value)) {
            this.throw(path, `Expected an object but found an array`);
        }
        else {
            for (const key of Object.keys(this.propertyValidators)) {
                if (!Object.prototype.hasOwnProperty.call(value, key)) {
                    this.throw(path, `Property "${key}" is missing`);
                }
                else {
                    this.propertyValidators[key].validate(`${path}/${key}`, value[key]);
                }
            }
            for (const key of Object.keys(value)) {
                if (!Object.prototype.hasOwnProperty.call(this.propertyValidators, key)) {
                    this.throw(path, `Unknown property "${key}"`);
                }
            }
        }
    }
}
class ArrayValidator extends Validator {
    constructor(itemValidator) {
        super();
        this.itemValidator = itemValidator;
    }
    validate(path, value) {
        if ("object" !== typeof value) {
            this.throw(path, `Expected an array but found ${typeof path}`);
        }
        else if (!value) {
            this.throw(path, `Expected an array but found null`);
        }
        else if (!Array.isArray(value)) {
            this.throw(path, `Expected an array but found an object`);
        }
        else {
            value.forEach((item, index) => this.itemValidator.validate(`${path}/${index}`, item));
        }
    }
}
class JsonValidator {
    static getConfigValidator() {
        return new ObjectValidator(Object.assign(Object.assign({}, JsonValidator.SOURCE_AND_DESTINATION_VALIDATORS), { password: new NonEmptyStringValidator(), sevenZip: new NonEmptyStringValidator() }));
    }
    static getFileValidator() {
        return new ObjectValidator(Object.assign(Object.assign({}, this.SOURCE_AND_DESTINATION_VALIDATORS), { created: new NumberValidator(0), modified: new NumberValidator(0), size: new NumberValidator(0) }));
    }
    static getDirectoryValidator() {
        const validator = new ObjectValidator(Object.assign(Object.assign(Object.assign({}, this.SOURCE_AND_DESTINATION_VALIDATORS), { files: new ArrayValidator(this.getFileValidator()) }), this.LAST_VALIDATOR));
        validator.setValidator("directories", new ArrayValidator(validator));
        return validator;
    }
    static getDatabaseValidator() {
        return new ObjectValidator(Object.assign({ files: new ArrayValidator(this.getFileValidator()), directories: new ArrayValidator(this.getDirectoryValidator()) }, this.LAST_VALIDATOR));
    }
    static validateConfig(json) {
        this.getConfigValidator().validate("", json);
    }
    static validateDatabase(json) {
        this.getDatabaseValidator().validate("", json);
    }
}
JsonValidator.SOURCE_AND_DESTINATION_VALIDATORS = {
    source: new NonEmptyStringValidator(),
    destination: new NonEmptyStringValidator(),
};
JsonValidator.LAST_VALIDATOR = {
    last: new StringValidator()
};
class MetadataManager {
    constructor(context) {
        this.context = context;
        this.logger = context.logger;
        this.print = context.print;
        this.isDryRun = context.options.dryRun;
        this.destination = context.config.destination;
    }
    loadOrInitializeDatabase() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const latest = (_a = this.listMetadataArchives()) === null || _a === void 0 ? void 0 : _a.latest;
            if (latest) {
                return this.loadDatabaseFromFile(latest.absolutePath, latest.name);
            }
            else if (FileUtils.getChildrenIfDirectoryExists(this.destination).array.length) {
                const indexFile = MetadataManager.ARCHIVE_FILE_PREFIX;
                throw new FriendlyException(`The destination has no ${indexFile} file but isn't empty either.\n`
                    + `For a full re-sync, delete everything from ${this.destination}`);
            }
            else {
                this.logger.info(`The destination ${this.destination} is empty - starting with an empty database`);
                return {
                    json: { files: [], directories: [], last: "" },
                    mustSaveImmediately: true
                };
            }
        });
    }
    loadDatabaseFromFile(absolutePath, name) {
        return __awaiter(this, void 0, void 0, function* () {
            const { sevenZip, passwordHasChanged } = yield this.getSevenZipToAccessForFile(absolutePath);
            const databaseFilename = MetadataManager.DATABASE_FILENAME;
            const json = this.unzipDatabase(sevenZip, absolutePath, name, databaseFilename);
            const database = JsonParser.parseAndValidateDatabase(json, name, databaseFilename, this.destination);
            if (passwordHasChanged) {
                return {
                    json: { files: [], directories: [], last: database.last },
                    mustSaveImmediately: true,
                };
            }
            else {
                return { json: database, mustSaveImmediately: false };
            }
        });
    }
    getSevenZipToAccessForFile(zipFile) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.checkIfSevenZipCanOpen(this.context.sevenZip, zipFile)) {
                return { sevenZip: this.context.sevenZip, passwordHasChanged: false };
            }
            else {
                this.logger.error(`Prompting for the old password (assuming that it has changed)`);
                console.error("The password seems to have changed.");
                const oldPassword = yield this.promptForOldPassword(zipFile);
                this.logger.info("Obtained the correct old password");
                return {
                    sevenZip: this.context.sevenZip.cloneWithDifferentPassword(oldPassword),
                    passwordHasChanged: true
                };
            }
        });
    }
    promptForOldPassword(zipFile) {
        return __awaiter(this, void 0, void 0, function* () {
            return InteractivePrompt.prompt({
                question: "Please enter the old password.",
                isPassword: true,
                useStderr: true,
                validate: input => {
                    console.error("");
                    const sevenZipWithNewPassword = this.context.sevenZip.cloneWithDifferentPassword(input);
                    const isCorrect = this.checkIfSevenZipCanOpen(sevenZipWithNewPassword, zipFile);
                    if (!isCorrect) {
                        console.error("");
                        console.error("Invalid password. Please try again.");
                    }
                    return isCorrect;
                }
            });
        });
    }
    checkIfSevenZipCanOpen(sevenZip, absolutePath) {
        const result = sevenZip.listToStdout(absolutePath);
        if (!result.success) {
            if (result.consoleOutput) {
                this.logger.error(result.consoleOutput);
            }
            this.logger.error(`Failed to open ${absolutePath} - ${result.errorMessage}`);
        }
        return result.success;
    }
    unzipDatabase(sevenZip, absolutePath, name, databaseFilename) {
        const unzip = sevenZip.unzipToStdout(absolutePath, databaseFilename);
        if (unzip.success && unzip.consoleOutput) {
            this.logger.info(`Loaded database ${databaseFilename} from ${absolutePath}`);
            this.print(`Loading the database`);
            return unzip.consoleOutput;
        }
        else {
            if (unzip.consoleOutput) {
                this.logger.error(unzip.consoleOutput.substring(0, Math.min(unzip.consoleOutput.length, 1000)));
            }
            this.logger.error(`Failed to extract ${databaseFilename} from ${absolutePath} - ${unzip.errorMessage}`);
            this.print(`Failed to extract the database from ${name}`);
            throw new FriendlyException([
                `The index file ${name} is corrupt.`,
                `It does not contain the database (filename: ${databaseFilename}).`,
                `To force a full re-sync, delete everything from ${this.destination}.`
            ].join("\n"));
        }
    }
    updateIndex(database) {
        const indexesToDelete = this.getMetadataArchives();
        const remainingOrphans = this.deleteOrphans(indexesToDelete.orphans.map(file => file.absolutePath));
        const mustCreateNewIndex = database.hasUnsavedChanges();
        const hasCreatedNewIndex = mustCreateNewIndex && this.createNewIndex(database);
        const isUpToDate = hasCreatedNewIndex || !mustCreateNewIndex;
        database.markAsSaved(isUpToDate);
        const remainingLatestOrphan = hasCreatedNewIndex
            ? this.deleteOrphans(indexesToDelete.latest.map(file => file.absolutePath))
            : indexesToDelete.latest.length;
        return { isUpToDate, remainingOrphans: remainingOrphans + remainingLatestOrphan };
    }
    getMetadataArchives() {
        var _a;
        const archives = this.listMetadataArchives();
        return { latest: archives ? [archives.latest] : [], orphans: (_a = archives === null || archives === void 0 ? void 0 : archives.orphans) !== null && _a !== void 0 ? _a : [] };
    }
    createNewIndex(database) {
        const archive = this.generateArchiveName();
        if (this.isDryRun) {
            this.logger.info(`Would save the database to ${archive.final}`);
            this.print("Would save the database");
            return true;
        }
        else {
            try {
                this.print("Saving the database");
                return this.populateIndex(archive.temp, archive.final, database);
            }
            catch (exception) {
                this.logger.error("Failed to save the database");
                this.print("===> FAILED");
                this.deleteFileIfExists(archive.temp);
                return false;
            }
        }
    }
    populateIndex(tempFile, finalFile, database) {
        const success = this.zipDatabase(tempFile, database)
            && this.zipReadme(tempFile, finalFile, database)
            && this.zipFileListing(tempFile, database)
            && this.renameArchive(tempFile, finalFile);
        if (!success) {
            this.deleteFileIfExists(tempFile);
        }
        return success;
    }
    zipDatabase(zipFile, database) {
        this.logger.info("Serializing the database");
        const json = DatabaseSerializer.serializeDatabase(database);
        this.logger.info(`Storing the database as ${MetadataManager.DATABASE_FILENAME} in ${zipFile}`);
        return this.addToArchive(zipFile, MetadataManager.DATABASE_FILENAME, json);
    }
    zipReadme(tempFile, finalFile, database) {
        this.logger.info(`Storing the README as ${MetadataManager.README_FILENAME} in ${tempFile}`);
        const filename = node.path.relative(database.destination.absolutePath, finalFile);
        const content = README_FILE_CONTENT.replace("___INDEX___2022-04-10-07-25-47-394.7z", filename);
        return this.addToArchive(tempFile, MetadataManager.README_FILENAME, content);
    }
    zipFileListing(zipFile, database) {
        this.logger.info("Creating the file listing");
        const listing = FileListingCreator.create(database);
        this.logger.info(`Storing the file listing as ${MetadataManager.LISTING_FILENAME} in ${zipFile}`);
        return this.addToArchive(zipFile, MetadataManager.LISTING_FILENAME, listing);
    }
    renameArchive(temp, final) {
        try {
            this.logger.info(`Renaming ${temp} => ${final}`);
            node.fs.renameSync(temp, final);
            return true;
        }
        catch (exception) {
            this.logger.error(`Failed to rename ${temp} => ${final} - ${firstLineOnly(exception)}`);
            return false;
        }
    }
    deleteFileIfExists(file) {
        if (FileUtils.exists(file)) {
            try {
                this.logger.info(`Deleting ${file}`);
                node.fs.rmSync(file);
                if (FileUtils.exists(file)) {
                    this.logger.error(`Failed to delete ${file}, although rmSync did not raise an error`);
                    return false;
                }
            }
            catch (exception) {
                this.logger.error(`Failed to delete ${file} - ${firstLineOnly(exception)}`);
                return false;
            }
        }
        return true;
    }
    deleteOrphans(orphans) {
        return orphans.filter(file => !this.deleteFileIfExists(file)).length;
    }
    static isMetadataArchiveName(name) {
        const prefix = MetadataManager.ARCHIVE_FILE_PREFIX;
        const suffix = ".7z";
        if (name.startsWith(prefix) && name.endsWith(suffix)) {
            const timestamp = name.substring(prefix.length, name.length - suffix.length);
            return !!timestamp.match(/^\d{4}(-\d{2}){5}-\d{3}(_\d{6})?$/);
        }
        else {
            return false;
        }
    }
    generateArchiveName() {
        const timestamp = MetadataManager.generateTimestamp();
        for (let index = 0; index < 1000000; index++) {
            const suffix = index ? `_${Logger.formatNumber(index, 6)}` : "";
            const name = `${MetadataManager.ARCHIVE_FILE_PREFIX}${timestamp}${suffix}.7z`;
            const tempName = `${MetadataManager.ARCHIVE_FILE_PREFIX}${timestamp}${suffix}_TMP.7z`;
            const nameWithPath = node.path.join(this.context.config.destination, name);
            const tempNameWithPath = node.path.join(this.context.config.destination, tempName);
            if (!MetadataManager.isMetadataArchiveName(name)) {
                throw new InternalError(`Generated an invalid archive name: ${timestamp}`);
            }
            if (!FileUtils.exists(nameWithPath) && !FileUtils.exists(tempNameWithPath)) {
                return { temp: tempNameWithPath, final: nameWithPath };
            }
        }
        throw new InternalError(`All generated archive names for timestamp ${timestamp} already exist`);
    }
    static generateTimestamp() {
        const now = new Date();
        return [
            [4, now.getFullYear()],
            [2, now.getMonth() + 1],
            [2, now.getDate()],
            [2, now.getHours()],
            [2, now.getMinutes()],
            [2, now.getSeconds()],
            [3, now.getMilliseconds()]
        ].map(array => Logger.formatNumber(array[1], array[0])).join("-");
    }
    listMetadataArchives() {
        const files = FileUtils.getChildren(this.destination)
            .array
            .filter(dirent => !dirent.isDirectory())
            .map(dirent => dirent.name)
            .filter(filename => MetadataManager.isMetadataArchiveName(filename))
            .sort()
            .map(filename => ({ name: filename, absolutePath: node.path.join(this.destination, filename) }));
        const total = files.length;
        return total ? { latest: files[total - 1], orphans: files.slice(0, total - 1) } : undefined;
    }
    addToArchive(zipFile, filename, content) {
        const result = this.context.sevenZip.zipString(content, filename, zipFile);
        if (!result.success) {
            if (result.consoleOutput) {
                this.context.logger.error(result.consoleOutput);
            }
            this.context.logger.error(`Failed to add ${filename} to the create recovery archive ${zipFile}: ${result.errorMessage}`);
        }
        return result.success;
    }
}
MetadataManager.ARCHIVE_FILE_PREFIX = "___INDEX___";
MetadataManager.DATABASE_FILENAME = "7-sync-database.json";
MetadataManager.LISTING_FILENAME = "7-sync-file-index.txt";
MetadataManager.README_FILENAME = "7-sync-README.txt";
class SetupWizard {
    static initialize(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.initializeOrReconfigure({ config: options.config });
        });
    }
    static reconfigure(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const logger = new Logger(LogLevel.ERROR, new NullOutputStream());
            const config = JsonParser.loadAndValidateConfig(options, logger);
            return this.initializeOrReconfigure(Object.assign({ config: options.config }, config.originalConfig));
        });
    }
    static initializeOrReconfigure(presets) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            console.log("");
            console.log("--------------------------------------------------------------------------------");
            console.log("7-sync configuration wizard");
            console.log("--------------------------------------------------------------------------------");
            console.log("");
            const hasPresets = undefined !== presets.source;
            const config = yield this.getConfigFile(hasPresets, presets.config);
            const base = FileUtils.getAbsolutePath(FileUtils.normalize(FileUtils.getParent(config)));
            const source = yield this.getSourceDirectory(config, base, presets === null || presets === void 0 ? void 0 : presets.source);
            const destination = yield this.getDestinationDirectory(config, base, source, presets.destination);
            const password = yield this.getPassword(presets.password);
            const sevenZip = yield this.getSevenZip(hasPresets, (_a = presets.sevenZip) !== null && _a !== void 0 ? _a : "7z");
            const configJson = {
                source: FileUtils.resolve(config, source),
                destination: FileUtils.resolve(config, destination),
                password,
                sevenZip
            };
            node.fs.writeFileSync(config, JSON.stringify(configJson, undefined, 4));
            if (hasPresets) {
                console.log(`Config file "${config}" has been updated.`);
            }
            else {
                console.log(`The config file "${config}" has been created.`);
            }
        });
    }
    static getConfigFile(hasPresets, preset) {
        return __awaiter(this, void 0, void 0, function* () {
            if (hasPresets) {
                console.log(`This wizard will reconfigure ${preset}.`);
                console.log("");
                return preset;
            }
            else {
                return this.prompt({
                    question: [
                        "Please enter the name of the configuration file to create.",
                        "It must end with .cfg and can include a relative or absolute path.",
                        "It must be located outside the directories where to sync from and to.",
                        `Press Enter to use the default: ${preset}`
                    ],
                    defaultAnswer: preset,
                    normalizePath: true,
                    validate: (file) => __awaiter(this, void 0, void 0, function* () {
                        if (FileUtils.existsAndIsFile(file)) {
                            const question = `${file} already exists. Do you want to overwrite it?`;
                            if (!(yield InteractivePrompt.promptYesNo({ question: question }))) {
                                return false;
                            }
                        }
                        return this.formatValidationResult(ConfigValidator.validateConfigFile(file, false));
                    })
                });
            }
        });
    }
    static getSourceDirectory(configFile, base, preset) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prompt({
                question: [
                    "Please enter the source directory where to sync files from.",
                    base ? `The path can be absolute or relative to ${base}` : "The path can be absolute or relative.",
                    ...(preset ? [`Press Enter to use the current setting: ${preset}`] : [])
                ],
                normalizePath: true,
                defaultAnswer: preset,
                validate: source => Promise.resolve(this.formatValidationResult(ConfigValidator.validateSourceDirectory(configFile, source)))
            });
        });
    }
    static getDestinationDirectory(config, base, source, preset) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prompt({
                question: [
                    "Please enter the destination directory for the encrypted files.",
                    base ? `The path can be absolute or relative to ${base}` : "The path can be absolute or relative.",
                    ...(preset ? [`Press Enter to use the current setting: ${preset}`] : [])
                ],
                normalizePath: true,
                defaultAnswer: preset,
                validate: destination => Promise.resolve(this.formatValidationResult(ConfigValidator.validateDestinationDirectory(config, source, destination)))
            });
        });
    }
    static getPassword(preset) {
        return __awaiter(this, void 0, void 0, function* () {
            while (true) {
                const question = preset
                    ? [
                        "Please enter a new password if you want to change it.",
                        "The next synchronization will delete and re-encrypt all files.",
                        "Press enter to keep the current password (without changing it)."
                    ]
                    : [
                        "Please enter the password."
                    ];
                const password = yield this.prompt({ question: question, isPassword: true, acceptBlankInput: !!preset });
                if (!password && preset) {
                    console.log("");
                    return preset;
                }
                if (password === (yield this.prompt({ question: ["Please repeat the password."], isPassword: true }))) {
                    console.log("");
                    return PasswordHelper.createSaltedHash(password);
                }
                else {
                    console.log("");
                    console.log("ERROR: The passwords don't match.");
                    console.log("");
                }
            }
        });
    }
    static getSevenZip(hasPresets, preset) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prompt({
                question: [
                    "Please enter the command to run 7-Zip.",
                    `Press Enter to use the ${hasPresets ? "current setting" : "default"}: ${preset}`
                ],
                normalizePath: true,
                defaultAnswer: preset,
                validate: sevenZip => Promise.resolve(this.formatValidationResult(this.validateSevenZip(sevenZip)))
            });
        });
    }
    static validateSevenZip(sevenZip) {
        const useAbsolutePath = "Please specify an absolute path if 7-Zip is not in the search path.";
        try {
            const result1 = SevenZip.runAnyCommand({ executable: sevenZip });
            if (result1.success) {
                return true;
            }
            else {
                return `Running ${sevenZip} causes an error\n${result1.errorMessage}\n${useAbsolutePath}`;
            }
        }
        catch (exception) {
            console.log(exception);
            return `Can't execute ${sevenZip}\n${firstLineOnly(exception)}${useAbsolutePath}`;
        }
    }
    static prompt(options) {
        return __awaiter(this, void 0, void 0, function* () {
            let answer = options.presetAnswer;
            while (true) {
                if (undefined !== answer) {
                    if (true === options.normalizePath) {
                        answer = FileUtils.normalize(answer);
                    }
                    const validationResult = options.validate ? (yield options.validate(answer)) : true;
                    if (true === validationResult) {
                        return answer;
                    }
                    else if ("string" === typeof validationResult) {
                        console.log(validationResult);
                        console.log("");
                    }
                }
                answer = yield InteractivePrompt.prompt({
                    question: options.question,
                    defaultAnswer: options.defaultAnswer,
                    isPassword: options.isPassword,
                    acceptBlankInput: options.acceptBlankInput
                });
            }
        });
    }
    static formatValidationResult(result) {
        return "string" === typeof result ? `ERROR: ${result}` : result;
    }
}
class SevenZip {
    constructor(executable, password, logger, console) {
        this.executable = executable;
        this.password = password;
        this.logger = logger;
        this.console = console;
        this.print = (message) => console.log(message);
        if (!password) {
            throw new FriendlyException("The password must not be empty");
        }
    }
    cloneWithDifferentPassword(newPassword) {
        return new SevenZip(this.executable, newPassword, this.logger, this.console);
    }
    runSelfTest() {
        this.logger.info(`Verifying that 7-Zip is working correctly`);
        this.print("Verifying that 7-Zip is working correctly");
        const directory = this.createTemporaryDirectory();
        try {
            const correctPassword = this.cloneWithDifferentPassword("correct-password");
            const invalidPassword = this.cloneWithDifferentPassword("invalid-password");
            correctPassword.runAllSelfTests(directory, invalidPassword);
            this.removeTestDirectory(directory);
        }
        catch (exception) {
            tryCatchIgnore(() => this.removeTestDirectory(directory));
            rethrow(exception, message => `7-Zip is not working correctly: ${message} (see log file for details)`);
        }
        this.logger.debug("All 7-Zip tests have passed");
    }
    createTemporaryDirectory() {
        const tempDirectory = tryCatchRethrowFriendlyException(() => node.path.resolve(node.os.tmpdir()), error => `Failed to determine the system's temp directory - ${error}`);
        const workingDirectory = tryCatchRethrowFriendlyException(() => node.fs.mkdtempSync(`${tempDirectory}${node.path.sep}7-sync-self-test-`), error => `Failed to create a a test directory in ${tempDirectory} - ${error}`);
        if (!FileUtils.existsAndIsDirectory(workingDirectory)) {
            this.logger.error(`mkdtempSync failed to create ${workingDirectory} - but did not raise an error either`);
            throw new FriendlyException(`Failed to create test directory ${tempDirectory}`);
        }
        return workingDirectory;
    }
    removeTestDirectory(directory) {
        if (FileUtils.exists(directory)) {
            tryCatchRethrowFriendlyException(() => node.fs.rmSync(directory, { recursive: true }), error => `Failed to delete test directory ${directory} - ${error}`);
            if (FileUtils.exists(directory)) {
                throw new FriendlyException(`Failed to delete ${directory} (though rmSync did not raise an error)`);
            }
        }
    }
    runAllSelfTests(directory, sevenZipWithWrongPassword) {
        const filename = "data.txt";
        const content = "Test data";
        const zipFile = node.path.join(directory, "archive.7z");
        this.createTestFile(node.path.join(directory, filename), content);
        this.testGeneralInvocation();
        this.testInvalidParameters();
        this.testZipAndUnzipFile(directory, filename, content, zipFile);
        this.testZipAndUnzipString(content, "In-memory data", zipFile);
        this.testZipNonExistentFile(directory, "non-existent-file", zipFile);
        sevenZipWithWrongPassword.testUnzipWithWrongPassword(zipFile, filename, content);
        this.selfTestList(zipFile);
        sevenZipWithWrongPassword.testListWithWrongPassword(zipFile);
    }
    createTestFile(file, content) {
        tryCatchRethrowFriendlyException(() => node.fs.writeFileSync(file, content), error => `Failed to create the test file ${file} - ${error}`);
        if (FileUtils.existsAndIsDirectory(file)) {
            throw new FriendlyException(`Failed to create the test file ${file} (writeFileSync did not raise an error)`);
        }
    }
    testGeneralInvocation() {
        const result = this.runSevenZip({});
        if (!result.success) {
            this.logExecution(result);
            throw new FriendlyException(`The program can't be started - ${result.errorMessage}`);
        }
    }
    testInvalidParameters() {
        const result = this.runSevenZip({ parameters: ["--invalid-option", "non-existent-file"] });
        if (result.success) {
            this.logExecution(result);
            throw new FriendlyException("Passing invalid parameters does not cause an error");
        }
    }
    testZipAndUnzipFile(directory, filename, content, zipFile) {
        const zipResult = this.zipFile(directory, filename, zipFile);
        if (!zipResult.success) {
            this.logExecution(zipResult);
            throw new FriendlyException("Failed to add a file to a zip archive");
        }
        const unzipResult = this.unzipToStdout(zipFile, filename);
        if (!zipResult.success) {
            this.logExecution(zipResult, LogLevel.INFO);
            this.logExecution(unzipResult);
            throw new FriendlyException("Failed to extract a file from a zip archive");
        }
        if (content !== unzipResult.consoleOutput) {
            this.logExecution(zipResult, LogLevel.INFO);
            this.logExecution(unzipResult, LogLevel.INFO);
            this.logger.error(`Expected unzip ${content} but received ${unzipResult.consoleOutput}`);
            throw new FriendlyException("Unzipping file content returns invalid data");
        }
    }
    testZipAndUnzipString(content, filenameInArchive, zipFile) {
        const zipResult = this.zipString(content, filenameInArchive, zipFile);
        if (!zipResult.success) {
            this.logExecution(zipResult);
            throw new FriendlyException("Failed to add string content to a zip archive");
        }
        const unzipResult = this.unzipToStdout(zipFile, filenameInArchive);
        if (!unzipResult.success) {
            this.logExecution(zipResult, LogLevel.INFO);
            this.logExecution(unzipResult);
            throw new FriendlyException("Failed to extract a file from a zip archive");
        }
        if (content !== unzipResult.consoleOutput) {
            this.logExecution(zipResult, LogLevel.INFO);
            this.logExecution(unzipResult, LogLevel.INFO);
            this.logger.error(`Expected "${content}" as unzipped content but received "${unzipResult.consoleOutput}"`);
            throw new FriendlyException("Unzipping file content returns invalid data");
        }
    }
    testUnzipWithWrongPassword(zipFile, filenameInArchive, content) {
        const result = this.unzipToStdout(zipFile, filenameInArchive);
        if (result.success) {
            this.logExecution(result);
            this.logger.error("Expected an exit code other than 0 or an error");
            throw new FriendlyException("Unzipping with a wrong password does not cause an error");
        }
        if (result.consoleOutput === content) {
            this.logExecution(result);
            this.logger.error(`Despite the wrong password, the correct file content (${content}) was returned`);
            throw new FriendlyException("Unzipping with a wrong password returns the correct file content");
        }
    }
    testZipNonExistentFile(directory, file, zipFile) {
        const result = this.zipFile(directory, file, zipFile);
        if (result.success) {
            this.logExecution(result);
            this.logger.error("Expected an exit code other than 0 or an error");
            throw new FriendlyException("Zipping a non-existent file does not cause an error");
        }
    }
    selfTestList(zipFile) {
        const result = this.listToStdout(zipFile);
        if (!result.success) {
            this.logExecution(result);
            throw new FriendlyException(`Listing the contents of a zip archive failed`);
        }
    }
    testListWithWrongPassword(zipFile) {
        const result = this.listToStdout(zipFile);
        if (result.success) {
            this.logExecution(result);
            this.logger.error("Expected an exit code other than 0 or an error");
            throw new FriendlyException("Listing archive file contents with a wrong password does not cause an error");
        }
    }
    logExecution(options, logLevel = LogLevel.ERROR) {
        var _a;
        [
            `Running command: ${options.getCommand()}`,
            options.consoleOutput || "The command did not produce any console output",
            (_a = options.errorMessage) !== null && _a !== void 0 ? _a : "",
            null !== options.details.status ? `The command exited with code ${options.details.status}` : ""
        ]
            .filter(line => line)
            .forEach(line => this.logger.log(logLevel, line));
    }
    zipFile(workingDirectory, sourceFile, zipFile) {
        return this.verifyZipResult(zipFile, this.runSevenZip({
            workingDirectory,
            parameters: [
                ...this.getZipParameters(),
                zipFile,
                sourceFile
            ]
        }));
    }
    zipString(content, filenameInArchive, zipFile) {
        return this.verifyZipResult(zipFile, this.runSevenZip({
            parameters: [
                ...this.getZipParameters(),
                `-si${filenameInArchive}`,
                zipFile
            ],
            stdin: content
        }));
    }
    verifyZipResult(zipFile, zipResult) {
        if (!FileUtils.existsAndIsFile(zipFile)) {
            return Object.assign(Object.assign({}, zipResult), { success: false, errorMessage: `7-Zip returned no error but ${zipFile} was not created either` });
        }
        const listResult = this.listToStdout(zipFile);
        if (!listResult.success) {
            return Object.assign(Object.assign({}, zipResult), { success: false, errorMessage: `The zip file was created but listing its contents failed - ${listResult.errorMessage}`, consoleOutput: [
                    "================================[ zip command ]================================",
                    "",
                    zipResult.consoleOutput,
                    "",
                    "================================[ list command ]================================",
                    "",
                    listResult.consoleOutput
                ].join("\n") });
        }
        return zipResult;
    }
    unzipToStdout(zipFile, filenameInArchive) {
        return this.runSevenZip({
            parameters: [
                ...this.getUnzipParameters(),
                `-so`,
                zipFile,
                filenameInArchive
            ],
        });
    }
    listToStdout(zipFile) {
        return this.runSevenZip({
            parameters: [
                ...this.getListParameters(),
                zipFile
            ]
        });
    }
    getZipParameters() {
        return [
            "a",
            "-mx=9",
            "-mhc=on",
            "-mhe=on",
            ...this.getSharedParameters()
        ];
    }
    getUnzipParameters() {
        return [
            "e",
            ...this.getSharedParameters()
        ];
    }
    getListParameters() {
        return [
            "l",
            ...this.getSharedParameters()
        ];
    }
    getSharedParameters() {
        return [
            "-t7z",
            "-bse1",
            "-y",
            `-p${this.password}`
        ];
    }
    runSevenZip(options) {
        return SevenZip.runAnyCommand(Object.assign(Object.assign({}, options), { executable: this.executable }));
    }
    static runAnyCommand(options) {
        var _a, _b, _c;
        const result = node.child_process.spawnSync(options.executable, (_a = options.parameters) !== null && _a !== void 0 ? _a : [], {
            cwd: options.workingDirectory,
            shell: false,
            windowsHide: true,
            encoding: "utf8",
            input: options.stdin,
            maxBuffer: 4 * 1024 * 1024 * 1024
        });
        return {
            success: 0 === result.status && !result.error,
            errorMessage: this.formatErrorMessage(result.status, result.error),
            consoleOutput: [(_b = result.stdout) !== null && _b !== void 0 ? _b : "", (_c = result.stderr) !== null && _c !== void 0 ? _c : ""].map(text => text.trim()).join("\n").trim(),
            getCommand: () => this.formatCommand(options),
            details: Object.assign({}, result)
        };
    }
    static formatErrorMessage(status, error) {
        const exitCode = "number" === typeof status ? `${status}` : undefined;
        const errorMessage = (error ? firstLineOnly(error) : "").trim() || undefined;
        if (errorMessage && exitCode) {
            return `${errorMessage} (exit code ${exitCode})`;
        }
        else if (errorMessage) {
            return `${errorMessage}`;
        }
        else if (exitCode) {
            return `Exit code ${exitCode}`;
        }
        else {
            return "";
        }
    }
    static formatCommand(options) {
        var _a;
        const command = [options.executable, ...((_a = options.parameters) !== null && _a !== void 0 ? _a : [])].map(this.quoteParameter).join(" ");
        const stdin = this.formatStdinPipe(options.stdin);
        return stdin + command;
    }
    static quoteParameter(parameter) {
        return 0 <= parameter.indexOf(" ") ? `"${parameter.replace(/"/g, '\\"')}"` : parameter;
    }
    static formatStdinPipe(stdin) {
        const completeText = stdin ? stdin.trim() : "";
        const firstLine = completeText.replace(/\r?\n.*/, "...");
        const truncated = firstLine.length <= 30
            ? firstLine
            : `${firstLine.substring(0, Math.max(30, firstLine.length - 3))}...`;
        const quoted = this.quoteParameter(truncated);
        return quoted ? `echo ${quoted} | ` : "";
    }
}
class StatisticsReporter {
    constructor(context, statistics) {
        this.context = context;
        this.statistics = statistics;
        this.logger = context.logger;
    }
    static run(context, statistics) {
        new StatisticsReporter(context, statistics).logStatistics();
    }
    logStatistics() {
        this.logCopyStatistics();
        this.logDeleteStatistics();
        this.logOrphanStatistics();
        this.logPurgeStatistics();
    }
    logCopyStatistics() {
        return this.logOperationStatistics(this.statistics.copied, {
            dryRun: {
                singular: "Would have copied {} that was added to or modified in the source",
                plural: "Would have copied {} that were added to or modified in the source"
            },
            success: {
                singular: "Successfully copied {} that was added to or modified in the source",
                plural: "Successfully copied {} that were added to or modified in the source"
            },
            failed: {
                singular: "Failed to copy {} that was added to or modified in the source",
                plural: "Failed to copy {} that were added to or modified in the source",
            }
        });
    }
    logDeleteStatistics() {
        return this.logOperationStatistics(this.statistics.deleted, {
            dryRun: {
                singular: "Would have deleted {} that was modified in or deleted from the source",
                plural: "Would have deleted {} that were modified in or deleted from the source"
            },
            success: {
                singular: "Successfully deleted {} that was modified in or deleted from the source",
                plural: "Successfully deleted {} that were modified in or deleted from the source"
            },
            failed: {
                singular: "Failed to delete {} that was modified in or deleted from the source",
                plural: "Failed to delete {} that were modified in or deleted from the source",
            }
        });
    }
    logOrphanStatistics() {
        return this.logOperationStatistics(this.statistics.orphans, {
            dryRun: {
                singular: "Would have deleted {} that is not registered in the database (orphan)",
                plural: "Would have deleted {} that are not registered in the database (orphans)"
            },
            success: {
                singular: "Successfully deleted {} that was not registered in the database (orphan)",
                plural: "Successfully deleted {} that were not registered in the database (orphans)"
            },
            failed: {
                singular: "Failed to delete {} that is not registered in the database (orphan)",
                plural: "Failed to delete {} that are not registered in the database (orphans)",
            }
        });
    }
    logPurgeStatistics() {
        return this.logOperationStatistics(this.statistics.purged, {
            dryRun: {
                singular: "Would have purged {} (that has vanished from the destination) from the database",
                plural: "Would have purged {} (that have vanished from the destination) from the database"
            },
            success: {
                singular: "Successfully purged {} (that has vanished from the destination) from the database",
                plural: "Successfully purged {} (that have vanished from the destination) from the database"
            },
            failed: {
                plural: "Failed to purge {} (that has vanished from the destination) from the database",
                singular: "Failed to purge {} (that have vanished from the destination) from the database",
            }
        });
    }
    logOperationStatistics(statistics, messages) {
        if (this.context.options.dryRun) {
            return this.logDryRunStatistics(statistics, messages.dryRun.singular, messages.dryRun.plural);
        }
        else {
            const logged1 = this.logSuccessStatistics(statistics, messages.success.singular, messages.success.plural);
            const logged2 = this.logFailureStatistics(statistics, messages.failed.singular, messages.failed.plural);
            return logged1 && logged2;
        }
    }
    logDryRunStatistics(statistics, singular, plural) {
        return this.log(statistics.files.total, statistics.directories.total, singular, plural, LogLevel.INFO);
    }
    logSuccessStatistics(statistics, singular, plural) {
        return this.log(statistics.files.success, statistics.directories.success, singular, plural, LogLevel.INFO);
    }
    logFailureStatistics(statistics, singular, plural) {
        return this.log(statistics.files.failed, statistics.directories.failed, singular, plural, LogLevel.WARN);
    }
    log(files, directories, singular, plural, logLevel) {
        if (files || directories) {
            const message = 1 === files + directories ? singular : plural;
            const filesAndDirectories = this.formatCounters(files, directories);
            const index = message.indexOf("{}");
            const messageStart = 0 <= index ? message.substring(0, index) : message;
            const messageEnd = 0 <= index ? message.substring(index + 2) : "";
            this.logger.log(logLevel, messageStart + filesAndDirectories + messageEnd);
            return true;
        }
        else {
            return false;
        }
    }
    formatCounters(files, directories) {
        const fileOrFiles = 1 === files ? "file" : "files";
        const directoryOrDirectories = 1 === directories ? "directory" : "directories";
        if (0 < files && 0 === directories) {
            return `${files} ${fileOrFiles}`;
        }
        else if (0 === files && 0 < directories) {
            return `${directories} ${directoryOrDirectories}`;
        }
        else {
            return `${files} ${fileOrFiles} and ${directories} ${directoryOrDirectories}`;
        }
    }
}
class Synchronizer {
    constructor(context, metadataManager, database) {
        this.context = context;
        this.metadataManager = metadataManager;
        this.database = database;
        this.statistics = new SyncStats();
        this.fileManager = new FileManager(context, database);
        this.logger = context.logger;
        this.isDryRun = context.options.dryRun;
        this.print = context.print;
    }
    static run(context, metadataManager, database) {
        const synchronizer = new Synchronizer(context, metadataManager, database);
        synchronizer.syncDirectory(database);
        const statistics = synchronizer.statistics;
        if (!statistics.copied.total && !statistics.deleted.total && !statistics.orphans.total) {
            context.print("The destination is already up to date");
            context.logger.info("The destination is already up to date - no changes required");
        }
        if (database.hasUnsavedChanges()) {
            synchronizer.updateIndex();
        }
        StatisticsReporter.run(context, synchronizer.statistics);
        return WarningsGenerator.run(context, synchronizer.statistics);
    }
    syncDirectory(directory) {
        const absoluteDestinationPath = directory.destination.absolutePath;
        const destinationChildren = FileUtils.getChildrenIfDirectoryExists(absoluteDestinationPath).map;
        this.logAndDiscardSymbolicLinks(absoluteDestinationPath, destinationChildren, "destination");
        const success1 = this.deleteOrphans(directory, destinationChildren);
        const items = this.analyzeDirectory(directory, destinationChildren);
        const success2 = this.mapAndReduce(items, item => this.processItem(directory, item.source, item.database, item.destination));
        return success1 && success2;
    }
    mapAndReduce(array, callback) {
        return !array.map(callback).some(success => !success);
    }
    deleteOrphans(database, destinationChildren) {
        return this.mapAndReduce(Array.from(destinationChildren), array => {
            const name = array[0];
            const dirent = array[1];
            if (!database.files.byDestinationName.has(name) && !database.subdirectories.byDestinationName.has(name)) {
                const destination = node.path.join(database.destination.absolutePath, name);
                const relativeRootPath = node.path.relative(this.database.source.absolutePath, database.source.absolutePath);
                const success = this.deleteOrphanedItem(destination, dirent, path => {
                    return node.path.join(relativeRootPath, name, path.substring(destination.length));
                });
                if (success) {
                    destinationChildren.delete(name);
                }
                return success;
            }
            else {
                return true;
            }
        });
    }
    deleteOrphanedItem(destination, dirent, pathMapper) {
        this.updateIndexIfRequired();
        const isRootFolder = node.path.dirname(destination) === this.database.destination.absolutePath;
        if (isRootFolder && MetadataManager.isMetadataArchiveName(dirent.name)) {
            return true;
        }
        else {
            return dirent.isDirectory()
                ? this.deleteOrphanedDirectory(destination, pathMapper)
                : this.deleteOrphanedFile(destination, pathMapper);
        }
    }
    deleteOrphanedDirectory(absolutePath, pathMapper) {
        this.deleteOrphanedChildren(absolutePath, pathMapper);
        if (!this.statistics.orphans.total) {
            this.recalculateLastFilenames();
        }
        const success = this.fileManager.deleteDirectory({
            destination: absolutePath,
            orphanDisplayPath: pathMapper(absolutePath)
        });
        if (success) {
            this.statistics.orphans.directories.success++;
        }
        else {
            this.statistics.orphans.directories.failed++;
        }
        return success;
    }
    deleteOrphanedChildren(absoluteParentPath, pathMapper) {
        return this.mapAndReduce(FileUtils.getChildren(absoluteParentPath).array, dirent => this.deleteOrphanedItem(node.path.join(absoluteParentPath, dirent.name), dirent, pathMapper));
    }
    deleteOrphanedFile(destination, pathMapper) {
        if (!this.statistics.orphans.total) {
            this.recalculateLastFilenames();
        }
        const success = this.fileManager.deleteFile({ destination, orphanDisplayPath: pathMapper(destination) });
        if (success) {
            this.statistics.orphans.files.success++;
        }
        else {
            this.statistics.orphans.files.failed++;
        }
        return success;
    }
    analyzeDirectory(directory, destinationChildren) {
        const sourceChildren = FileUtils.getChildrenIfDirectoryExists(directory.source.absolutePath).map;
        this.logAndDiscardSymbolicLinks(directory.source.absolutePath, sourceChildren, "source");
        const databaseFiles = directory.files.bySourceName.values();
        const databaseSubdirectories = directory.subdirectories.bySourceName.values();
        const databaseItems = [...databaseFiles, ...databaseSubdirectories].map(database => ({
            source: sourceChildren.get(database.source.name),
            database,
            destination: destinationChildren.get(database.destination.name)
        }));
        databaseItems.forEach(item => {
            if (item.source) {
                sourceChildren.delete(item.source.name);
            }
        });
        const sourceOnlyItems = Array.from(sourceChildren.values()).map(source => ({
            source, database: undefined, destination: undefined
        }));
        return this.sortAnalysisResults(...sourceOnlyItems, ...databaseItems);
    }
    logAndDiscardSymbolicLinks(path, map, category) {
        const toDelete = Array.from(map.values()).filter(dirent => !dirent.isFile() && !dirent.isDirectory());
        toDelete.forEach(dirent => map.delete(dirent.name));
        const unprocessable = this.statistics.unprocessable;
        const statistics = "source" === category ? unprocessable.source : unprocessable.destination;
        statistics.symlinks += toDelete.filter(dirent => dirent.isSymbolicLink()).length;
        statistics.other += toDelete.filter(dirent => !dirent.isSymbolicLink()).length;
        toDelete.map(entry => node.path.join(path, entry.name)).forEach(name => this.logger.warn(`Ignoring ${name} because it's a symbolic link or otherwise unprocessable`));
    }
    sortAnalysisResults(...array) {
        return array.map(item => {
            let isDirectory = item.database instanceof MappedSubdirectory;
            if (!isDirectory && item.source) {
                isDirectory = item.source.isDirectory();
            }
            if (!isDirectory && item.destination) {
                isDirectory = item.destination.isDirectory();
            }
            return Object.assign(Object.assign({}, item), { isDirectory });
        }).sort((a, b) => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            if (a.isDirectory === b.isDirectory) {
                const name1 = ((_d = (_b = (_a = a.database) === null || _a === void 0 ? void 0 : _a.source.name) !== null && _b !== void 0 ? _b : (_c = a.source) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : "").toLowerCase();
                const name2 = ((_h = (_f = (_e = b.database) === null || _e === void 0 ? void 0 : _e.source.name) !== null && _f !== void 0 ? _f : (_g = b.source) === null || _g === void 0 ? void 0 : _g.name) !== null && _h !== void 0 ? _h : "").toLowerCase();
                return name1 < name2 ? -1 : 1;
            }
            else {
                return a.isDirectory ? -1 : 1;
            }
        });
    }
    processItem(parentDirectory, sourceDirent, databaseEntry, destinationDirent) {
        this.updateIndexIfRequired();
        if (databaseEntry) {
            return this.processKnownItem(parentDirectory, databaseEntry, sourceDirent, destinationDirent);
        }
        else if (sourceDirent) {
            return this.processNewItem(parentDirectory, sourceDirent);
        }
        else {
            return true;
        }
    }
    processKnownItem(parentDirectory, databaseEntry, sourceDirent, destinationDirent) {
        if (sourceDirent && destinationDirent) {
            return this.processPreexistingItem(parentDirectory, databaseEntry, sourceDirent, destinationDirent);
        }
        else if (destinationDirent) {
            return this.processDeletedItem(parentDirectory, databaseEntry, destinationDirent);
        }
        else {
            return this.processVanishedItem(parentDirectory, databaseEntry, sourceDirent);
        }
    }
    processNewItem(parentDirectory, sourceDirent) {
        return sourceDirent.isDirectory()
            ? this.processNewDirectory(parentDirectory, sourceDirent)
            : this.processNewFile(parentDirectory, sourceDirent);
    }
    processDeletedItem(parentDirectory, databaseEntry, destinationDirent) {
        return databaseEntry instanceof MappedFile
            ? this.processDeletedFile(parentDirectory, databaseEntry, destinationDirent)
            : this.processDeletedDirectory(parentDirectory, databaseEntry, destinationDirent);
    }
    processNewDirectory(parentDirectory, sourceDirent) {
        const subdirectory = this.fileManager.createDirectory(parentDirectory, sourceDirent);
        if (subdirectory) {
            this.statistics.copied.directories.success++;
            return this.syncDirectory(subdirectory);
        }
        else {
            this.statistics.copied.directories.failed++;
            return false;
        }
    }
    processNewFile(parentDirectory, sourceDirent) {
        if (this.fileManager.zipFile(parentDirectory, sourceDirent)) {
            this.statistics.copied.files.success++;
            return true;
        }
        else {
            this.statistics.copied.files.failed++;
            return false;
        }
    }
    processVanishedItem(parentDirectory, databaseEntry, sourceDirent) {
        const prefix = this.isDryRun ? "Would purge" : "Purging";
        const sourcePath = databaseEntry.source.absolutePath;
        const destinationPath = databaseEntry.destination.absolutePath;
        const children = databaseEntry instanceof MappedFile
            ? { files: 1, subdirectories: 0 }
            : databaseEntry.countChildren();
        const files = 1 === children.files ? `${children.files} file` : `${children.files} files`;
        const subdirectories = 1 === children.subdirectories
            ? `${children.subdirectories} subdirectory`
            : `${children.subdirectories} subdirectories`;
        const suffix = databaseEntry instanceof MappedSubdirectory && (children.files || children.subdirectories)
            ? ` (including ${files} and ${subdirectories})`
            : "";
        this.logger.warn(`${prefix} ${sourcePath}${suffix} from the database because ${destinationPath} has vanished`);
        parentDirectory.delete(databaseEntry);
        this.statistics.purged.files.success += children.files;
        this.statistics.purged.directories.success += children.subdirectories;
        if (databaseEntry instanceof MappedDirectoryBase) {
            this.statistics.purged.directories.success += children.subdirectories;
        }
        if (sourceDirent) {
            this.processNewItem(parentDirectory, sourceDirent);
        }
        return true;
    }
    processDeletedFile(parentDirectory, databaseEntry, destinationDirent) {
        parentDirectory.delete(databaseEntry);
        if (destinationDirent) {
            const success = this.fileManager.deleteFile({
                destination: databaseEntry.destination.absolutePath,
                source: databaseEntry.source.absolutePath,
                reason: "because the source file was deleted"
            });
            if (success) {
                this.statistics.deleted.files.success++;
            }
            else {
                this.statistics.deleted.files.failed++;
            }
            return success;
        }
        else {
            this.statistics.purged.files.success++;
            return true;
        }
    }
    processDeletedDirectory(parentDirectory, databaseEntry, destinationDirent) {
        parentDirectory.delete(databaseEntry);
        if (destinationDirent) {
            const destinationChildren = FileUtils.getChildrenIfDirectoryExists(databaseEntry.destination.absolutePath);
            const success1 = this.deleteOrphans(databaseEntry, destinationChildren.map);
            const success2 = this.mapAndReduce(databaseEntry.files.bySourceName.values(), file => {
                const dirent = destinationChildren.map.get(file.destination.name);
                return this.processDeletedFile(databaseEntry, file, dirent);
            });
            const success3 = this.mapAndReduce(databaseEntry.subdirectories.bySourceName.values(), subdirectory => this.syncDirectory(subdirectory));
            const success4 = success1 && success2 && success3 && this.fileManager.deleteDirectory({
                destination: databaseEntry.destination.absolutePath,
                source: databaseEntry.source.absolutePath,
                reason: "because the source directory was deleted"
            });
            if (success4) {
                this.statistics.deleted.directories.success++;
            }
            else {
                this.statistics.deleted.directories.failed++;
            }
            return success4;
        }
        return true;
    }
    processPreexistingItem(parentDirectory, databaseEntry, sourceDirent, destinationDirent) {
        if (sourceDirent.isDirectory() !== destinationDirent.isDirectory()) {
            const success1 = this.processDeletedItem(parentDirectory, databaseEntry, destinationDirent);
            const success2 = this.processNewItem(parentDirectory, sourceDirent);
            return success1 && success2;
        }
        else if (databaseEntry instanceof MappedFile) {
            return this.processPreexistingFile(parentDirectory, databaseEntry, sourceDirent);
        }
        else {
            return this.syncDirectory(databaseEntry);
        }
    }
    processPreexistingFile(parentDirectory, databaseEntry, sourceDirent) {
        const properties = FileUtils.getProperties(databaseEntry.source.absolutePath);
        const hasChanged = databaseEntry.created !== properties.birthtimeMs
            || databaseEntry.modified !== properties.ctimeMs
            || databaseEntry.size !== properties.size;
        if (hasChanged) {
            return this.processModifiedFile(parentDirectory, databaseEntry, sourceDirent, "the source file was modified");
        }
        else {
            return true;
        }
    }
    processModifiedFile(parentDirectory, databaseEntry, sourceDirent, reason) {
        parentDirectory.delete(databaseEntry);
        const deleteSucceeded = this.fileManager.deleteFile({
            destination: databaseEntry.destination.absolutePath,
            source: databaseEntry.source.absolutePath,
            reason: `because ${reason}`,
            suppressConsoleOutput: true
        });
        if (deleteSucceeded) {
            this.statistics.deleted.files.success++;
        }
        else {
            this.statistics.deleted.files.failed++;
        }
        const copySucceeded = !!this.fileManager.zipFile(parentDirectory, sourceDirent);
        if (copySucceeded) {
            this.statistics.copied.files.success++;
        }
        else {
            this.statistics.copied.files.failed++;
        }
        return deleteSucceeded && copySucceeded;
    }
    updateIndex() {
        const { remainingOrphans, isUpToDate } = this.metadataManager.updateIndex(this.database);
        this.statistics.index.hasLingeringOrphans = 0 < remainingOrphans;
        this.statistics.index.isUpToDate = isUpToDate;
        return isUpToDate;
    }
    updateIndexIfRequired() {
        if (this.database.hasUnsavedChanges() && !this.database.wasSavedWithinTheLastSeconds(60)) {
            this.updateIndex();
        }
    }
    recalculateLastFilenames() {
        const message1 = "Found orphans - scanning the destination for filenames to not re-use";
        this.logger.info(message1);
        this.print(message1);
        if (this.updateLastFilenames(this.database)) {
            if (!this.updateIndex()) {
                throw new FriendlyException(`Failed to save the database (see log file for details)`);
            }
        }
        else {
            this.logger.info("Did not find any orphan filenames of concern - no need to update the database");
            this.print("Did not find any orphan filenames of concern");
        }
        const message2 = `Continuing with the ${this.isDryRun ? "dry run" : "synchronization"}`;
        this.logger.info(message2);
        this.print(message2);
    }
    updateLastFilenames(directory) {
        const path = directory.destination.absolutePath;
        if (FileUtils.existsAndIsDirectory(path)) {
            const updatedSubdirectories = directory.subdirectories.byDestinationName.values()
                .map(subdirectory => this.updateLastFilenames(subdirectory))
                .reduce((a, b) => a + b, 0);
            const children = FileUtils.getChildrenIfDirectoryExists(path).array.map(dirent => dirent.name);
            const last = this.context.filenameEnumerator.recalculateLastFilename(directory.last, children);
            if (last === directory.last) {
                return updatedSubdirectories;
            }
            else {
                directory.last = last;
                return updatedSubdirectories + 1;
            }
        }
        else {
            return 0;
        }
    }
}
class WarningsGenerator {
    constructor(context, statistics) {
        this.statistics = statistics;
        this.logger = context.logger;
        this.print = context.print;
        this.isDryRun = context.options.dryRun;
    }
    static run(context, statistics) {
        return new WarningsGenerator(context, statistics).generateWarningsAndGetExitCode();
    }
    generateWarningsAndGetExitCode() {
        const warnings = [
            this.someFilesCouldNotBeCopied(),
            this.someFilesCouldNotBeDeleted(),
            this.orphansWereFound(),
            this.purgeWasNecessary(),
            this.indexArchive(),
            this.unprocessableSourceItems(),
            this.unprocessableDestinationItems(),
        ].flatMap(array => array).sort((a, b) => a.logLevel.index - b.logLevel.index);
        if (warnings.length) {
            warnings.forEach(warning => this.logger.log(warning.logLevel, warning.message));
            this.logger.warn(`Please refer to ${README_URL_WARNINGS} for more details`);
            const logLevel = warnings[0].logLevel;
            this.displayReport(logLevel, warnings.map(warning => warning.message));
            return logLevel === LogLevel.ERROR || LogLevel.WARN ? 1 : 0;
        }
        else {
            if (!this.isDryRun) {
                const message = `The synchronization has completed successfully`;
                this.print(message);
                this.logger.info(message);
            }
            return 0;
        }
    }
    someFilesCouldNotBeCopied() {
        const failedFiles = this.format(this.statistics.copied.files.failed);
        return failedFiles.quantity
            ? this.error(`${failedFiles.asText} could not be copied.`, `${failedFiles.theyOrIt.upperCase} will be retried in the next synchronization run.`, "Until then, the backup is incomplete.")
            : [];
    }
    someFilesCouldNotBeDeleted() {
        const failedFiles = this.format(this.statistics.deleted.files.failed + this.statistics.orphans.files.failed);
        return failedFiles.quantity
            ? this.warning(`${failedFiles.asText} could not be deleted.`, `${failedFiles.theyOrIt.upperCase} will be retried in the next synchronization run.`, "Until then, the backup contains outdated file versions.")
            : [];
    }
    orphansWereFound() {
        const orphans = this.format(this.statistics.orphans.files.total, "orphaned file");
        if (orphans.quantity) {
            const thereAreOrphans = `The previous synchronization left ${orphans.asText} behind.`;
            if (orphans.quantity === this.statistics.orphans.files.failed) {
                return this.warning(thereAreOrphans, `Attempts to delete ${orphans.theyOrIt.lowerCase} have failed.`);
            }
            else if (orphans.quantity === this.statistics.orphans.files.success) {
                const theyWereDeleted = 1 === orphans.quantity
                    ? "It was deleted successfully."
                    : "They were deleted deleted successfully.";
                const theyWouldBeDeleted = 1 === orphans.quantity
                    ? "It would be deleted."
                    : "They would be deleted.";
                return this.info(thereAreOrphans, this.isDryRun ? theyWouldBeDeleted : theyWereDeleted);
            }
            else {
                return this.warning(thereAreOrphans, "Some of them could be deleted but others are still there.");
            }
        }
        else {
            return [];
        }
    }
    purgeWasNecessary() {
        const purged = this.format(this.statistics.purged.files.total);
        const theyWereOrWouldBeRemoved = this.isDryRun
            ? `${purged.theyOrIt.upperCase} would be removed from the database.`
            : `${purged.theyOrIt.upperCase} ${purged.haveOrHas} been removed from the database.`;
        return purged.quantity
            ? this.warning(`There ${purged.wereOrWas} ${purged.asText} that ${purged.haveOrHas} vanished from the destination.`, theyWereOrWouldBeRemoved)
            : [];
    }
    indexArchive() {
        const hasOrphans = this.statistics.index.hasLingeringOrphans;
        const isUpToDate = this.statistics.index.isUpToDate;
        if (!isUpToDate && hasOrphans) {
            return this.error("Failed to update the database.", "The previous one was preserved but is outdated.", "The next synchronization run will delete and re-encrypted all files processed in this run.");
        }
        else if (!isUpToDate && !hasOrphans) {
            return this.error("Failed to save the database.", `The next synchronization run will delete and re-encrypt all files.`);
        }
        else if (isUpToDate && hasOrphans) {
            return this.warning("The database was saved but the old one(s) could not be deleted.", "It will be retried in the next synchronization run");
        }
        else {
            return [];
        }
    }
    unprocessableSourceItems() {
        const unprocessable = this.format(this.statistics.unprocessable.source.symlinks + this.statistics.unprocessable.source.other, "symbolic link or otherwise unprocessable object", "symbolic links or otherwise unprocessable objects");
        return unprocessable.quantity
            ? this.warning(`The source contains ${unprocessable.asText}.`, `${unprocessable.theyOrIt.upperCase} ${unprocessable.isOrAre} ignored and not synchronized.`, "Please refer to the log file for the list of affected links/items.")
            : [];
    }
    unprocessableDestinationItems() {
        const unprocessable = this.format(this.statistics.unprocessable.destination.symlinks + this.statistics.unprocessable.destination.other, "symbolic link or otherwise unprocessable object", "symbolic links or otherwise unprocessable objects");
        return unprocessable.quantity
            ? this.warning(`The destination contains ${unprocessable.asText}.`, `${unprocessable.theyOrIt.upperCase} ${unprocessable.isOrAre} ignored and not synchronized.`, `Please delete ${unprocessable.itOrThem} manually.`, "Refer to the log file for the list of the affected links/items.")
            : [];
    }
    error(...message) {
        return this.as(LogLevel.ERROR, message);
    }
    warning(...message) {
        return this.as(LogLevel.WARN, message);
    }
    info(...message) {
        return this.as(LogLevel.INFO, message);
    }
    as(logLevel, message) {
        return [{ logLevel: logLevel, message: message.join(" ") }];
    }
    format(quantity, singular, plural) {
        const effectiveSingular = singular !== null && singular !== void 0 ? singular : "file";
        const effectivePlural = plural !== null && plural !== void 0 ? plural : `${effectiveSingular}s`;
        return {
            quantity,
            asText: 1 === quantity ? `${quantity} ${effectiveSingular}` : `${quantity} ${effectivePlural}`,
            theyOrIt: {
                lowerCase: 1 === quantity ? "it" : "they",
                upperCase: 1 === quantity ? "It" : "They",
            },
            haveOrHas: 1 === quantity ? "has" : "have",
            wereOrWas: 1 === quantity ? "was" : "were",
            isOrAre: 1 === quantity ? "is" : "are",
            itOrThem: 1 === quantity ? "it" : "them",
        };
    }
    displayReport(logLevel, messages) {
        this.displayBanner(logLevel);
        messages.forEach((message, index) => this.displayMessage(message, index, messages.length));
        this.print("");
        this.print(`See ${README_URL_WARNINGS}`);
    }
    displayBanner(logLevel) {
        this.print("");
        this.print("--------------------------------------------------------------------------------");
        this.print(logLevel === LogLevel.ERROR ? "ERROR" : "Warning");
        this.print("--------------------------------------------------------------------------------");
    }
    displayMessage(message, index, total) {
        this.print("");
        const useNumbering = 1 < total;
        message = (useNumbering ? `${index + 1}. ${message}` : message).trim();
        const indent = useNumbering ? "   " : "";
        while (message) {
            const originalMessageLength = message.length;
            if (80 < originalMessageLength) {
                for (let position = Math.min(80, originalMessageLength - 2); 0 <= position; position--) {
                    if (" " === message.charAt(position)) {
                        this.print(message.substring(0, position));
                        message = indent + message.substring(position + 1).trim();
                        break;
                    }
                }
            }
            if (message.length === originalMessageLength) {
                this.print(message);
                message = "";
            }
        }
    }
}
function tryCatchIgnore(action) {
    try {
        return Optional.of(action());
    }
    catch (ignored) {
        return Optional.empty();
    }
}
function tryCatchRethrowFriendlyException(action, getErrorMessage) {
    try {
        return action();
    }
    catch (exception) {
        throw new FriendlyException(getErrorMessage(firstLineOnly(exception)));
    }
}
function rethrow(exception, getErrorMessage) {
    if (exception instanceof Error) {
        exception.message = getErrorMessage(exception.message);
        throw exception;
    }
    else {
        throw new Error(getErrorMessage(`${exception}`));
    }
}
function firstLineOnly(exception) {
    return `${exception}`.replace(/[\r\n].*$/m, "");
}
class FileUtils {
    static exists(path) {
        return node.fs.existsSync(path);
    }
    static existsAndIsFile(path) {
        return this.exists(path) && this.getProperties(path).isFile();
    }
    static existsAndIsDirectory(path) {
        return this.exists(path) && this.getProperties(path).isDirectory();
    }
    static getProperties(path) {
        return node.fs.lstatSync(path);
    }
    static getParent(path) {
        return node.path.dirname(path);
    }
    static normalize(path) {
        return node.path.normalize(path);
    }
    static resolve(configFile, path) {
        if (node.path.isAbsolute(path)) {
            return node.path.normalize(path);
        }
        else {
            return node.path.normalize(node.path.join(configFile, "..", path));
        }
    }
    static getAbsolutePath(path) {
        return node.path.resolve(path);
    }
    static isParentChild(parent, child) {
        return this.getAbsolutePath(child).startsWith(this.getAbsolutePath(parent) + node.path.sep);
    }
    static equals(path1, path2) {
        return this.getAbsolutePath(path1) === this.getAbsolutePath(path2);
    }
    static getChildren(directory) {
        const array = node.fs.readdirSync(directory, { withFileTypes: true });
        const map = new Map();
        array.forEach(item => map.set(item.name, item));
        return { array, map };
    }
    static getChildrenIfDirectoryExists(directory) {
        return this.exists(directory) ? this.getChildren(directory) : { array: [], map: new Map() };
    }
}
class LogLevel {
    constructor(index, paddedName) {
        this.index = index;
        this.paddedName = paddedName;
    }
}
LogLevel.ERROR = new LogLevel(1, "ERROR  ");
LogLevel.WARN = new LogLevel(2, "WARNING");
LogLevel.INFO = new LogLevel(3, "INFO   ");
LogLevel.DEBUG = new LogLevel(4, "DEBUG  ");
class Logger {
    constructor(logLevel, outputStream) {
        this.logLevel = logLevel;
        this.outputStream = outputStream;
    }
    debug(...message) {
        this.formatAndAppend(LogLevel.DEBUG, message);
    }
    info(...message) {
        this.formatAndAppend(LogLevel.INFO, message);
    }
    warn(...message) {
        this.formatAndAppend(LogLevel.WARN, message);
    }
    error(...message) {
        this.formatAndAppend(LogLevel.ERROR, message);
    }
    log(logLevel, ...message) {
        this.formatAndAppend(logLevel, message);
    }
    separator() {
        this.outputStream.log(Logger.SEPARATOR);
    }
    formatAndAppend(logLevel, messages) {
        if (logLevel.index <= this.logLevel.index) {
            this.outputStream.logAligned(Logger.PADDING, Logger.getCurrentTimestamp(), logLevel.paddedName, ...messages);
        }
    }
    static getCurrentTimestamp() {
        const now = new Date();
        return [
            this.formatNumber(now.getFullYear(), 4),
            "-",
            this.formatNumber(now.getMonth() + 1, 2),
            "-",
            this.formatNumber(now.getDate(), 2),
            " ",
            this.formatNumber(now.getHours(), 2),
            ":",
            this.formatNumber(now.getMinutes(), 2),
            ":",
            this.formatNumber(now.getSeconds(), 2),
            ".",
            this.formatNumber(now.getMilliseconds(), 3),
        ].join("");
    }
    static formatNumber(number, length) {
        const result = number.toFixed(0);
        return "00000000000000000000".substring(0, Math.max(0, length - result.length)) + result;
    }
    static purge(file, numberOfSectionsToKeep) {
        return __awaiter(this, void 0, void 0, function* () {
            if (FileUtils.existsAndIsFile(file)) {
                const actualNumberOfSections = yield this.countSeparators(file);
                if (numberOfSectionsToKeep < actualNumberOfSections) {
                    yield this.removeSections(file, actualNumberOfSections - numberOfSectionsToKeep);
                }
            }
        });
    }
    static countSeparators(file) {
        return __awaiter(this, void 0, void 0, function* () {
            let count = 0;
            const io = node.readline.createInterface({
                input: node.fs.createReadStream(file),
                output: process.stdout,
                terminal: false
            });
            io.on("line", line => count += this.isSeparator(line) ? 1 : 0);
            return new Promise(resolve => {
                io.on("close", () => resolve(count));
            });
        });
    }
    static isSeparator(line) {
        return line === Logger.SEPARATOR;
    }
    static removeSections(file, numberOfSectionsToRemove) {
        return __awaiter(this, void 0, void 0, function* () {
            const tmpFile = `${file}~`;
            const outputStream = new FileOutputStream(tmpFile, false);
            const readline = node.readline.createInterface({
                input: node.fs.createReadStream(file),
                output: node.process.stdout,
                terminal: false
            });
            readline.on("line", line => {
                if (this.isSeparator(line)) {
                    numberOfSectionsToRemove--;
                }
                if (numberOfSectionsToRemove < 0) {
                    outputStream.log(line);
                }
            });
            return new Promise(resolve => {
                readline.on('close', () => {
                    resolve();
                });
            }).then(() => {
                node.fs.rmSync(file);
                node.fs.renameSync(tmpFile, file);
            });
        });
    }
}
Logger.SEPARATOR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(() => "----------").join("");
Logger.PADDING = "\n                              ";
const node = (() => ({
    crypto: require("crypto"),
    child_process: require("child_process"),
    fs: require("fs"),
    os: require("os"),
    path: require("path"),
    process: require("process"),
    readline: require("readline")
}))();
class OutputStream {
    log(...data) {
        this.write(data.map(item => "object" === typeof item ? JSON.stringify(item, undefined, 4) : `${item}`).join(" "));
    }
    logAligned(padding, ...data) {
        const text = data.map(item => "object" === typeof item ? JSON.stringify(item, undefined, 4) : `${item}`)
            .join(" ")
            .split(/\r?\n/)
            .join(padding);
        this.write(text);
    }
    write(_data) {
    }
    close() {
    }
}
class NullOutputStream extends OutputStream {
}
class ConsoleOutputStream extends OutputStream {
    write(line) {
        console.log(line);
    }
}
class FileOutputStream extends OutputStream {
    constructor(file, append) {
        super();
        this.file = file;
        try {
            this.fileDescriptor = node.fs.openSync(file, append ? "a" : "w");
        }
        catch (exception) {
            throw new FriendlyException(`Failed to open log file ${file}: ${exception}`);
        }
    }
    write(line) {
        try {
            node.fs.writeSync(this.fileDescriptor, `${line}\n`);
        }
        catch (exception) {
            throw new FriendlyException(`Failed to write to log file ${this.file}: ${firstLineOnly(exception)}`);
        }
    }
    close() {
        node.fs.closeSync(this.fileDescriptor);
    }
}
class PasswordHelper {
    static createSaltedHash(password) {
        return this.createHash(node.crypto.randomBytes(16).toString("hex"), password);
    }
    static validatePassword(password, saltedHash) {
        return saltedHash === this.createHash(saltedHash.replace(/:.*/, ""), password);
    }
    static createHash(salt, password) {
        const hash = node.crypto.scryptSync(password, salt, 64, { N: 1024 }).toString("base64");
        return `${salt}:${hash}`;
    }
}
function readonly(object) {
    return object;
}
