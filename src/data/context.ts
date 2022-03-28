//----------------------------------------------------------------------------------------------------------------------
// Contextual data and helpers configuration and loggers
//----------------------------------------------------------------------------------------------------------------------

class Context {

    public readonly print;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    private constructor(
        public readonly options: SyncOptions,
        public readonly config: JsonConfig,
        public readonly files: { config: string, database: string, log: string },
        public readonly logger: Logger,
        public readonly console: OutputStream,
        public readonly filenameEnumerator: FilenameEnumerator,
        public readonly sevenZip: SevenZip
    ) {
        this.print = (message: string) => this.console.log(message);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Factory method
    //------------------------------------------------------------------------------------------------------------------

    public static async of(options: SyncOptions) {
        const password = options.password ?? node.process.env["7_SYNC_PASSWORD"];
        delete options.password;
        const console = options.silent ? new NullOutputStream() : new ConsoleOutputStream();
        const files = Context.getFileNames(options.config);
        await Logger.purge(files.log, 9);
        const logger = Context.getLogger(files.log, false);
        logger.separator();
        try {
            logger.info(`7-sync started in ${FileUtils.getAbsolutePath(".")}`);
            const config = Context.getConfig(files.config, options, logger);
            const validatedPassword = await this.validateOrPromptForPassword(config.password, password);
            const sevenZip = new SevenZip(config.sevenZip, validatedPassword, logger);
            const filenameEnumerator = new FilenameEnumerator(logger);
            logger.info(`Source .......... ${config.source}`);
            logger.info(`Destination ..... ${config.destination}`);
            logger.info(`Configuration ... ${FileUtils.getAbsolutePath(files.config)}`);
            logger.info(`Log file ........ ${FileUtils.getAbsolutePath(files.log)}`);
            logger.info(`Database ........ ${FileUtils.getAbsolutePath(files.database)}`);
            logger.info(`7-Zip command ... ${config.sevenZip}`);
            logger.info(`Dry-run ......... ${options.dryRun}`);
            return new Context(options, config, files, logger, console, filenameEnumerator, sevenZip);
        } catch (exception) {
            logger.error(exception instanceof FriendlyException ? exception.message : firstLineOnly(exception));
            throw exception;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Validate the config file name
    //------------------------------------------------------------------------------------------------------------------

    private static getFileNames(configFile: string) {
        const result = ConfigValidator.validateConfigFile(configFile, true);
        if (true === result) {
            return {
                config: FileUtils.getAbsolutePath(configFile),
                database: FileUtils.getAbsolutePath(FileUtils.resolve(configFile, configFile.replace(/(\.cfg)?$/, ".db"))),
                log: FileUtils.getAbsolutePath(FileUtils.resolve(configFile, configFile.replace(/(\.cfg)?$/, ".log")))
            };
        } else {
            throw new FriendlyException(result);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Initialize the logger
    //------------------------------------------------------------------------------------------------------------------

    private static getLogger(file: string, verbose: boolean) {
        return new Logger(verbose ? LogLevel.DEBUG : LogLevel.INFO, new FileOutputStream(file, true));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Load and validate the configuration - and overlay it with command line options
    //------------------------------------------------------------------------------------------------------------------

    private static getConfig(configFile: string, options: SyncOptions, logger: Logger) {
        const json = JsonLoader.loadAndValidateConfig(options, logger).finalConfig;
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

    private static async validateOrPromptForPassword(saltedHash: string, password?: string) {
        password = password ?? await this.promptForPassword(saltedHash);
        if (!PasswordHelper.validatePassword(password, saltedHash)) {
            throw new FriendlyException("Invalid password");
        }
        return password;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Prompt for the password
    //------------------------------------------------------------------------------------------------------------------

    private static async promptForPassword(saltedHash: string) {
        return InteractivePrompt.prompt({
            question: "Please enter the password.",
            isPassword: true,
            validate: input => {
                console.log("");
                const isCorrect = PasswordHelper.validatePassword(input, saltedHash);
                if (!isCorrect) {
                    console.log("Invalid password. Please try again.");
                }
                return isCorrect;
            }
        });
    }
}
