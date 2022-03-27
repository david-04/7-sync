//----------------------------------------------------------------------------------------------------------------------
// Orchestrating process for the synchronization
//----------------------------------------------------------------------------------------------------------------------

class Synchronizer {

    private readonly fileManager;

    private readonly statistics = asReadonly({
        delete: asReadonly({
            orphans: new Statistics(),
            outdated: new Statistics()
        }),
        copy: asReadonly({
            new: new Statistics(),
            modified: new Statistics()
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
        const destinationChildren = FileUtils.getChildren(directory.destination.absolutePath).map;
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
        const sourceChildren = FileUtils.getChildren(directory.source.absolutePath).map;
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
        array: Array<{ source?: Dirent, database?: MappedSubDirectory | MappedFile, destination?: Dirent }>
    ) {
        return array.map(item => {
            let isDirectory = item.database instanceof MappedSubDirectory;
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
        directory: MappedDirectory, source?: Dirent, database?: MappedDirectory | MappedFile, destination?: Dirent
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
        directory: MappedDirectory, database: MappedDirectory | MappedFile, source?: Dirent, destination?: Dirent
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
    // Process a previously synced item that still exists in the source and in the destination
    //------------------------------------------------------------------------------------------------------------------
    private processPreservedItem(
        _directory: MappedDirectory, _database: MappedDirectory | MappedFile, _source: Dirent, _destination: Dirent
    ) {
        // TODO: file might have been modified or the there might have been a swap (file <=> directory)
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a previously synced item that's still in the source but has disappeared from the destination
    //------------------------------------------------------------------------------------------------------------------

    private processVanishedItem(
        _directory: MappedDirectory, _database: MappedDirectory | MappedFile, _source: Dirent
    ) {
        // TODO: the item is still in the source but has vanished from the destination
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a previously synced item that's no longer in the source but might still be in the destination
    //------------------------------------------------------------------------------------------------------------------

    private processDeletedItem(
        _directory: MappedDirectory, _database: MappedDirectory | MappedFile, _destination?: Dirent
    ) {
        // TODO: the item was deleted from the source but is still in the destination
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
    // Process a new directory that's not in the database yet
    //------------------------------------------------------------------------------------------------------------------

    private processNewDirectory(_parentDirectory: MappedDirectory, _source: Dirent) {
        // TODO: create directory, add to database and recurse into it
        return true;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Process a new file that's not in the database yet
    //------------------------------------------------------------------------------------------------------------------

    private processNewFile(_directory: MappedDirectory, _source: Dirent) {
        // TODO: new file: zip file and add to database
        return true;
    }



    // //------------------------------------------------------------------------------------------------------------------
    // // Create a new directory
    // //------------------------------------------------------------------------------------------------------------------

    // public createDirectory(database: MappedRootDirectory, directory: MappedDirectory, entry: Dirent) {
    //     const result = this.syncAndLog(
    //         database,
    //         directory,
    //         entry,
    //         "",
    //         () => this.statistics.sync.directories.success++,
    //         () => this.statistics.sync.directories.failed++,
    //         filename => {
    //             node.fs.mkdirSync(node.path.join(directory.destination.absolutePath, filename));
    //             return true;
    //         }
    //     );
    //     if (result) {
    //         const source = new SubDirectory(directory.source, entry.name);
    //         const destination = new SubDirectory(directory.destination, result.filename);
    //         const newDirectory = new MappedSubDirectory(directory, source, destination, "");
    //         directory.add(newDirectory);
    //         directory.last = result.last;
    //         this.syncDirectory(newDirectory);
    //     }
    // }

    // //------------------------------------------------------------------------------------------------------------------
    // // Synchronize a single file
    // //------------------------------------------------------------------------------------------------------------------

    // public compressFile(database: MappedRootDirectory, parentDirectory: MappedDirectory, entry: Dirent) {
    //     const result = this.syncAndLog(
    //         database,
    //         parentDirectory,
    //         entry,
    //         ".7z",
    //         () => this.statistics.sync.files.success++,
    //         () => this.statistics.sync.files.failed++,
    //         filename => {
    //             const root = database.source.absolutePath;
    //             const path = node.path.relative(root, node.path.join(parentDirectory.source.absolutePath, entry.name));
    //             const zipFile = node.path.join(parentDirectory.destination.absolutePath, filename);
    //             const { status, stdout } = this.context.sevenZip.compressFile(root, path, zipFile);
    //             if (0 === status) {
    //                 return true;
    //             } else {
    //                 this.logger.error(`7-Zip exited with error code ${status}`, stdout);
    //                 node.fs.rmSync(zipFile);
    //                 return false;
    //             }
    //         }
    //     );
    //     if (result) {
    //         const source = new File(parentDirectory.source, entry.name);
    //         const destination = new File(parentDirectory.destination, result.filename);
    //         const properties = source.getProperties();
    //         parentDirectory.add(new MappedFile(
    //             parentDirectory,
    //             source,
    //             destination,
    //             properties.ctimeMs,
    //             properties.mtimeMs,
    //             properties.size
    //         ));
    //         parentDirectory.last = result.last;
    //     }
    // }

    // //------------------------------------------------------------------------------------------------------------------
    // // Sync and log the syncing of single item
    // //------------------------------------------------------------------------------------------------------------------

    // private syncAndLog(
    //     database: MappedRootDirectory,
    //     directory: MappedDirectory,
    //     file: Dirent,
    //     suffix: string,
    //     onSuccess: () => void,
    //     onError: () => void,
    //     sync: (filename: string) => boolean
    // ) {
    //     let success = false;
    //     const paths = this.getSourceAndDestinationPaths(database, directory, file, suffix);
    //     const description = `${paths.source.absolutePath} => ${paths.destination.absolutePath}`;
    //     this.print(`+ ${paths.source.relativePath}`);
    //     if (this.isDryRun) {
    //         this.logger.info(`Would sync ${description}`);
    //         success = true;
    //     } else {
    //         this.logger.info(`Syncing ${description}`);
    //         if (sync(paths.destination.filename) && FileUtils.exists(paths.destination.absolutePath)) {
    //             success = true;
    //         } else {
    //             this.logger.warn(`Failed to sync ${description}`);
    //             this.print("  => FAILED!")
    //         }
    //     }
    //     if (success) {
    //         onSuccess();
    //         return { filename: paths.destination.filename, last: paths.next };
    //     } else {
    //         onError();
    //         return undefined;
    //     }
    // }

    // //------------------------------------------------------------------------------------------------------------------
    // // Retrieve source and destination information
    // //------------------------------------------------------------------------------------------------------------------

    // private getSourceAndDestinationPaths(
    //     database: MappedRootDirectory,
    //     directory: MappedDirectory,
    //     file: Dirent,
    //     suffix: string
    // ) {
    //     const sourceAbsolute = node.path.join(directory.source.absolutePath, file.name);
    //     const sourceRelative = node.path.relative(database.source.absolutePath, sourceAbsolute);
    //     const next = this.context.filenameEnumerator.getNextAvailableFilename(directory.destination.absolutePath, directory.last, "", suffix);
    //     const destinationAbsolute = node.path.join(directory.destination.absolutePath, next.filename);
    //     const destinationRelative = node.path.relative(database.destination.absolutePath, destinationAbsolute);
    //     return {
    //         source: {
    //             absolutePath: sourceAbsolute,
    //             relativePath: sourceRelative
    //         },
    //         destination: {
    //             filename: next.filename,
    //             absolutePath: destinationAbsolute,
    //             relativePath: destinationRelative
    //         },
    //         next: next.enumeratedName
    //     };
    // }


    // //------------------------------------------------------------------------------------------------------------------
    // // Copy (zip) a single file
    // //------------------------------------------------------------------------------------------------------------------

    // private copyFile(statistics: Statistics, sourcePath: string, destinationPath: string) {

    // }

}
