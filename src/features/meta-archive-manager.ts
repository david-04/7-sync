//----------------------------------------------------------------------------------------------------------------------
// Manage the index archive with the database and file listings
//----------------------------------------------------------------------------------------------------------------------

class MetaArchiveManager {

    public static readonly ARCHIVE_FILE_PREFIX = "___INDEX___";

    private static readonly DATABASE_FILENAME = "7-sync-database.json";
    private static readonly LISTING_FILENAME = "7-sync-file-index.txt";
    private static readonly README_FILENAME = "7-sync-README.txt"

    private successfullyReadArchive?: string;

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

    public loadDatabaseOrGetEmptyOne(): JsonDatabase {
        const files = this.listIndexArchives();
        if (files) {
            const json = this.loadDatabaseFromFile(files.latest.absolutePath, files.latest.name);
            if (json) {
                const database = JsonParser.parseAndValidateDatabase(json);
                this.successfullyReadArchive = files.latest.absolutePath;
                return database;
            }
        } else if (this.isDryRun) {
            this.logger.warn(`There is no index file in ${this.destination} - would start with an empty database`);
            this.print("There's no index file, would start with an empty database");
        } else {
            this.logger.warn(`There is no index file in ${this.destination} - starting with an empty database`);
            this.print("There's no index file, starting with an empty database");
        }
        return { files: [], directories: [], last: "" };
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that the archive can be read - and unzip the database from it
    //------------------------------------------------------------------------------------------------------------------

    private loadDatabaseFromFile(absolutePath: string, name: string) {
        const list = this.context.sevenZip.listToStdout(absolutePath);
        if (list.success) {
            return this.unzipDatabase(absolutePath, name, MetaArchiveManager.DATABASE_FILENAME);
        } else {
            if (list.consoleOutput) {
                this.logger.error(list.consoleOutput);
            }
            this.logger.error(`Failed to open ${absolutePath} - ${list.errorMessage}`);
            this.print(`Can't read ${name} - assuming that the password has changed`);
            if (this.isDryRun) {
                this.logger.error(`Assuming that the password has changed - would start with an empty database`);
                this.print("Would start with an empty database, forcing a full re-sync");
            } else {
                this.logger.error(`Assuming that the password has changed - starting with an empty database`);
                this.print("Starting with an empty database, forcing a full re-sync");

            }
            return undefined;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Unzip the database from the given archive
    //------------------------------------------------------------------------------------------------------------------

    private unzipDatabase(absolutePath: string, name: string, databaseFilename: string) {
        const unzip = this.context.sevenZip.unzipToStdout(absolutePath, databaseFilename);
        if (unzip.success && unzip.consoleOutput) {
            this.logger.info(`Loaded database ${databaseFilename} from ${absolutePath}`);
            this.print(`Loading the database`);
            return unzip.consoleOutput;
        } else {
            if (unzip.consoleOutput) {
                this.logger.error(unzip.consoleOutput.substring(0, Math.min(unzip.consoleOutput.length, 1000)));
            }
            this.logger.error(`Failed to extract ${databaseFilename} from ${absolutePath} - ${unzip.errorMessage}`);
            this.print(`Failed to extract the database from ${name}`);
            const message = this.isDryRun
                ? "Would start with an empty database, forcing a full re-sync"
                : "Starting with an empty database, forcing a full re-sync";
            this.logger.error(message);
            this.print(message);
            return undefined;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Update the index (if required)
    //------------------------------------------------------------------------------------------------------------------

    public updateIndex(database: MappedRootDirectory, hasChanged: boolean) {
        const actions = this.determineUpdateIndexActions(hasChanged);
        const hasCreatedNewIndex = actions.mustCreateNewIndex ? this.createNewIndex(database) : false;
        const orphansToDelete = hasCreatedNewIndex
            ? actions.orphansToDelete.includingLatest
            : actions.orphansToDelete.excludingLatest
        const orphans = this.isDryRun
            ? { orphans: { success: 0, failed: 0 }, latest: { success: 0, failed: 0 } }
            : this.deleteOrphans(orphansToDelete.map(file => file.absolutePath));
        return { isUpToDate: hasCreatedNewIndex || !actions.mustCreateNewIndex, ...orphans };
    }

    //------------------------------------------------------------------------------------------------------------------
    // Determine the actions to perform when updating the index
    //------------------------------------------------------------------------------------------------------------------

    private determineUpdateIndexActions(hasChanged: boolean) {
        const archives = this.listIndexArchives();
        const mustCreateNewIndex = hasChanged
            || undefined === this.successfullyReadArchive
            || this.successfullyReadArchive !== archives?.latest.absolutePath;
        return {
            mustCreateNewIndex,
            orphansToDelete: {
                includingLatest: archives ? [...archives.orphans, archives.latest] : [],
                excludingLatest: archives?.orphans ?? []
            }
        };
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
            && this.zipReadme(tempFile)
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
        this.logger.info(`Storing the database as ${MetaArchiveManager.DATABASE_FILENAME} in ${zipFile}`);
        return this.addToArchive(zipFile, MetaArchiveManager.DATABASE_FILENAME, json);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Add the README to the zip archive
    //------------------------------------------------------------------------------------------------------------------

    private zipReadme(zipFile: string) {
        this.logger.info(`Storing the README as ${MetaArchiveManager.README_FILENAME} in ${zipFile}`);
        return this.addToArchive(zipFile, MetaArchiveManager.README_FILENAME, README);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Add the file mapping
    //------------------------------------------------------------------------------------------------------------------

    private zipFileListing(zipFile: string, database: MappedRootDirectory) {
        this.logger.info("Creating the file listing");
        const listing = FileListingCreator.create(database);
        this.logger.info(`Storing the file listing as ${MetaArchiveManager.LISTING_FILENAME} in ${zipFile}`);
        return this.addToArchive(zipFile, MetaArchiveManager.LISTING_FILENAME, listing);
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
        const deleted = orphans.filter(file => this.deleteFileIfExists(file)).length;
        const failed = orphans.length - deleted;
        const lastDeleted = 0 < deleted ? 1 : 0;
        const lastFailed = !lastDeleted && failed ? 1 : 0;
        return {
            orphans: {
                success: deleted - lastDeleted,
                failed: failed - lastFailed
            },
            latest: {
                success: lastDeleted,
                failed: lastFailed
            }
        };
    }

    //------------------------------------------------------------------------------------------------------------------
    // Check if the given name is an archive name
    //------------------------------------------------------------------------------------------------------------------

    public static isArchiveName(name: string) {
        const prefix = MetaArchiveManager.ARCHIVE_FILE_PREFIX;
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
        const timestamp = MetaArchiveManager.generateTimestamp();
        for (let index = 0; index < 1000000; index++) {
            const suffix = index ? `_${Logger.formatNumber(index, 6)}` : "";
            const name = `${MetaArchiveManager.ARCHIVE_FILE_PREFIX}${timestamp}${suffix}.7z`;
            const tempName = `${MetaArchiveManager.ARCHIVE_FILE_PREFIX}${timestamp}${suffix}_TMP.7z`
            const nameWithPath = node.path.join(this.context.config.destination, name);
            const tempNameWithPath = node.path.join(this.context.config.destination, tempName);
            if (!MetaArchiveManager.isArchiveName(name)) {
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
            [4, now.getFullYear()],
            [2, now.getMonth() + 1],
            [2, now.getDate()],
            [2, now.getHours()],
            [2, now.getMinutes()],
            [2, now.getSeconds()],
            [3, now.getMilliseconds()]
        ].map(array => Logger.formatNumber(array[1], array[0])).join("-");
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the absolute path of all index files in the destination's root folder
    //------------------------------------------------------------------------------------------------------------------

    private listIndexArchives() {
        const files = FileUtils.getChildren(this.destination)
            .array
            .filter(dirent => !dirent.isDirectory())
            .map(dirent => dirent.name)
            .filter(filename => MetaArchiveManager.isArchiveName(filename))
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
                this.context.logger.error(result.consoleOutput)
            }
            this.context.logger.error(
                `Failed to add ${filename} to the create recovery archive ${zipFile}: ${result.errorMessage}`
            );
        }
        return result.success;
    }
}
