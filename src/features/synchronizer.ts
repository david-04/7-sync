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
        this.logger.info(this.context.options.dryRun ? "Simulating synchronization" : "Starting synchronization");
        const json = JsonLoader.loadAndValidateDatabase(this.context);
        new DatabaseAssembler(this.context).assembleFromJson(json);
        // Delete files in the destination that are not linked in the database
        // Copy over all missing files from the source
        // Create the recovery/index files
        // this.saveDatabase(database);
    }


    //------------------------------------------------------------------------------------------------------------------
    // Save the database
    //------------------------------------------------------------------------------------------------------------------

    // private saveDatabase(database: JsonDatabase) {
    //     const file = this.context.files.database;
    //     this.logger.info(`Saving database ${file}`);
    //     node.fs.writeFileSync(file, JSON.stringify(database, undefined, 4));
    // }
}
