//----------------------------------------------------------------------------------------------------------------------
// Orchestrating process for the synchronization
//----------------------------------------------------------------------------------------------------------------------

class Synchronizer {

    private readonly logger;
    private readonly print;
    private readonly isDryRun;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(private readonly context: Context) {
        this.logger = context.logger;
        this.print = context.print;
        this.isDryRun = context.options.dryRun;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Sync or dry-run
    //------------------------------------------------------------------------------------------------------------------

    public run() {
        this.logger.info(this.context.options.dryRun ? "Simulating synchronization" : "Starting synchronization");
        const json = JsonLoader.loadAndValidateDatabase(this.context);
        const database = new DatabaseAssembler(this.context).assembleFromJson(json);
        const purgeStatistics = new OrphanRemover(this.context).run(database);
        const syncStatistics = new Statistics();
        this.syncDirectory(database, database, syncStatistics);
        console.log({ purgeStatistics, syncStatistics });
        // Create the recovery/index files
        this.saveDatabase(database);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Sync a directory
    //------------------------------------------------------------------------------------------------------------------

    private syncDirectory(database: MappedRootDirectory, directory: MappedDirectory, statistics: Statistics) {
        const children = FileUtils.getChildren(directory.source.absolutePath).map;
        directory.files.forEach(file => children.delete(file.source.name));
        directory.directories.forEach(subdirectory => children.delete(subdirectory.source.name));
        children.forEach(child => {
            if (FileUtils.isDirectoryOrDirectoryLink(directory.source.absolutePath, child)) {
                this.createDirectory(database, directory, child, statistics);
            } else {
                this.compressFile(database, directory, child, statistics);
            }
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create a new directory
    //------------------------------------------------------------------------------------------------------------------

    private createDirectory(
        database: MappedRootDirectory, directory: MappedDirectory, entry: Dirent, statistics: Statistics
    ) {
        const result = this.syncAndLog(
            database,
            directory,
            entry,
            "",
            () => statistics.directories.success++,
            () => statistics.directories.failed++,
            filename => {
                node.fs.mkdirSync(node.path.join(directory.destination.absolutePath, filename));
                return true;
            }
        );
        if (result) {
            const source = new SubDirectory(directory.source, entry.name);
            const destination = new SubDirectory(directory.destination, result.filename);
            const newDirectory = new MappedSubDirectory(directory, source, destination, "");
            directory.directories.push(newDirectory);
            directory.last = result.last;
            this.syncDirectory(database, newDirectory, statistics);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Synchronize a single file
    //------------------------------------------------------------------------------------------------------------------

    private compressFile(database: MappedRootDirectory, parentDirectory: MappedDirectory, entry: Dirent, statistics: Statistics) {
        const result = this.syncAndLog(
            database,
            parentDirectory,
            entry,
            ".7z",
            () => statistics.files.success++,
            () => statistics.files.failed++,
            filename => {
                const root = database.source.absolutePath;
                const path = node.path.relative(root, node.path.join(parentDirectory.source.absolutePath, entry.name));
                const zipFile = node.path.join(parentDirectory.destination.absolutePath, filename);
                const { status, stdout } = this.context.sevenZip.compressFile(root, path, zipFile);
                if (0 === status) {
                    return true;
                } else {
                    this.logger.error(`7-Zip exited with error code ${status}`, stdout);
                    node.fs.rmSync(zipFile);
                    return false;
                }
            }
        );
        if (result) {
            const source = new File(parentDirectory.source, entry.name);
            const destination = new File(parentDirectory.destination, entry.name);
            const properties = source.getProperties();
            parentDirectory.files.push(new MappedFile(
                parentDirectory,
                source,
                destination,
                properties.ctimeMs,
                properties.mtimeMs,
                properties.size
            ));
            parentDirectory.last = result.last;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Sync and log the syncing of single item
    //------------------------------------------------------------------------------------------------------------------

    private syncAndLog(
        database: MappedRootDirectory,
        directory: MappedDirectory,
        file: Dirent,
        suffix: string,
        onSuccess: () => void,
        onError: () => void,
        sync: (filename: string) => boolean
    ) {
        let success = false;
        const paths = this.getSourceAndDestinationPaths(database, directory, file, suffix);
        const description = `${paths.source.absolutePath} => ${paths.destination.absolutePath}`;
        this.print(`+ ${paths.source.relativePath}`);
        if (this.isDryRun) {
            this.logger.info(`Would sync ${description}`);
            success = true;
        } else {
            this.logger.info(`Syncing ${description}`);
            if (sync(paths.destination.filename) && FileUtils.exists(paths.destination.absolutePath)) {
                success = true;
            } else {
                this.logger.warn(`Failed to sync ${description}`);
                this.print("  => FAILED!")
            }
        }
        if (success) {
            onSuccess();
            return { filename: paths.destination.filename, last: paths.next };
        } else {
            onError();
            return undefined;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Retrieve source and destination information
    //------------------------------------------------------------------------------------------------------------------

    private getSourceAndDestinationPaths(
        database: MappedRootDirectory,
        directory: MappedDirectory,
        file: Dirent,
        suffix: string
    ) {
        const sourceAbsolute = node.path.join(directory.source.absolutePath, file.name);
        const sourceRelative = node.path.relative(database.source.absolutePath, sourceAbsolute);
        const next = this.getNextFilename(directory.destination.absolutePath, directory.last, suffix);
        const filename = next + suffix;
        const destinationAbsolute = node.path.join(directory.destination.absolutePath, filename);
        const destinationRelative = node.path.relative(database.destination.absolutePath, destinationAbsolute);
        return {
            source: {
                absolutePath: sourceAbsolute,
                relativePath: sourceRelative
            },
            destination: {
                filename,
                absolutePath: destinationAbsolute,
                relativePath: destinationRelative
            },
            next: next
        };
    }

    //------------------------------------------------------------------------------------------------------------------
    // Determine the next file name
    //------------------------------------------------------------------------------------------------------------------

    private getNextFilename(path: string, last: string, suffix: string) {
        let next = last;
        while (true) {
            next = this.context.filenameEnumerator.getNextFilename(next);
            const filename = node.path.join(path, next + suffix);
            if (!FileUtils.exists(filename)) {
                return next;
            } else {
                this.logger.debug(`The next filename is already occupied: ${filename}`);
                this.logger.warn(`The database seems to be lagging behind the destination directory`);
            }
        }
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
