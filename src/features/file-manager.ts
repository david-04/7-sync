//----------------------------------------------------------------------------------------------------------------------
// File operations like zipping and creating/deleting files and directories
//----------------------------------------------------------------------------------------------------------------------

class FileManager {

    private readonly print;
    private readonly logger;
    private readonly isDryRun;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    constructor(private readonly context: Context, private readonly database: MappedRootDirectory) {
        this.print = context.print;
        this.logger = context.logger;
        this.isDryRun = context.options.dryRun;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create a new directory
    //------------------------------------------------------------------------------------------------------------------

    public createDirectory(directory: MappedDirectory, source: Dirent) {
        const paths = this.getSourceAndDestinationPaths(directory, source, "");
        this.print(`+ ${paths.source.relativePath}`);
        const pathInfo = `directory ${paths.source.absolutePath} => ${paths.destination.absolutePath}`;
        let newDestinationDirectory: Subdirectory | undefined;
        if (this.isDryRun) {
            this.logger.info(`Would create ${pathInfo}`);
            newDestinationDirectory = new Subdirectory(directory.destination, paths.destination.filename);
        } else {
            this.logger.info(`Creating ${pathInfo}`);
            try {
                node.fs.mkdirSync(paths.destination.absolutePath);
                if (!FileUtils.exists(paths.destination.absolutePath)) {
                    throw new Error("No exception was raised");
                }
                newDestinationDirectory = new Subdirectory(directory.destination, paths.destination.filename);
            } catch (exception) {
                this.logger.error(
                    `Failed to create directory ${paths.destination.absolutePath} - ${firstLineOnly(exception)}`
                );
                this.print("===> FAILED");
            }
        }
        return newDestinationDirectory
            ? this.storeNewSubdirectory(directory, source.name, newDestinationDirectory, paths.next)
            : undefined;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Wrap a destination directory into a mapped directory and attach it to the database
    //------------------------------------------------------------------------------------------------------------------

    private storeNewSubdirectory(parent: MappedDirectory, sourceName: string, destination: Subdirectory, last: string) {
        const source = new Subdirectory(parent.source, sourceName);
        const newMappedSubdirectory = new MappedSubdirectory(parent, source, destination, "");
        parent.add(newMappedSubdirectory);
        parent.last = last;
        return newMappedSubdirectory;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Synchronize a single file
    //------------------------------------------------------------------------------------------------------------------

    public compressFile(parentDirectory: MappedDirectory, source: Dirent) {
        const paths = this.getSourceAndDestinationPaths(parentDirectory, source, ".7z");
        this.print(`+ ${paths.source.relativePath}`);
        const pathInfo = `file ${paths.source.absolutePath} => ${paths.destination.absolutePath}`;
        let success = true;
        if (this.isDryRun) {
            this.logger.info(`Would zip ${pathInfo}`);
        } else {
            this.logger.info(`Zipping ${pathInfo}`);
            success = this.compressAndValidate(pathInfo, paths.source.relativePath, paths.destination.absolutePath);
        }
        return success
            ? this.storeNewFile(parentDirectory, source.name, paths.destination.filename, paths.next)
            : undefined
    }

    //------------------------------------------------------------------------------------------------------------------
    // Compress the given file, check if it was successful and log errors if applicable
    //------------------------------------------------------------------------------------------------------------------

    private compressAndValidate(pathInfo: string, sourceRelativePath: string, destinationAbsolutePath: string) {
        try {
            const result = this.context.sevenZip.compressFile(
                this.database.source.absolutePath, sourceRelativePath, destinationAbsolutePath
            );
            if (0 !== result.status || result.error) {
                this.logger.error(result.stdout);
                throw new Error(result.error
                    ? `${result.error} (exit code ${result.status}`
                    : `7-Zip exited with status code ${result.status}`
                );
            }
            if (!FileUtils.exists(destinationAbsolutePath)) {
                this.logger.error(result.stdout);
                throw new Error("No exception was raised");
            }
            return true;
        } catch (exception) {
            this.logger.error(`Failed to create ${pathInfo} - ${firstLineOnly(exception)}`);
            this.print("===> FAILED");
            return false;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Wrap a destination file into a mapped file and attach it to the database
    //------------------------------------------------------------------------------------------------------------------

    private storeNewFile(parent: MappedDirectory, sourceName: string, destinationName: string, last: string) {
        const properties = FileUtils.getProperties(node.path.join(parent.source.absolutePath, sourceName));
        const newMappedFile = new MappedFile(
            parent,
            new File(parent.source, sourceName),
            new File(parent.destination, destinationName),
            properties.ctimeMs,
            properties.mtimeMs,
            properties.size
        );
        parent.add(newMappedFile);
        parent.last = last;
        return newMappedFile;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete a single file
    //------------------------------------------------------------------------------------------------------------------

    public deleteFile(
        options: { destination: string, source?: string, suppressConsoleOutput?: boolean, reason?: string }
    ) {
        return this.deleteFileOrDirectory({ ...options, type: "file" });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete a single directory
    //------------------------------------------------------------------------------------------------------------------

    public deleteDirectory(
        options: { destination: string, source?: string, suppressConsoleOutput?: boolean, reason?: string }
    ) {
        return this.deleteFileOrDirectory({ ...options, type: "directory" });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Generic delete function with logging and dry-run handling
    //------------------------------------------------------------------------------------------------------------------

    private deleteFileOrDirectory(options: {
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
        const success = this.doDeleteFileOrDirectory(options.destination, isDirectory);
        if (!success && !options.suppressConsoleOutput) {
            this.print("===> FAILED");
        }
        return success;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete the given file or directory
    //------------------------------------------------------------------------------------------------------------------

    private doDeleteFileOrDirectory(path: string, isDirectory: boolean) {
        if (!this.isDryRun) {
            try {
                node.fs.rmSync(path, isDirectory ? { recursive: true, force: true } : {});
                if (FileUtils.exists(path)) {
                    throw new FriendlyException("No exception was raised but the file is still present");
                }
            } catch (exception) {
                this.logger.error(`Failed to delete ${path} - ${firstLineOnly(exception)}`);
                return false;
            }
        }
        return true;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get thr relative display path for the console output
    //------------------------------------------------------------------------------------------------------------------

    private getRelativeDisplayPath(destinationPath: string, sourcePath?: string) {
        return sourcePath
            ? node.path.relative(this.database.source.absolutePath, sourcePath)
            : node.path.relative(this.database.destination.absolutePath, destinationPath)
    }

    //------------------------------------------------------------------------------------------------------------------
    // Retrieve source and destination information
    //------------------------------------------------------------------------------------------------------------------

    private getSourceAndDestinationPaths(directory: MappedDirectory, source: Dirent, suffix: string) {
        const sourceAbsolute = node.path.join(directory.source.absolutePath, source.name);
        const sourceRelative = node.path.relative(this.database.source.absolutePath, sourceAbsolute);
        const next = this.getNextAvailableFilename(directory, "", suffix);
        const destinationAbsolute = node.path.join(directory.destination.absolutePath, next.filename);
        const destinationRelative = node.path.relative(this.database.destination.absolutePath, destinationAbsolute);
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
    // Get the next available enumerated file name
    //------------------------------------------------------------------------------------------------------------------

    private getNextAvailableFilename(directory: MappedDirectory, prefix: string, suffix: string) {
        return this.context.filenameEnumerator.getNextAvailableFilename(
            directory.destination.absolutePath, directory.last, prefix, suffix
        );
    }
}
