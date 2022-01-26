//----------------------------------------------------------------------------------------------------------------------
// Contextual items like configuration and loggers
//----------------------------------------------------------------------------------------------------------------------

class Context<T extends TaskOptions> {

    //------------------------------------------------------------------------------------------------------------------
    // Initialisation
    //------------------------------------------------------------------------------------------------------------------

    public constructor(
        public readonly options: T,
        public readonly config: JsonConfig,
        public readonly originalConfig: JsonConfig,
        public readonly console: OutputStream,
        public readonly logger: Logger
    ) { }

    //------------------------------------------------------------------------------------------------------------------
    // A hacky hint to TypeScripts type inferer
    //------------------------------------------------------------------------------------------------------------------

    public typify<T extends TaskOptions>(options: T) {
        if (this.options !== options as any) {
            throw `Internal error: Typify must be called with this.options`;
        }
        return this as any as Context<T>;
    }
}
