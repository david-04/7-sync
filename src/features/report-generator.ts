//----------------------------------------------------------------------------------------------------------------------
// Evaluate sync run statistics and create log entries and console output
//----------------------------------------------------------------------------------------------------------------------

class ReportGenerator {

    private readonly logger;
    private readonly isDryRun;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    constructor(
        context: Context,
        private readonly statistics: Record<"copied" | "deleted" | "orphans" | "purged" | "recoveryArchive", Statistics>,
        _recoveryArchiveIsUpToDate: boolean,
        _databaseIsUpToDate: boolean
    ) {
        this.logger = context.logger;
        this.isDryRun = context.options.dryRun;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log relevant statistics
    //------------------------------------------------------------------------------------------------------------------

    public logStatistics() {
        this.logOperationStatistics(
            this.statistics.copied,
            "copy",
            "copied",
            "that was added or modified in the source",
            "that were added or modified in the source"
        );
        this.logOperationStatistics(
            this.statistics.deleted,
            "delete",
            "deleted",
            "that was modified in or deleted from the source",
            "that were modified in or deleted from the source"
        );
        this.logOperationStatistics(
            this.statistics.orphans,
            "delete",
            "deleted",
            "that is/was not registered in the database",
            "that are/were not registered in the database"
        );
        this.logOperationStatistics(
            this.statistics.purged,
            "purge from the database",
            "purged from the database",
            "that has vanished from the destination",
            "that have vanished from the destination"
        );
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log a single set of statistics
    //------------------------------------------------------------------------------------------------------------------

    public logOperationStatistics(
        statistics: Statistics,
        infinitive: string,
        simplePast: string,
        descriptionSingular: string,
        descriptionPlural: string
    ) {
        if (this.isDryRun) {
            return this.logDryRunStatistics(statistics, simplePast, descriptionSingular, descriptionPlural);
        } else {
            const result1 = this.logSuccessStatistics(statistics, simplePast, descriptionSingular, descriptionPlural);
            const result2 = this.logFailureStatistics(statistics, infinitive, descriptionSingular, descriptionSingular);
            return result1 && result2;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log statistics for a dry run
    //------------------------------------------------------------------------------------------------------------------

    private logDryRunStatistics(
        statistics: Statistics, verb: string, descriptionSingular: string, descriptionPlural: string
    ) {
        const files = statistics.files.success + statistics.files.failed;
        const directories = statistics.directories.success + statistics.directories.failed
        if (0 < files + directories) {
            const filesAndDirectories = this.formatStatistics(files, directories);
            const extraInfo = 1 === files + directories ? descriptionSingular : descriptionPlural;
            this.logger.info(`Would have ${verb} ${filesAndDirectories} ${extraInfo}`);
            return true;
        } else {
            return false;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log a successful operation
    //------------------------------------------------------------------------------------------------------------------

    private logSuccessStatistics(
        statistics: Statistics, verb: string, descriptionSingular: string, descriptionPlural: string
    ) {
        const filesAndDirectories = this.formatStatistics(statistics.files.success, statistics.directories.success);
        if (filesAndDirectories) {
            const description = 1 === statistics.files.success + statistics.directories.success
                ? descriptionSingular
                : descriptionPlural;
            this.logger.info(`Successfully ${verb} ${filesAndDirectories} ${description}`);
            return true;
        } else {
            return false;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log statistics about failed operations
    //------------------------------------------------------------------------------------------------------------------

    private logFailureStatistics(
        statistics: Statistics, verb: string, descriptionSingular: string, descriptionPlural: string
    ) {
        const failed = this.formatStatistics(statistics.files.failed, statistics.directories.failed);
        if (failed) {
            const description = 1 === statistics.files.failed + statistics.directories.failed
                ? descriptionSingular
                : descriptionPlural;
            this.logger.warn(`Failed to ${verb} ${failed} ${description}`);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Format the quantiies of files and directories
    //------------------------------------------------------------------------------------------------------------------

    private formatStatistics(files: number, directories: number) {
        const filesLabel = 1 === files ? "file" : "files";
        const directoriesLabel = 1 === directories ? "directory" : "directories";
        if (0 < files && 0 < directories) {
            return `${files} ${filesLabel} and ${directories} ${directoriesLabel}`;
        } else if (0 < files) {
            return `${files} ${filesLabel}`;
        } else if (0 < directories) {
            return `${directories} ${directoriesLabel}`;
        } else {
            return undefined;
        }
    }
}
