//----------------------------------------------------------------------------------------------------------------------
// Wrapper for 7-zip
//----------------------------------------------------------------------------------------------------------------------

class SevenZip {

    //------------------------------------------------------------------------------------------------------------------
    // Check if the given executable is a working 7-Zip
    //------------------------------------------------------------------------------------------------------------------

    public static isValidExecutable(executable: string) {
        try {
            const ok = this.runAnyCommand(".", executable, ["--help"]);
            if (0 !== ok.status || ok.error) {
                return false
            }
            const nok = this.runAnyCommand(".", executable, ["--unsupported-option"]);
            return 0 !== nok.status && !nok.error;
        } catch (exception) {
            return false;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(_executable: string, _password: string) {
        if (!SevenZip.isValidExecutable(_executable)) {
            throw new FriendlyException(`Can't execute "${_executable}"`);
        }
    }

    // //------------------------------------------------------------------------------------------------------------------
    // // Run any 7-Zip command
    // //------------------------------------------------------------------------------------------------------------------

    // private run(directory: string, parameters: string[]) {
    //     return SevenZip.runAnyCommand(directory, this.executable, parameters);
    // }

    //------------------------------------------------------------------------------------------------------------------
    // Run any command
    //------------------------------------------------------------------------------------------------------------------

    private static runAnyCommand(directory: string, executable: string, parameters: string[]) {
        const result = node.child_process.spawnSync(executable, parameters, {
            cwd: directory,
            shell: false,
            windowsHide: true,
            encoding: "utf8"
        });
        return {
            stdout: result.stdout,
            stderr: result.stderr,
            status: result.status,
            error: result.error
        };
    }
}
