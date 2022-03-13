//----------------------------------------------------------------------------------------------------------------------
// Contextual data and helpers configuration and loggers
//----------------------------------------------------------------------------------------------------------------------

class Context {

    //------------------------------------------------------------------------------------------------------------------
    // Initialisation
    //------------------------------------------------------------------------------------------------------------------

    private constructor(
        public readonly options: SyncOptions,
        public readonly config: JsonConfig,
        public readonly files: { config: string, database: string, logfile: string },
        public readonly logger: Logger,
        public readonly console: OutputStream,
        public readonly sevenZip: SevenZip
    ) { }

    //------------------------------------------------------------------------------------------------------------------
    // Factory method
    //------------------------------------------------------------------------------------------------------------------

    public static async of(options: SyncOptions) {
        const password = options.password ?? node.process.env["7_SYNC_PASSWORD"];
        delete options.password;
        const console = options.silent ? new NullOutputStream() : new ConsoleOutputStream();
        const files = Context.getFileNames(options.config);
        await Logger.purge(files.logfile, 4);
        const logger = Context.getLogger(files.logfile, options.verbose);
        logger.separator();
        const config = Context.getConfig(files.config, options, logger);
        const sevenZip = new SevenZip(config.sevenZip, await this.getPassword(config.password, password));
        return new Context(options, config, files, logger, console, sevenZip);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Validate the config file name
    //------------------------------------------------------------------------------------------------------------------

    private static getFileNames(configFile: string) {
        const result = ConfigValidator.validateConfigFile(configFile, true);
        if (true === result) {
            return {
                config: configFile,
                database: configFile.replace(/(\.cfg)?$/, ".db"),
                logfile: configFile.replace(/(\.cfg)?$/, ".log")
            };
        } else {
            throw new FriendlyException(result);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Initialise the logger
    //------------------------------------------------------------------------------------------------------------------

    private static getLogger(file: string, verbose: boolean) {
        return new Logger(verbose ? LogLevel.DEBUG : LogLevel.INFO, new FileOutputStream(file, true));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Load and validate the configuration - and overlay it with command line options
    //------------------------------------------------------------------------------------------------------------------

    private static getConfig(configFile: string, options: SyncOptions, logger: Logger) {
        const json = JsonLoader.loadAndValidateConfig(options, logger).mergedConfig;
        const validationResult = ConfigValidator.validate(configFile, json);
        if (true === validationResult) {
            return json;
        } else {
            throw new FriendlyException(`Invalid configuration: ${validationResult}`);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Obtain the password
    //------------------------------------------------------------------------------------------------------------------

    private static async getPassword(saltedHash: string, password?: string) {
        if (undefined === password) {
            password = await InteractivePrompt.prompt({
                question: "Please enter the password.",
                isPassword: true,
                validate: password => {
                    const isCorrect = PasswordHelper.validatePassword(password, saltedHash);
                    if (!isCorrect) {
                        console.log("");
                        console.log("Invalid password. Please try again.");
                    }
                    return isCorrect;
                }
            });
            console.log("");
            console.log("test");
        }
        if (!PasswordHelper.validatePassword(password, saltedHash)) {
            throw new FriendlyException("Invalid password");
        }
        return password;
    }
}
