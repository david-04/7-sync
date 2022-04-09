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
}

//----------------------------------------------------------------------------------------------------------------------
// Counting synchronization activities
//----------------------------------------------------------------------------------------------------------------------

class SyncStats {

    public readonly copied = new FileAndDirectoryStats();
    public readonly deleted = new FileAndDirectoryStats();
    public readonly orphans = new FileAndDirectoryStats();
    public readonly purged = new FileAndDirectoryStats();
    public readonly unprocessable = readonly({
        source: { symlinks: 0, other: 0 },
        destination: { symlinks: 0, other: 0 }
    });

    public readonly index = {
        hasLingeringOrphans: false,
        isUpToDate: true
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
