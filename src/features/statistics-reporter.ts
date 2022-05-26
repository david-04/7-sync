//----------------------------------------------------------------------------------------------------------------------
// Evaluate sync run statistics and create log entries and console output
//----------------------------------------------------------------------------------------------------------------------

class StatisticsReporter {

    private readonly logger;

    private static readonly PLACEHOLDER = "{}";

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    private constructor(private readonly context: Context, private readonly statistics: SyncStats) {
        this.logger = context.logger;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log relevant statistics
    //------------------------------------------------------------------------------------------------------------------

    public static run(context: Context, statistics: SyncStats) {
        new StatisticsReporter(context, statistics).logStatistics();
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log relevant statistics
    //------------------------------------------------------------------------------------------------------------------

    private logStatistics() {
        this.logCopyStatistics();
        this.logDeleteStatistics();
        this.logOrphanStatistics();
        this.logPurgeStatistics();
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log statistics about copy operations
    //------------------------------------------------------------------------------------------------------------------

    private logCopyStatistics() {
        return this.logOperationStatistics(
            this.statistics.copied,
            {
                dryRun: {
                    singular: "Would have copied {} that was added to or modified in the source",
                    plural: "Would have copied {} that were added to or modified in the source"
                },
                success: {
                    singular: "Successfully copied {} that was added to or modified in the source",
                    plural: "Successfully copied {} that were added to or modified in the source"
                },
                failed: {
                    singular: "Failed to copy {} that was added to or modified in the source",
                    plural: "Failed to copy {} that were added to or modified in the source",
                }
            }
        );
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log statistics about delete operations
    //------------------------------------------------------------------------------------------------------------------

    private logDeleteStatistics() {
        return this.logOperationStatistics(
            this.statistics.deleted,
            {
                dryRun: {
                    singular: "Would have deleted {} that was modified in or deleted from the source",
                    plural: "Would have deleted {} that were modified in or deleted from the source"
                },
                success: {
                    singular: "Successfully deleted {} that was modified in or deleted from the source",
                    plural: "Successfully deleted {} that were modified in or deleted from the source"
                },
                failed: {
                    singular: "Failed to delete {} that was modified in or deleted from the source",
                    plural: "Failed to delete {} that were modified in or deleted from the source",
                }
            }
        );
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log files and directories that were deleted
    //------------------------------------------------------------------------------------------------------------------

    private logOrphanStatistics() {
        return this.logOperationStatistics(
            this.statistics.orphans,
            {
                dryRun: {
                    singular: "Would have deleted {} that is not registered in the database (orphan)",
                    plural: "Would have deleted {} that are not registered in the database (orphans)"
                },
                success: {
                    singular: "Successfully deleted {} that was not registered in the database (orphan)",
                    plural: "Successfully deleted {} that were not registered in the database (orphans)"
                },
                failed: {
                    singular: "Failed to delete {} that is not registered in the database (orphan)",
                    plural: "Failed to delete {} that are not registered in the database (orphans)",
                }
            }
        );
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log purge statistics
    //------------------------------------------------------------------------------------------------------------------

    private logPurgeStatistics() {
        return this.logOperationStatistics(
            this.statistics.purged,
            {
                dryRun: {
                    singular: "Would have purged {} (that has vanished from the destination) from the database",
                    plural: "Would have purged {} (that have vanished from the destination) from the database"
                },
                success: {
                    singular: "Successfully purged {} (that has vanished from the destination) from the database",
                    plural: "Successfully purged {} (that have vanished from the destination) from the database"
                },
                failed: {
                    plural: "Failed to purge {} (that has vanished from the destination) from the database",
                    singular: "Failed to purge {} (that have vanished from the destination) from the database",
                }
            }
        );
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log a single set of statistics
    //------------------------------------------------------------------------------------------------------------------

    private logOperationStatistics(
        statistics: FileAndDirectoryStats,
        messages: {
            dryRun: {
                singular: string,
                plural: string;
            },
            success: {
                singular: string,
                plural: string;
            },
            failed: {
                singular: string,
                plural: string;
            };
        }
    ) {
        if (this.context.options.dryRun) {
            return this.logDryRunStatistics(statistics, messages.dryRun.singular, messages.dryRun.plural);
        } else {
            const logged1 = this.logSuccessStatistics(statistics, messages.success.singular, messages.success.plural);
            const logged2 = this.logFailureStatistics(statistics, messages.failed.singular, messages.failed.plural);
            return logged1 && logged2;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log statistics for a dry run
    //------------------------------------------------------------------------------------------------------------------

    private logDryRunStatistics(statistics: FileAndDirectoryStats, singular: string, plural: string) {
        return this.log(statistics.files.total, statistics.directories.total, singular, plural, LogLevel.INFO);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log statistics about successful operations
    //------------------------------------------------------------------------------------------------------------------

    private logSuccessStatistics(statistics: FileAndDirectoryStats, singular: string, plural: string) {
        return this.log(statistics.files.success, statistics.directories.success, singular, plural, LogLevel.INFO);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log statistics about failed operations
    //------------------------------------------------------------------------------------------------------------------

    private logFailureStatistics(statistics: FileAndDirectoryStats, singular: string, plural: string) {
        return this.log(statistics.files.failed, statistics.directories.failed, singular, plural, LogLevel.WARN);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log a single set of counters
    //------------------------------------------------------------------------------------------------------------------

    private log(files: number, directories: number, singular: string, plural: string, logLevel: LogLevel) {
        if (files || directories) {
            const message = 1 === files + directories ? singular : plural;
            const filesAndDirectories = this.formatCounters(files, directories);
            const index = message.indexOf(StatisticsReporter.PLACEHOLDER);
            const messageStart = 0 <= index ? message.substring(0, index) : message;
            const messageEnd = 0 <= index ? message.substring(index + StatisticsReporter.PLACEHOLDER.length) : "";
            this.logger.log(logLevel, messageStart + filesAndDirectories + messageEnd);
            return true;
        } else {
            return false;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Format file and directory counters as a string
    //------------------------------------------------------------------------------------------------------------------

    private formatCounters(files: number, directories: number) {
        const fileOrFiles = 1 === files ? "file" : "files";
        const directoryOrDirectories = 1 === directories ? "directory" : "directories";
        if (0 < files && 0 === directories) {
            return `${files} ${fileOrFiles}`;
        } else if (0 === files && 0 < directories) {
            return `${directories} ${directoryOrDirectories}`;
        } else {
            return `${files} ${fileOrFiles} and ${directories} ${directoryOrDirectories}`;
        }
    }
}
