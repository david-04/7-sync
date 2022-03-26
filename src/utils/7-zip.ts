//----------------------------------------------------------------------------------------------------------------------
// Wrapper for 7-zip
//----------------------------------------------------------------------------------------------------------------------

class SevenZip {

    private readonly SHARED_OPTIONS;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(private readonly executable: string, private readonly password: string) {
        if (!SevenZip.isValidExecutable(executable)) {
            throw new FriendlyException(`Failed to execute "${executable}"`);
        }
        this.SHARED_OPTIONS = [
            "a", // add
            "-t7z",
            "-mx=9", // compression level
            "-mhc=on", // header compression
            "-mhe=on", // header encryption
            "-y", // assume "yes" for all prompts
            "-bse1", // stderr => stdout
            `-p${this.password}`
        ];
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
    // Add a file to an archive
    //------------------------------------------------------------------------------------------------------------------

    public compressFile(workingDirectory: string, relativePathToFile: string, zipFile: string, fileContent?: string) {
        if (undefined === fileContent) {
            return this.run(workingDirectory, [
                ...this.SHARED_OPTIONS,
                "-ssw", // compress files open for writing
                "-stl", // set archive timestamp to same as file
                zipFile,
                relativePathToFile
            ]);
        } else {
            return this.run(workingDirectory, [
                ...this.SHARED_OPTIONS,
                `-si${relativePathToFile}`,
                zipFile
            ], fileContent);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run any 7-Zip command
    //------------------------------------------------------------------------------------------------------------------

    private run(directory: string, parameters: string[], stdin?: string) {
        return SevenZip.runAnyCommand(directory, this.executable, parameters, stdin);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run any command
    //------------------------------------------------------------------------------------------------------------------

    private static runAnyCommand(directory: string, executable: string, parameters: string[], stdin?: string) {
        const result = node.child_process.spawnSync(executable, parameters, {
            cwd: directory,
            shell: false,
            windowsHide: true,
            encoding: "utf8",
            input: stdin
        });
        const error = result.error instanceof Error ? firstLineOnly(result.error) : result.error;
        return { stdout: result.stdout, stderr: result.stderr, status: result.status, error };
    }
}
