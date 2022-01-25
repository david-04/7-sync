//----------------------------------------------------------------------------------------------------------------------
// Contextual information like configuration
//----------------------------------------------------------------------------------------------------------------------

class Context<T extends AllOptions> {

    private static instanceCount = 0;
    public logger: Logger = new Logger(LogLevel.ERROR, new NullOutputStream());
    public stdout: OutputStream = new ConsoleOutputStream();

    //------------------------------------------------------------------------------------------------------------------
    // initialisation
    //------------------------------------------------------------------------------------------------------------------

    public constructor(public readonly options: T) {
        if (0 < Context.instanceCount++) {
            throw `Internal error: Repeated Context instantiation`;
        }
    }
}
