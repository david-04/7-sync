//----------------------------------------------------------------------------------------------------------------------
// Convert the database's JSON representation into properly typed/linked classes
//----------------------------------------------------------------------------------------------------------------------

class DatabaseAssembler {

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    constructor(private readonly context: Context) { }

    //------------------------------------------------------------------------------------------------------------------
    // Load, validate and assemble the database
    //------------------------------------------------------------------------------------------------------------------

    public static loadDatabase(context: Context) {
        const json = JsonLoader.loadAndValidateDatabase(context);
        return new DatabaseAssembler(context).assembleDatabase(json);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Assemble the source and destination file/directory trees
    //------------------------------------------------------------------------------------------------------------------

    private assembleDatabase(json: JsonDatabase) {
        const source = new RootDirectory(this.context.config.source);
        const destination = new RootDirectory(this.context.config.destination);
        this.assertThatDirectoriesExist(source, destination);
        try {
            const database = new MappedRootDirectory(source, destination, json.last);
            this.assembleFilesAndSubdirectories(database, json);
            DatabaseSerializer.saveDatabase(this.context, database);
            return database;
        } catch (exception) {
            rethrowWithPrefix(`Failed to assemble database ${this.context.files.database}`, exception);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Assemble files and subdirectories within a directory
    //------------------------------------------------------------------------------------------------------------------

    private assembleFilesAndSubdirectories(directory: MappedDirectory, json: JsonDatabase | JsonDirectory) {
        json.files.forEach(file =>
            directory.files.push(this.assembleFile(directory, file))
        );
        json.directories.forEach(subdirectory =>
            directory.subdirectories.push(this.assembleDirectory(directory, subdirectory))
        );
    }

    //------------------------------------------------------------------------------------------------------------------
    // Assemble a mapped directory
    //------------------------------------------------------------------------------------------------------------------

    private assembleDirectory(parent: MappedDirectory, json: JsonDirectory) {
        const source = new SubDirectory(parent.source, json.source);
        const destination = new SubDirectory(parent.destination, json.destination);
        const mappedDirectory = new MappedSubDirectory(parent, source, destination, json.last);
        this.assembleFilesAndSubdirectories(mappedDirectory, json);
        return mappedDirectory;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Assemble a mapped file
    //------------------------------------------------------------------------------------------------------------------

    private assembleFile(directory: MappedDirectory, json: JsonFile) {
        const source = new File(directory.source, json.source);
        const destination = new File(directory.destination, json.destination);
        return new MappedFile(directory, source, destination, json.created, json.modified, json.size);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that the source and destination directories exist
    //------------------------------------------------------------------------------------------------------------------

    private assertThatDirectoriesExist(...directories: Directory[]) {
        directories.map(directory => directory.absolutePath).forEach(directory => {
            if (!FileUtils.exists(directory)) {
                throw new FriendlyException(`Directory ${directory} does not exist`);
            } else if (!FileUtils.existsAndIsDirectory(directory)) {
                throw new FriendlyException(`${directory} is not a directory`);
            }
            this.context.logger.debug(`Verified that directory ${directory} exists`);
        });
    }
}