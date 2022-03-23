//----------------------------------------------------------------------------------------------------------------------
// Run the given code and prepend a message if a FriendlyException is thrown
//----------------------------------------------------------------------------------------------------------------------

function rethrowWithPrefix(message: string, exception: unknown): never {
    if (exception instanceof FriendlyException) {
        exception.prependMessage(message + ": ");
    }
    throw exception;
}
