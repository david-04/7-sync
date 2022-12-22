type TaskOptions = InitOptions | ReconfigureOptions | SyncOptions;

//----------------------------------------------------------------------------------------------------------------------
// Shared options that apply to all tasks
//----------------------------------------------------------------------------------------------------------------------

interface SharedOptions {
    config: string;
}

//----------------------------------------------------------------------------------------------------------------------
// Options for the "init" operation
//----------------------------------------------------------------------------------------------------------------------

interface InitOptions extends SharedOptions {
    command: "init";
}

//----------------------------------------------------------------------------------------------------------------------
// Options for the "reconfigure" operation
//----------------------------------------------------------------------------------------------------------------------

interface ReconfigureOptions extends SharedOptions {
    command: "reconfigure";
}

//----------------------------------------------------------------------------------------------------------------------
// Options for the "sync" operation
//----------------------------------------------------------------------------------------------------------------------

interface SyncOptions extends SharedOptions {
    command: "sync";
    dryRun: boolean;
    password?: string;
    sevenZip?: string;
    silent: boolean;
    parallel: number;
}
