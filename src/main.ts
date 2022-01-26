//----------------------------------------------------------------------------------------------------------------------
// The main program
//----------------------------------------------------------------------------------------------------------------------

class Application {

    private static logger?: Logger;

    //------------------------------------------------------------------------------------------------------------------
    // Entry point and error handling for the main program
    //------------------------------------------------------------------------------------------------------------------

    public static main() {
        try {
            this.run(process.argv.slice(2));
        } catch (exception) {
            if (exception instanceof FriendlyException) {
                if (0 === exception.exitCode) {
                    console.log(`${exception.message}`);
                } else {
                    console.error(`ERROR: ${exception.message}`);
                }
                this.logger?.error(exception.message);
            } else {
                console.error(exception);
                this.logger?.error(`${exception}`);
            }
            node.process.exit(exception instanceof FriendlyException ? exception.exitCode : 1);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // The main processing logic
    //------------------------------------------------------------------------------------------------------------------

    private static run(argv: string[]) {
        this.logger = new Logger(LogLevel.ERROR, new NullOutputStream());
        this.logger.info("Parsing the command line options");
        const options = CommandLineParser.parse(argv);
        this.logger.debug("Extracted command line options:", options);
        const { originalConfig, mergedConfig } = JsonLoader.loadAndValidateConfig(options, this.logger);
        if (mergedConfig.logfile) {
            this.logger = new Logger(LogLevel.INFO, new NullOutputStream());
        }
        const console = options.silent ? new NullOutputStream() : new ConsoleOutputStream();
        const context = new Context(options, originalConfig, mergedConfig, console, this.logger);
        this.runTask(context);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Initiate the requested task
    //------------------------------------------------------------------------------------------------------------------

    private static runTask(context: Context<TaskOptions>) {
        switch (context.options.command) {
            case "init": return this.init(context.typify(context.options));
            case "sync": return this.sync(context.typify(context.options));
            case "change-password": return this.changePassword(context.typify(context.options));
        }
        // @ts-expect-error
        throw `Internal error: Missing handler for ${context.options.command}`
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run the initialisation
    //------------------------------------------------------------------------------------------------------------------

    private static init(_context: Context<InitOptions>) {

    }

    //------------------------------------------------------------------------------------------------------------------
    // Run a sync (or a dry run)
    //------------------------------------------------------------------------------------------------------------------

    private static sync(_context: Context<SyncOptions>) {

    }

    //------------------------------------------------------------------------------------------------------------------
    // Change the password
    //------------------------------------------------------------------------------------------------------------------

    private static changePassword(_context: Context<ChangePasswordOptions>) {

    }
}

//----------------------------------------------------------------------------------------------------------------------
// Run the application when the whole script has been loaded
//----------------------------------------------------------------------------------------------------------------------

process.on("exit", () => Application.main());
