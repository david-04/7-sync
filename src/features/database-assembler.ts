//----------------------------------------------------------------------------------------------------------------------
// Convert the database's JSON representation into properly typed/linked classes
//----------------------------------------------------------------------------------------------------------------------

class DatabaseAssembler {

    private readonly logger;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    constructor(private readonly context: Context) {
        this.logger = context.logger;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Assemble the source and destination file/directory trees
    //------------------------------------------------------------------------------------------------------------------

    public assembleFromJson(json: JsonDatabase) {
        try {
            const source = new RootDirectory(this.context.config.source);
            const destination = new RootDirectory(this.context.config.destination);
            this.assertThatDirectoriesExist(source, destination);
            const database = new MappedRootDirectory(source, destination, json.next);
            if (false !== this.doesPasswordWorkWithAnyFileFrom(this.context.config.destination)) {
                this.logger.debug("Assembling database from the raw JSON data");
                this.assembleDirectory(database, json);
            } else {
                this.logger.info("Deleting the database to force a full re-encrypt because the password has changed");
            }
            return database;
        } catch (exception) {
            if (exception instanceof FriendlyException) {
                exception.prependMessage(`Failed to assemble database ${this.context.files.database}:`);
            }
            throw exception;
        }
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
            this.logger.debug(`Verified that directory ${directory} exists`);
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that the password can decrypt a randomly selected file from the destination
    //------------------------------------------------------------------------------------------------------------------

    private doesPasswordWorkWithAnyFileFrom(directory: string): boolean | undefined {
        const children = FileUtils.getChildren(directory);
        for (const child of children.filter(c => c.isFile() && c.name.endsWith(".7z"))) {
            const file = node.path.join(directory, child.name);
            this.logger.debug(`Checking if the password can open ${file}`)
            if (this.context.sevenZip.isReadableWithCurrentPassword(file)) {
                this.logger.debug("Successfully opened the archive, the password is correct");
                return true;
            } else {
                this.logger.debug("Failed to open the archive, the password is not correct");
                return false;
            }
        }
        for (const child of children.filter(c => c.isDirectory())) {
            const result = this.doesPasswordWorkWithAnyFileFrom(node.path.join(directory, child.name));
            if (undefined !== result) {
                return result;
            }
        }
        return undefined;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Assemble a directory
    //------------------------------------------------------------------------------------------------------------------

    private assembleDirectory(database: MappedDirectory, json: JsonDatabase | JsonDirectory) {
        this.assembleFiles(database, json);
        json.directories.forEach(directory => {
            const source = new SubDirectory(database.source, directory.source);
            const destination = new SubDirectory(database.destination, directory.destination);
            if (!FileUtils.existsAndIsDirectory(source.absolutePath)) {
                this.logPurged(source.relativePath, "it does not exist (as a directory) in the source");
            } else if (!FileUtils.existsAndIsDirectory(destination.absolutePath)) {
                this.logPurged(source.relativePath, "it does not exist (as a directory) in the destination");
            } else {
                const mappedDirectory = new MappedSubDirectory(database, source, destination, database.next);
                this.assembleDirectory(mappedDirectory, directory);
                database.directories.push(mappedDirectory);
            }
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Assemble the files in a directory
    //------------------------------------------------------------------------------------------------------------------

    private assembleFiles(database: MappedDirectory, json: JsonDatabase | JsonDirectory) {
        json.files.forEach(file => {
            const source = new File(database.source, file.source);
            const destination = new File(database.destination, file.destination);
            if (!FileUtils.existsAndIsFile(source.absolutePath)) {
                this.logPurged(source.relativePath, "it does not exist (as a file) in the source");
            } else if (!FileUtils.existsAndIsFile(destination.absolutePath)) {
                this.logPurged(source.relativePath, "it does not exist (as a file) in the destination");
            } else {
                const properties = source.getProperties();
                if (file.size !== properties.size) {
                    this.logPurged(source.relativePath, "the file size has changed");
                } else if (file.modified !== properties.mtimeMs) {
                    this.logPurged(source.relativePath, "the modified date has changed");
                } else if (file.created !== properties.ctimeMs) {
                    this.logPurged(source.relativePath, "the create date has changed");
                } else {
                    database.files.push(
                        new MappedFile(database, source, destination, file.created, file.modified, file.size)
                    );
                }
            }
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log that an element has been purged from the database
    //------------------------------------------------------------------------------------------------------------------

    private logPurged(path: string, reason: string) {
        this.context.logger.debug(`Removing ${path} from database because ${reason}`);
    }
}
