//----------------------------------------------------------------------------------------------------------------------
// Orchestrating process for the synchronization
//----------------------------------------------------------------------------------------------------------------------

class Synchronizer {

    private readonly logger;
    private readonly print;
    private readonly isDryRun;

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
        readonly _database: MappedRootDirectory,
        _forceReEncrypt: boolean
    ) {
        this.logger = context.logger;
        this.print = context.print;
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
        const destinationChildren = FileUtils.getChildren(directory.destination.absolutePath).map;
        this.deleteOrphans(directory, destinationChildren);
        // {name: string, source: dirent, database: mapped, destination: dirent}
        // this.getCategorizedChildren(directory, destinationChildren).forEach(child => {
        //     if (child.source && !child.database && FileUtils.isDirectoryOrDirectoryLink(child.source)) {
        //         //
        //     }
        // })
        // recursively sync all children
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
                    : this.deleteFile({ destination, statistics: this.statistics.delete.orphans });
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
        return this.deleteDirectory({ destination: absolutePath, statistics: this.statistics.delete.orphans });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete the contents of an orphan directory
    //------------------------------------------------------------------------------------------------------------------

    private deleteOrphanedChildren(absoluteParentPath: string) {
        return FileUtils.getChildren(absoluteParentPath).array.map(dirent => {
            const destination = node.path.join(absoluteParentPath, dirent.name)
            return dirent.isDirectory()
                ? this.deleteOrphanedDirectory(destination)
                : this.deleteFile({ destination, statistics: this.statistics.delete.orphans });
        }).some(result => !result);
    }














    // //------------------------------------------------------------------------------------------------------------------
    // // Compare the database with the current file contents
    // //------------------------------------------------------------------------------------------------------------------

    // public getCategorizedChildren(directory: MappedDirectory, destinationChildren: Map<string, Dirent>) {
    //     const sourceChildren = FileUtils.getChildren(directory.source.absolutePath).map;
    //     const databaseChildren = new Map<string, MappedSubDirectory | MappedFile>();
    //     directory.files.bySourceName.forEach(file => databaseChildren.set(file.source.name, file));
    //     directory.subdirectories.bySourceName.forEach(subdirectory => databaseChildren.set(subdirectory.source.name, subdirectory));
    //     const allChildren = new Set<string>();
    //     sourceChildren.forEach((_dirent, name) => allChildren.add(name))
    //     databaseChildren.forEach((_mappedFileOrDirectory, name) => allChildren.add(name));
    //     return Array.from(allChildren).sort().map(name => ({
    //         source: sourceChildren.get(name),
    //         database: databaseChildren.get(name),
    //         destination: destinationChildren.get(databaseChildren.get(name)?.source.name ?? "")
    //     }));
    // }


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

    //------------------------------------------------------------------------------------------------------------------
    // Delete a single file
    //------------------------------------------------------------------------------------------------------------------

    private deleteFile(options: {
        statistics: Statistics,
        destination: string,
        source?: string,
        suppressConsoleOutput?: boolean,
        reason?: string
    }) {
        return this.deleteFileOrDirectory({ ...options, type: "file", statistics: options.statistics.files });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete a single directory
    //------------------------------------------------------------------------------------------------------------------

    private deleteDirectory(options: {
        statistics: Statistics,
        destination: string,
        source?: string,
        suppressConsoleOutput?: boolean,
        reason?: string
    }) {
        return this.deleteFileOrDirectory({ ...options, type: "directory", statistics: options.statistics.directories });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Generic delete function with logging and dry-run handling
    //------------------------------------------------------------------------------------------------------------------

    private deleteFileOrDirectory(options: {
        statistics: { success: number, failed: number },
        destination: string,
        source?: string,
        suppressConsoleOutput?: boolean,
        reason?: string,
        type: "file" | "directory"
    }) {
        const isOrphan = !options.source;
        const reason = options.reason ? ` ${options.reason}` : "";
        if (!options.suppressConsoleOutput) {
            const displayPath = this.getRelativeDisplayPath(options.destination, options.source);
            const suffix = isOrphan ? " (orphan)" : "";
            this.print(`- ${displayPath}${suffix}`);
        }
        if (isOrphan) {
            this.logger.warn(this.isDryRun
                ? `Would delete orphaned ${options.type} ${options.destination}`
                : `Deleting orphaned ${options.type} ${options.destination}`
            );
        } else {
            this.logger.info(this.isDryRun
                ? `Would delete ${options.destination} ${reason}`
                : `Deleting ${options.destination} ${reason}`
            );
        }
        const isDirectory = "directory" === options.type;
        const success = this.doDeleteFileOrDirectory(options.destination, options.statistics, isDirectory);
        if (!success && !options.suppressConsoleOutput) {
            this.print("===> FAILED");
        }
        return success;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete the given file or directory
    //------------------------------------------------------------------------------------------------------------------

    private doDeleteFileOrDirectory(
        path: string, statistics: { success: number, failed: number }, isDirectory: boolean
    ) {
        let success = true;
        if (!this.isDryRun) {
            try {
                node.fs.rmSync(path, isDirectory ? { recursive: true, force: true } : {});
                if (FileUtils.exists(path)) {
                    throw new FriendlyException("No exception was raised but the file is still present");
                }
            } catch (exception) {
                this.logger.error(`Failed to delete ${path} - ${firstLineOnly(exception)}`);
                success = false;
            }
        }
        success ? statistics.success++ : statistics.failed++;
        return success;
    }


    //------------------------------------------------------------------------------------------------------------------
    // Get thr relative display path for the console output
    //------------------------------------------------------------------------------------------------------------------

    private getRelativeDisplayPath(destinationPath: string, sourcePath?: string) {
        return sourcePath
            ? node.path.relative(this._database.source.absolutePath, sourcePath)
            : node.path.relative(this._database.destination.absolutePath, destinationPath)
    }
}
