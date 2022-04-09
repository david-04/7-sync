//----------------------------------------------------------------------------------------------------------------------
// Main program
//----------------------------------------------------------------------------------------------------------------------

class Application {

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    constructor(private logger: Logger) { }

    //------------------------------------------------------------------------------------------------------------------
    // Entry point and error handling for the main program
    //------------------------------------------------------------------------------------------------------------------

    public static async main() {
        const application = new Application(new Logger(LogLevel.ERROR, new NullOutputStream()));
        try {
            process.exit(await application.run(process.argv.slice(2)));
        } catch (exception) {
            if (exception instanceof FriendlyException) {
                if (0 === exception.exitCode) {
                    console.log(`${exception.message}`);
                } else {
                    console.error(`ERROR: ${exception.message}`);
                }
                application.logger.error(exception.message);
            } else {
                console.error(exception);
                application.logger.error(`${exception}`);
            }
            node.process.exit(exception instanceof FriendlyException ? exception.exitCode : 1);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // The main processing logic
    //------------------------------------------------------------------------------------------------------------------

    private async run(argv: string[]) {
        this.logger.info("Parsing the command line options");
        const options = CommandLineParser.parse(argv);
        if (!options.config.endsWith(".cfg")) {
            throw new FriendlyException(`"${options.config}" does not end with .cfg`)
        }
        this.logger.debug("Extracted command line options:", options);
        switch (options.command) {
            case CommandLineParser.DEFAULT_OPTIONS.init.command:
                await SetupWizard.initialize(options);
                return 0;
            case CommandLineParser.DEFAULT_OPTIONS.reconfigure.command:
                await SetupWizard.reconfigure(options);
                return 0;
            case CommandLineParser.DEFAULT_OPTIONS.sync.command:
                return this.sync(await Context.of(options));
        }
        // @ts-expect-error The switch above should be exhaustive
        throw new Error(`Internal error: Missing handler for ${context.options.command}`)
    }

    //------------------------------------------------------------------------------------------------------------------
    // Sync process orchestration
    //------------------------------------------------------------------------------------------------------------------

    private async sync(context: Context) {
        try {
            context.sevenZip.runSelfTest();
            const metadataManager = new MetadataManager(context);
            const { json, mustSaveImmediately } = await metadataManager.loadOrInitializeDatabase();
            const database = DatabaseAssembler.assemble(context, json);
            if (mustSaveImmediately && !metadataManager.updateIndex(database).isUpToDate) {
                throw new FriendlyException("Failed to save the database");
            }
            const message = context.options.dryRun ? "Starting the dry run" : "Starting the synchronization";
            context.logger.info(message);
            context.print(message);
            return Synchronizer.run(context, metadataManager, database);
        } catch (exception) {
            if (exception instanceof FriendlyException) {
                exception.message
                    .split(/\r?\n/)
                    .map(line => line.trim())
                    .filter(line => line)
                    .forEach(line => context.logger.error(line))
            } else {
                context.logger.error(firstLineOnly(exception));
            }
            context.console.log("");
            throw exception;
        }
    }
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
