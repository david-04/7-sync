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
        synchronizer.deleteRecoveryArchive();
        return synchronizer.statistics;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Sync a directory
    //------------------------------------------------------------------------------------------------------------------

    private syncDirectory(directory: MappedDirectory): boolean {
        const destinationChildren = FileUtils.getChildrenIfDirectoryExists(directory.destination.absolutePath).map;
        const success1 = this.deleteOrphans(directory, destinationChildren);
        const items = this.analyzeDirectory(directory, destinationChildren);
        const success2 = this.mapAndReduce(
            items, item => this.processItem(directory, item.source, item.database, item.destination)
        );
        return success1 && success2;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run an operation on all array elements and indicate if all succeeded
    //------------------------------------------------------------------------------------------------------------------

    private mapAndReduce<T>(array: T[], callback: (item: T) => boolean) {
        return !array.map(callback).some(success => !success);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete orphan children from a directory
    //------------------------------------------------------------------------------------------------------------------

    private deleteOrphans(database: MappedDirectory, destinationChildren: Map<string, Dirent>) {
        return this.mapAndReduce(Array.from(destinationChildren), array => {
            const name = array[0];
            const dirent = array[1];
            if (!database.files.byDestinationName.has(name) && !database.subdirectories.byDestinationName.has(name)) {
                const destination = node.path.join(database.destination.absolutePath, name);
                const success = this.deleteOrphanedItem(destination, dirent);
                if (success) {
                    destinationChildren.delete(name);
                }
                return success
            } else {
                return true;
            }
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete an orphaned file or directory
    //------------------------------------------------------------------------------------------------------------------

    private deleteOrphanedItem(destination: string, dirent: Dirent) {
        const isRootFolder = node.path.dirname(destination) === this.database.destination.absolutePath;
        if (dirent.isDirectory()) {
            return this.deleteOrphanedDirectory(destination);
        } else if (isRootFolder && dirent.name.startsWith(FilenameEnumerator.RECOVERY_FILE_NAME_PREFIX)) {
            console.log("Skipping")
            return true;
        } else {
            const success = this.fileManager.deleteFile({ destination });
            if (success) {
                this.statistics.delete.orphans.files.success++;
            } else {
                this.statistics.delete.orphans.files.failed++;
            }
            return success;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete an orphan directory
    //------------------------------------------------------------------------------------------------------------------

    private deleteOrphanedDirectory(absolutePath: string) {
        this.deleteOrphanedChildren(absolutePath);
        const success = this.fileManager.deleteDirectory({ destination: absolutePath });
        if (success) {
            this.statistics.delete.orphans.directories.success++;
        } else {
            this.statistics.delete.orphans.directories.failed++;
        }
        return success;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete the contents of an orphan directory
    //------------------------------------------------------------------------------------------------------------------

    private deleteOrphanedChildren(absoluteParentPath: string) {
        return this.mapAndReduce(
            FileUtils.getChildren(absoluteParentPath).array,
            dirent => this.deleteOrphanedItem(absoluteParentPath, dirent)
        );
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete recovery archives from the root folder
    //------------------------------------------------------------------------------------------------------------------

    private deleteRecoveryArchive() {
        const path = this.database.destination.absolutePath;
        return this.mapAndReduce(FileUtils.getChildrenIfDirectoryExists(path).array, dirent => {
            if (!dirent.isDirectory()
                && dirent.name.startsWith(FilenameEnumerator.RECOVERY_FILE_NAME_PREFIX)
                && !this.database.files.byDestinationName.has(dirent.name)
                && !this.database.subdirectories.byDestinationName.has(dirent.name)) {
                return this.fileManager.deleteFile({
                    destination: node.path.join(path, dirent.name),
                    suppressConsoleOutput: true
                });
            } else {
                return true;
            }
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Compare the database with the current destination directory
    //------------------------------------------------------------------------------------------------------------------

    public analyzeDirectory(directory: MappedDirectory, destinationChildren: Map<string, Dirent>) {
        const sourceChildren = FileUtils.getChildrenIfDirectoryExists(directory.source.absolutePath).map;
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
    // Sort directory items (directories first, recovery archive last)
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
    // Synchronize a single file or directory
    //------------------------------------------------------------------------------------------------------------------

    private processItem(
        parentDirectory: MappedDirectory,
        sourceDirent?: Dirent,
        databaseEntry?: MappedSubdirectory | MappedFile,
        destinationDirent?: Dirent
    ) {
        if (databaseEntry) {
            return this.processPreexistingItem(parentDirectory, databaseEntry, sourceDirent, destinationDirent);
        } else if (sourceDirent) {
            return this.processNewItem(parentDirectory, sourceDirent);
        } else {
            return true;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process an item that is registered in the database
    //------------------------------------------------------------------------------------------------------------------

    private processPreexistingItem(
        parentDirectory: MappedDirectory,
        databaseEntry: MappedSubdirectory | MappedFile,
        sourceDirent?: Dirent,
        destinationDirent?: Dirent
    ) {
        if (sourceDirent && destinationDirent) {
            return this.processPreservedItem(parentDirectory, databaseEntry, sourceDirent, destinationDirent);
        } else if (sourceDirent) {
            return this.processVanishedItem(parentDirectory, databaseEntry, sourceDirent)
        } else {
            return this.processDeletedItem(parentDirectory, databaseEntry, destinationDirent);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a new item that's not in the database yet
    //------------------------------------------------------------------------------------------------------------------

    private processNewItem(parentDirectory: MappedDirectory, sourceDirent: Dirent) {
        return FileUtils.isDirectoryOrDirectoryLink(parentDirectory.source.absolutePath, sourceDirent)
            ? this.processNewDirectory(parentDirectory, sourceDirent)
            : this.processNewFile(parentDirectory, sourceDirent);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a previously synced item that's no longer in the source but might still be in the destination
    //------------------------------------------------------------------------------------------------------------------

    private processDeletedItem(
        parentDirectory: MappedDirectory, databaseEntry: MappedSubdirectory | MappedFile, destinationDirent?: Dirent
    ) {
        return databaseEntry instanceof MappedFile
            ? this.processDeletedFile(parentDirectory, databaseEntry, destinationDirent)
            : this.processDeletedDirectory(parentDirectory, databaseEntry, destinationDirent)
    }















    //------------------------------------------------------------------------------------------------------------------
    // Process a new directory that was created after the last sync
    //------------------------------------------------------------------------------------------------------------------

    private processNewDirectory(parentDirectory: MappedDirectory, sourceDirent: Dirent) {
        const subdirectory = this.fileManager.createDirectory(parentDirectory, sourceDirent);
        if (subdirectory) {
            this.statistics.copy.new.directories.success++;
            return this.syncDirectory(subdirectory);
        } else {
            this.statistics.copy.new.directories.failed++;
            return false;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a new file that was created after the last sync
    //------------------------------------------------------------------------------------------------------------------

    private processNewFile(parentDirectory: MappedDirectory, sourceDirent: Dirent) {
        if (this.fileManager.compressFile(parentDirectory, sourceDirent)) {
            this.statistics.copy.new.files.success++;
            return true;
        } else {
            this.statistics.copy.new.files.failed++;
            return false;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a previously synced item that's still in the source but has disappeared from the destination
    //------------------------------------------------------------------------------------------------------------------

    private processVanishedItem(
        parentDirectory: MappedDirectory, databaseEntry: MappedSubdirectory | MappedFile, sourceDirent: Dirent
    ) {
        const prefix = this.isDryRun ? "Would purge" : "Purging";
        const sourcePath = databaseEntry.source.absolutePath;
        const destinationPath = databaseEntry.destination.absolutePath;
        const children = databaseEntry instanceof MappedFile
            ? { files: 0, subdirectories: 0 }
            : databaseEntry.countChildren();
        const suffix = children.files || children.subdirectories
            ? ` (including ${children.files} files and ${children.subdirectories} subdirectories)`
            : "";
        this.logger.warn(`${prefix} ${sourcePath}${suffix} from the database because ${destinationPath} has vanished`);
        parentDirectory.delete(databaseEntry);
        this.statistics.purge.vanished.files.success += children.files;
        this.statistics.purge.vanished.directories.success += children.subdirectories + 1;
        this.processNewItem(parentDirectory, sourceDirent);
        return true;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a previously synced directory that's no longer in the source but might still be in the destination
    //------------------------------------------------------------------------------------------------------------------

    private processDeletedFile(
        parentDirectory: MappedDirectory, databaseEntry: MappedFile, destinationDirent?: Dirent
    ) {
        parentDirectory.delete(databaseEntry);
        if (destinationDirent) {
            const success = this.fileManager.deleteFile({
                destination: databaseEntry.destination.absolutePath,
                source: databaseEntry.source.absolutePath,
                reason: "because the source file was deleted"
            });
            if (success) {
                this.statistics.delete.deleted.files.success++;
            } else {
                this.statistics.delete.deleted.files.failed++;
            }
            return success;
        } else {
            this.statistics.purge.vanished.files.success++;
            return true;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a previously synced file that's no longer in the source but might still be in the destination
    //------------------------------------------------------------------------------------------------------------------

    private processDeletedDirectory(
        parentDirectory: MappedDirectory, databaseEntry: MappedSubdirectory, destinationDirent?: Dirent
    ) {
        parentDirectory.delete(databaseEntry);
        if (destinationDirent) {
            const destinationDirents = FileUtils.getChildrenIfDirectoryExists(databaseEntry.destination.absolutePath);
            const success1 = this.mapAndReduce(
                Array.from(databaseEntry.files.bySourceName.values()),
                file => this.processDeletedFile(
                    databaseEntry,
                    file,
                    destinationDirents.map.get(file.destination.name)
                )
            );
            const success2 = this.mapAndReduce(
                Array.from(databaseEntry.subdirectories.bySourceName.values()),
                subdirectory => this.syncDirectory(subdirectory)
            );
            const success3 = success1 && success2 && this.fileManager.deleteDirectory({
                destination: databaseEntry.destination.absolutePath,
                source: databaseEntry.source.absolutePath,
                reason: "because the source directory was deleted"
            });
            if (success3) {
                this.statistics.delete.deleted.directories.success++;
            } else {
                this.statistics.delete.deleted.directories.failed++;
            }
            return success3;
        }
        return true;
    }


    //------------------------------------------------------------------------------------------------------------------
    // Process a previously synced item that still exists in the source and in the destination
    //------------------------------------------------------------------------------------------------------------------
    private processPreservedItem(
        _parentDirectory: MappedDirectory, _databaseEntry: MappedDirectory | MappedFile, _sourceDirent: Dirent, _destinationDirent: Dirent
    ) {
        // TODO: file might have been modified or the there might have been a swap (file <=> directory)
        return true;
    }



}
