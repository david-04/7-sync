//----------------------------------------------------------------------------------------------------------------------
// Parse the command line
//----------------------------------------------------------------------------------------------------------------------

class CommandLineParser {

    //------------------------------------------------------------------------------------------------------------------
    // Default values
    //------------------------------------------------------------------------------------------------------------------

    private static readonly DEFAULT_CONFIG_FILE = "7-sync.cfg";
    public static readonly DEFAULT_7_ZIP_EXECUTABLE = "7z";

    //------------------------------------------------------------------------------------------------------------------
    // Options
    //------------------------------------------------------------------------------------------------------------------

    private static readonly OPTIONS = {
        config: "config",
        dryRun: "dry-run",
        password: "password", //NOSONAR This is not an actual password
        parallel: "parallel",
        sevenZip: "7-zip",
        silent: "silent",
        help: "help",
        version: "version"
    };

    //------------------------------------------------------------------------------------------------------------------
    // Default options per command
    //------------------------------------------------------------------------------------------------------------------

    private static readonly SHARED_DEFAULT_OPTIONS: SharedOptions = {
        config: this.DEFAULT_CONFIG_FILE
    };

    public static readonly DEFAULT_OPTIONS = {
        sync: this.as<Readonly<SyncOptions>>({
            command: "sync",
            ...this.SHARED_DEFAULT_OPTIONS,
            dryRun: false,
            password: undefined,
            sevenZip: undefined,
            silent: false,
            parallel: 1
        }),
        init: this.as<Readonly<InitOptions>>({
            command: "init",
            ...this.SHARED_DEFAULT_OPTIONS,
        }),
        reconfigure: this.as<Readonly<ReconfigureOptions>>({
            command: "reconfigure",
            ...this.SHARED_DEFAULT_OPTIONS
        })
    };

    //------------------------------------------------------------------------------------------------------------------
    // Usage information
    //------------------------------------------------------------------------------------------------------------------

