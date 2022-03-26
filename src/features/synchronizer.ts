//----------------------------------------------------------------------------------------------------------------------
// Orchestrating process for the synchronization
//----------------------------------------------------------------------------------------------------------------------

class Synchronizer {

    private readonly logger;
    private readonly print;
    private readonly isDryRun;
    private readonly statistics = {
        sync: new Statistics(),
        orphans: new Statistics()
    }

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    private constructor(
        private readonly context: Context,
        readonly _database: MappedRootDirectory,
        readonly _passwordChanged: boolean
    ) {
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
        } else {
            context.logger.info(context.options.dryRun ? "Simulating synchronization" : "Starting synchronization");
        }
        const synchronizer = new Synchronizer(context, database, passwordChanged ?? false);
        synchronizer.syncDirectory(database);
        return synchronizer.statistics.sync;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Sync a directory
    //------------------------------------------------------------------------------------------------------------------

    private syncDirectory(directory: MappedDirectory) {
        const destinationChildren = FileUtils.getChildren(directory.source.absolutePath).map;
        this.deleteOrphans(directory, destinationChildren).forEach(name => destinationChildren.delete(name));

        // {name: string, source: dirent, database: mapped, destination: dirent}
        // this.getCategorizedChildren(directory, destinationChildren).forEach(child => {
        //     if (child.source && !child.database && FileUtils.isDirectoryOrDirectoryLink(child.source)) {
        //         //
        //     }
        // })
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete orphans from a directory
    //------------------------------------------------------------------------------------------------------------------

    private deleteOrphans(directory: MappedDirectory, children: Map<string, Dirent>) {
        const orphans = Synchronizer.clone(children);
        directory.subdirectories.byDestinationName.forEach(subdirectory => orphans.delete(subdirectory.destination.name));
        directory.files.byDestinationName.forEach(file => orphans.delete(file.destination.name));
        const deletedEntries = new Array<string>();
        orphans.forEach((dirent, name) => {
            const childPath = node.path.join(directory.destination.absolutePath, name);
            if (dirent.isDirectory() ? this.deleteOrphanDirectory(childPath) : this.deleteOrphanFile(childPath)) {
                deletedEntries.push(name);
            }
        });
        return deletedEntries;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete an orphan directory
    //------------------------------------------------------------------------------------------------------------------

    private deleteOrphanDirectory(path: string) {
        this.deleteOrphanDirectoryContents(path);
        this.logger.warn(`Deleting orphan directory ${path}`);
        node.fs.rmSync(path, { recursive: true, force: true });
        if (FileUtils.exists(path)) {
            this.logger.error(`Failed to delete orphan directory ${path}`);
            this.statistics.orphans.directories.success++;
            return true;
        } else {
            this.statistics.orphans.directories.failed++;
            return false;
        }

    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete the contents of an orphan directory
    //------------------------------------------------------------------------------------------------------------------

    private deleteOrphanDirectoryContents(path: string) {
        FileUtils.getChildren(path).array.forEach(dirent => {
            const childPath = node.path.join(path, dirent.name)
            if (dirent.isDirectory()) {
                this.deleteOrphanDirectory(childPath);
            } else {
                this.deleteOrphanFile(childPath);
            }
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete an orphan file
    //------------------------------------------------------------------------------------------------------------------

    private deleteOrphanFile(path: string) {
        this.logger.warn(`Deleting orphan file ${path}`);
        node.fs.rmSync(path);
        if (FileUtils.exists(path)) {
            this.logger.error(`Failed to delete orphan file ${path}`);
            this.statistics.orphans.files.success++;
            return true;
        } else {
            this.statistics.orphans.files.failed++;
            return false;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Compare the database with the current file contents
    //------------------------------------------------------------------------------------------------------------------

    public getCategorizedChildren(directory: MappedDirectory, destinationChildren: Map<string, Dirent>) {
        const sourceChildren = FileUtils.getChildren(directory.source.absolutePath).map;
        const databaseChildren = new Map<string, MappedSubDirectory | MappedFile>();
        directory.files.bySourceName.forEach(file => databaseChildren.set(file.source.name, file));
        directory.subdirectories.bySourceName.forEach(subdirectory => databaseChildren.set(subdirectory.source.name, subdirectory));
        const allChildren = new Set<string>();
        sourceChildren.forEach((_dirent, name) => allChildren.add(name))
        databaseChildren.forEach((_mappedFileOrDirectory, name) => allChildren.add(name));
        return Array.from(allChildren).sort().map(name => ({
            source: sourceChildren.get(name),
            database: databaseChildren.get(name),
            destination: destinationChildren.get(databaseChildren.get(name)?.source.name ?? "")
        }));
    }


    //------------------------------------------------------------------------------------------------------------------
    // Create a new directory
    //------------------------------------------------------------------------------------------------------------------

    public createDirectory(database: MappedRootDirectory, directory: MappedDirectory, entry: Dirent) {
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
            directory.add(newDirectory);
            directory.last = result.last;
            this.syncDirectory(newDirectory);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Synchronize a single file
    //------------------------------------------------------------------------------------------------------------------

    public compressFile(database: MappedRootDirectory, parentDirectory: MappedDirectory, entry: Dirent) {
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
            parentDirectory.add(new MappedFile(
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

    //------------------------------------------------------------------------------------------------------------------
    // Clone a map
    //------------------------------------------------------------------------------------------------------------------

    private static clone<K, V>(input: Map<K, V>): Map<K, V> {
        const output = new Map<K, V>();
        input.forEach((value, key) => output.set(key, value));
        return output;
    }
}
