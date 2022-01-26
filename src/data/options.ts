type TaskOptions = InitOptions | SyncOptions | ChangePasswordOptions;

//----------------------------------------------------------------------------------------------------------------------
// Shared options that apply to all tasks
//----------------------------------------------------------------------------------------------------------------------

interface SharedOptions {
    config: string;
    silent: boolean;
    debug: boolean;
}

//----------------------------------------------------------------------------------------------------------------------
// Options for the "init" operation
//----------------------------------------------------------------------------------------------------------------------

interface InitOptions extends SharedOptions {
    command: "init";
}

//----------------------------------------------------------------------------------------------------------------------
// Options for the "sync" operation
//----------------------------------------------------------------------------------------------------------------------

interface SyncOptions extends SharedOptions {
    command: "sync";
    dryRun: boolean;
    sevenZip: string | undefined;
}

//----------------------------------------------------------------------------------------------------------------------
// Options for the "change-password" operation
//----------------------------------------------------------------------------------------------------------------------

interface ChangePasswordOptions extends SharedOptions {
    command: "change-password";
}
