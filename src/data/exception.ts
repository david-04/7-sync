//----------------------------------------------------------------------------------------------------------------------
// An exception with a human-readable message that does not require a stack-trace
//----------------------------------------------------------------------------------------------------------------------

class FriendlyException extends Error {

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(message: string, public readonly exitCode: number = 1) {
        super(message);
    }
}

//----------------------------------------------------------------------------------------------------------------------
// A class for internal errors (that are never supposed to be thrown in production code)
//----------------------------------------------------------------------------------------------------------------------

class InternalError extends Error {

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    constructor(message: string) {
        super(`Internal error: ${message}`);
    }
}
