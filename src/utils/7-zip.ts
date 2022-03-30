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
        private readonly console: OutputStream
    ) {
        this.print = (message: string) => console.log(message);
    }

    //------------------------------------------------------------------------------------------------------------------
    // For the self-test, create a new SevenZip instance that uses a different password
    //------------------------------------------------------------------------------------------------------------------

    public cloneWithDifferentPassword(newPassword: string) {
        return new SevenZip(this.executable, newPassword, this.logger, this.console);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run the self tests
    //------------------------------------------------------------------------------------------------------------------

    public runSelfTest() {
        this.logger.info(`Verifying that 7-Zip (${this.executable}) is working correctly`);
        this.print("Verifying that 7-Zip is working correctly");
        const directory = this.createTemporaryDirectory();
        try {
            const correctPassword = this.cloneWithDifferentPassword("correct-password");
            const invalidPassword = this.cloneWithDifferentPassword("invalid-password");
            correctPassword.runAllSelfTests(directory, invalidPassword);
            this.removeTestDirectory(directory);
        } catch (exception) {
            tryCatchIgnore(() => this.removeTestDirectory(directory));
            rethrowWithPrefixAndSuffix("7-Zip is not working correctly", exception, "(see log file for details)");
        }
        this.logger.debug("All 7-Zip tests have passed");
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create the working directory for the self-test
    //------------------------------------------------------------------------------------------------------------------

    private createTemporaryDirectory() {
        const tempDirectory = tryCatchRethrowFriendlyException(
            () => node.path.resolve(node.os.tmpdir()),
            error => `Failed to determine the system's temp directory - ${error}`
        );
        const workingDirectory = tryCatchRethrowFriendlyException(
            () => node.fs.mkdtempSync(`${tempDirectory}${node.path.sep}7-sync-self-test-`),
            error => `Failed to create a a test directory in ${tempDirectory} - ${error}`
        );
        if (!FileUtils.existsAndIsDirectory(workingDirectory)) {
            this.logger.error(`mkdtempSync failed to create ${workingDirectory} - but did not raise an error either`);
            FriendlyException.throw(`Failed to create test directory ${tempDirectory}`);
        }
        return workingDirectory;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete the self-test files
    //------------------------------------------------------------------------------------------------------------------

    private removeTestDirectory(directory: string) {
        if (FileUtils.exists(directory)) {
            tryCatchRethrowFriendlyException(
                () => node.fs.rmSync(directory, { recursive: true }),
                error => `Failed to delete test directory ${directory} - ${error}`
            );
            if (FileUtils.exists(directory)) {
                FriendlyException.throw(`Failed to delete ${directory} (though rmSync did not raise an error)`);
            }
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run all self tests
    //------------------------------------------------------------------------------------------------------------------

    private runAllSelfTests(directory: string, sevenZipWithWrongPassword: SevenZip) {
        const filename = "data.txt";
        const content = "Test data";
        const zipFile = node.path.join(directory, "archive.7z");
        this.createTestFile(node.path.join(directory, filename), content);
        this.testGeneralInvocation();
        this.testInvalidParameters();
        this.testZipAndUnzipFile(directory, filename, content, zipFile);
        this.testZipAndUnzipString(content, "In-memory data", zipFile);
        this.testZipNonExistentFile(directory, "non-existent-file", zipFile);
        sevenZipWithWrongPassword.testUnzipWithWrongPassword(zipFile, filename, content);
        this.selfTestList(zipFile);
        sevenZipWithWrongPassword.testListWithWrongPassword(zipFile);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create and populate a test data file
    //------------------------------------------------------------------------------------------------------------------

    private createTestFile(file: string, content: string) {
        tryCatchRethrowFriendlyException(
            () => node.fs.writeFileSync(file, content),
            error => FriendlyException.throw(`Failed to create the test file ${file} - ${error}`)
        );
        if (FileUtils.existsAndIsDirectory(file)) {
            FriendlyException.throw(`Failed to create the test file ${file} (writeFileSync did not raise an error)`);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that 7-Zip can be executed
    //------------------------------------------------------------------------------------------------------------------

    private testGeneralInvocation() {
        const result = this.runSevenZip({});
        if (!result.success) {
            this.logExecution(result);
            this.logger.error("Expected no error and exit code 0");
            FriendlyException.throw(`The program can't be started - ${result.errorMessage}`);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify invalid parameters cause an error
    //------------------------------------------------------------------------------------------------------------------

    private testInvalidParameters() {
        const result = this.runSevenZip({ parameters: ["--invalid-option", "non-existent-file"] });
        if (result.success) {
            this.logExecution(result);
            this.logger.error("Expected an exit code other than 0 or an error");
            FriendlyException.throw("Passing invalid parameters does not cause an error");
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that a file can be zipped and that its content can be unzipped thereafter
    //------------------------------------------------------------------------------------------------------------------

    private testZipAndUnzipFile(directory: string, filename: string, content: string, zipFile: string) {
        const zipResult = this.zipFile(directory, filename, zipFile);
        if (!zipResult.success) {
            this.logExecution(zipResult);
            this.logger.error("Expected no error and exit code 0");
            FriendlyException.throw("Failed to add a file to a zip archive");
        }
        const unzipResult = this.unzipToStdout(zipFile, filename);
        if (!zipResult.success) {
            this.logExecution(zipResult, LogLevel.INFO);
            this.logExecution(unzipResult);
            this.logger.error("Expected no error and exit code 0");
            FriendlyException.throw("Failed to extract a file from a zip archive");
        }
        if (content !== unzipResult.consoleOutput) {
            this.logExecution(zipResult, LogLevel.INFO);
            this.logExecution(unzipResult, LogLevel.INFO);
            this.logger.error(`Expected unzip ${content} but received ${unzipResult.consoleOutput}`);
            FriendlyException.throw("Unzipping file content returns invalid data");
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that in-memory text content can be zipped and unzipped
    //------------------------------------------------------------------------------------------------------------------

    private testZipAndUnzipString(content: string, filenameInArchive: string, zipFile: string) {
        const zipResult = this.zipString(content, filenameInArchive, zipFile);
        if (!zipResult.success) {
            this.logExecution(zipResult);
            this.logger.error("Expected no error and exit code 0");
            FriendlyException.throw("Failed to add string content to a zip archive");
        }
        const unzipResult = this.unzipToStdout(zipFile, filenameInArchive);
        if (!unzipResult.success) {
            this.logExecution(zipResult, LogLevel.INFO);
            this.logExecution(unzipResult);
            this.logger.error("Expected no error and exit code 0");
            FriendlyException.throw("Failed to extract a file from a zip archive");
        }
        if (content !== unzipResult.consoleOutput) {
            this.logExecution(zipResult, LogLevel.INFO);
            this.logExecution(unzipResult, LogLevel.INFO);
            this.logger.error(`Expected "${content}" as unzipped content but received "${unzipResult.consoleOutput}"`);
            FriendlyException.throw("Unzipping file content returns invalid data");
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify invalid parameters cause an error
    //------------------------------------------------------------------------------------------------------------------

    private testUnzipWithWrongPassword(zipFile: string, filenameInArchive: string, content: string) {
        const result = this.unzipToStdout(zipFile, filenameInArchive);
        if (result.success) {
            this.logExecution(result);
            this.logger.error("Expected an exit code other than 0 or an error");
            FriendlyException.throw("Unzipping with a wrong password does not cause an error");
        }
        if (result.consoleOutput === content) {
            this.logExecution(result);
            this.logger.error(`Despite the wrong password, the correct file content (${content}) was returned`);
            FriendlyException.throw("Unzipping with a wrong password returns the correct file content");
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that zipping a non-existent file causes an error
    //------------------------------------------------------------------------------------------------------------------

    private testZipNonExistentFile(directory: string, file: string, zipFile: string) {
        const result = this.zipFile(directory, file, zipFile);
        if (result.success) {
            this.logExecution(result);
            this.logger.error("Expected an exit code other than 0 or an error");
            FriendlyException.throw("Zipping a non-existent file does not cause an error");
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that files within an archive can be listed
    //------------------------------------------------------------------------------------------------------------------

    private selfTestList(zipFile: string) {
        const result = this.listToStdout(zipFile);
        if (!result.success) {
            this.logExecution(result);
            this.logger.error("Expected no error and exit code 0");
            FriendlyException.throw(`Listing the contents of a zip archive failed`);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that files within an archive can't be listed with the wrong password
    //------------------------------------------------------------------------------------------------------------------

    private testListWithWrongPassword(zipFile: string) {
        const result = this.listToStdout(zipFile);
        if (result.success) {
            this.logExecution(result);
            this.logger.error("Expected an exit code other than 0 or an error");
            FriendlyException.throw("Listing archive file contents with a wrong password does not cause an error");
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log the execution of a command
    //------------------------------------------------------------------------------------------------------------------

    private logExecution(
        options: { getCommand: () => string, consoleOutput: string, details: { status: number | null, error?: Error } },
        logLevel = LogLevel.ERROR
    ) {
        [
            `Running command: ${options.getCommand()}`,
            options.consoleOutput || "The command did not produce any console output",
            options.details.error ? firstLineOnly(options.details.error) : "",
            null !== options.details.status ? `The command exited with code ${options.details.status}` : ""
        ]
            .filter(line => line)
            .forEach(line => this.logger.log(logLevel, line));
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

    public zipFile(workingDirectory: string, sourceFile: string, zipFile: string) {
        return this.verifyZipResult(zipFile, this.runSevenZip({
            workingDirectory,
            parameters: [
                ...this.getZipParameters(),
                zipFile,
                sourceFile
            ]
        }));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Zip in-memory string content
    //------------------------------------------------------------------------------------------------------------------

    public zipString(content: string, filenameInArchive: string, zipFile: string) {
        return this.verifyZipResult(zipFile, this.runSevenZip({
            parameters: [
                ...this.getZipParameters(),
                `-si${filenameInArchive}`, // read from stdin
                zipFile // write to this zip archive
            ],
            stdin: content
        }));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that a recently created zip archive can be listed
    //------------------------------------------------------------------------------------------------------------------

    private verifyZipResult<T extends { success: boolean, errorMessage: string, consoleOutput: string }>(
        zipFile: string, zipResult: T
    ): T {
        if (!FileUtils.existsAndIsFile(zipFile)) {
            return {
                ...zipResult,
                success: false,
                errorMessage: `7-Zip returned no error but ${zipFile} was not created either`
            }
        }
        const listResult = this.listToStdout(zipFile);
        if (!listResult.success) {
            return {
                ...zipResult,
                success: false,
                errorMessage: `The zip file was created but listing its contents failed - ${listResult.errorMessage}`,
                consoleOutput: [
                    "================================[ zip command ]================================",
                    "",
                    zipResult.consoleOutput,
                    "",
                    "================================[ list command ]================================",
                    "",
                    listResult.consoleOutput
                ].join("\n")
            };
        }
        return zipResult;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Unzip a file to stdout
    //------------------------------------------------------------------------------------------------------------------

    public unzipToStdout(zipFile: string, filenameInArchive: string) {
        return this.runSevenZip({
            parameters: [
                ...this.getUnzipParameters(),
                `-so`, // write to stdout
                zipFile, // the zip archive to read
                filenameInArchive // the filename within the archive
            ],
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // List file contents to stdout
    //------------------------------------------------------------------------------------------------------------------

    private listToStdout(zipFile: string) {
        return this.runSevenZip({
            parameters: [
                ...this.getListParameters(),
                zipFile
            ]
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the 7-Zip parameters that are needed for every "zip" command
    //------------------------------------------------------------------------------------------------------------------

    private getZipParameters() {
        return [
            "a", // add file
            "-mx=9", // highest compression level
            "-mhc=on", // enable header compression
            "-mhe=on", // enable header encryption
            ...this.getSharedParameters()
        ];
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the 7-Zip parameters that are needed for every "unzip" command
    //------------------------------------------------------------------------------------------------------------------

    private getUnzipParameters() {
        return [
            "e", // extract file
            ...this.getSharedParameters()
        ];
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the 7-Zip parameters that are needed for every "list" command
    //------------------------------------------------------------------------------------------------------------------

    private getListParameters() {
        return [
            "l", // list file
            ...this.getSharedParameters()
        ];
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the 7-Zip parameters that are needed for every command/operation
    //------------------------------------------------------------------------------------------------------------------

    private getSharedParameters() {
        return [
            "-t7z", // set file format to 7z
            "-bse1", // redirect stderr => stdout
            "-y", // assume "yes" for all prompts
            `-p${this.password}` // password
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

    public static runAnyCommand(options: {
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
            input: options.stdin
        });
        return {
            success: 0 === result.status && !result.error,
            errorMessage: this.formatErrorMessage(result.status, result.error),
            consoleOutput: [result.stdout ?? "", result.stderr ?? ""].map(text => text.trim()).join("\n").trim(),
            getCommand: () => this.formatCommand(options),
            details: { ...result }
        };
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create an error message incorporating the error and the exit code (if set)
    //------------------------------------------------------------------------------------------------------------------

    private static formatErrorMessage(status: number | null, error?: Error) {
        const exitCode = "number" === typeof status ? `${status}` : undefined;
        const errorMessage = (error ? firstLineOnly(error) : "").trim() || undefined;
        if (errorMessage && exitCode) {
            return `${errorMessage} (exit code ${exitCode})`;
        } else if (errorMessage) {
            return `${errorMessage}`;
        } else if (exitCode) {
            return `Exit code ${exitCode}`;
        } else {
            return "";
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Format a command
    //------------------------------------------------------------------------------------------------------------------

    private static formatCommand(options: { executable: string, parameters?: string[], stdin?: string }) {
        const command = [options.executable, ...(options.parameters ?? [])].map(this.quoteParameter).join(" ");
        const stdin = this.formatStdinPipe(options.stdin);
        return stdin + command;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Quote a parameter if it contains blanks
    //------------------------------------------------------------------------------------------------------------------

    private static quoteParameter(parameter: string) {
        return 0 <= parameter.indexOf(" ") ? `"${parameter.replace(/"/g, '\\"')}"` : parameter;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Convert stdin (if present) into echo "..." |
    //------------------------------------------------------------------------------------------------------------------

    private static formatStdinPipe(stdin?: string) {
        const completeText = stdin ? stdin.trim() : "";
        const firstLine = completeText.replace(/\r?\n.*/, "...");
        const truncated = firstLine.length <= 30
            ? firstLine
            : `${firstLine.substring(0, Math.max(30, firstLine.length - 3))}...`;
        const quoted = this.quoteParameter(truncated);
        return quoted ? `echo ${quoted} | ` : "";
    }
}
