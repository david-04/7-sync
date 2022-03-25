//----------------------------------------------------------------------------------------------------------------------
// Convert the database's JSON representation into properly typed/linked classes
//----------------------------------------------------------------------------------------------------------------------

class DatabaseAssembler {

    private readonly logger;
    private readonly print;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    constructor(private readonly context: Context) {
        this.logger = context.logger;
        this.print = context.print;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Assemble the source and destination file/directory trees
    //------------------------------------------------------------------------------------------------------------------

    public assembleFromJson(json: JsonDatabase) {
        try {
            const source = new RootDirectory(this.context.config.source);
            const destination = new RootDirectory(this.context.config.destination);
            this.assertThatDirectoriesExist(source, destination);
            const database = new MappedRootDirectory(source, destination, json.last);
            this.logger.debug("Checking if the password has changed");
            if (false !== this.doesPasswordWorkWithAnyFileFrom(this.context.config.destination)) {
                const message = this.context.options.dryRun
                    ? "Would purge outdated and orphaned files from database"
                    : "Purging outdated and orphaned files from database";
                this.logger.info(message);
                this.print(message);
                this.assembleDirectory(database, json);
            } else {
                const message = this.context.options.dryRun
                    ? "The password has changed - would discard the database to force a full re-encrypt"
                    : "The password has changed - discarding the database to force a full re-encrypt";
                this.logger.warn(message);
                this.print(message);
            }
            return database;
        } catch (exception) {
            rethrowWithPrefix(`Failed to assemble database ${this.context.files.database}`, exception);
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
        const children = FileUtils.getChildren(directory).array;
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
        const existingSources = FileUtils.getChildren(database.source.absolutePath).map;
        const existingDestinations = FileUtils.getChildren(database.destination.absolutePath).map;
        json.files.forEach(file => this.assembleFiles(database, file, existingSources, existingDestinations));
        json.directories.forEach(directory => {
            const source = this.getDirectoryInfo(existingSources, database.source, directory.source);
            const destination = this.getDirectoryInfo(existingDestinations, database.destination, directory.destination);
            const relativePath = source.directory.relativePath;
            if (!source.dirent) {
                this.logPurged(relativePath, "it does not exist (in the source)");
            } else if (!FileUtils.isDirectoryOrDirectoryLink(database.source.absolutePath, source.dirent)) {
                this.logPurged(relativePath, "it's not a directory (in the source)");
            } else if (!destination.dirent) {
                this.logPurged(relativePath, "it does not exist (in the destination)");
            } else if (!destination.dirent.isDirectory()) {
                this.logPurged(relativePath, "it's not a directory (in the destination)");
            } else {
                const mappedDirectory = new MappedSubDirectory(
                    database, source.directory, destination.directory, database.last
                );
                this.assembleDirectory(mappedDirectory, directory);
                database.directories.push(mappedDirectory);
            }
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Compile directory information into a single object
    //------------------------------------------------------------------------------------------------------------------

    private getDirectoryInfo(existingDirectories: Map<string, Dirent>, directory: Directory, filename: string) {
        return {
            name: filename,
            directory: new SubDirectory(directory, filename),
            dirent: existingDirectories.get(filename)
        };
    }

    //------------------------------------------------------------------------------------------------------------------
    // Assemble the files in a directory
    //------------------------------------------------------------------------------------------------------------------

    private assembleFiles(
        directory: MappedDirectory,
        file: JsonFile,
        existingSources: Map<string, Dirent>,
        existingDestinations: Map<string, Dirent>
    ) {
        const source = this.getFileInfo(existingSources, directory.source, file.source);
        const destination = this.getFileInfo(existingDestinations, directory.destination, file.destination);
        const relativePath = source.file.relativePath;
        if (!source.dirent) {
            this.logPurged(relativePath, "it does not exist (in the source)");
        } else if (!FileUtils.isFileOrFileLink(directory.source.absolutePath, source.dirent)) {
            this.logPurged(relativePath, "it's not a file (in the source)");
        } else if (!destination.dirent) {
            this.logPurged(relativePath, "it does not exist (in the destination)");
        } else if (!destination.dirent.isFile()) {
            this.logPurged(relativePath, "it's not a file (in the destination)");
        } else {
            const properties = source.file.getProperties();
            if (file.size !== properties.size) {
                this.logPurged(relativePath, "the file size has changed");
            } else if (file.modified !== properties.mtimeMs) {
                this.logPurged(relativePath, "the modified date has changed");
            } else if (file.created !== properties.ctimeMs) {
                this.logPurged(relativePath, "the create date has changed");
            } else {
                directory.files.push(
                    new MappedFile(directory, source.file, destination.file, file.created, file.modified, file.size)
                );
            }
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Compile file information into a single object
    //------------------------------------------------------------------------------------------------------------------

    private getFileInfo(existingFiles: Map<string, Dirent>, directory: Directory, filename: string) {
        return { name: filename, file: new File(directory, filename), dirent: existingFiles.get(filename) };
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log that an element has been purged from the database
    //------------------------------------------------------------------------------------------------------------------

    private logPurged(path: string, reason: string) {
        this.context.logger.debug(`Removing ${path} from database because ${reason}`);
    }
}
