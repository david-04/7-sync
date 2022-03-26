//----------------------------------------------------------------------------------------------------------------------
// Delete outdated and unknown files from the destination
//----------------------------------------------------------------------------------------------------------------------

class OrphanRemover {

    private readonly logger;
    private readonly print;
    private readonly isDryRun;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(private readonly context: Context) {
        this.logger = context.logger;
        this.print = context.print;
        this.isDryRun = context.options.dryRun;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Recursively clean orphaned files and directories
    //------------------------------------------------------------------------------------------------------------------

    public run(database: MappedRootDirectory) {
        const root = database.destination.absolutePath;
        if (this.isDryRun) {
            this.logger.info(`Would delete outdated and orphaned files and directories from ${root}`);
            this.print("Would delete outdated and orphaned files and directories");
        } else {
            this.logger.info(`Deleting outdated and orphaned files and directories from ${root}`);
            this.print("Deleting outdated and orphaned files and directories");
        }
        const statistics = new Statistics();
        this.purgeDirectory(root, database, statistics);
        statistics.log(this.logger, this.isDryRun, "delete", "deleted", this.context.console);
        return statistics;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Recursively purge a directory
    //------------------------------------------------------------------------------------------------------------------

    private purgeDirectory(root: string, directory: MappedDirectory, statistics: Statistics) {
        const children = FileUtils.getChildren(root).map;
        directory.files.forEach(databaseFile => children.delete(databaseFile.destination.name));
        directory.directories.forEach(databaseDirectory => children.delete(databaseDirectory.destination.name));
        children.forEach(child => {
            const childPath = node.path.join(directory.destination.absolutePath, child.name);
            if (child.isDirectory()) {
                this.deleteDirectoryRecursively(root, childPath, statistics);
            } else {
                this.deleteFile(root, childPath, statistics);
            }
        });
        directory.directories.forEach(subdirectory => this.purgeDirectory(root, subdirectory, statistics));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete all files and sub-directories
    //------------------------------------------------------------------------------------------------------------------

    private deleteDirectoryRecursively(root: string, path: string, statistics: Statistics) {
        FileUtils.getChildren(path).array.forEach(child => {
            if (child.isDirectory()) {
                this.deleteDirectoryRecursively(root, node.path.join(path, child.name), statistics);
            } else {
                this.deleteFile(root, node.path.join(path, child.name), statistics);
            }
        });
        this.deleteDirectory(root, path, statistics);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete a directory
    //---------------------------------------------------------------------------------------------------------------

    private deleteDirectory(root: string, path: string, statistics: Statistics) {
        this.delete(
            root,
            path,
            () => node.fs.rmSync(path, { recursive: true, force: true }),
            () => statistics.directories.success++,
            () => statistics.directories.failed++
        );
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete a file
    //------------------------------------------------------------------------------------------------------------------

    private deleteFile(root: string, path: string, statistics: Statistics) {
        this.delete(
            root,
            path,
            () => node.fs.rmSync(path),
            () => statistics.files.success++,
            () => statistics.files.failed++
        );
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete any file system entry
    //------------------------------------------------------------------------------------------------------------------

    private delete(root: string, path: string, command: () => void, onSuccess: () => void, onError: () => void) {
        this.print(`- ${node.path.relative(root, path)}`);
        if (this.isDryRun) {
            this.logger.info(`Would delete ${path}`);
            onSuccess();
        } else {
            this.logger.info(`Deleting ${path}`);
            command();
            if (FileUtils.exists(path)) {
                this.logger.warn(`Failed to delete ${path}`);
                this.print("  => FAILED!")
                onError();
            } else {
                onSuccess();
            }
        }
    }
}
