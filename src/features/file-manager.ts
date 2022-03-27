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

    constructor(context: Context, private readonly database: MappedRootDirectory) {
        this.print = context.print;
        this.logger = context.logger;
        this.isDryRun = context.options.dryRun;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete a single file
    //------------------------------------------------------------------------------------------------------------------

    public deleteFile(options: {
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

    public deleteDirectory(options: {
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
            ? node.path.relative(this.database.source.absolutePath, sourcePath)
            : node.path.relative(this.database.destination.absolutePath, destinationPath)
    }
}
