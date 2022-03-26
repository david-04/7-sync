//----------------------------------------------------------------------------------------------------------------------
// Compile a file index and bundle it with scripts and instructions into a recovery archive
//----------------------------------------------------------------------------------------------------------------------

class RecoveryArchiveCreator {

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(private readonly context: Context) { }

    //------------------------------------------------------------------------------------------------------------------
    // Create the recovery archive
    //------------------------------------------------------------------------------------------------------------------

    public static create(context: Context, database: MappedRootDirectory) {
        const zipFile = context.filenameEnumerator.getNextAvailableFilename(
            database.destination.absolutePath, database.last, FilenameEnumerator.RECOVERY_FILE_NAME_PREFIX, ".7z"
        ).filenameWithPath;
        if (context.options.dryRun) {
            context.logger.info(`Would create recovery archive ${zipFile}`);
            context.print("Would create the recovery archive");
            return true;
        } else {
            context.logger.info(`Creating recovery archive ${zipFile}`);
            context.print("Creating the recovery archive")
            return new RecoveryArchiveCreator(context).createRecoveryArchive(zipFile, database);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create the recovery archive
    //------------------------------------------------------------------------------------------------------------------

    private createRecoveryArchive(zipFile: string, database: MappedRootDirectory) {
        const filesAndContent = this.getFilesAndContent(database);
        for (const result of filesAndContent.map(file => this.addToArchive(zipFile, file.name, file.content))) {
            if (true !== result) {
                return result;
            }
        }
        return true;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the files (and content) that need to go into the recovery archive
    //------------------------------------------------------------------------------------------------------------------

    private getFilesAndContent(database: MappedRootDirectory) {
        return [
            { name: "file-index.txt", content: this.createFileIndex(database, []).join("\n") + "\n" },
            { name: "README.txt", content: RecoveryResources.getReadme() },
            { name: "7-sync-recovery.bat", content: RecoveryResources.getBatchScript() },
            { name: "7-sync-recovery.sh", content: RecoveryResources.getShellScript() }
        ];
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create the the file index
    //------------------------------------------------------------------------------------------------------------------

    private createFileIndex(directory: MappedDirectory, lines: string[]) {
        this.addToIndex(directory, lines);
        directory.subdirectories.bySourceName.sorted().forEach(subdirectory => this.createFileIndex(subdirectory, lines));
        directory.files.bySourceName.sorted().forEach(file => this.addToIndex(file, lines));
        return lines;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Add a single file or directory to the index
    //------------------------------------------------------------------------------------------------------------------

    private addToIndex(fileOrDirectory: MappedFile | MappedDirectory, lines: string[]) {
        if (fileOrDirectory instanceof MappedSubDirectory || fileOrDirectory instanceof MappedFile) {
            lines.push(`${fileOrDirectory.source.relativePath} => ${fileOrDirectory.destination.relativePath}`);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Add file content to the archive
    //------------------------------------------------------------------------------------------------------------------

    private addToArchive(zipFile: string, filename: string, content: string) {
        const result = this.context.sevenZip.compressFile(".", filename, zipFile, content);
        if (0 === result.status) {
            return true;
        } else {
            this.context.logger.error(`Failed to create recovery archive ${zipFile}: ${result.error}`, result.stdout);
            return result.error || `7-Zip exited with status code ${result.status}`;
        }
    }
}
