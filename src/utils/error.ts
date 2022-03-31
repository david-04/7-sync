//----------------------------------------------------------------------------------------------------------------------
// Prepend a prefix to the exception's message and rethrow it
//----------------------------------------------------------------------------------------------------------------------

function rethrowWithPrefix(prefix: string, exception: unknown): never {
    if (exception instanceof Error) {
        exception.message = `${prefix}: ${exception.message}`;
        throw exception;
    } else {
        throw new Error(`${prefix}: ${exception}`);
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Append a suffix to the exception's message and rethrow it
//----------------------------------------------------------------------------------------------------------------------

function rethrowWithSuffix(exception: unknown, suffix: string): never {
    if (exception instanceof Error) {
        exception.message = `${exception.message} ${suffix}`;
        throw exception;
    } else {
        throw new Error(`${exception} ${suffix}`);
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Prepend a prefix and append a suffix to the exception's message and rethrow it
//----------------------------------------------------------------------------------------------------------------------

function rethrowWithPrefixAndSuffix(prefix: string, exception: unknown, suffix: string): never {
    if (exception instanceof Error) {
        exception.message = `${prefix}: ${exception.message} ${suffix}`;
        throw exception;
    } else {
        throw new Error(`${prefix}: ${exception} ${suffix}`);
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Run code in a try-catch exception handler and and ignore errors
//----------------------------------------------------------------------------------------------------------------------

function tryCatchIgnore(action: () => void) {
    try {
        return action();
    } catch (ignored) { }
}

//----------------------------------------------------------------------------------------------------------------------
// Run code in a try-catch exception handler and return it's result
//----------------------------------------------------------------------------------------------------------------------

function tryCatchRethrowFriendlyException<T>(action: () => T, getErrorMessage: (error: string) => string | never) {
    try {
        return action();
    } catch (exception) {
        throw new FriendlyException(getErrorMessage(firstLineOnly(exception)));
    }
}
