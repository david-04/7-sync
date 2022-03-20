//----------------------------------------------------------------------------------------------------------------------
// Orchestrating process for the synchronization
//----------------------------------------------------------------------------------------------------------------------

class Synchronizer {

    private readonly logger;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(private readonly context: Context) {
        this.logger = context.logger;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Sync or dry-run
    //------------------------------------------------------------------------------------------------------------------

    public run() {
        this.logger.info(this.context.options.dryRun ? "Simulating synchronization" : "Starting synchronization")
        // Load the database file
        const database = JsonLoader.loadAndValidateDatabase(this.context);
        // Try to open any 7z file in the destination with the current password
        // Truncate the database if the previous step found a file but could not open it (wrong password)
        // Remove files that were changed and deleted in the source from the database
        // Delete files in the destination that are not linked in the database
        // Copy over all missing files from the source
        // Create the recovery/index files
        this.saveDatabase(database);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Save the database
    //------------------------------------------------------------------------------------------------------------------

    private saveDatabase(database: JsonDatabase) {
        const file = this.context.files.database;
        this.logger.info(`Saving database ${file}`);
        node.fs.writeFileSync(file, JSON.stringify(database, undefined, 4));
    }
}
