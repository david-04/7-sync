//----------------------------------------------------------------------------------------------------------------------
// Wrapper for 7-zip
//----------------------------------------------------------------------------------------------------------------------

class SevenZip {

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(private readonly executable: string, private readonly password: string) {
        if (!SevenZip.isValidExecutable(executable)) {
            throw new FriendlyException(`Failed to execute "${executable}"`);
        }
    }

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
    // Verify if the given file can be accessed (with the current password)
    //------------------------------------------------------------------------------------------------------------------

    public isReadableWithCurrentPassword(file: string) {
        const result = this.run(FileUtils.getAbsolutePath("."), [
            "t",
            `-p${this.password}`,
            file
        ]);
        return 0 === result.status && !result.error;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run any 7-Zip command
    //------------------------------------------------------------------------------------------------------------------

    private run(directory: string, parameters: string[]) {
        return SevenZip.runAnyCommand(directory, this.executable, parameters);
    }

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
        return { stdout: result.stdout, stderr: result.stderr, status: result.status, error: result.error };
    }
}
