//----------------------------------------------------------------------------------------------------------------------
// Orchestrating process for the synchronization
//----------------------------------------------------------------------------------------------------------------------

class Synchronizer {

    private readonly logger;
    private readonly print;
    private readonly isDryRun;
    private readonly statistics = {
        sync: new Statistics(),
        orphan: new Statistics()
    }

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    private constructor(private readonly context: Context) {
        this.logger = context.logger;
        this.print = context.print;
        this.isDryRun = context.options.dryRun;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run the synchronization
    //------------------------------------------------------------------------------------------------------------------

    public static run(context: Context, database: MappedRootDirectory) {
        const passwordChanged = context.sevenZip.doesPasswordWorkWithAnyFileFrom(context.config.destination);
        if (passwordChanged) {
            const message = context.options.dryRun
                ? "Would delete and re-encrypt all files because the password has changed"
                : "Deleting and re-encrypting all files because the password has changed";
            context.logger.info(message);
            context.print(message);
        }
        const synchronizer = new Synchronizer(context);
        synchronizer.syncDirectory(database, database);
        return synchronizer.statistics.sync;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Sync a directory
    //------------------------------------------------------------------------------------------------------------------

    private syncDirectory(database: MappedRootDirectory, directory: MappedDirectory) {
        const children = FileUtils.getChildren(directory.source.absolutePath).map;
        directory.files.forEach(file => children.delete(file.source.name));
        directory.subdirectories.forEach(subdirectory => children.delete(subdirectory.source.name));
        children.forEach(child => {
            if (FileUtils.isDirectoryOrDirectoryLink(directory.source.absolutePath, child)) {
                this.createDirectory(database, directory, child);
            } else {
                this.compressFile(database, directory, child);
            }
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create a new directory
    //------------------------------------------------------------------------------------------------------------------

    private createDirectory(database: MappedRootDirectory, directory: MappedDirectory, entry: Dirent) {
        const result = this.syncAndLog(
            database,
            directory,
            entry,
            "",
            () => this.statistics.sync.directories.success++,
            () => this.statistics.sync.directories.failed++,
            filename => {
                node.fs.mkdirSync(node.path.join(directory.destination.absolutePath, filename));
                return true;
            }
        );
        if (result) {
            const source = new SubDirectory(directory.source, entry.name);
            const destination = new SubDirectory(directory.destination, result.filename);
            const newDirectory = new MappedSubDirectory(directory, source, destination, "");
            directory.subdirectories.push(newDirectory);
            directory.last = result.last;
            this.syncDirectory(database, newDirectory);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Synchronize a single file
    //------------------------------------------------------------------------------------------------------------------

    private compressFile(database: MappedRootDirectory, parentDirectory: MappedDirectory, entry: Dirent) {
        const result = this.syncAndLog(
            database,
            parentDirectory,
            entry,
            ".7z",
            () => this.statistics.sync.files.success++,
            () => this.statistics.sync.files.failed++,
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
            const destination = new File(parentDirectory.destination, result.filename);
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
        const next = this.context.filenameEnumerator.getNextAvailableFilename(directory.destination.absolutePath, directory.last, "", suffix);
        const destinationAbsolute = node.path.join(directory.destination.absolutePath, next.filename);
        const destinationRelative = node.path.relative(database.destination.absolutePath, destinationAbsolute);
        return {
            source: {
                absolutePath: sourceAbsolute,
                relativePath: sourceRelative
            },
            destination: {
                filename: next.filename,
                absolutePath: destinationAbsolute,
                relativePath: destinationRelative
            },
            next: next.enumeratedName
        };
    }
}
