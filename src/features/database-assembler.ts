//----------------------------------------------------------------------------------------------------------------------
// Convert the database's JSON representation into properly typed/linked classes
//----------------------------------------------------------------------------------------------------------------------

class DatabaseAssembler {

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    private constructor(private readonly context: Context) { }

    //------------------------------------------------------------------------------------------------------------------
    // Load, validate and assemble the database
    //------------------------------------------------------------------------------------------------------------------

    public static assemble(context: Context, database: JsonDatabase) {
        return new DatabaseAssembler(context).assembleDatabase(database);
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
            return database;
        } catch (exception) {
            rethrow(exception, message => `Failed to assemble database - ${message}`);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Assemble files and subdirectories within a directory
    //------------------------------------------------------------------------------------------------------------------

    private assembleFilesAndSubdirectories(directory: MappedDirectory, json: JsonDatabase | JsonDirectory) {
        json.files.forEach(file =>
            directory.add(this.assembleFile(directory, file))
        );
        json.directories.forEach(subdirectory =>
            directory.add(this.assembleDirectory(directory, subdirectory))
        );
    }

    //------------------------------------------------------------------------------------------------------------------
    // Assemble a mapped directory
    //------------------------------------------------------------------------------------------------------------------

    private assembleDirectory(parent: MappedDirectory, json: JsonDirectory) {
        const source = new Subdirectory(parent.source, json.source);
        const destination = new Subdirectory(parent.destination, json.destination);
        const mappedDirectory = new MappedSubdirectory(parent, source, destination, json.last);
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
        });
    }
}
