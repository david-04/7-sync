type AllOptions = InitOptions | SyncOptions | ChangePasswordOptions;

//----------------------------------------------------------------------------------------------------------------------
// Options for the "init" operation
//----------------------------------------------------------------------------------------------------------------------

interface InitOptions {
    command: "init";
    config: string;
}

//----------------------------------------------------------------------------------------------------------------------
// Options for the "sync" operation
//----------------------------------------------------------------------------------------------------------------------

interface SyncOptions {
    command: "sync";
    config: string;
    dryRun: boolean;
    source: string | undefined;
    destination: string | undefined;
    sevenZip: string;
}

//----------------------------------------------------------------------------------------------------------------------
// Options for the "change-password" operation
//----------------------------------------------------------------------------------------------------------------------

interface ChangePasswordOptions {
    command: "change-password";
    config: string;
}
