//----------------------------------------------------------------------------------------------------------------------
// File operations like zipping and creating/deleting files and directories
//----------------------------------------------------------------------------------------------------------------------

class FileManager {

    private readonly print;
    private readonly logger;
    private readonly isDryRun;

    private static readonly LOG_MESSAGE_FAILED = "===> FAILED";

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(private readonly context: Context, private readonly database: MappedRootDirectory) {
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
        const pathInfo = this.getLogFilePathInfo("mkdir", paths.destination.absolutePath, paths.source.absolutePath);
        let newDestinationDirectory: Subdirectory | undefined;
        if (this.isDryRun) {
            this.logger.info(`Would create directory ${pathInfo}`);
            newDestinationDirectory = new Subdirectory(directory.destination, paths.destination.filename);
        } else {
            this.logger.info(`Creating directory ${pathInfo}`);
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
                this.print(FileManager.LOG_MESSAGE_FAILED);
            }
        }
        return newDestinationDirectory
            ? this.storeNewSubdirectory(directory, source.name, newDestinationDirectory)
            : undefined;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Wrap a destination directory into a mapped directory and attach it to the database
    //------------------------------------------------------------------------------------------------------------------

    private storeNewSubdirectory(parent: MappedDirectory, sourceName: string, destination: Subdirectory) {
        const source = new Subdirectory(parent.source, sourceName);
        const newMappedSubdirectory = new MappedSubdirectory(parent, source, destination, "");
        parent.add(newMappedSubdirectory);
        return newMappedSubdirectory;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Synchronize a single file
    //------------------------------------------------------------------------------------------------------------------

    public async zipFile(parentDirectory: MappedDirectory, source: Dirent) {
        const paths = this.getSourceAndDestinationPaths(parentDirectory, source, ".7z");
        this.print(`+ ${paths.source.relativePath}`);
        const pathInfo = this.getLogFilePathInfo("cp", paths.destination.absolutePath, paths.source.absolutePath);
        let success = true;
        if (this.isDryRun) {
            this.logger.info(`Would zip ${pathInfo}`);
        } else {
            this.logger.info(`Zipping ${pathInfo}`);
            success = await this.zipFileAndLogErrors(
                pathInfo, paths.source.relativePath, paths.destination.absolutePath
            );
        }
        return success
            ? this.storeNewFile(parentDirectory, source.name, paths.destination.filename)
            : undefined;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Compress the given file, check if it was successful and log errors if applicable
    //------------------------------------------------------------------------------------------------------------------

    private async zipFileAndLogErrors(pathInfo: string, sourceRelativePath: string, destinationAbsolutePath: string) {
        try {
            const result = await this.context.sevenZip.zipFile(
                this.database.source.absolutePath, sourceRelativePath, destinationAbsolutePath
            );
            if (!result.success) {
                this.logger.error(result.consoleOutput);
                this.logger.error(`Failed to zip ${pathInfo}: ${result.errorMessage}`);
                this.print(FileManager.LOG_MESSAGE_FAILED);
            }
            return result.success;
        } catch (exception) {
            this.logger.error(`Failed to zip ${pathInfo} - ${firstLineOnly(exception)}`);
            this.print(FileManager.LOG_MESSAGE_FAILED);
            return false;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Wrap a destination file into a mapped file and attach it to the database
    //------------------------------------------------------------------------------------------------------------------

    private storeNewFile(parent: MappedDirectory, sourceName: string, destinationName: string) {
        const properties = FileUtils.getProperties(node.path.join(parent.source.absolutePath, sourceName));
        const newMappedFile = new MappedFile(
            parent,
            new File(parent.source, sourceName),
            new File(parent.destination, destinationName),
            properties.birthtimeMs,
            properties.ctimeMs,
            properties.size
        );
        parent.add(newMappedFile);
        return newMappedFile;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete a single file
    //------------------------------------------------------------------------------------------------------------------

    public deleteFile(options: {
        destination: string,
        source?: string,
        suppressConsoleOutput?: boolean,
        reason?: string,
        orphanDisplayPath?: string;
    }) {
        const isMetadataArchive = !options.source
            && this.database.destination.absolutePath === node.path.dirname(options.destination)
            && MetadataManager.isMetadataArchiveName(node.path.basename(options.destination));
        return this.deleteFileOrDirectory({
            ...options,
            type: "file",
            isMetadataArchive: isMetadataArchive,
            suppressConsoleOutput: options.suppressConsoleOutput || isMetadataArchive
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete a single directory
    //------------------------------------------------------------------------------------------------------------------

    public deleteDirectory(options: {
        destination: string,
        source?: string,
        suppressConsoleOutput?: boolean,
        reason?: string,
        orphanDisplayPath?: string;
    }) {
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
        type: "file" | "directory",
        isMetadataArchive?: boolean,
        orphanDisplayPath?: string;
    }) {
        const isOrphan = undefined !== options.orphanDisplayPath;
        if (!options.suppressConsoleOutput) {
            if (options.orphanDisplayPath) {
                this.print(`- ${options.orphanDisplayPath} (orphan)`);
            } else {
                this.print(`- ${this.getConsolePathInfo("rm", options.destination, options.source)}`);
            }
        }
        const pathInfo = this.getLogFilePathInfo("rm", options.destination, options.source);
        const reason = options.reason ? ` ${options.reason}` : "";
        if (isOrphan && !options.isMetadataArchive) {
            this.logger.warn(this.isDryRun
                ? `Would delete orphaned ${options.type} ${pathInfo}${reason}`
                : `Deleting orphaned ${options.type} ${pathInfo}${reason}`
            );
        } else {
            this.logger.info(this.isDryRun
                ? `Would delete ${options.type} ${pathInfo}${reason}`
                : `Deleting ${options.type} ${pathInfo}${reason}`
            );
        }
        const success = this.doDeleteFileOrDirectory(options.destination, "directory" === options.type);
        if (!success && !options.suppressConsoleOutput) {
            this.print(FileManager.LOG_MESSAGE_FAILED);
        }
        return success;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete the given file or directory
    //------------------------------------------------------------------------------------------------------------------

    private doDeleteFileOrDirectory(path: string, isDirectory: boolean) {
        if (!this.isDryRun) {
            try {
                if (!FileUtils.exists(path)) {
                    this.logger.info(`${path} has already been deleted (nothing to do)`);
                } else {
                    node.fs.rmSync(path, isDirectory ? { recursive: true, force: true } : {});
                    if (FileUtils.exists(path)) {
                        throw new FriendlyException("No exception was raised but the file is still present");
                    }
                }
            } catch (exception) {
                this.logger.error(`Failed to delete ${path} - ${firstLineOnly(exception)}`);
                return false;
            }
        }
        return true;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Retrieve source and destination information
    //------------------------------------------------------------------------------------------------------------------

    private getSourceAndDestinationPaths(directory: MappedDirectory, source: Dirent, suffix: string) {
        const sourceAbsolute = node.path.join(directory.source.absolutePath, source.name);
        const sourceRelative = node.path.relative(this.database.source.absolutePath, sourceAbsolute);
        const next = this.reserveNextAvailableFilename(directory, "", suffix);
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
            }
        };
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get source and destination paths for the log file output
    //------------------------------------------------------------------------------------------------------------------

    private getLogFilePathInfo(operation: "cp" | "mkdir" | "rm", destinationPath: string, sourcePath?: string) {
        if ("cp" === operation) {
            return sourcePath ? `${sourcePath} => ${destinationPath}` : destinationPath;
        } else {
            return sourcePath ? `${destinationPath} (mirroring ${sourcePath})` : destinationPath;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get source and destination paths for console output
    //------------------------------------------------------------------------------------------------------------------

    private getConsolePathInfo(operation: "cp" | "mkdir" | "rm", destinationPath: string, sourcePath?: string) {
        const source = sourcePath ? node.path.relative(this.database.source.absolutePath, sourcePath) : undefined;
        const destination = node.path.relative(this.database.destination.absolutePath, destinationPath);
        if ("rm" === operation) {
            return source ?? `${destination} (orphan)`;
        } else {
            return source;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the next available enumerated file name
    //------------------------------------------------------------------------------------------------------------------

    private reserveNextAvailableFilename(directory: MappedDirectory, prefix: string, suffix: string) {
        const next = this.context.filenameEnumerator.getNextAvailableFilename(
            directory.destination.absolutePath, directory.last, prefix, suffix
        );
        directory.last = next.enumeratedName;
        return next;
    }
}
