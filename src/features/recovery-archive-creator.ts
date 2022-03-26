//----------------------------------------------------------------------------------------------------------------------
// Compile a file index and bundle it with scripts and instructions into a recovery archive
//----------------------------------------------------------------------------------------------------------------------

class RecoveryArchiveCreator {

    private readonly logger;
    private readonly print;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(private readonly context: Context) {
        this.logger = context.logger;
        this.print = context.print;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create the recovery archive
    //------------------------------------------------------------------------------------------------------------------

    public create(zipFile: string, database: MappedRootDirectory) {
        if (this.context.options.dryRun) {
            this.logger.info(`Would create recovery archive ${zipFile}`);
            this.print("Would create the recovery archive");
            return true;
        } else {
            this.logger.info(`Creating recovery archive ${zipFile}`);
            this.print("Creating the recovery archive")
            return this.createRecoveryArchive(zipFile, database);
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
        this.sort(directory.files);
        this.sort(directory.directories);
        directory.directories.forEach(subdirectory => this.createFileIndex(subdirectory, lines));
        directory.files.forEach(file => this.addToIndex(file, lines));
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
    // Sort an array of files or directories alphabetically
    //------------------------------------------------------------------------------------------------------------------

    private sort(array: Array<{ source: { name: string } }>) {
        array.sort((item1, item2) => {
            const name1 = item1.source.name.toLowerCase();
            const name2 = item2.source.name.toLowerCase();
            if (name1 < name2) {
                return -1;
            } else {
                return name1 === name2 ? 0 : 1;
            }
        });
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
