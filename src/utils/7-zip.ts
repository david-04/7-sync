//----------------------------------------------------------------------------------------------------------------------
// Wrapper for 7-zip
//----------------------------------------------------------------------------------------------------------------------

class SevenZip {

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(
        private readonly executable: string,
        private readonly password: string,
        private readonly logger: Logger
    ) {
        SevenZip.assertThatSevenZipIsWorking(executable);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that the password can decrypt a randomly selected file from the destination
    //------------------------------------------------------------------------------------------------------------------

    public doesPasswordWorkWithAnyFileFrom(directory: string): boolean | undefined {
        const children = FileUtils.getChildren(directory).array;
        for (const child of children.filter(c => c.isFile() && c.name.endsWith(".7z"))) {
            const file = node.path.join(directory, child.name);
            this.logger.debug(`Checking if the password can open ${file}`)
            if (this.isReadableWithCurrentPassword(file)) {
                this.logger.debug("Successfully opened the archive, the password is correct");
                return true;
            } else {
                this.logger.debug("Failed to open the archive, the password is not correct");
                return false;
            }
        }
        for (const child of children.filter(c => c.isDirectory())) {
            const result = this.doesPasswordWorkWithAnyFileFrom(node.path.join(directory, child.name));
            if (undefined !== result) {
                return result;
            }
        }
        return undefined;
    }

    //------------------------------------------------------------------------------------------------------------------
    //
    //------------------------------------------------------------------------------------------------------------------

    public static assertThatSevenZipIsWorking(_executable: string) {
        // TODO
    }


    //------------------------------------------------------------------------------------------------------------------
    // Check if the given executable is a working 7-Zip
    //------------------------------------------------------------------------------------------------------------------

    // public static isValidExecutable(executable: string) {
    //     try {
    //         const ok = this.runAnyCommand(".", executable, ["--help"]);
    //         if (0 !== ok.status || ok.error) {
    //             return false
    //         }
    //         const nok = this.runAnyCommand(".", executable, ["--unsupported-option"]);
    //         return 0 !== nok.status && !nok.error;
    //     } catch (exception) {
    //         return false;
    //     }
    // }











    //------------------------------------------------------------------------------------------------------------------
    // Verify if the given file can be accessed with the current password
    //------------------------------------------------------------------------------------------------------------------

    public isReadableWithCurrentPassword(zipFile: string) {
        return SevenZip.isReadableWithCurrentPassword(this.executable, this.password, zipFile);
    }

    private static isReadableWithCurrentPassword(executable: string, password: string, zipFile: string) {
        return this.listToStdout(executable, password, zipFile).success;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Zip a file
    //------------------------------------------------------------------------------------------------------------------

    public zipFile(workingDirectory: string, sourceFile: string, zipFile: string) {
        return SevenZip.zipFile(this.executable, this.password, workingDirectory, sourceFile, zipFile);
    }

    private static zipFile(
        executable: string, password: string, workingDirectory: string, sourceFile: string, zipFile: string
    ) {
        return this.verifyZipResult(executable, password, zipFile, this.run({
            executable,
            workingDirectory,
            parameters: [
                ...this.getZipParameters(password),
                zipFile,
                sourceFile
            ]
        }));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Zip in-memory string content
    //------------------------------------------------------------------------------------------------------------------

    public zipString(content: string, filenameInArchive: string, zipFile: string) {
        return SevenZip.zipString(this.executable, this.password, content, filenameInArchive, zipFile);
    }

    private static zipString(
        executable: string, password: string, content: string, filenameInArchive: string, zipFile: string
    ) {
        return this.verifyZipResult(executable, password, zipFile, this.run({
            executable,
            parameters: [
                ...this.getZipParameters(password),
                `-si${filenameInArchive}`, // read from stdin
                zipFile // write to this zip archive
            ],
            stdin: content
        }));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that a recently created zip archive can be listed
    //------------------------------------------------------------------------------------------------------------------

    private static verifyZipResult(
        executable: string,
        password: string,
        zipFile: string,
        zipResult: { success: boolean, errorMessage: string, stdout: string }
    ) {
        if (zipResult.success) {
            if (!FileUtils.existsAndIsFile(zipFile)) {
                return {
                    success: false,
                    errorMessage: `7-Zip returned no error but ${zipFile} was not created either`,
                    stdout: zipResult.stdout
                };
            }
            const listResult = this.listToStdout(executable, password, zipFile);
            if (!listResult.success) {
                return {
                    success: false,
                    errorMessage: `The zip file was created but listing its contents failed: ${listResult.errorMessage}`,
                    stdout: [
                        "================================[ zip command ]================================",
                        "",
                        zipResult.stdout,
                        "",
                        "================================[ list command ]================================",
                        "",
                        listResult.stdout
                    ].join("\n")
                };
            }
        }
        return zipResult;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Unzip a file to stdout
    //------------------------------------------------------------------------------------------------------------------

    public unzipToStdout(zipFile: string, filenameInArchive: string) {
        return SevenZip.unzipToStdout(this.executable, this.password, zipFile, filenameInArchive);
    }

    private static unzipToStdout(executable: string, password: string, zipFile: string, filenameInArchive: string) {
        return this.run({
            executable,
            parameters: [
                ...this.getUnzipParameters(password),
                `-soi`, // write to stdout
                zipFile, // the zip archive to read
                filenameInArchive // the filename within the archive
            ],
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // List file contents to stdout
    //------------------------------------------------------------------------------------------------------------------

    public listToStdout(zipFile: string) {
        return SevenZip.listToStdout(this.executable, this.password, zipFile);
    }

    private static listToStdout(executable: string, password: string, zipFile: string) {
        return this.run({
            executable,
            parameters: [
                ...this.getListParameters(password),
                zipFile
            ]
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the 7-Zip parameters that are needed for every "zip" command
    //------------------------------------------------------------------------------------------------------------------

    private static getZipParameters(password: string) {
        return [
            "a", // add file
            "-mx=9", // highest compression level
            "-mhc=on", // enable header compression
            "-mhe=on", // enable header encryption
            ...this.getSharedParameters(password)
        ];
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the 7-Zip parameters that are needed for every "unzip" command
    //------------------------------------------------------------------------------------------------------------------

    private static getUnzipParameters(password: string) {
        return [
            "x", // extract file
            ...this.getSharedParameters(password)
        ];
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the 7-Zip parameters that are needed for every "list" command
    //------------------------------------------------------------------------------------------------------------------

    private static getListParameters(password: string) {
        return [
            "l", // list file
            ...this.getSharedParameters(password)
        ];
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the 7-Zip parameters that are needed for every command/operation
    //------------------------------------------------------------------------------------------------------------------

    private static getSharedParameters(password: string) {
        return [
            "-t7z", // set file format to 7z
            "-bse1", // redirect stderr => stdout
            "-y", // assume "yes" for all prompts
            `-p${password}` // password
        ];
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run any arbitrary command
    //------------------------------------------------------------------------------------------------------------------

    private static run(options: {
        workingDirectory?: string,
        executable: string,
        parameters?: string[],
        stdin?: string
    }) {
        const result = node.child_process.spawnSync(options.executable, options.parameters ?? [], {
            cwd: options.workingDirectory,
            shell: false,
            windowsHide: true,
            encoding: "utf8",
            input: options.stdin,

        });
        const success = 0 === result.status && !result.error;
        const errorMessage = result.error
            ? `${firstLineOnly(result.error)} (exit code ${result.status})`
            : `7-Zip exited with status exit code ${result.status}`
        return { success, errorMessage, stdout: result.stdout };
    }
}
