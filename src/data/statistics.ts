//----------------------------------------------------------------------------------------------------------------------
// Processing statistics
//----------------------------------------------------------------------------------------------------------------------

class Statistics {

    public directories = { success: 0, failed: 0 };
    public files = { success: 0, failed: 0 };

    //------------------------------------------------------------------------------------------------------------------
    // Log the statistics
    //------------------------------------------------------------------------------------------------------------------

    public log(logger: Logger, isDryRun: boolean, infinitive: string, simplePast: string) {
        const success = isDryRun ? `Would have ${simplePast}` : `Successfully ${simplePast}`;
        if (this.files.success && this.directories.success) {
            logger.info(`${success} ${this.files.success} files and ${this.directories.success} directories`);
        } else if (this.files.success) {
            logger.info(`${success} ${this.files.success} files`);
        } else if (this.directories.success) {
            logger.info(`${success} ${this.directories.success} directories`);
        }
        const failed = `Failed to ${simplePast}`;
        if (this.files.failed && this.directories.failed) {
            logger.warn(`${failed} ${this.files.failed} files and ${this.directories.failed} directories`);
        } else if (this.files.failed) {
            logger.warn(`${failed} ${this.files.failed} files`);
        } else if (this.directories.failed) {
            logger.warn(`${failed} ${this.directories.failed} directories`);
        }
        if (!(this.directories.success + this.directories.failed + this.files.success + this.files.failed)) {
            logger.info(`There are no files or directories to ${infinitive}`);
        }
    }
}
