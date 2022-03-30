//----------------------------------------------------------------------------------------------------------------------
// Orchestrating process for the synchronization
//----------------------------------------------------------------------------------------------------------------------

class Synchronizer {

    private readonly logger;
    private readonly isDryRun;
    private readonly fileManager;

    private readonly statistics = new SyncStats();

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    private constructor(readonly context: Context, readonly database: MappedRootDirectory) {
        this.fileManager = new FileManager(context, database);
        this.logger = context.logger;
        this.isDryRun = context.options.dryRun;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run the synchronization
    //------------------------------------------------------------------------------------------------------------------

    public static run(context: Context, database: MappedRootDirectory) {
        const synchronizer = new Synchronizer(context, database);
        synchronizer.syncDirectory(database);
        const statistics = synchronizer.statistics;
        if (!statistics.copied.total && !statistics.deleted.total) {
            context.print("The destination is already up to date");
        }
        synchronizer.processRecoveryArchive();
        DatabaseSerializer.saveDatabase(context, database);
        StatisticsReporter.run(context, synchronizer.statistics);
        return WarningsGenerator.run(context, synchronizer.statistics);
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
            return true;
        } else {
            const success = this.fileManager.deleteFile({ destination });
            if (success) {
                this.statistics.orphans.files.success++;
            } else {
                this.statistics.orphans.files.failed++;
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
            this.statistics.orphans.directories.success++;
        } else {
            this.statistics.orphans.directories.failed++;
        }
        return success;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete the contents of an orphan directory
    //------------------------------------------------------------------------------------------------------------------

    private deleteOrphanedChildren(absoluteParentPath: string) {
        return this.mapAndReduce(
            FileUtils.getChildren(absoluteParentPath).array,
            dirent => this.deleteOrphanedItem(node.path.join(absoluteParentPath, dirent.name), dirent)
        );
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
        if (this.fileManager.compressFile(parentDirectory, sourceDirent)) {
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
        parentDirectory: MappedDirectory, databaseEntry: MappedSubdirectory | MappedFile, sourceDirent: Dirent
    ) {

        const prefix = this.isDryRun ? "Would purge" : "Purging";
        const sourcePath = databaseEntry.source.absolutePath;
        const destinationPath = databaseEntry.destination.absolutePath;
        const children = databaseEntry instanceof MappedFile
            ? { files: 1, subdirectories: 0 }
            : databaseEntry.countChildren();
        const suffix = children.files || children.subdirectories
            ? ` (including ${children.files} files and ${children.subdirectories} subdirectories)`
            : "";
        this.logger.warn(`${prefix} ${sourcePath}${suffix} from the database because ${destinationPath} has vanished`);
        parentDirectory.delete(databaseEntry);
        this.statistics.purged.files.success += children.files;
        this.statistics.purged.directories.success += children.subdirectories;
        if (databaseEntry instanceof MappedDirectoryBase) {
            this.statistics.purged.directories.success += children.subdirectories;
        }
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
            const success1 = this.mapAndReduce(
                Array.from(databaseEntry.files.bySourceName.values()),
                file => this.processDeletedFile(
                    databaseEntry,
                    file,
                    destinationChildren.map.get(file.destination.name)
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
                this.statistics.deleted.directories.success++;
            } else {
                this.statistics.deleted.directories.failed++;
            }
            return success3;
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
        const sourceIsDirectory = FileUtils.isDirectoryOrDirectoryLink(
            databaseEntry.source.absolutePath, sourceDirent
        );
        const destinationIsDirectory = FileUtils.isDirectoryOrDirectoryLink(
            databaseEntry.destination.absolutePath, destinationDirent
        );
        if (sourceIsDirectory !== destinationIsDirectory) {
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
        const properties = databaseEntry.source.getProperties();
        const hasChanged = databaseEntry.created !== properties.ctimeMs
            && databaseEntry.modified !== properties.mtimeMs
            && databaseEntry.size !== properties.size;
        if (hasChanged) {
            return this.processModifiedFile(parentDirectory, databaseEntry, sourceDirent, "the source file was modified");
        } else if (!this.context.sevenZip.isReadableWithCurrentPassword(databaseEntry.destination.absolutePath)) {
            return this.processModifiedFile(parentDirectory, databaseEntry, sourceDirent, "the password has changed");
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
        const copySucceeded = !!this.fileManager.compressFile(parentDirectory, sourceDirent);
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

    private processRecoveryArchive() {
        const recoveryArchives = this.getRecoveryArchives();
        if (1 === recoveryArchives.length && !this.statistics.success) {
            const recoveryArchive = node.path.join(this.database.source.absolutePath, recoveryArchives[0].name);
            if (this.context.sevenZip.isReadableWithCurrentPassword(recoveryArchive)) {
                const archiveName = node.path.basename(recoveryArchives[0].name);
                this.logger.info(`The recovery archive ${archiveName} does not need to be updated`);
                this.statistics.recoveryArchive.isUpToDate = true;
                return true;
            }
        }
        return this.recreateRecoveryArchive(recoveryArchives);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get a list of all recovery archives
    //------------------------------------------------------------------------------------------------------------------

    private getRecoveryArchives() {
        return FileUtils.getChildrenIfDirectoryExists(this.database.destination.absolutePath).array.filter(dirent =>
            !dirent.isDirectory()
            && dirent.name.startsWith(FilenameEnumerator.RECOVERY_FILE_NAME_PREFIX)
            && !this.database.files.byDestinationName.has(dirent.name)
            && !this.database.subdirectories.byDestinationName.has(dirent.name)
        );
    }

    //------------------------------------------------------------------------------------------------------------------
    // Recreate the recovery archive
    //------------------------------------------------------------------------------------------------------------------

    private recreateRecoveryArchive(recoveryArchives: Dirent[]) {
        const success = RecoveryArchiveCreator.create(this.context, this.database);
        if (success) {
            this.statistics.recoveryArchive.isUpToDate = true;
            this.deleteRecoveryArchives(recoveryArchives);
        }
        return success;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete recovery archives from the root folder
    //------------------------------------------------------------------------------------------------------------------

    private deleteRecoveryArchives(recoveryArchives: Dirent[]) {
        if (recoveryArchives.length) {
            const success = recoveryArchives
                .map(dirent => node.path.join(this.database.destination.absolutePath, dirent.name))
                .filter(name => this.fileManager.deleteFile({ destination: name, suppressConsoleOutput: true }))
                .length;
            this.statistics.orphans.files.success += Math.max(0, success - 1);
            this.statistics.orphans.files.failed += Math.max(0, recoveryArchives.length - success - (success ? 0 : 1));
            this.statistics.recoveryArchive.hasLingeringOrphans = success < recoveryArchives.length;
        }
    }
}
