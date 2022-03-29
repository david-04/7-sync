//----------------------------------------------------------------------------------------------------------------------
// Wrapper for 7-zip
//----------------------------------------------------------------------------------------------------------------------

class SevenZip {

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(
        private readonly executable: string, private readonly password: string, logger: Logger, console: OutputStream
    ) {
        logger.info(`Verifying that the 7-Zip command "${executable}" is working`);
        console.log("Verifying that 7-Zip is working correctly");
        try {
            SevenZip.assertThatSevenZipIsWorking(executable);
        } catch (exception) {
            if (exception instanceof SevenZipSelfTestException) {
                if (exception.stdout) {
                    logger.error(exception.stdout);
                }
                logger.error(exception.message);
                throw new FriendlyException(
                    `7-Zip is not working: ${exception.message}`
                );
            }

        }
        logger.debug("All tests have passed");
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that
    //------------------------------------------------------------------------------------------------------------------

    public static assertThatSevenZipIsWorking(executable: string) {
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
            this.selfTestExecutable(executable);
            this.selfTestCommandLineError(executable);
            this.selfTestZipFile(executable, password, directory, sourceFilename, sourceContent, zipFile);
            this.selfTestZipString(executable, password, virtualFilename, virtualContent, zipFile);
            this.selfTestUnzip(executable, password, sourceFilename, sourceContent, zipFile);
            this.selfTestList(executable, password, zipFile);
            this.removeTestDirectory(directory);
        } catch (exception) {
            try {
                this.removeTestDirectory(directory);
            } catch (exception) {
                // ignored
            }
            throw exception;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create the working directory for the self-test
    //------------------------------------------------------------------------------------------------------------------

    private static createWorkingDirectory() {
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
        };
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create the test data file for the self-test
    //------------------------------------------------------------------------------------------------------------------

    private static createTestSourceFile(absolutePath: string, content: string) {
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

    private static removeTestDirectory(directory: string) {
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

    private static selfTestExecutable(executable: string) {
        const result = this.run({ executable });
        const message = `${executable} could not be started`;
        this.assertSuccess(result, message);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that an invalid parameter causes an error
    //------------------------------------------------------------------------------------------------------------------

    private static selfTestCommandLineError(executable: string) {
        const result = this.run({ executable, parameters: ["--unknown-option"] })
        const message = `Passing an invalid option to ${executable} did not raise an error`;
        this.assertFailure(result, message);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that a file can be zipped
    //------------------------------------------------------------------------------------------------------------------

    private static selfTestZipFile(
        executable: string, password: string, directory: string, filename: string, content: string, zipFile: string
    ) {
        const zipResult = this.zipFile(executable, password, directory, filename, zipFile);
        const zipMessage = "Failed to zip a file";
        this.assertSuccess(zipResult, zipMessage);
        const unzipResult = this.unzipToStdout(executable, password, zipFile, filename);
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

    private static selfTestZipString(
        executable: string, password: string, filename: string, content: string, zipFile: string
    ) {
        const zipResult = this.zipString(executable, password, content, filename, zipFile);
        const zipMessage = "Failed to zip a string";
        this.assertSuccess(zipResult, zipMessage);
        const unzipResult = this.unzipToStdout(executable, password, zipFile, filename);
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

    private static selfTestUnzip(
        executable: string, password: string, filename: string, content: string, zipFile: string
    ) {
        const result1 = this.unzipToStdout(executable, password, zipFile, filename);
        const message1 = "Failed to unzip a file";
        this.assertSuccess(result1, message1);
        if (content !== result1.stdout) {
            throw new SevenZipSelfTestException(
                `Unzipped file and received "${result1.stdout}" but expected "${content}"`
            );
        }
        const result2 = this.unzipToStdout(executable, "_" + password, zipFile, filename);
        const message2 = "Unzipping with a wrong password did not raise an error";
        this.assertFailure(result2, message2);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that file content can be unzipped
    //------------------------------------------------------------------------------------------------------------------

    private static selfTestList(executable: string, password: string, zipFile: string) {
        const result1 = this.listToStdout(executable, password, zipFile);
        const message1 = "Failed to list files within the archive ";
        this.assertSuccess(result1, message1);
        const result2 = this.listToStdout(executable, "_" + password, zipFile);
        const message2 = "Listing files with an invalid password did not raise an error";
        this.assertFailure(result2, message2);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run a test and expect it to succeed
    //------------------------------------------------------------------------------------------------------------------

    private static assertSuccess(result: { success: boolean, errorMessage: string, stdout: string }, message: string) {
        if (!result.success) {
            throw new SevenZipSelfTestException(`${message} - ${result.errorMessage}`, result.stdout);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Run a test and expect it to fail
    //------------------------------------------------------------------------------------------------------------------

    private static assertFailure(result: { success: boolean, errorMessage: string, stdout: string }, message: string) {
        if (result.success) {
            throw new SevenZipSelfTestException(message, result.stdout);
        }
    }

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
                `-so`, // write to stdout
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
            "e", // extract file
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
            : `exit code ${result.status}`
        return { success, errorMessage, stdout: result.stdout };
    }
}
