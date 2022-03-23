class JsonLoader {

    //------------------------------------------------------------------------------------------------------------------
    // Load and validate a JSON configuration
    //------------------------------------------------------------------------------------------------------------------

    public static loadAndValidateConfig(options: TaskOptions, logger: Logger) {
        const file = options.config;
        if (!FileUtils.existsAndIsFile(file)) {
            throw new FriendlyException(`Configuration file ${file} does not exist`);
        }
        if (!file.endsWith(".cfg")) {
            throw new FriendlyException(`The configuration file ${file} does not end with .cfg`);
        }
        try {
            logger.debug(`Loading configuration file ${FileUtils.getAbsolutePath(file)}`);
            const originalConfig = this.loadFile<JsonConfig>(file);
            logger.debug(originalConfig);
            logger.debug("Applying command line parameters");
            logger.debug(options);
            logger.debug("Merging configuration and command line parameters");
            const mergedConfig = { ...originalConfig };
            this.overwriteConfigWithCommandLineOptions(mergedConfig, options);
            logger.debug(mergedConfig);
            logger.debug("Converting relative paths to absolute paths");
            const finalConfig = {
                ...mergedConfig,
                source: FileUtils.getAbsolutePath(FileUtils.resolve(file, mergedConfig.source)),
                destination: FileUtils.getAbsolutePath(FileUtils.resolve(file, mergedConfig.destination)),
            }
            logger.debug(finalConfig);
            logger.debug("Validating the configuration");
            JsonValidator.validateConfig(finalConfig);
            return { originalConfig, finalConfig };
        } catch (exception) {
            rethrowWithPrefix(`Failed to load configuration file ${file}:`, exception);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Overwrite the loaded configuration with command line options (if/as supplied)
    //------------------------------------------------------------------------------------------------------------------

    private static overwriteConfigWithCommandLineOptions(config: any, options: any) {
        for (const key of Object.keys(options)) {
            if (Object.prototype.hasOwnProperty.call(config, key) && undefined !== options[key]) {
                config[key] = options[key];
            }
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Load and validate a JSON database
    //------------------------------------------------------------------------------------------------------------------

    public static loadAndValidateDatabase(context: Context) {
        const file = context.files.database;
        if (FileUtils.exists(file)) {
            if (!FileUtils.existsAndIsFile(file)) {
                throw new FriendlyException(`${file} is not a file`);
            } else {
                context.logger.info(`Loading database ${file}`);
                context.print("Loading database");
                try {
                    const database = this.loadFile<JsonDatabase>(file);
                    JsonValidator.validateDatabase(database);
                    return database;
                } catch (exception) {
                    rethrowWithPrefix(`Failed to load database ${file}:`, exception);
                }
            }
        } else {
            context.logger.info(`${file} does not exist - starting with an empty database`);
            const next = context.filenameEnumerator.getNextFilename()
            const emptyDatabase: JsonDatabase = { directories: [], files: [], next };
            return emptyDatabase;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Load and validate a JSON file
    //------------------------------------------------------------------------------------------------------------------

    private static loadFile<T>(file: string): T {
        try {
            return JSON.parse(node.fs.readFileSync(file).toString()) as T;
        } catch (exception) {
            throw new FriendlyException(firstLineOnly(exception));
        }
    }
}
