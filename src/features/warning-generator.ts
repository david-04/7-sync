//----------------------------------------------------------------------------------------------------------------------
// Analyze the sync run statistics and generate warnings
//----------------------------------------------------------------------------------------------------------------------

class WarningsGenerator {

    private readonly logger;
    private readonly print;
    private readonly isDryRun;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    private constructor(context: Context, private readonly statistics: SyncStats) {
        this.logger = context.logger;
        this.print = context.print;
        this.isDryRun = context.options.dryRun;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Generate warnings
    //------------------------------------------------------------------------------------------------------------------

    public static run(context: Context, statistics: SyncStats) {
        return new WarningsGenerator(context, statistics).generateWarningsAndGetExitCode();
    }

    //------------------------------------------------------------------------------------------------------------------
    // Generate warnings
    //------------------------------------------------------------------------------------------------------------------

    private generateWarningsAndGetExitCode() {
        const warnings = [
            this.someFilesCouldNotBeCopied(),
            this.someFilesCouldNotBeDeleted(),
            this.orphansWereFound(),
            this.purgeWasNecessary(),
            this.indexArchive(),
            this.enumeratedFilenameCollisions()
        ].flatMap(array => array).sort((a, b) => a.logLevel.index - b.logLevel.index);
        if (warnings.length) {
            warnings.forEach(warning => this.logger.log(warning.logLevel, warning.message));
            const logLevel = warnings[0].logLevel;
            this.displayReport(logLevel, warnings.map(warning => warning.message));
            return logLevel === LogLevel.ERROR || LogLevel.WARN ? 1 : 0;
        } else {
            const message = `The ${this.isDryRun ? "dry run" : "synchronization"} has completed successfully`;
            this.print(message);
            this.logger.info(message);
            return 0;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Some files could not be copied
    //------------------------------------------------------------------------------------------------------------------

    private someFilesCouldNotBeCopied() {
        const failedFiles = this.format(this.statistics.copied.files.failed);
        return failedFiles.quantity
            ? this.error(
                `${failedFiles.asText} could not be copied.`,
                `${failedFiles.theyOrIt.upperCase} will be retried in the next synchronization run.`,
                "Until then, the backup is incomplete."
            )
            : [];
    }

    //------------------------------------------------------------------------------------------------------------------
    // Some files could not be deleted
    //------------------------------------------------------------------------------------------------------------------

    private someFilesCouldNotBeDeleted() {
        const failedFiles = this.format(this.statistics.deleted.files.failed + this.statistics.orphans.files.failed);
        return failedFiles.quantity
            ? this.warning(
                `${failedFiles.asText} could not be deleted.`,
                `${failedFiles.theyOrIt.upperCase} will be retried in the next synchronization run.`,
                "Until then, the backup contains outdated file versions."
            )
            : [];
    }

    //------------------------------------------------------------------------------------------------------------------
    // Orphans were found
    //------------------------------------------------------------------------------------------------------------------

    private orphansWereFound() {
        const orphans = this.format(this.statistics.orphans.files.total, "orphaned file");
        if (orphans.quantity) {
            const thereAreOrphans = `The previous synchronization left ${orphans.asText} behind.`;
            if (orphans.quantity === this.statistics.orphans.files.failed) {
                return this.warning(thereAreOrphans, `Attempts to delete ${orphans.theyOrIt.lowerCase} have failed.`);
            } else if (orphans.quantity === this.statistics.orphans.files.success) {
                const theyWereDeleted = 1 === orphans.quantity
                    ? "It was deleted successfully."
                    : "They were deleted deleted successfully.";
                return this.info(thereAreOrphans, theyWereDeleted);
            } else {
                return this.warning(thereAreOrphans, "Some of them could be deleted but others are still there.");
            }
        } else {
            return [];
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // A database purge was necessary
    //------------------------------------------------------------------------------------------------------------------

    private purgeWasNecessary() {
        const purged = this.format(this.statistics.purged.files.total);
        return purged.quantity
            ? this.warning(
                `There ${purged.wereOrWas} ${purged.asText} that ${purged.haveOrHas} vanished from the destination.`,
                `${purged.theyOrIt.upperCase} ${purged.haveOrHas} been removed from the database.`
            )
            : [];
    }

    //------------------------------------------------------------------------------------------------------------------
    // Recovery archive
    //------------------------------------------------------------------------------------------------------------------

    private indexArchive() {
        const isUpToDate = this.statistics.index.isUpToDate;
        const hasOrphans = this.statistics.index.hasLingeringOrphans;
        if (!isUpToDate) {
            if (hasOrphans) {
                return this.error(
                    "Failed to update the database.",
                    "The previous one was preserved but is outdated.",
                    "The next synchronization run will delete and re-encrypted all files processed in this run."
                );
            } else {
                return this.error(
                    "Failed to save the database.",
                    `The next synchronization run will delete and re-encrypt all files`
                );
            }
        } else if (hasOrphans) {
            return this.warning(
                "The database was saved but the old one could not be deleted.",
                "It will be retried in the next synchronization run"
            );
        } else {
            return [];
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // The database is out of sync with the file system
    //------------------------------------------------------------------------------------------------------------------

    private enumeratedFilenameCollisions() {
        return FilenameEnumerator.hasDetectedFilenameCollisions()
            ? this.error(
                "The database is out of sync with the destination.",
                "Generated filename might be re-used.",
                "When synchronizing the encrypted destination to another location without checking the modified date,",
                "updated files might be copied"
            )
            : [];
    }

    //------------------------------------------------------------------------------------------------------------------
    // Package a message as an error
    //------------------------------------------------------------------------------------------------------------------

    private error(...message: string[]) {
        return this.as(LogLevel.ERROR, message);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Package a message as a warning
    //------------------------------------------------------------------------------------------------------------------

    private warning(...message: string[]) {
        return this.as(LogLevel.WARN, message);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Package a message as an info
    //------------------------------------------------------------------------------------------------------------------

    private info(...message: string[]) {
        return this.as(LogLevel.INFO, message);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Wrap the severity and message into one object
    //------------------------------------------------------------------------------------------------------------------

    private as(logLevel: LogLevel, message: string[]) {
        return [{ logLevel: logLevel, message: message.join(" ") }];
    }

    //------------------------------------------------------------------------------------------------------------------
    // Format a number with a unit
    //------------------------------------------------------------------------------------------------------------------

    private format(quantity: number, singular?: string, plural?: string) {
        const effectiveSingular = singular ?? "file";
        const effectivePlural = plural ?? `${effectiveSingular}s`;
        return {
            quantity,
            asText: 1 === quantity ? `${quantity} ${effectiveSingular}` : `${quantity} ${effectivePlural}`,
            theyOrIt: {
                lowerCase: 1 === quantity ? "it" : "they",
                upperCase: 1 === quantity ? "It" : "They",
            },
            haveOrHas: 1 === quantity ? "has" : "have",
            wereOrWas: 1 === quantity ? "was" : "were"
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get a report of findings onto the console
    //------------------------------------------------------------------------------------------------------------------

    private displayReport(logLevel: LogLevel, messages: string[]) {
        this.displayBanner(logLevel);
        messages.forEach((message, index) => this.displayMessage(message, index, messages.length));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Display the report headline / separator
    //------------------------------------------------------------------------------------------------------------------

    private displayBanner(logLevel: LogLevel) {
        this.print("");
        this.print("--------------------------------------------------------------------------------");
        this.print(logLevel === LogLevel.ERROR ? "ERROR" : "Warning");
        this.print("--------------------------------------------------------------------------------");
        this.print("");
    }

    //------------------------------------------------------------------------------------------------------------------
    // Render an individual message
    //------------------------------------------------------------------------------------------------------------------

    private displayMessage(message: string, index: number, total: number) {
        const useNumbering = 1 < total;
        message = (useNumbering ? `${index + 1}. ${message}` : message).trim();
        const indent = useNumbering ? "   " : "";
        while (message) {
            const originalMessageLength = message.length;
            if (80 < originalMessageLength) {
                for (let position = Math.min(80, originalMessageLength - 2); 0 <= position; position--) {
                    if (" " === message.charAt(position)) {
                        this.print(message.substring(0, position).trim());
                        message = indent + message.substring(position + 1).trim()
                        break;
                    }
                }
            }
            if (message.length === originalMessageLength) {
                this.print(message);
                message = "";
            }
        }
        this.print("");
    }
}