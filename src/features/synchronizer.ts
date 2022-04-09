//----------------------------------------------------------------------------------------------------------------------
// Orchestrating process for the synchronization
//----------------------------------------------------------------------------------------------------------------------

class Synchronizer {

    private readonly logger;
    private readonly isDryRun;
    private readonly fileManager;
    private readonly print;

    private readonly statistics = new SyncStats();

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    private constructor(
        private context: Context,
        private readonly metadataManager: MetadataManager,
        private readonly database: MappedRootDirectory
    ) {
        this.fileManager = new FileManager(context, database);
        this.logger = context.logger;
        this.isDryRun = context.options.dryRun;
        this.print = context.print;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run the synchronization
    //------------------------------------------------------------------------------------------------------------------

    public static run(context: Context, metadataManager: MetadataManager, database: MappedRootDirectory) {
        const synchronizer = new Synchronizer(context, metadataManager, database);
        synchronizer.syncDirectory(database);
        const statistics = synchronizer.statistics;
        if (!statistics.copied.total && !statistics.deleted.total && !statistics.orphans.total) {
            context.print("The destination is already up to date");
            context.logger.info("The destination is already up to date - no changes required");
        }
        if (database.hasUnsavedChanges()) {
            synchronizer.updateIndex();
        }
        StatisticsReporter.run(context, synchronizer.statistics);
        return WarningsGenerator.run(context, synchronizer.statistics);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Sync a directory
    //------------------------------------------------------------------------------------------------------------------

    private syncDirectory(directory: MappedDirectory): boolean {
        const absoluteDestinationPath = directory.destination.absolutePath;
        const destinationChildren = FileUtils.getChildrenIfDirectoryExists(absoluteDestinationPath).map;
        this.logAndDiscardSymbolicLinks(absoluteDestinationPath, destinationChildren, "destination");
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
                const relativeRootPath = node.path.relative(
                    this.database.source.absolutePath,
                    database.source.absolutePath
                );
                const success = this.deleteOrphanedItem(destination, dirent, path => {
                    return node.path.join(relativeRootPath, name, path.substring(destination.length));
                });
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

    private deleteOrphanedItem(destination: string, dirent: Dirent, pathMapper: (destination: string) => string) {
        this.updateIndexIfRequired();
        const isRootFolder = node.path.dirname(destination) === this.database.destination.absolutePath;
        if (isRootFolder && MetadataManager.isMetadataArchiveName(dirent.name)) {
            return true;
        } else {
            return dirent.isDirectory()
                ? this.deleteOrphanedDirectory(destination, pathMapper)
                : this.deleteOrphanedFile(destination, pathMapper);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete an orphan directory
    //------------------------------------------------------------------------------------------------------------------

    private deleteOrphanedDirectory(absolutePath: string, pathMapper: (destination: string) => string) {
        this.deleteOrphanedChildren(absolutePath, pathMapper);
        if (!this.statistics.orphans.total) {
            this.recalculateLastFilenames();
        }
        const success = this.fileManager.deleteDirectory({
            destination: absolutePath,
            orphanDisplayPath: pathMapper(absolutePath)
        });
        if (success) {
            this.statistics.orphans.directories.success++;
        } else {
            this.statistics.orphans.directories.failed++;
        }
        return success;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete the contents of an orphan directory
    //------------------------------------------------------------------------------------------------------------------

    private deleteOrphanedChildren(absoluteParentPath: string, pathMapper: (destination: string) => string) {
        return this.mapAndReduce(
            FileUtils.getChildren(absoluteParentPath).array,
            dirent => this.deleteOrphanedItem(node.path.join(absoluteParentPath, dirent.name), dirent, pathMapper)
        );
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete an orphaned file
    //------------------------------------------------------------------------------------------------------------------

    private deleteOrphanedFile(destination: string, pathMapper: (destination: string) => string) {
        if (!this.statistics.orphans.total) {
            this.recalculateLastFilenames();
        }
        const success = this.fileManager.deleteFile({ destination, orphanDisplayPath: pathMapper(destination) });
        if (success) {
            this.statistics.orphans.files.success++;
        } else {
            this.statistics.orphans.files.failed++;
        }
        return success;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Compare the database with the current destination directory
    //------------------------------------------------------------------------------------------------------------------

    private analyzeDirectory(directory: MappedDirectory, destinationChildren: Map<string, Dirent>) {
        const sourceChildren = FileUtils.getChildrenIfDirectoryExists(directory.source.absolutePath).map;
        this.logAndDiscardSymbolicLinks(directory.source.absolutePath, sourceChildren, "source");
        const databaseFiles = directory.files.bySourceName.values();
        const databaseSubdirectories = directory.subdirectories.bySourceName.values();
        const databaseItems = [...databaseFiles, ...databaseSubdirectories].map(database => ({
            source: sourceChildren.get(database.source.name),
            database,
            destination: destinationChildren.get(database.destination.name)
        }));
        databaseItems.forEach(item => {
            if (item.source) {
                sourceChildren.delete(item.source.name);
            }
        });
        const sourceOnlyItems = Array.from(sourceChildren.values()).map(source => ({
            source, database: undefined, destination: undefined
        }));
        return this.sortAnalysisResults(...sourceOnlyItems, ...databaseItems);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Remove symbolic links from the map
    //------------------------------------------------------------------------------------------------------------------

    private logAndDiscardSymbolicLinks(path: string, map: Map<string, Dirent>, category: "source" | "destination") {
        const toDelete = Array.from(map.values()).filter(dirent => !dirent.isFile() && !dirent.isDirectory());
        toDelete.forEach(dirent => map.delete(dirent.name));
        const unprocessable = this.statistics.unprocessable;
        const statistics = "source" === category ? unprocessable.source : unprocessable.destination;
        statistics.symlinks += toDelete.filter(dirent => dirent.isSymbolicLink()).length;
        statistics.other += toDelete.filter(dirent => !dirent.isSymbolicLink()).length;
        toDelete.map(entry => node.path.join(path, entry.name)).forEach(name =>
            this.logger.warn(`Ignoring ${name} because it's a symbolic link or otherwise unprocessable`)
        );
    }

    //------------------------------------------------------------------------------------------------------------------
    // Sort directory items (directories first, recovery archive last)
    //------------------------------------------------------------------------------------------------------------------

    private sortAnalysisResults(
        ...array: Array<{ source?: Dirent, database?: MappedSubdirectory | MappedFile, destination?: Dirent }>
    ) {
        return array.map(item => {
            let isDirectory = item.database instanceof MappedSubdirectory;
            if (!isDirectory && item.source) {
                isDirectory = item.source.isDirectory();
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
        this.updateIndexIfRequired();
        if (databaseEntry) {
            return this.processKnownItem(parentDirectory, databaseEntry, sourceDirent, destinationDirent);
        } else if (sourceDirent) {
            return this.processNewItem(parentDirectory, sourceDirent);
        } else {
            return true;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process an item that is registered in the database
    //------------------------------------------------------------------------------------------------------------------

    private processKnownItem(
        parentDirectory: MappedDirectory,
        databaseEntry: MappedSubdirectory | MappedFile,
        sourceDirent?: Dirent,
        destinationDirent?: Dirent
    ) {
        if (sourceDirent && destinationDirent) {
            return this.processPreexistingItem(parentDirectory, databaseEntry, sourceDirent, destinationDirent);
        } else if (destinationDirent) {
            return this.processDeletedItem(parentDirectory, databaseEntry, destinationDirent);
        } else {
            return this.processVanishedItem(parentDirectory, databaseEntry, sourceDirent);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a new item that's not in the database yet
    //------------------------------------------------------------------------------------------------------------------

    private processNewItem(parentDirectory: MappedDirectory, sourceDirent: Dirent) {
        return sourceDirent.isDirectory()
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
            this.statistics.copied.directories.success++;
            return this.syncDirectory(subdirectory);
        } else {
            this.statistics.copied.directories.failed++;
            return false;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a new file that was created after the last sync
    //------------------------------------------------------------------------------------------------------------------

    private processNewFile(parentDirectory: MappedDirectory, sourceDirent: Dirent) {
        if (this.fileManager.zipFile(parentDirectory, sourceDirent)) {
            this.statistics.copied.files.success++;
            return true;
        } else {
            this.statistics.copied.files.failed++;
            return false;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a previously synced item that's still in the source but has disappeared from the destination
    //------------------------------------------------------------------------------------------------------------------

    private processVanishedItem(
        parentDirectory: MappedDirectory, databaseEntry: MappedSubdirectory | MappedFile, sourceDirent?: Dirent
    ) {
        const prefix = this.isDryRun ? "Would purge" : "Purging";
        const sourcePath = databaseEntry.source.absolutePath;
        const destinationPath = databaseEntry.destination.absolutePath;
        const children = databaseEntry instanceof MappedFile
            ? { files: 1, subdirectories: 0 }
            : databaseEntry.countChildren();
        const files = 1 === children.files ? `${children.files} file` : `${children.files} files`;
        const subdirectories = 1 === children.subdirectories
            ? `${children.subdirectories} subdirectory`
            : `${children.subdirectories} subdirectories`;
        const suffix = databaseEntry instanceof MappedSubdirectory && (children.files || children.subdirectories)
            ? ` (including ${files} and ${subdirectories})`
            : "";
        this.logger.warn(`${prefix} ${sourcePath}${suffix} from the database because ${destinationPath} has vanished`);
        parentDirectory.delete(databaseEntry);
        this.statistics.purged.files.success += children.files;
        this.statistics.purged.directories.success += children.subdirectories;
        if (databaseEntry instanceof MappedDirectoryBase) {
            this.statistics.purged.directories.success += children.subdirectories;
        }
        if (sourceDirent) {
            this.processNewItem(parentDirectory, sourceDirent);
        }
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
                this.statistics.deleted.files.success++;
            } else {
                this.statistics.deleted.files.failed++;
            }
            return success;
        } else {
            this.statistics.purged.files.success++;
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
            const destinationChildren = FileUtils.getChildrenIfDirectoryExists(databaseEntry.destination.absolutePath);
            const success1 = this.deleteOrphans(databaseEntry, destinationChildren.map);
            const success2 = this.mapAndReduce(
                databaseEntry.files.bySourceName.values(),
                file => {
                    const dirent = destinationChildren.map.get(file.destination.name);
                    return this.processDeletedFile(databaseEntry, file, dirent);
                }
            );
            const success3 = this.mapAndReduce(
                databaseEntry.subdirectories.bySourceName.values(),
                subdirectory => this.syncDirectory(subdirectory)
            );
            const success4 = success1 && success2 && success3 && this.fileManager.deleteDirectory({
                destination: databaseEntry.destination.absolutePath,
                source: databaseEntry.source.absolutePath,
                reason: "because the source directory was deleted"
            });
            if (success4) {
                this.statistics.deleted.directories.success++;
            } else {
                this.statistics.deleted.directories.failed++;
            }
            return success4;
        }
        return true;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a previously synced item that still exists in the source and in the destination
    //------------------------------------------------------------------------------------------------------------------

    private processPreexistingItem(
        parentDirectory: MappedDirectory,
        databaseEntry: MappedSubdirectory | MappedFile,
        sourceDirent: Dirent,
        destinationDirent: Dirent
    ) {
        if (sourceDirent.isDirectory() !== destinationDirent.isDirectory()) {
            const success1 = this.processDeletedItem(parentDirectory, databaseEntry, destinationDirent);
            const success2 = this.processNewItem(parentDirectory, sourceDirent);
            return success1 && success2;
        } else if (databaseEntry instanceof MappedFile) {
            return this.processPreexistingFile(parentDirectory, databaseEntry, sourceDirent);
        } else {
            return this.syncDirectory(databaseEntry);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a previously synced file that still exists in the source and in the destination
    //------------------------------------------------------------------------------------------------------------------

    private processPreexistingFile(parentDirectory: MappedDirectory, databaseEntry: MappedFile, sourceDirent: Dirent) {
        const properties = FileUtils.getProperties(databaseEntry.source.absolutePath);
        const hasChanged = databaseEntry.created !== properties.birthtimeMs
            || databaseEntry.modified !== properties.ctimeMs
            || databaseEntry.size !== properties.size;
        if (hasChanged) {
            return this.processModifiedFile(parentDirectory, databaseEntry, sourceDirent, "the source file was modified");
        } else {
            return true;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a previously synced file that still exists in the source and in the destination
    //------------------------------------------------------------------------------------------------------------------

    private processModifiedFile(
        parentDirectory: MappedDirectory, databaseEntry: MappedFile, sourceDirent: Dirent, reason: string
    ) {
        parentDirectory.delete(databaseEntry);
        const deleteSucceeded = this.fileManager.deleteFile({
            destination: databaseEntry.destination.absolutePath,
            source: databaseEntry.source.absolutePath,
            reason: `because ${reason}`,
            suppressConsoleOutput: true
        });
        if (deleteSucceeded) {
            this.statistics.deleted.files.success++;
        } else {
            this.statistics.deleted.files.failed++;
        }
        const copySucceeded = !!this.fileManager.zipFile(parentDirectory, sourceDirent);
        if (copySucceeded) {
            this.statistics.copied.files.success++;
        } else {
            this.statistics.copied.files.failed++;
        }
        return deleteSucceeded && copySucceeded;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Recreate the recovery archive
    //------------------------------------------------------------------------------------------------------------------

    private updateIndex() {
        const { remainingOrphans, isUpToDate } = this.metadataManager.updateIndex(this.database);
        this.statistics.index.hasLingeringOrphans = 0 < remainingOrphans;
        this.statistics.index.isUpToDate = isUpToDate;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Update the index if there are changes that haven't been saved in a while
    //------------------------------------------------------------------------------------------------------------------

    private updateIndexIfRequired() {
        if (this.database.hasUnsavedChanges() && !this.database.wasSavedWithinTheLastSeconds(60)) {
            this.updateIndex();
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // When called for the first time, recursively update the "last" property of all database directories
    //------------------------------------------------------------------------------------------------------------------

    private recalculateLastFilenames() {
        const message1 = "Found orphans - scanning the destination for filenames to not re-use";
        this.logger.info(message1);
        this.print(message1);
        if (this.updateLastFilenames(this.database)) {
            this.updateIndex();
        } else {
            this.logger.info("Did not find any orphan filenames of concern - no need to update the database");
            this.print("Did not find any orphan filenames of concern");
        }
        const message2 = `Continuing with the ${this.isDryRun ? "dry run" : "synchronization"}`
        this.logger.info(message2);
        this.print(message2);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Recursively update the "last" property
    //------------------------------------------------------------------------------------------------------------------

    private updateLastFilenames(directory: MappedDirectory): number {
        const path = directory.destination.absolutePath;
        if (FileUtils.existsAndIsDirectory(path)) {
            const updatedSubdirectories = directory.subdirectories.byDestinationName.values()
                .map(subdirectory => this.updateLastFilenames(subdirectory))
                .reduce((a, b) => a + b, 0);
            const children = FileUtils.getChildrenIfDirectoryExists(path).array.map(dirent => dirent.name);
            const last = this.context.filenameEnumerator.recalculateLastFilename(directory.last, children);
            if (last === directory.last) {
                return updatedSubdirectories;
            } else {
                directory.last = last;
                return updatedSubdirectories + 1;
            }
        } else {
            return 0;
        }
    }
}
