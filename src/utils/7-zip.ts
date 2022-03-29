//----------------------------------------------------------------------------------------------------------------------
// Wrapper for 7-zip
//----------------------------------------------------------------------------------------------------------------------

class SevenZip {

    private readonly print;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(
        private readonly executable: string,
        private readonly password: string,
        private readonly logger: Logger,
        console: OutputStream
    ) {
        this.print = (message: string) => console.log(message);
        this.runSelfTests();
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run the self tests
    //------------------------------------------------------------------------------------------------------------------

    public runSelfTests() {
        this.logger.info(`Verifying that the 7-Zip command "${this.executable}" is working`);
        this.print("Verifying that 7-Zip is working correctly");
        try {
            this.assertThatSevenZipIsWorking();
        } catch (exception) {
            if (exception instanceof SevenZipSelfTestException) {
                if (exception.stdout) {
                    this.logger.error(exception.stdout);
                }
                this.logger.error(exception.message);
                throw new FriendlyException(`7-Zip is not working: ${exception.message}`);
            }

        }
        this.logger.debug("All tests have passed");
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that
    //------------------------------------------------------------------------------------------------------------------

    public assertThatSevenZipIsWorking() {
        const directory = this.createWorkingDirectory();
        const sourceFilename = "data.txt";
        const sourceContent = "Test data";
        const sourceFilePath = node.path.join(directory, sourceFilename);
        const password = "my-password";
        const virtualFilename = "_" + sourceFilename;
        const virtualContent = "_" + sourceContent;
        const zipFile = node.path.join(directory, "archive.7z");
        try {
            this.createTestSourceFile(sourceFilePath, sourceContent);
            this.selfTestExecutable();
            this.selfTestCommandLineError();
            this.selfTestZipFile(password, directory, sourceFilename, sourceContent, zipFile);
            this.selfTestZipString(password, virtualFilename, virtualContent, zipFile);
            this.selfTestUnzip(password, sourceFilename, sourceContent, zipFile);
            this.selfTestList(password, zipFile);
            this.removeTestDirectory(directory);
        } catch (exception) {
            try {
                this.removeTestDirectory(directory);
            } catch (nestedException) {
                // ignored
            }
            throw exception;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create the working directory for the self-test
    //------------------------------------------------------------------------------------------------------------------

    private createWorkingDirectory() {
        const tempDirectory = node.path.resolve(node.os.tmpdir());
        try {
            const workingDirectory = node.fs.mkdtempSync(`${tempDirectory}${node.path.sep}7-sync-self-test-`);
            if (FileUtils.existsAndIsDirectory(workingDirectory)) {
                return workingDirectory;
            } else {
                throw new SevenZipSelfTestException(`Failed to create a working directory in ${tempDirectory}`);
            }
        } catch (exception) {
            throw new SevenZipSelfTestException(
                `Failed to create a working directory in ${tempDirectory} - ${firstLineOnly(exception)}`
            );
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create the test data file for the self-test
    //------------------------------------------------------------------------------------------------------------------

    private createTestSourceFile(absolutePath: string, content: string) {
        try {
            node.fs.writeFileSync(absolutePath, content);
            if (FileUtils.existsAndIsDirectory(absolutePath)) {
                throw new SevenZipSelfTestException(`Failed to create the test file ${absolutePath}`);
            }
        } catch (exception) {
            throw new SevenZipSelfTestException(
                `Failed to create the test file ${absolutePath} - ${firstLineOnly(exception)}`
            );
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete the self-test files
    //------------------------------------------------------------------------------------------------------------------

    private removeTestDirectory(directory: string) {
        if (FileUtils.exists(directory)) {
            try {
                node.fs.rmSync(directory, { recursive: true });
                if (FileUtils.exists(directory)) {
                    throw new SevenZipSelfTestException(`Failed to delete ${directory}`);
                }
            } catch (exception) {
                throw new SevenZipSelfTestException(`Failed to delete ${directory} - ${firstLineOnly(exception)}`);
            }
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that 7-Zip can be executed
    //------------------------------------------------------------------------------------------------------------------

    private selfTestExecutable() {
        const result = this.runSevenZip({});
        const message = `${this.executable} could not be started`;
        this.assertSuccess(result, message);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that an invalid parameter causes an error
    //------------------------------------------------------------------------------------------------------------------

    private selfTestCommandLineError() {
        const result = this.runSevenZip({ parameters: ["--unknown-option"] })
        const message = `Passing an invalid option to ${this.executable} did not raise an error`;
        this.assertFailure(result, message);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that a file can be zipped
    //------------------------------------------------------------------------------------------------------------------

    private selfTestZipFile(
        password: string, directory: string, filename: string, content: string, zipFile: string
    ) {
        const zipResult = this.zipFile(directory, filename, zipFile, password);
        const zipMessage = "Failed to zip a file";
        this.assertSuccess(zipResult, zipMessage);
        const unzipResult = this.unzipToStdout(zipFile, filename, password);
        const unzipMessage = "Failed to unzip a file";
        this.assertSuccess(unzipResult, unzipMessage);
        if (content !== unzipResult.stdout) {
            throw new SevenZipSelfTestException(
                `Zipped a file with content "${content}" but received "${unzipResult.stdout}" when unzipping it again`
            );
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that a string can be zipped
    //------------------------------------------------------------------------------------------------------------------

    private selfTestZipString(
        password: string, filename: string, content: string, zipFile: string
    ) {
        const zipResult = this.zipString(content, filename, zipFile, password);
        const zipMessage = "Failed to zip a string";
        this.assertSuccess(zipResult, zipMessage);
        const unzipResult = this.unzipToStdout(zipFile, filename, password);
        const unzipMessage = "Failed to unzip a file";
        this.assertSuccess(unzipResult, unzipMessage);
        if (content !== unzipResult.stdout) {
            throw new SevenZipSelfTestException(
                `Zipped a file with content "${content}" but received "${unzipResult.stdout}" when unzipping it again`
            );
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that file content can be unzipped
    //------------------------------------------------------------------------------------------------------------------

    private selfTestUnzip(
        password: string, filename: string, content: string, zipFile: string
    ) {
        const result1 = this.unzipToStdout(zipFile, filename, password);
        const message1 = "Failed to unzip a file";
        this.assertSuccess(result1, message1);
        if (content !== result1.stdout) {
            throw new SevenZipSelfTestException(
                `Unzipped file and received "${result1.stdout}" but expected "${content}"`
            );
        }
        const result2 = this.unzipToStdout(zipFile, filename, "_" + password);
        const message2 = "Unzipping with a wrong password did not raise an error";
        this.assertFailure(result2, message2);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that file content can be unzipped
    //------------------------------------------------------------------------------------------------------------------

    private selfTestList(password: string, zipFile: string) {
        const result1 = this.listToStdout(zipFile, password);
        const message1 = "Failed to list files within the archive ";
        this.assertSuccess(result1, message1);
        const result2 = this.listToStdout(zipFile, "_" + password);
        const message2 = "Listing files with an invalid password did not raise an error";
        this.assertFailure(result2, message2);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run a test and expect it to succeed
    //------------------------------------------------------------------------------------------------------------------

    private assertSuccess(result: { success: boolean, errorMessage: string, stdout: string }, message: string) {
        if (!result.success) {
            throw new SevenZipSelfTestException(`${message} - ${result.errorMessage}`, result.stdout);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run a test and expect it to fail
    //------------------------------------------------------------------------------------------------------------------

    private assertFailure(result: { success: boolean, errorMessage: string, stdout: string }, message: string) {
        if (result.success) {
            throw new SevenZipSelfTestException(message, result.stdout);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify if the given file can be accessed with the current password
    //------------------------------------------------------------------------------------------------------------------

    public isReadableWithCurrentPassword(zipFile: string) {
        return this.listToStdout(zipFile).success;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Zip a file
    //------------------------------------------------------------------------------------------------------------------

    public zipFile(workingDirectory: string, sourceFile: string, zipFile: string, passwordOverride?: string) {
        const result = this.runSevenZip({
            workingDirectory,
            parameters: [
                ...this.getZipParameters(passwordOverride ?? this.password),
                zipFile,
                sourceFile
            ]
        })
        return this.verifyZipResult(zipFile, result, passwordOverride);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Zip in-memory string content
    //------------------------------------------------------------------------------------------------------------------

    public zipString(content: string, filenameInArchive: string, zipFile: string, passwordOverride?: string) {
        const result = this.runSevenZip({
            parameters: [
                ...this.getZipParameters(passwordOverride ?? this.password),
                `-si${filenameInArchive}`, // read from stdin
                zipFile // write to this zip archive
            ],
            stdin: content
        });
        if (result.success) {
            return this.verifyZipResult(zipFile, result, passwordOverride);
        } else {
            return result;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that a recently created zip archive can be listed
    //------------------------------------------------------------------------------------------------------------------

    private verifyZipResult(
        zipFile: string,
        zipResult: { success: boolean, errorMessage: string, stdout: string },
        passwordOverride?: string
    ) {
        if (!FileUtils.existsAndIsFile(zipFile)) {
            return {
                success: false,
                errorMessage: `7-Zip returned no error but ${zipFile} was not created either`,
                stdout: zipResult.stdout
            };
        }
        const listResult = this.listToStdout(zipFile, passwordOverride ?? this.password);
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
        return listResult;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Unzip a file to stdout
    //------------------------------------------------------------------------------------------------------------------

    public unzipToStdout(zipFile: string, filenameInArchive: string, passwordOverride?: string) {
        return this.runSevenZip({
            parameters: [
                ...this.getUnzipParameters(passwordOverride ?? this.password),
                `-so`, // write to stdout
                zipFile, // the zip archive to read
                filenameInArchive // the filename within the archive
            ],
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // List file contents to stdout
    //------------------------------------------------------------------------------------------------------------------

    private listToStdout(zipFile: string, passwordOverride?: string) {
        return this.runSevenZip({
            parameters: [
                ...this.getListParameters(passwordOverride ?? this.password),
                zipFile
            ]
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the 7-Zip parameters that are needed for every "zip" command
    //------------------------------------------------------------------------------------------------------------------

    private getZipParameters(password: string) {
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

    private getUnzipParameters(password: string) {
        return [
            "e", // extract file
            ...this.getSharedParameters(password)
        ];
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the 7-Zip parameters that are needed for every "list" command
    //------------------------------------------------------------------------------------------------------------------

    private getListParameters(password: string) {
        return [
            "l", // list file
            ...this.getSharedParameters(password)
        ];
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the 7-Zip parameters that are needed for every command/operation
    //------------------------------------------------------------------------------------------------------------------

    private getSharedParameters(password: string) {
        return [
            "-t7z", // set file format to 7z
            "-bse1", // redirect stderr => stdout
            "-y", // assume "yes" for all prompts
            `-p${password}` // password
        ];
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run 7-Zip with the given parameters
    //------------------------------------------------------------------------------------------------------------------

    private runSevenZip(options: { workingDirectory?: string, parameters?: string[], stdin?: string }) {
        return SevenZip.runAnyCommand({ ...options, executable: this.executable });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run any arbitrary command
    //------------------------------------------------------------------------------------------------------------------

    private static runAnyCommand(options: {
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
            : `exit code ${result.status}`
        return { success, errorMessage, stdout: result.stdout };
    }
}
