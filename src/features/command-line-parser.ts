//----------------------------------------------------------------------------------------------------------------------
// Parse the command line
//----------------------------------------------------------------------------------------------------------------------

class CommandLineParser {

    //------------------------------------------------------------------------------------------------------------------
    // Default values
    //------------------------------------------------------------------------------------------------------------------

    private static readonly DEFAULT_CONFIG_FILE = "7-sync.json";
    private static readonly DEFAULT_7_ZIP_EXECUTABLE = "7z";

    //------------------------------------------------------------------------------------------------------------------
    // Options
    //------------------------------------------------------------------------------------------------------------------

    private static readonly OPTIONS = {
        config: "config",
        dryRun: "dry-run",
        sevenZip: "7-zip",
        silent: "silent",
        help: "help",
        version: "version",
        debug: "debug"
    }

    //------------------------------------------------------------------------------------------------------------------
    // Default options per command
    //------------------------------------------------------------------------------------------------------------------

    private static readonly SHARED_DEFAULT_OPTIONS: SharedOptions = {
        config: this.DEFAULT_CONFIG_FILE,
        debug: false,
        silent: false
    };

    private static readonly DEFAULT_OPTIONS: { [index: string]: TaskOptions } = {
        sync: this.as<SyncOptions>({
            command: "sync",
            ...this.SHARED_DEFAULT_OPTIONS,
            dryRun: false,
            sevenZip: this.DEFAULT_7_ZIP_EXECUTABLE
        }),
        init: this.as<InitOptions>({
            command: "init",
            ...this.SHARED_DEFAULT_OPTIONS
        }),
        changePassword: this.as<ChangePasswordOptions>({
            command: "change-password",
            ...this.SHARED_DEFAULT_OPTIONS
        })
    }

    //------------------------------------------------------------------------------------------------------------------
    // Usage information
    //------------------------------------------------------------------------------------------------------------------

    private static showUsageAndExit(): never {
        this.exitWithMessage(`
              Replicate a file and directory structure using 7-zip.
            |
            | Usage: 7-sync [command] [options]
            |
            | Commands:
            |
            |   ${this.DEFAULT_OPTIONS.sync.command}                        sync files (or perform a dry run)
            |   ${this.DEFAULT_OPTIONS.init.command}                        create a new configuration file
            |   ${this.DEFAULT_OPTIONS.changePassword.command}             change the password
            |
            | Options:
            |
            |   --${this.OPTIONS.config}=<CONFIG_JSON>      use the given configuration file (default: ${this.DEFAULT_CONFIG_FILE})
            |   --${this.OPTIONS.dryRun}                   perform a trial run without making any changes
            |   --${this.OPTIONS.sevenZip}=<7_ZIP_EXECUTABLE>  the 7-Zip executable to use
            |   --${this.OPTIONS.silent}                    suppress console output
            |   --${this.OPTIONS.debug}                     enable verbose log file output
            |
            |   --${this.OPTIONS.help}                      display this help and exit
            |   --${this.OPTIONS.version}                   display version information and exit
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
        if (argv.filter(parameter => parameter.match(/^-?-?v(version)?$/)).length) {
            this.showVersionAndExit();
        } else if (argv.filter(parameter => parameter.match(/^-?-?h(elp)?$/)).length) {
            this.showUsageAndExit();
        }
        const { commands, options } = this.splitParameters(argv);
        if (0 === commands.length) {
            this.exitWithError('missing command');
        } else if (1 < commands.length) {
            this.exitWithError('more than one command');
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
        argv.forEach(argument => {
            if (argument.startsWith("--")) {
                const index = argument.indexOf("=");
                if (3 <= index) {
                    options.set(argument.substring(2, index).trim(), argument.substring(index + 1).trim());
                } else {
                    options.set(argument.substring(2).trim(), true);
                }
            } else {
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
            this.setOption(mergedOptions, suppliedKey, suppliedValue);
        });
        return mergedOptions;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the default option values for the given command
    //------------------------------------------------------------------------------------------------------------------

    private static getDefaultOptions(command: string) {
        const defaultOptions = this.DEFAULT_OPTIONS[this.getInternalKey(this.DEFAULT_OPTIONS, command)];
        if (defaultOptions) {
            return defaultOptions;
        } else {
            this.exitWithError(`internal error - no default options for command ${command}`);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Set a single option value
    //------------------------------------------------------------------------------------------------------------------

    private static setOption(defaultOptions: object, suppliedKey: string, suppliedValue: any) {
        const defaultKey = this.getInternalKey(this.OPTIONS, suppliedKey);
        if ("command" === suppliedKey || !(defaultKey in defaultOptions)) {
            this.exitWithError(`invalid option --${suppliedKey}`);
        }
        const defaultValue = (defaultOptions as any)[defaultKey];
        if ("boolean" === typeof defaultValue) {
            if ("boolean" !== typeof suppliedValue) {
                console.log(suppliedValue);
                this.exitWithError(`option --${suppliedKey} doesn't take an argument`);
            }
        } else {
            if ("string" !== typeof suppliedValue) {
                this.exitWithError(`option --${suppliedKey} requires a value`);
            }
        }
        (defaultOptions as any)[defaultKey] = suppliedValue;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the internal key for a command or option (e.g. 7-zip => sevenZip)
    //------------------------------------------------------------------------------------------------------------------

    private static getInternalKey(mapping: { [index: string]: string }, suppliedKey: string): string
    private static getInternalKey(mapping: { [index: string]: { command: string } }, suppliedKey: string): string
    private static getInternalKey(mapping: { [index: string]: string | { command: string } }, suppliedKey: string) {
        let isOption = false;
        for (const internalKey of Object.keys(mapping)) {
            const mappedValue = mapping[internalKey];
            isOption = "string" !== typeof mappedValue;
            const externalKey = "string" === typeof mappedValue ? mappedValue : mappedValue.command;
            if (suppliedKey === externalKey) {
                return internalKey;
            }
        }
        this.exitWithError(`invalid ${isOption ? "option --" : "command "}${suppliedKey}`);
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
            7-sync: ${message}
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
