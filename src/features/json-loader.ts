class JsonLoader {

    //------------------------------------------------------------------------------------------------------------------
    // Load and validate a JSON configuration
    //------------------------------------------------------------------------------------------------------------------

    public static loadAndValidateConfig(options: TaskOptions, logger: Logger) {
        const file = options.config;
        if (!FileUtils.existsAndIsFile(file)) {
            throw new FriendlyException(`Configuration file ${file} does not exist`);
        }
        try {
            if (!options.config.endsWith(".cfg")) {
                throw new FriendlyException(`The configuration file ${options.config} does not end with .cfg`);
            }
            logger.info(`Loading configuration file ${file}`);
            const originalConfig = this.loadFile<JsonConfig>(options.config);
            logger.debug("Loaded configuration:", originalConfig);
            logger.info("Validating the configuration");
            JsonValidator.validateConfig(originalConfig);
            logger.info("Merging the configuration with the current command line options");
            const mergedConfig = { ...originalConfig };
            this.overwriteConfigWithCommandLineOptions(mergedConfig, options);
            logger.debug("Merged configuration:", mergedConfig);
            logger.info("Validating the merged configuration");
            JsonValidator.validateConfig(mergedConfig);
            logger.debug("Finished loading the configuration");
            return { originalConfig, mergedConfig };
        } catch (exception) {
            if (exception instanceof FriendlyException) {
                exception.prependMessage(`Failed to load configuration file ${file}:`);
            }
            throw exception;
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
    // Load and validate a JSON registry
    //------------------------------------------------------------------------------------------------------------------

    // public static loadAndValidateRegistry(file: string, logger: Logger, console: OutputStream) {
    //     return this.loadAndValidateFile(file, JsonValidator.validateRegistry, "registry", logger, console);
    // }

    //------------------------------------------------------------------------------------------------------------------
    // Load and validate a JSON file
    //------------------------------------------------------------------------------------------------------------------

    private static loadFile<T>(file: string): T {
        try {
            return JSON.parse(node.fs.readFileSync(file).toString()) as T;
        } catch (exception) {
            throw new FriendlyException(firstLineOnly(`${exception}`));
        }
    }
}
