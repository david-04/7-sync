//----------------------------------------------------------------------------------------------------------------------
// An exception with a human-readable message that does not require a stack-trace
//----------------------------------------------------------------------------------------------------------------------

class FriendlyException {
    public constructor(public readonly message: string, public readonly exitCode: number = 1) { }
}
