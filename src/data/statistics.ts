//----------------------------------------------------------------------------------------------------------------------
// Counting success and failures
//----------------------------------------------------------------------------------------------------------------------

class SuccessAndFailureStats {

    public success = 0;
    public failed = 0;

    //------------------------------------------------------------------------------------------------------------------
    // Initialize with the sum of other statistics
    //------------------------------------------------------------------------------------------------------------------

    public constructor(...statistics: SuccessAndFailureStats[]) {
        statistics.forEach(item => {
            this.success += item.success;
            this.failed += item.failed;
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Count the total number items (success and failure)
    //------------------------------------------------------------------------------------------------------------------

    public get total() {
        return this.success + this.failed
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Counting success and failures for files and directories
//----------------------------------------------------------------------------------------------------------------------

class FileAndDirectoryStats {

    public readonly files: SuccessAndFailureStats;
    public readonly directories: SuccessAndFailureStats;

    //------------------------------------------------------------------------------------------------------------------
    // Initialize with the sum of other statistics
    //------------------------------------------------------------------------------------------------------------------

    public constructor(...statistics: FileAndDirectoryStats[]) {
        this.files = new SuccessAndFailureStats(...statistics.map(item => item.files));
        this.directories = new SuccessAndFailureStats(...statistics.map(item => item.directories));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Count the total number items (success and failure)
    //------------------------------------------------------------------------------------------------------------------

    public get total() {
        return this.files.total + this.directories.total
    }

    //------------------------------------------------------------------------------------------------------------------
    // Count the total number of successful items
    //------------------------------------------------------------------------------------------------------------------

    public get success() {
        return this.files.success + this.directories.success;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Count the total number of successful items
    //------------------------------------------------------------------------------------------------------------------

    public get failed() {
        return this.files.failed + this.directories.failed;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Format successful counts as "5 files and 2 directories"
    //------------------------------------------------------------------------------------------------------------------

    public formatSuccess() {
        return FileAndDirectoryStats.formatFilesAndDirectories(this.files.success, this.directories.success);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Format failure counts as "5 files and 2 directories"
    //------------------------------------------------------------------------------------------------------------------

    public formatFailed() {
        return FileAndDirectoryStats.formatFilesAndDirectories(this.files.failed, this.directories.failed);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Format the given counters as "5 files and 2 directories"
    //------------------------------------------------------------------------------------------------------------------

    private static formatFilesAndDirectories(files: number, directories: number) {
        if (0 === files || 0 === directories) {
            return "0 files and 0 directories";
        } else if (0 === files) {
            return FileAndDirectoryStats.formatNumberAndUnit(directories, "directory", "directories");
        } else if (0 === directories) {
            return FileAndDirectoryStats.formatNumberAndUnit(files, "file", "files");
        } else {
            return [
                FileAndDirectoryStats.formatNumberAndUnit(files, "file", "files"),
                FileAndDirectoryStats.formatNumberAndUnit(directories, "directory", "directories")
            ].join(" and ")
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Format a single counter
    //------------------------------------------------------------------------------------------------------------------

    private static formatNumberAndUnit(quantity: number, singular: string, plural: string) {
        return `${quantity} ${1 === quantity ? singular : plural}`;
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Counting synchronization activities
//----------------------------------------------------------------------------------------------------------------------

class SyncStats {

    public readonly copied = new FileAndDirectoryStats();
    public readonly deleted = new FileAndDirectoryStats();
    public readonly orphans = new FileAndDirectoryStats();
    public readonly purged = new FileAndDirectoryStats();

    public readonly index = {
        hasLingeringOrphans: false,
        isUpToDate: false
    };

    //------------------------------------------------------------------------------------------------------------------
    // Check if anything has been updated
    //------------------------------------------------------------------------------------------------------------------

    public get success() {
        return this.copied.success
            || this.deleted.success
            || this.orphans.success
            || this.purged.success;
    }
}
