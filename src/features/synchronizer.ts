//----------------------------------------------------------------------------------------------------------------------
// Orchestrating process for the synchronization
//----------------------------------------------------------------------------------------------------------------------

class Synchronizer {

    private readonly logger;
    private readonly print;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(private readonly context: Context) {
        this.logger = context.logger;
        this.print = context.print;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Sync or dry-run
    //------------------------------------------------------------------------------------------------------------------

    public run() {
        this.logger.info(this.context.options.dryRun ? "Simulating synchronization" : "Starting synchronization");
        const json = JsonLoader.loadAndValidateDatabase(this.context);
        const database = new DatabaseAssembler(this.context).assembleFromJson(json);
        new OrphanRemover(this.context).run(database);
        // Copy over all missing files from the source
        // Create the recovery/index files
        this.saveDatabase(database);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Save the database
    //------------------------------------------------------------------------------------------------------------------

    private saveDatabase(database: MappedRootDirectory) {
        const file = this.context.files.database;
        if (this.context.options.dryRun) {
            this.logger.info(`Would save database ${file}`);
            this.print("Would save updated database");
        } else {
            this.logger.info(`Saving updated database ${file}`);
            this.print("Saving updated database");
            node.fs.writeFileSync(file, DatabaseSerializer.serialize(database));
        }
    }
}
