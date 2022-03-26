//----------------------------------------------------------------------------------------------------------------------
// Processing statistics
//----------------------------------------------------------------------------------------------------------------------

class Statistics {

    public directories = { success: 0, failed: 0 };
    public files = { success: 0, failed: 0 };

    //------------------------------------------------------------------------------------------------------------------
    // Join two statistics
    //------------------------------------------------------------------------------------------------------------------

    public static add(...statistics: Statistics[]) {
        const result = new Statistics;
        for (const currentStatistics of statistics) {
            result.files.success += currentStatistics.files.success;
            result.files.failed += currentStatistics.files.failed;
            result.directories.success += currentStatistics.directories.success;
            result.directories.failed += currentStatistics.directories.failed;
        }
        return result;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Check if it contains failed items
    //------------------------------------------------------------------------------------------------------------------

    public hasFailures() {
        return 0 < this.directories.failed || 0 < this.files.failed;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Check if it contains successful items
    //------------------------------------------------------------------------------------------------------------------

    public hasSuccess() {
        return 0 < this.directories.success || 0 < this.files.success;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log the statistics
    //------------------------------------------------------------------------------------------------------------------

    public log(logger: Logger, isDryRun: boolean, infinitive: string, simplePast: string, console: OutputStream) {
        const hasSuccess = this.hasSuccess();
        const hasFailures = this.hasFailures();
        if (hasSuccess || hasFailures) {
            if (hasSuccess) {
                const intro = isDryRun ? `Would have ${simplePast}` : `Successfully ${simplePast}`;
                const statistics = Statistics.format(this.files.success, this.directories.success);
                const message = `${intro} ${statistics}`;
                logger.info(message);
                console.log(message);
            }
            if (hasFailures) {
                const intro = isDryRun ? `Would have ${simplePast}` : `Failed to ${infinitive}`;
                const statistics = Statistics.format(this.files.failed, this.directories.failed);
                const message = `${intro} ${statistics}`;
                logger.warn(message);
                console.log(message);
            }
        } else {
            const message = isDryRun ?
                `Would have ${simplePast} any files or directories`
                : `There are no files or directories that need to be ${simplePast}`;
            logger.info(message);
            console.log(message);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Format the file and directory counter
    //------------------------------------------------------------------------------------------------------------------

    public static format(files: number, directories: number) {
        return [this.formatNumber(files, "file", "files"), this.formatNumber(directories, "directory", "directories")]
            .filter(message => message).join(" and ");
    }

    //------------------------------------------------------------------------------------------------------------------
    // Format a single counter
    //------------------------------------------------------------------------------------------------------------------

    private static formatNumber(quantity: number, singular: string, plural: string) {
        return `${quantity} ${1 === quantity ? singular : plural}`;
    }
}
