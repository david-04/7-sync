class JsonParser {

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
            };
            logger.debug(finalConfig);
            logger.debug("Validating the configuration");
            JsonValidator.validateConfig(finalConfig);
            return { originalConfig, finalConfig };
        } catch (exception) {
            return rethrow(exception, message => `Failed to load configuration file ${file}: ${message}`);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Overwrite the loaded configuration with command line options (if/as supplied)
    //------------------------------------------------------------------------------------------------------------------

    private static overwriteConfigWithCommandLineOptions(config: unknown, options: unknown) {
        const configAsAny = asAny(config);
        const optionsAsAny = asAny(options);
        for (const key of Object.keys(optionsAsAny)) {
            if (Object.prototype.hasOwnProperty.call(config, key) && undefined !== optionsAsAny[key]) {
                configAsAny[key] = optionsAsAny[key];
            }
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Load and validate a JSON database
    //------------------------------------------------------------------------------------------------------------------

    public static parseAndValidateDatabase(json: string, zipFile: string, databaseFile: string, destination: string) {
        return tryCatchRethrowFriendlyException(
            () => {
                const database = this.parseJson<JsonDatabase>(json);
                JsonValidator.validateDatabase(database);
                return database;
            },
            error => [
                `${databaseFile} in ${zipFile} is corrupt.`,
                error,
                `To force a full re-sync, delete everything from ${destination}`
            ].join("\n")
        );
    }

    //------------------------------------------------------------------------------------------------------------------
    // Load and validate a JSON file
    //------------------------------------------------------------------------------------------------------------------

    private static loadFile<T>(file: string): T {
        const json = tryCatchRethrowFriendlyException(
            () => node.fs.readFileSync(file).toString(),
            error => `Failed to load ${file}: ${error}`
        );
        return this.parseJson<T>(json);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Parse JSON content
    //------------------------------------------------------------------------------------------------------------------

    private static parseJson<T>(json: string): T {
        return tryCatchRethrowFriendlyException(
            () => JSON.parse(json) as T,
            error => `${error}`
        );
    }
}
