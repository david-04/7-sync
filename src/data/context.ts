//----------------------------------------------------------------------------------------------------------------------
// Contextual data and helpers configuration and loggers
//----------------------------------------------------------------------------------------------------------------------

class Context {

    public readonly files;
    public readonly config;
    public readonly logger;
    public readonly console;

    //------------------------------------------------------------------------------------------------------------------
    // Initialisation
    //------------------------------------------------------------------------------------------------------------------

    public constructor(public readonly options: SyncOptions) {
        this.files = Context.getFileNames(options.config);
        this.console = options.silent ? new NullOutputStream() : new ConsoleOutputStream();
        this.logger = Context.getLogger(this.files.logfile, options.verbose);
        this.logger.separator();
        this.config = Context.getConfig(this.files.config, options, this.logger, this.console);
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

    private static getConfig(configFile: string, options: SyncOptions, logger: Logger, console: OutputStream) {
        console.log(`Loading config file ${configFile}`);
        const json = JsonLoader.loadAndValidateConfig(options, logger).mergedConfig;
        const validationResult = ConfigValidator.validate(configFile, json);
        if (true === validationResult) {
            return json;
        } else {
            throw new FriendlyException(`Invalid configuration: ${validationResult}`);
        }
    }
}
