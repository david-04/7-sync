//----------------------------------------------------------------------------------------------------------------------
// The main program
//----------------------------------------------------------------------------------------------------------------------

class Application {

    private static logger?: Logger;

    //------------------------------------------------------------------------------------------------------------------
    // Entry point and error handling for the main program
    //------------------------------------------------------------------------------------------------------------------

    public static async main() {
        try {
            await this.run(process.argv.slice(2));
            process.exit(0);
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

    private static async run(argv: string[]) {
        this.logger = new Logger(LogLevel.ERROR, new NullOutputStream());
        this.logger.info("Parsing the command line options");
        const options = CommandLineParser.parse(argv);
        this.logger.debug("Extracted command line options:", options);
        switch (options.command) {
            case CommandLineParser.DEFAULT_OPTIONS.init.command:
                return SetupWizard.initialiseConfigFile(options);
            case CommandLineParser.DEFAULT_OPTIONS.sync.command:
                return;
            case CommandLineParser.DEFAULT_OPTIONS.changePassword.command:
                return;
        }
        // @ts-expect-error The switch above should be exhaustive
        throw new Error(`Internal error: Missing handler for ${context.options.command}`)
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create a context instance
    //------------------------------------------------------------------------------------------------------------------

    //     private static createContext<T extends SyncOptions | ChangePasswordOptions>(
    //         options: T, logger: Logger
    //     ): Context<T> {
    //         this.logger = logger;
    //         const { originalConfig, mergedConfig } = JsonLoader.loadAndValidateConfig(options, this.logger);
    //         if (mergedConfig.logfile) {
    //             this.logger = new Logger(LogLevel.INFO, new NullOutputStream());
    //         }
    //         const console = options.silent ? new NullOutputStream() : new ConsoleOutputStream();
    //         return new Context(options, originalConfig, mergedConfig, console, this.logger);
    //     }
}

//----------------------------------------------------------------------------------------------------------------------
// Run the application when the whole script has been loaded
//----------------------------------------------------------------------------------------------------------------------

let hasStarted = false;

process.on("beforeExit", () => {
    if (!hasStarted) {
        hasStarted = true;
        Application.main();
    }
});