    private static showUsageAndExit(): never {
        const configFile = this.DEFAULT_CONFIG_FILE;
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
            |   --${this.OPTIONS.config}=<CONFIG_FILE>      use the given configuration file (default: ${configFile})
            |   --${this.OPTIONS.dryRun}                   perform a trial run without making any changes
            |   --${this.OPTIONS.help}                      display this help and exit
            |   --${this.OPTIONS.parallel}=<NO_OF_JOBS>     run multiple 7-Zip instances in parallel (default: 1)
            |   --${this.OPTIONS.password}=<PASSWORD>       use this password instead of prompting for it
            |   --${this.OPTIONS.silent}                    suppress console output
            |   --${this.OPTIONS.version}                   display version information and exit
            |
            | The password can also be stored as environment variable SEVEN_SYNC_PASSWORD.
            |
            | Full documentation: ${README_URL_BASE}
        `.trim().replace(/^\s+/gm, "").replace(/^\| ?/gm, ""));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Version information
    //------------------------------------------------------------------------------------------------------------------

    private static showVersionAndExit(): never {
        this.exitWithMessage(`
            7-sync ${APPLICATION_VERSION}
            Copyright (c) ${COPYRIGHT_YEARS} ${COPYRIGHT_OWNER}
            License: MIT <https://opensource.org/licenses/MIT>
        `.trim().replace(/^\s+/gm, ""));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Parse the command line
    //------------------------------------------------------------------------------------------------------------------

    public static parse(argv: string[]) {
        if (argv.filter(parameter => parameter.match(/^--?(v|version)$/)).length) {
            return this.showVersionAndExit();
        } else if (argv.filter(parameter => parameter.match(/^--?(h|help)$/)).length) {
            return this.showUsageAndExit();
        }
        const { commands, options } = this.splitParameters(argv);
        if (0 === commands.length) {
            return this.exitWithError("Missing command");
        } else if (1 < commands.length) {
            return this.exitWithError(`More than one command specified: ${commands.join(", ")}`);
        } else {
            return this.assembleOptions(commands[0], options);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Separate arguments from options and extract option values
    //------------------------------------------------------------------------------------------------------------------

    private static splitParameters(argv: string[]) {
        const options = new Map<string, string | true>();
        const commands = new Array<string>();
        const prefix = "--";
        const separator = "=";
        const minLength = prefix.length + separator.length;
        argv.forEach(argument => {
            if (argument.startsWith(prefix)) {
                const index = argument.indexOf(separator);
                const key = minLength <= index
                    ? argument.substring(prefix.length, index).trim()
                    : argument.substring(prefix.length).trim();
                const value = minLength <= index ? argument.substring(index + separator.length) : true;
                options.set(key, "string" === typeof value && this.OPTIONS.password !== key ? value.trim() : value);
            } else {
                this.getInternalKey(this.DEFAULT_OPTIONS, argument, false);
                commands.push(argument);
            }
        });
        return { options, commands };
    }

    //------------------------------------------------------------------------------------------------------------------
    // Assemble options for the operation, incorporating default settings
    //------------------------------------------------------------------------------------------------------------------

    private static assembleOptions(command: string, suppliedOptions: Map<string, string | boolean>) {
        const mergedOptions = { ...this.getDefaultOptions(command) };
        suppliedOptions.forEach((suppliedValue, suppliedKey) => {
            this.setOption(command, mergedOptions, suppliedKey, suppliedValue);
        });
        return mergedOptions;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the default option values for the given command
    //------------------------------------------------------------------------------------------------------------------

    private static getDefaultOptions(command: string) {
        const defaultOptionsMap: { [index: string]: TaskOptions; } = this.DEFAULT_OPTIONS;
        const defaultOptions = defaultOptionsMap[this.getInternalKey(this.DEFAULT_OPTIONS, command, false)];
        return defaultOptions
            ? defaultOptions
            : this.exitWithError(`Internal error - no default options for command "${command}"`);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Set a single option value
    //------------------------------------------------------------------------------------------------------------------

    private static setOption(
        command: string, defaultOptions: object, suppliedKey: string, suppliedValue: boolean | string
    ) {
        const defaultKey = this.getInternalKey(this.OPTIONS, suppliedKey, true);
        if ("command" === suppliedKey || !(defaultKey in defaultOptions)) {
            this.exitWithError(`Command "${command}" does not support option --${suppliedKey}`);
        }
        const defaultValue = asAny(defaultOptions)[defaultKey];
        if ("boolean" === typeof defaultValue) {
            if ("boolean" !== typeof suppliedValue) {
                this.exitWithError(`Option --${suppliedKey} can't have a value assigned`);
            }
        } else {
            if ("string" !== typeof suppliedValue || !suppliedValue) {
                this.exitWithError(`Option --${suppliedKey} requires a value`);
            }
        }
        if ("number" === typeof defaultValue) {
            const parsedNumber = parseInt(asAny(suppliedValue));
            if (isNaN(parsedNumber)) {
                this.exitWithError(`Invalid value for --${suppliedKey} (${suppliedValue} is not a number)`);
            }
            if (suppliedKey === this.OPTIONS.parallel && parsedNumber < 1) {
                this.exitWithError(`Invalid value for --${suppliedKey} (it must be 1 or greater)`);
            }
            asAny(defaultOptions)[defaultKey] = parsedNumber;
        } else {
            asAny(defaultOptions)[defaultKey] = suppliedValue;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the internal key for a command or option (e.g. 7-zip => sevenZip)
    //------------------------------------------------------------------------------------------------------------------

    private static getInternalKey(mapping: { [index: string]: string; }, suppliedKey: string, isOption: true): string;
    private static getInternalKey(
        mapping: { [index: string]: { command: string; }; }, suppliedKey: string, isOption: false
    ): string;
    private static getInternalKey(
        mapping: { [index: string]: string | { command: string; }; }, suppliedKey: string, isOption: boolean
    ) {
        for (const internalKey of Object.keys(mapping)) {
            const mappedValue = mapping[internalKey];
            const externalKey = "string" === typeof mappedValue ? mappedValue : mappedValue.command;
            if (suppliedKey === externalKey) {
                return internalKey;
            }
        }
        if (isOption) {
            return this.exitWithError(`Invalid option --${suppliedKey}`);
        } else {
            return this.exitWithError(`Invalid argument "${suppliedKey}"`);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // A less verbose way to add typed object literals as object properties
    //------------------------------------------------------------------------------------------------------------------

    private static as<T>(value: T): T {
        return value;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Show an error message and exit with exit code 1
    //------------------------------------------------------------------------------------------------------------------

    private static exitWithError(message: string): never {
        throw new FriendlyException(`
            ${message}
            Try '7-sync --${this.OPTIONS.help}' for more information
        `.trim().replace(/^\s+/gm, ""));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Show a message and exit with exit code 0
    //------------------------------------------------------------------------------------------------------------------

    private static exitWithMessage(message: string): never {
        throw new FriendlyException(message, 0);
    }
}
