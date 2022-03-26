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
            await application.run(process.argv.slice(2));
            process.exit(0);
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
                return SetupWizard.initialize(options);
            case CommandLineParser.DEFAULT_OPTIONS.reconfigure.command:
                return SetupWizard.reconfigure(options);
            case CommandLineParser.DEFAULT_OPTIONS.sync.command:
                return this.sync(await Context.of(options));
        }
        // @ts-expect-error The switch above should be exhaustive
        throw new Error(`Internal error: Missing handler for ${context.options.command}`)
    }

    //------------------------------------------------------------------------------------------------------------------
    // Sync process orchestration
    //------------------------------------------------------------------------------------------------------------------

    private sync(context: Context) {
        const isDryRun = context.options.dryRun;
        this.logger.info(isDryRun ? "Simulating synchronization" : "Starting synchronization");
        const database = DatabaseAssembler.loadDatabase(context);
        const statistics = Synchronizer.run(context, database);
        statistics.log(this.logger, isDryRun, "sync", "synced", context.console)
        database.sortFilesAndSubdirectories();
        const recoveryArchiveResult = RecoveryArchiveCreator.create(context, database);
        DatabaseSerializer.saveDatabase(context, database);
        if (true !== recoveryArchiveResult) {
            throw new FriendlyException(`Failed to create the recovery archive: ${recoveryArchiveResult}`);
        } else if (statistics.hasFailures()) {
            const counters = Statistics.format(statistics.files.failed, statistics.directories.failed);
            throw new FriendlyException(`${counters} could not be processed`, 2);
        } else if (!isDryRun) {
            const message = "The synchronization has been completed successfully";
            context.print(message);
            this.logger.info(message);
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
