//----------------------------------------------------------------------------------------------------------------------
// Manage the index archive with the database and file listings
//----------------------------------------------------------------------------------------------------------------------

class MetadataManager {

    public static readonly ARCHIVE_FILE_PREFIX = "___INDEX___";

    private static readonly DATABASE_FILENAME = "7-sync-database.json";
    private static readonly LISTING_FILENAME = "7-sync-file-index.txt";
    private static readonly README_FILENAME = "7-sync-README.txt";

    private static readonly MAX_INDEX = 999999;
    private static readonly INDEX_LENGTH = `${this.MAX_INDEX}`.length;
    private static readonly MAX_UNZIP_CONSOLE_OUTPUT_LENGTH = 1000;

    private readonly logger;
    private readonly print;
    private readonly isDryRun;
    private readonly destination;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(private readonly context: Context) {
        this.logger = context.logger;
        this.print = context.print;
        this.isDryRun = context.options.dryRun;
        this.destination = context.config.destination;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Load the database from the latest archive
    //------------------------------------------------------------------------------------------------------------------

    public async loadOrInitializeDatabase() {
        const latest = this.listMetadataArchives()?.latest;
        if (latest) {
            return this.loadDatabaseFromFile(latest.absolutePath, latest.name);
        } else if (FileUtils.getChildrenIfDirectoryExists(this.destination).array.length) {
            const indexFile = MetadataManager.ARCHIVE_FILE_PREFIX;
            throw new FriendlyException(
                `The destination has no ${indexFile} file but isn't empty either.\n`
                + `For a full re-sync, delete everything from ${this.destination}`
            );
        } else {
            this.logger.info(`The destination ${this.destination} is empty - starting with an empty database`);
            return {
                json: { files: [], directories: [], last: "" },
                mustSaveImmediately: true
            };
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that the archive can be read - and unzip the database from it
    //------------------------------------------------------------------------------------------------------------------

    private async loadDatabaseFromFile(absolutePath: string, name: string) {
        const { sevenZip, passwordHasChanged } = await this.getSevenZipToAccessForFile(absolutePath);
        const databaseFilename = MetadataManager.DATABASE_FILENAME;
        const json = this.unzipDatabase(sevenZip, absolutePath, name, databaseFilename);
        const database = JsonParser.parseAndValidateDatabase(json, name, databaseFilename, this.destination);
        if (passwordHasChanged) {
            return {
                json: { files: [], directories: [], last: database.last },
                mustSaveImmediately: true,
            };
        } else {
            return { json: database, mustSaveImmediately: false };
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Obtain a SevenZip instance that can open the given file
    //------------------------------------------------------------------------------------------------------------------

    private async getSevenZipToAccessForFile(zipFile: string) {
        if (this.checkIfSevenZipCanOpen(this.context.sevenZip, zipFile)) {
            return { sevenZip: this.context.sevenZip, passwordHasChanged: false };
        } else {
            this.logger.error(`Prompting for the old password (assuming that it has changed)`);
            console.error("The password seems to have changed.");
            const oldPassword = await this.promptForOldPassword(zipFile);
            this.logger.info("Obtained the correct old password");
            return {
                sevenZip: this.context.sevenZip.cloneWithDifferentPassword(oldPassword),
                passwordHasChanged: true
            };
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Prompt for the password
    //------------------------------------------------------------------------------------------------------------------

    private async promptForOldPassword(zipFile: string) {
        return InteractivePrompt.prompt({
            question: "Please enter the old password.",
            isPassword: true,
            useStderr: true,
            validate: input => {
                console.error("");
                const sevenZipWithNewPassword = this.context.sevenZip.cloneWithDifferentPassword(input);
                const isCorrect = this.checkIfSevenZipCanOpen(sevenZipWithNewPassword, zipFile);
                if (!isCorrect) {
                    console.error("");
                    console.error("Invalid password. Please try again.");
                }
                return isCorrect;
            }
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify if that the sevenZip instance has the correct password to list the contents of the given file
    //------------------------------------------------------------------------------------------------------------------

    private checkIfSevenZipCanOpen(sevenZip: SevenZip, absolutePath: string) {
        const result = sevenZip.listToStdout(absolutePath);
        if (!result.success) {
            if (result.consoleOutput) {
                this.logger.error(result.consoleOutput);
            }
            this.logger.error(`Failed to open ${absolutePath} - ${result.errorMessage}`);
        }
        return result.success;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Unzip the database from the given archive
    //------------------------------------------------------------------------------------------------------------------

    private unzipDatabase(sevenZip: SevenZip, absolutePath: string, name: string, databaseFilename: string) {
        const unzip = sevenZip.unzipToStdout(absolutePath, databaseFilename);
        if (unzip.success && unzip.consoleOutput) {
            this.logger.info(`Loaded database ${databaseFilename} from ${absolutePath}`);
            this.print(`Loading the database`);
            return unzip.consoleOutput;
        } else {
            if (unzip.consoleOutput) {
                this.logger.error(unzip.consoleOutput.substring(
                    0,
                    Math.min(unzip.consoleOutput.length, MetadataManager.MAX_UNZIP_CONSOLE_OUTPUT_LENGTH))
                );
            }
            this.logger.error(`Failed to extract ${databaseFilename} from ${absolutePath} - ${unzip.errorMessage}`);
            this.print(`Failed to extract the database from ${name}`);
            throw new FriendlyException([
                `The index file ${name} is corrupt.`,
                `It does not contain the database (filename: ${databaseFilename}).`,
                `To force a full re-sync, delete everything from ${this.destination}.`
            ].join("\n"));
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Update the index (if required)
    //------------------------------------------------------------------------------------------------------------------

    public updateIndex(database: MappedRootDirectory) {
        const indexesToDelete = this.getMetadataArchives();
        const remainingOrphans = this.deleteOrphans(indexesToDelete.orphans.map(file => file.absolutePath));
        const mustCreateNewIndex = database.hasUnsavedChanges();
        const hasCreatedNewIndex = mustCreateNewIndex && this.createNewIndex(database);
        const isUpToDate = hasCreatedNewIndex || !mustCreateNewIndex;
        database.markAsSaved(isUpToDate);
        const remainingLatestOrphan = hasCreatedNewIndex
            ? this.deleteOrphans(indexesToDelete.latest.map(file => file.absolutePath))
            : indexesToDelete.latest.length;
        return { isUpToDate, remainingOrphans: remainingOrphans + remainingLatestOrphan };
    }

    //------------------------------------------------------------------------------------------------------------------
    // Determine the actions to perform when updating the index
    //------------------------------------------------------------------------------------------------------------------

    private getMetadataArchives() {
        const archives = this.listMetadataArchives();
        return { latest: archives ? [archives.latest] : [], orphans: archives?.orphans ?? [] };
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create a new index
    //------------------------------------------------------------------------------------------------------------------

    private createNewIndex(database: MappedRootDirectory) {
        const archive = this.generateArchiveName();
        if (this.isDryRun) {
            this.logger.info(`Would save the database to ${archive.final}`);
            this.print("Would save the database");
            return true;
        } else {
            try {
                this.print("Saving the database");
                return this.populateIndex(archive.temp, archive.final, database);
            } catch (exception) {
                this.logger.error("Failed to save the database");
                this.print("===> FAILED");
                this.deleteFileIfExists(archive.temp);
                return false;
            }
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create a new index archive and add all files
    //------------------------------------------------------------------------------------------------------------------

    private populateIndex(tempFile: string, finalFile: string, database: MappedRootDirectory) {
        const success = this.zipDatabase(tempFile, database)
            && this.zipReadme(tempFile, finalFile, database)
            && this.zipFileListing(tempFile, database)
            && this.renameArchive(tempFile, finalFile);
        if (!success) {
            this.deleteFileIfExists(tempFile);
        }
        return success;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Serialize the database and add it to the zip archive
    //------------------------------------------------------------------------------------------------------------------

    private zipDatabase(zipFile: string, database: MappedRootDirectory) {
        this.logger.info("Serializing the database");
        const json = DatabaseSerializer.serializeDatabase(database);
        this.logger.info(`Storing the database as ${MetadataManager.DATABASE_FILENAME} in ${zipFile}`);
        return this.addToArchive(zipFile, MetadataManager.DATABASE_FILENAME, json);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Add the README to the zip archive
    //------------------------------------------------------------------------------------------------------------------

    private zipReadme(tempFile: string, finalFile: string, database: MappedRootDirectory) {
        this.logger.info(`Storing the README as ${MetadataManager.README_FILENAME} in ${tempFile}`);
        const filename = node.path.relative(database.destination.absolutePath, finalFile);
        const content = README_FILE_CONTENT.replace("___INDEX___2022-04-10-07-25-47-394.7z", filename);
        return this.addToArchive(tempFile, MetadataManager.README_FILENAME, content);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Add the file mapping
    //------------------------------------------------------------------------------------------------------------------

    private zipFileListing(zipFile: string, database: MappedRootDirectory) {
        this.logger.info("Creating the file listing");
        const listing = FileListingCreator.create(database);
        this.logger.info(`Storing the file listing as ${MetadataManager.LISTING_FILENAME} in ${zipFile}`);
        return this.addToArchive(zipFile, MetadataManager.LISTING_FILENAME, listing);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Rename the archive from temp => final
    //------------------------------------------------------------------------------------------------------------------

    private renameArchive(temp: string, final: string) {
        try {
            this.logger.info(`Renaming ${temp} => ${final}`);
            node.fs.renameSync(temp, final);
            return true;
        } catch (exception) {
            this.logger.error(`Failed to rename ${temp} => ${final} - ${firstLineOnly(exception)}`);
            return false;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Try to delete the temporary file (if it exists)
    //------------------------------------------------------------------------------------------------------------------

    private deleteFileIfExists(file: string) {
        if (FileUtils.exists(file)) {
            try {
                this.logger.info(`Deleting ${file}`);
                node.fs.rmSync(file);
                if (FileUtils.exists(file)) {
                    this.logger.error(`Failed to delete ${file}, although rmSync did not raise an error`);
                    return false;
                }
            } catch (exception) {
                this.logger.error(`Failed to delete ${file} - ${firstLineOnly(exception)}`);
                return false;
            }
        }
        return true;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete orphaned archives
    //------------------------------------------------------------------------------------------------------------------

    private deleteOrphans(orphans: string[]) {
        return orphans.filter(file => !this.deleteFileIfExists(file)).length;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Check if the given name is an archive name
    //------------------------------------------------------------------------------------------------------------------

    public static isMetadataArchiveName(name: string) {
        const prefix = MetadataManager.ARCHIVE_FILE_PREFIX;
        const suffix = ".7z";
        if (name.startsWith(prefix) && name.endsWith(suffix)) {
            const timestamp = name.substring(prefix.length, name.length - suffix.length);
            return !!timestamp.match(/^\d{4}(-\d{2}){5}-\d{3}(_\d{6})?$/);
        } else {
            return false;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Generate an archive name with the current timestamp
    //------------------------------------------------------------------------------------------------------------------

    private generateArchiveName() {
        const timestamp = MetadataManager.generateTimestamp();
        for (let index = 0; index <= MetadataManager.MAX_INDEX; index++) {
            const suffix = index ? `_${Logger.formatNumber(index, MetadataManager.INDEX_LENGTH)}` : "";
            const name = `${MetadataManager.ARCHIVE_FILE_PREFIX}${timestamp}${suffix}.7z`;
            const tempName = `${MetadataManager.ARCHIVE_FILE_PREFIX}${timestamp}${suffix}_TMP.7z`;
            const nameWithPath = node.path.join(this.context.config.destination, name);
            const tempNameWithPath = node.path.join(this.context.config.destination, tempName);
            if (!MetadataManager.isMetadataArchiveName(name)) {
                throw new InternalError(`Generated an invalid archive name: ${timestamp}`);
            }
            if (!FileUtils.exists(nameWithPath) && !FileUtils.exists(tempNameWithPath)) {
                return { temp: tempNameWithPath, final: nameWithPath };
            }
        }
        throw new InternalError(`All generated archive names for timestamp ${timestamp} already exist`);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the current timestamp
    //------------------------------------------------------------------------------------------------------------------

    private static generateTimestamp() {
        const now = new Date();
        return [
            [Logger.LENGTH_YEAR, now.getFullYear()],
            [Logger.LENGTH_MONTH, now.getMonth() + 1],
            [Logger.LENGTH_DAY, now.getDate()],
            [Logger.LENGTH_HOURS, now.getHours()],
            [Logger.LENGTH_MINUTES, now.getMinutes()],
            [Logger.LENGTH_SECONDS, now.getSeconds()],
            [Logger.LENGTH_MILLISECONDS, now.getMilliseconds()]
        ].map(array => Logger.formatNumber(array[1], array[0])).join("-");
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the absolute path of all index files in the destination's root folder
    //------------------------------------------------------------------------------------------------------------------

    private listMetadataArchives() {
        const files = FileUtils.getChildren(this.destination)
            .array
            .filter(dirent => !dirent.isDirectory())
            .map(dirent => dirent.name)
            .filter(filename => MetadataManager.isMetadataArchiveName(filename))
            .sort()
            .map(filename => ({ name: filename, absolutePath: node.path.join(this.destination, filename) }));
        const total = files.length;
        return total ? { latest: files[total - 1], orphans: files.slice(0, total - 1) } : undefined;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Add file content to the archive (and log errors)
    //------------------------------------------------------------------------------------------------------------------

    private addToArchive(zipFile: string, filename: string, content: string) {
        const result = this.context.sevenZip.zipString(content, filename, zipFile);
        if (!result.success) {
            if (result.consoleOutput) {
                this.context.logger.error(result.consoleOutput);
            }
            this.context.logger.error(
                `Failed to add ${filename} to the create recovery archive ${zipFile}: ${result.errorMessage}`
            );
        }
        return result.success;
    }
}
