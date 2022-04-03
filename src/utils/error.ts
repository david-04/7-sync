//----------------------------------------------------------------------------------------------------------------------
// Run code in a try-catch exception handler and and ignore errors
//----------------------------------------------------------------------------------------------------------------------

function tryCatchIgnore<T>(action: () => T): Optional<T> {
    try {
        return Optional.of(action());
    } catch (ignored) {
        return Optional.empty();
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Run code in a try-catch exception handler and return it's result
//----------------------------------------------------------------------------------------------------------------------

function tryCatchRethrowFriendlyException<T>(action: () => T, getErrorMessage: (error: string) => string): T | never {
    try {
        return action();
    } catch (exception) {
        throw new FriendlyException(getErrorMessage(firstLineOnly(exception)));
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Run code and rethrow with a modified message
//----------------------------------------------------------------------------------------------------------------------

function rethrow(exception: unknown, getErrorMessage: (error: string) => string): never {
    if (exception instanceof Error) {
        exception.message = getErrorMessage(exception.message);
        throw exception;
    } else {
        throw new Error(getErrorMessage(`${exception}`));
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Extract the first line (error message) from an exception
//----------------------------------------------------------------------------------------------------------------------

function firstLineOnly(exception: unknown) {
    return `${exception}`.replace(/[\r\n].*$/m, "");
}
