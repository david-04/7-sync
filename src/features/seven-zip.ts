//----------------------------------------------------------------------------------------------------------------------
// Wrapper for 7-zip
//----------------------------------------------------------------------------------------------------------------------

class SevenZip {

    // 4 * 1024 * 1024 * 1024
    private static readonly MAX_OUTPUT_BUFFER = 4_294_967_296;
    private static readonly EXPECT_EXIT_CODE_OTHER_THAN_ZERO = "Expected an exit code other than 0 or an error";
    private static readonly MAX_LINE_LENGTH = 30;

    private readonly print;

    private static readonly ELLIPSIS = "...";

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
        if (!password) {
            throw new FriendlyException("The password must not be empty");
        }
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

    public async runSelfTest() {
        this.logger.info(`Verifying that 7-Zip is working correctly`);
        this.print("Verifying that 7-Zip is working correctly");
        const directory = this.createTemporaryDirectory();
        try {
            const correctPassword = this.cloneWithDifferentPassword("correct-password");
            const invalidPassword = this.cloneWithDifferentPassword("invalid-password");
            await correctPassword.runAllSelfTests(directory, invalidPassword);
            this.removeTestDirectory(directory);
        } catch (exception) {
            tryCatchIgnore(() => this.removeTestDirectory(directory));
            rethrow(exception, message => `7-Zip is not working correctly: ${message} (see log file for details)`);
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
            throw new FriendlyException(`Failed to create test directory ${tempDirectory}`);
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
                throw new FriendlyException(`Failed to delete ${directory} (though rmSync did not raise an error)`);
            }
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run all self tests
    //------------------------------------------------------------------------------------------------------------------

    private async runAllSelfTests(directory: string, sevenZipWithWrongPassword: SevenZip) {
        const filename = "data.txt";
        const content = "Test data";
        const zipFile = node.path.join(directory, "archive.7z");
        this.createTestFile(node.path.join(directory, filename), content);
        await this.testGeneralInvocation();
        await this.testInvalidParameters();
        await this.testZipAndUnzipFile(directory, filename, content, zipFile);
        await this.testZipAndUnzipString(content, "In-memory data", zipFile);
        await this.testZipNonExistentFile(directory, "non-existent-file", zipFile);
        await sevenZipWithWrongPassword.testUnzipWithWrongPassword(zipFile, filename, content);
        await this.selfTestList(zipFile);
        await sevenZipWithWrongPassword.testListWithWrongPassword(zipFile);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create and populate a test data file
    //------------------------------------------------------------------------------------------------------------------

    private createTestFile(file: string, content: string) {
        tryCatchRethrowFriendlyException(
            () => node.fs.writeFileSync(file, content),
            error => `Failed to create the test file ${file} - ${error}`
        );
        if (FileUtils.existsAndIsDirectory(file)) {
            throw new FriendlyException(
                `Failed to create the test file ${file} (writeFileSync did not raise an error)`
            );
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that 7-Zip can be executed
    //------------------------------------------------------------------------------------------------------------------

    private async testGeneralInvocation() {
        const result = await this.runSevenZip({});
        if (!result.success) {
            this.logExecution(result);
            throw new FriendlyException(`The program can't be started - ${result.errorMessage}`);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify invalid parameters cause an error
    //------------------------------------------------------------------------------------------------------------------

    private async testInvalidParameters() {
        const result = await this.runSevenZip({ parameters: ["--invalid-option", "non-existent-file"] });
        if (result.success) {
            this.logExecution(result);
            throw new FriendlyException("Passing invalid parameters does not cause an error");
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that a file can be zipped and that its content can be unzipped thereafter
    //------------------------------------------------------------------------------------------------------------------

    private async testZipAndUnzipFile(directory: string, filename: string, content: string, zipFile: string) {
        const zipResult = await this.zipFile(directory, filename, zipFile);
        if (!zipResult.success) {
            this.logExecution(zipResult);
            throw new FriendlyException("Failed to add a file to a zip archive");
        }
        const unzipResult = await this.unzipToStdout(zipFile, filename);
        if (!zipResult.success) {
            this.logExecution(zipResult, LogLevel.INFO);
            this.logExecution(unzipResult);
            throw new FriendlyException("Failed to extract a file from a zip archive");
        }
        if (content !== unzipResult.consoleOutput) {
            this.logExecution(zipResult, LogLevel.INFO);
            this.logExecution(unzipResult, LogLevel.INFO);
            this.logger.error(`Expected unzip ${content} but received ${unzipResult.consoleOutput}`);
            throw new FriendlyException("Unzipping file content returns invalid data");
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that in-memory text content can be zipped and unzipped
    //------------------------------------------------------------------------------------------------------------------

    private async testZipAndUnzipString(content: string, filenameInArchive: string, zipFile: string) {
        const zipResult = await this.zipString(content, filenameInArchive, zipFile);
        if (!zipResult.success) {
            this.logExecution(zipResult);
            throw new FriendlyException("Failed to add string content to a zip archive");
        }
        const unzipResult = await this.unzipToStdout(zipFile, filenameInArchive);
        if (!unzipResult.success) {
            this.logExecution(zipResult, LogLevel.INFO);
            this.logExecution(unzipResult);
            throw new FriendlyException("Failed to extract a file from a zip archive");
        }
        if (content !== unzipResult.consoleOutput) {
            this.logExecution(zipResult, LogLevel.INFO);
            this.logExecution(unzipResult, LogLevel.INFO);
            this.logger.error(`Expected "${content}" as unzipped content but received "${unzipResult.consoleOutput}"`);
            throw new FriendlyException("Unzipping file content returns invalid data");
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify invalid parameters cause an error
    //------------------------------------------------------------------------------------------------------------------

    private async testUnzipWithWrongPassword(zipFile: string, filenameInArchive: string, content: string) {
        const result = await this.unzipToStdout(zipFile, filenameInArchive);
        if (result.success) {
            this.logExecution(result);
            this.logger.error(SevenZip.EXPECT_EXIT_CODE_OTHER_THAN_ZERO);
            throw new FriendlyException("Unzipping with a wrong password does not cause an error");
        }
        if (result.consoleOutput === content) {
            this.logExecution(result);
            this.logger.error(`Despite the wrong password, the correct file content (${content}) was returned`);
            throw new FriendlyException("Unzipping with a wrong password returns the correct file content");
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that zipping a non-existent file causes an error
    //------------------------------------------------------------------------------------------------------------------

    private async testZipNonExistentFile(directory: string, file: string, zipFile: string) {
        const result = await this.zipFile(directory, file, zipFile);
        if (result.success) {
            this.logExecution(result);
            this.logger.error(SevenZip.EXPECT_EXIT_CODE_OTHER_THAN_ZERO);
            throw new FriendlyException("Zipping a non-existent file does not cause an error");
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that files within an archive can be listed
    //------------------------------------------------------------------------------------------------------------------

    private async selfTestList(zipFile: string) {
        const result = await this.listToStdout(zipFile);
        if (!result.success) {
            this.logExecution(result);
            throw new FriendlyException(`Listing the contents of a zip archive failed`);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that files within an archive can't be listed with the wrong password
    //------------------------------------------------------------------------------------------------------------------

    private async testListWithWrongPassword(zipFile: string) {
        const result = await this.listToStdout(zipFile);
        if (result.success) {
            this.logExecution(result);
            this.logger.error(SevenZip.EXPECT_EXIT_CODE_OTHER_THAN_ZERO);
            throw new FriendlyException("Listing archive file contents with a wrong password does not cause an error");
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Log the execution of a command
    //------------------------------------------------------------------------------------------------------------------

    private logExecution(
        options: {
            getCommand: () => string,
            consoleOutput: string,
            errorMessage?: string,
            exitCode: number | null;
        },
        logLevel = LogLevel.ERROR
    ) {
        [
            `Running command: ${options.getCommand()}`,
            options.consoleOutput || "The command did not produce any console output",
            options.errorMessage ?? "",
            null !== options.exitCode ? `The command exited with code ${options.exitCode}` : ""
        ]
            .filter(line => line)
            .forEach(line => this.logger.log(logLevel, line));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Zip a file
    //------------------------------------------------------------------------------------------------------------------

    public async zipFile(workingDirectory: string, sourceFile: string, zipFile: string) {
        return this.verifyZipResult(zipFile, await this.runSevenZip({
            workingDirectory,
            parameters: [
                ...this.getZipParameters(),
                zipFile,
                "--",
                sourceFile
            ]
        }));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Zip in-memory string content
    //------------------------------------------------------------------------------------------------------------------

    public zipStringSync(content: string, filenameInArchive: string, zipFile: string) {
        return this.verifyZipResultSync(zipFile, this.runSevenZipSync({
            parameters: [
                ...this.getZipParameters(),
                `-si${filenameInArchive}`, // read from stdin
                zipFile // write to this zip archive
            ],
            stdin: content
        }));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Zip in-memory string content
    //------------------------------------------------------------------------------------------------------------------

    public async zipString(content: string, filenameInArchive: string, zipFile: string) {
        return this.verifyZipResult(zipFile, await this.runSevenZip({
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

    private verifyZipResultSync<T extends { success: boolean, errorMessage: string, consoleOutput: string; }>(
        zipFile: string, zipResult: T
    ): T {
        if (!FileUtils.existsAndIsFile(zipFile)) {
            return {
                ...zipResult,
                success: false,
                errorMessage: `7-Zip returned no error but ${zipFile} was not created either`
            };
        }
        const listResult = this.listToStdoutSync(zipFile);
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
    // Verify that a recently created zip archive can be listed
    //------------------------------------------------------------------------------------------------------------------

    private async verifyZipResult<T extends { success: boolean, errorMessage: string, consoleOutput: string; }>(
        zipFile: string, zipResult: T
    ): Promise<T> {
        if (!FileUtils.existsAndIsFile(zipFile)) {
            return {
                ...zipResult,
                success: false,
                errorMessage: `7-Zip returned no error but ${zipFile} was not created either`
            };
        }
        const listResult = await this.listToStdout(zipFile);
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

    public unzipToStdoutSync(zipFile: string, filenameInArchive: string) {
        return this.runSevenZipSync({
            parameters: [
                ...this.getUnzipParameters(),
                `-so`, // write to stdout
                zipFile, // the zip archive to read
                filenameInArchive // the filename within the archive
            ],
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Unzip a file to stdout
    //------------------------------------------------------------------------------------------------------------------

    public async unzipToStdout(zipFile: string, filenameInArchive: string) {
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

    public listToStdoutSync(zipFile: string) {
        return this.runSevenZipSync({
            parameters: [
                ...this.getListParameters(),
                zipFile
            ]
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // List file contents to stdout
    //------------------------------------------------------------------------------------------------------------------

    public async listToStdout(zipFile: string) {
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

    private runSevenZipSync(options: { workingDirectory?: string, parameters?: string[], stdin?: string; }) {
        return SevenZip.runAnyCommandSync({ ...options, executable: this.executable });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run 7-Zip with the given parameters
    //------------------------------------------------------------------------------------------------------------------

    private async runSevenZip(options: { workingDirectory?: string, parameters?: string[], stdin?: string; }) {
        return SevenZip.runAnyCommand({ ...options, executable: this.executable });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run any arbitrary command
    //------------------------------------------------------------------------------------------------------------------

    public static runAnyCommandSync(options: {
        workingDirectory?: string,
        executable: string,
        parameters?: string[],
        stdin?: string;
    }) {
        const result = node.child_process.spawnSync(options.executable, options.parameters ?? [], {
            cwd: options.workingDirectory,
            shell: false,
            windowsHide: true,
            encoding: "utf8",
            input: options.stdin,
            maxBuffer: SevenZip.MAX_OUTPUT_BUFFER
        });
        return {
            success: 0 === result.status && !result.error,
            errorMessage: this.formatErrorMessage(result.status, result.error),
            consoleOutput: [result.stdout ?? "", result.stderr ?? ""].map(text => text.trim()).join("\n").trim(),
            getCommand: () => this.formatCommand(options),
            exitCode: result.status
        };
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run any arbitrary command
    //------------------------------------------------------------------------------------------------------------------

    public static async runAnyCommand(options: {
        workingDirectory?: string,
        executable: string,
        parameters?: string[],
        stdin?: string;
    }) {
        return new Promise<{
            success: boolean;
            errorMessage: string;
            consoleOutput: string;
            getCommand: () => string;
            exitCode: number | null;
        }>(resolve => {
            let stderr = "";
            let stdout = "";
            try {
                const process = node.child_process.spawn(options.executable, options.parameters ?? [], {
                    cwd: options.workingDirectory,
                    shell: false,
                    windowsHide: true,
                });
                process.stderr.on("data", data => stderr += data);
                process.stdout.on("data", data => stdout += data);
                process.on("error", error => {
                    resolve({
                        success: false,
                        errorMessage: this.formatErrorMessage(null, error),
                        consoleOutput: [stdout ?? "", stderr ?? ""].map(text => text.trim()).join("\n").trim(),
                        getCommand: () => this.formatCommand(options),
                        exitCode: process.exitCode
                    });
                });
                process.on("close", code => {
                    resolve({
                        success: 0 === code,
                        errorMessage: this.formatErrorMessage(code),
                        consoleOutput: [stdout ?? "", stderr ?? ""].map(text => text.trim()).join("\n").trim(),
                        getCommand: () => this.formatCommand(options),
                        exitCode: process.exitCode
                    });
                });
                process.stdin.write(options.stdin ?? "");
                process.stdin.end();
            } catch (error) {
                resolve({
                    success: false,
                    errorMessage: this.formatErrorMessage(null, error instanceof Error ? error : new Error(`${error}`)),
                    consoleOutput: [stdout ?? "", stderr ?? ""].map(text => text.trim()).join("\n").trim(),
                    getCommand: () => this.formatCommand(options),
                    exitCode: process.exitCode ?? null
                });
            }
        });
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

    private static formatCommand(options: { executable: string, parameters?: string[], stdin?: string; }) {
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
        const firstLine = completeText.replace(/\r?\n.*/, SevenZip.ELLIPSIS);
        const truncatedLength = Math.max(SevenZip.MAX_LINE_LENGTH, firstLine.length - SevenZip.ELLIPSIS.length);
        const truncated = firstLine.length <= SevenZip.MAX_LINE_LENGTH
            ? firstLine
            : `${firstLine.substring(0, truncatedLength)}...`;
        const quoted = this.quoteParameter(truncated);
        return quoted ? `echo ${quoted} | ` : "";
    }
}
