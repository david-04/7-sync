//----------------------------------------------------------------------------------------------------------------------
// Orchestrating process for the synchronization
//----------------------------------------------------------------------------------------------------------------------

class Synchronizer {

    private readonly logger;
    private readonly isDryRun;
    private readonly fileManager;

    private readonly statistics = asReadonly({
        delete: asReadonly({
            orphans: new Statistics(), // unknown items in the destination
            outdated: new Statistics(), // the source was modified
            deleted: new Statistics() // the source was deleted
        }),
        copy: asReadonly({
            new: new Statistics(), // new source item (previously unseen)
            modified: new Statistics() // modified source items (changed since the last sync)
        }),
        purge: asReadonly({ // purged from the database
            vanished: new Statistics() // item has disappeared from the destination
        })
    });

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    private constructor(
        readonly context: Context,
        readonly database: MappedRootDirectory,
        _forceReEncrypt: boolean
    ) {
        this.fileManager = new FileManager(context, database);
        this.logger = context.logger;
        this.isDryRun = context.options.dryRun;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run the synchronization
    //------------------------------------------------------------------------------------------------------------------

    public static run(context: Context, database: MappedRootDirectory, forceReEncrypt: boolean) {
        const synchronizer = new Synchronizer(context, database, forceReEncrypt);
        synchronizer.syncDirectory(database);
        return synchronizer.statistics;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Sync a directory
    //------------------------------------------------------------------------------------------------------------------

    private syncDirectory(directory: MappedDirectory) {
        const destinationChildren = directory.destination.getChildren().map;
        this.deleteOrphans(directory, destinationChildren);
        const items = this.analyzeDirectory(directory, destinationChildren);
        items.forEach(item => this.processItem(directory, item.source, item.database, item.destination));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete orphan children from a directory
    //------------------------------------------------------------------------------------------------------------------

    private deleteOrphans(database: MappedDirectory, children: Map<string, Dirent>) {
        Array.from(children).forEach(array => {
            const name = array[0];
            const dirent = array[1];
            if (!database.files.byDestinationName.has(name) && !database.subdirectories.byDestinationName.has(name)) {
                const destination = node.path.join(database.destination.absolutePath, name);
                const success = dirent.isDirectory()
                    ? this.deleteOrphanedDirectory(destination)
                    : this.fileManager.deleteFile({ destination, statistics: this.statistics.delete.orphans });
                if (success) {
                    children.delete(name);
                }
            }
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete an orphan directory
    //------------------------------------------------------------------------------------------------------------------

    private deleteOrphanedDirectory(absolutePath: string) {
        this.deleteOrphanedChildren(absolutePath);
        return this.fileManager.deleteDirectory({
            destination: absolutePath, statistics: this.statistics.delete.orphans
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete the contents of an orphan directory
    //------------------------------------------------------------------------------------------------------------------

    private deleteOrphanedChildren(absoluteParentPath: string) {
        return FileUtils.getChildren(absoluteParentPath).array.map(dirent => {
            const destination = node.path.join(absoluteParentPath, dirent.name)
            return dirent.isDirectory()
                ? this.deleteOrphanedDirectory(destination)
                : this.fileManager.deleteFile({ destination, statistics: this.statistics.delete.orphans });
        }).some(result => !result);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Compare the database with the current destination directory
    //------------------------------------------------------------------------------------------------------------------

    public analyzeDirectory(directory: MappedDirectory, destinationChildren: Map<string, Dirent>) {
        const sourceChildren = directory.source.getChildren().map;
        const databaseFiles = Array.from(directory.files.bySourceName.values());
        const databaseSubdirectories = Array.from(directory.subdirectories.bySourceName.values());
        const databaseItems = [...databaseFiles, ...databaseSubdirectories].map(database => ({
            source: sourceChildren.get(database.source.name),
            database,
            destination: destinationChildren.get(database.destination.name)
        }));
        databaseItems.forEach(item => {
            if (item.source) sourceChildren.delete(item.source.name)
        });
        const sourceOnlyItems = Array.from(sourceChildren.values()).map(source => ({
            source, database: undefined, destination: undefined
        }));
        return this.sortAnalysisResults(directory, [...sourceOnlyItems, ...databaseItems]);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Sort directory items case-insensitive alphabetically with directories first
    //------------------------------------------------------------------------------------------------------------------

    private sortAnalysisResults(
        directory: MappedDirectory,
        array: Array<{ source?: Dirent, database?: MappedSubdirectory | MappedFile, destination?: Dirent }>
    ) {
        return array.map(item => {
            let isDirectory = item.database instanceof MappedSubdirectory;
            if (!isDirectory && item.source) {
                isDirectory = FileUtils.isDirectoryOrDirectoryLink(
                    node.path.join(directory.source.absolutePath, item.source.name), item.source
                );
            }
            if (!isDirectory && item.destination) {
                isDirectory = item.destination.isDirectory();
            }
            return { ...item, isDirectory };
        }).sort((a, b) => {
            if (a.isDirectory === b.isDirectory) {
                const name1 = (a.database?.source.name ?? a.source?.name ?? "").toLowerCase();
                const name2 = (b.database?.source.name ?? b.source?.name ?? "").toLowerCase();
                return name1 < name2 ? -1 : 1
            } else {
                return a.isDirectory ? -1 : 1;
            }
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Synchronize a file or directory
    //------------------------------------------------------------------------------------------------------------------

    private processItem(
        directory: MappedDirectory, source?: Dirent, database?: MappedSubdirectory | MappedFile, destination?: Dirent
    ) {
        if (database) {
            return this.processDatabaseItem(directory, database, source, destination);
        } else if (source) {
            return this.processNewItem(directory, source);
        } else {
            return true;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process an item that is registered in the database
    //------------------------------------------------------------------------------------------------------------------

    private processDatabaseItem(
        directory: MappedDirectory, database: MappedSubdirectory | MappedFile, source?: Dirent, destination?: Dirent
    ) {
        if (source && destination) {
            return this.processPreservedItem(directory, database, source, destination);
        } else if (source) {
            return this.processVanishedItem(directory, database, source)
        } else {
            return this.processDeletedItem(directory, database, destination);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a new item that's not in the database yet
    //------------------------------------------------------------------------------------------------------------------

    private processNewItem(directory: MappedDirectory, source: Dirent) {
        return FileUtils.isDirectoryOrDirectoryLink(directory.source.absolutePath, source)
            ? this.processNewDirectory(directory, source)
            : this.processNewFile(directory, source);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a new directory that was created after the last sync
    //------------------------------------------------------------------------------------------------------------------

    private processNewDirectory(parentDirectory: MappedDirectory, source: Dirent) {
        const subdirectory = this.fileManager.createDirectory(parentDirectory, source, this.statistics.copy.new);
        return subdirectory ? this.syncDirectory(subdirectory) : false;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a new file that was created after the last sync
    //------------------------------------------------------------------------------------------------------------------

    private processNewFile(directory: MappedDirectory, source: Dirent) {
        return this.fileManager.compressFile(directory, source, this.statistics.copy.new);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a previously synced item that's still in the source but has disappeared from the destination
    //------------------------------------------------------------------------------------------------------------------

    private processVanishedItem(directory: MappedDirectory, database: MappedSubdirectory | MappedFile, source: Dirent) {
        const prefix = this.isDryRun ? "Would purge" : "Purging";
        const sourcePath = database.source.absolutePath;
        const destinationPath = database.destination.absolutePath;
        const children = database instanceof MappedFile ? { files: 0, subdirectories: 0 } : database.countChildren();
        const suffix = children.files || children.subdirectories
            ? ` (including ${children.files} files in ${children.subdirectories} subdirectories)`
            : "";
        this.logger.warn(`${prefix} ${sourcePath}${suffix} from the database because ${destinationPath} has vanished`);
        directory.delete(database)
        this.processNewItem(directory, source);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a previously synced item that still exists in the source and in the destination
    //------------------------------------------------------------------------------------------------------------------
    private processPreservedItem(
        _directory: MappedDirectory, _database: MappedDirectory | MappedFile, _source: Dirent, _destination: Dirent
    ) {
        // TODO: file might have been modified or the there might have been a swap (file <=> directory)
    }


    //------------------------------------------------------------------------------------------------------------------
    // Process a previously synced item that's no longer in the source but might still be in the destination
    //------------------------------------------------------------------------------------------------------------------

    private processDeletedItem(
        _directory: MappedDirectory, _database: MappedDirectory | MappedFile, _destination?: Dirent
    ) {
        // TODO: the item was deleted from the source but is still in the destination
    }


}
