type TaskOptions = InitOptions | SyncOptions | ChangePasswordOptions;
type TaskOptionsWithConfigFile = TaskOptions & { config: string };

//----------------------------------------------------------------------------------------------------------------------
// Shared options that apply to all tasks
//----------------------------------------------------------------------------------------------------------------------

interface SharedOptions {
    silent: boolean;
    debug: boolean;
}

//----------------------------------------------------------------------------------------------------------------------
// Options for the "init" operation
//----------------------------------------------------------------------------------------------------------------------

interface InitOptions extends SharedOptions {
    command: "init";
    config?: string;
}

//----------------------------------------------------------------------------------------------------------------------
// Options for the "sync" operation
//----------------------------------------------------------------------------------------------------------------------

interface SyncOptions extends SharedOptions {
    command: "sync";
    config: string;
    dryRun: boolean;
    sevenZip: string | undefined;
}

//----------------------------------------------------------------------------------------------------------------------
// Options for the "change-password" operation
//----------------------------------------------------------------------------------------------------------------------

interface ChangePasswordOptions extends SharedOptions {
    command: "change-password";
    config: string;
}
