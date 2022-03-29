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
        const result = SevenZip.checkIfSevenZipIsWorking(executable);
        logger.info(`Testing if 7-Zip command/executable ${executable} is working`);
        console.log("Verifying that 7-Zip is working");
        if (true !== result) {
            if (result.stdout) {
                logger.error(result.stdout);
            }
            logger.error(result.error);
            throw new FriendlyException(`The 7-Zip command/executable ${executable} does not work: ${result.error}`);
        }
        logger.debug("All tests have passed");
    }

    //------------------------------------------------------------------------------------------------------------------
    // Verify that
    //------------------------------------------------------------------------------------------------------------------

    public static checkIfSevenZipIsWorking(executable: string): true | { error: string, stdout?: string } {
        const testData = this.setUpTestData();
        if ("string" === typeof testData) {
            return { error: testData };
        } else {
            const tests = [
                () => this.verifyHelp(executable),
                // () => this.assertUnknownOption(executable),
                // () => this.assertZipFile(executable, correctPassword, tempDirectory, fileSource.name, zipFile),
                // () => this.assertZipString(executable, correctPassword, tempDirectory, stringSource.content, stringSource.name, zipFile),
                // () => this.assertUnzipCorrectPassword(),
                // () => this.assertUnzipWrongPassword(),
                // () => this.assertListCorrectPassword(),
                // () => this.assertListWrongPassword()
            ]
            for (const test of tests) {
                const testResult = test();
                if (true !== testResult) {
                    this.removeTestData(testData.workingDirectory, testData.sourceFile.name, testData.zipFile);
                    return testResult;
                }
            }
            const result = this.removeTestData(testData.workingDirectory, testData.sourceFile.name, testData.zipFile);
            return true === result ? result : { error: result, stdout: "" };
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Set up a sample file in the temp folder to use for testing
    //------------------------------------------------------------------------------------------------------------------

    private static setUpTestData() {
        const workingDirectory = this.createWorkingDirectory();
        if ("string" === typeof workingDirectory) {
            const sourceFileName = "data.txt";
            const sourceFilePath = node.path.join(workingDirectory, sourceFileName);
            const sourceFileContent = "Test data";
            const result = this.createTestSourceFile(sourceFilePath, sourceFileContent);
            if (true !== result) {
                this.removeTestData(workingDirectory, sourceFileName);
                return result;
            }
            return {
                workingDirectory,
                sourceFile: {
                    absolutePath: sourceFilePath,
                    name: sourceFileName,
                    content: sourceFileContent
                },
                sourceString: {
                    name: "_" + sourceFileName,
                    content: "_" + sourceFileContent
                },
                password: {
                    correct: "correct-password",
                    invalid: "invalid-password"
                },
                zipFile: node.path.join(workingDirectory, "archive.7z")
            };
        } else {
            return workingDirectory.error;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create the working directory for the self-test
    //------------------------------------------------------------------------------------------------------------------

    private static createWorkingDirectory() {
        const tempDirectory = node.path.resolve(node.os.tmpdir());
        try {
            const workingDirectory = node.fs.mkdtempSync(`${tempDirectory}${node.path.sep}7-sync-self-test-`);
            return FileUtils.existsAndIsDirectory(workingDirectory)
                ? workingDirectory
                : { error: `Failed to create a working directory in ${tempDirectory}` };
        } catch (exception) {
            return { error: `Failed to create a working directory in ${tempDirectory} - ${firstLineOnly(exception)}` };
        };
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create the test data file for the self-test
    //------------------------------------------------------------------------------------------------------------------

    private static createTestSourceFile(absolutePath: string, content: string) {
        try {
            node.fs.writeFileSync(absolutePath, content);
            return FileUtils.existsAndIsFile(absolutePath)
                ? true
                : `Failed to create the test file ${absolutePath}`;
        } catch (exception) {
            return `Failed to create the test file ${absolutePath} - ${firstLineOnly(exception)}`;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete the self-test files
    //------------------------------------------------------------------------------------------------------------------

    private static removeTestData(directory: string, ...files: string[]) {
        for (const file of [...files, "."]) {
            const absolutePath = node.path.normalize(node.path.join(directory, file));
            if (FileUtils.exists(absolutePath)) {
                try {
                    node.fs.rmSync(absolutePath, { recursive: "." === file });
                    if (FileUtils.exists(absolutePath)) {
                        return `Failed to delete ${absolutePath}`;
                    }
                } catch (exception) {
                    return `Failed to delete ${absolutePath} - ${firstLineOnly(exception)}`;
                }
            }
        }
        return true;
    }


    //------------------------------------------------------------------------------------------------------------------
    // Verify that --help returns with exit code 0 (and no error)
    //------------------------------------------------------------------------------------------------------------------

    private static verifyHelp(executable: string) {
        const result = this.run({ executable, parameters: ["--help"] });
        return result.success || {
            error: `${executable} --help failed (${result.errorMessage})`,
            stdout: result.stdout
        };
    }

    // private static assertUnknownOption(executable: string) {
    //     // TODO
    // }

    // private static assertZipFile(
    //     executable: string, password: string, workingDirectory: string, sourceFile: string, zipFile: string
    // ) {
    //     // TODO
    // }

    // private static assertZipString(
    //     executable: string,
    //     password: string,
    //     workingDirectory: string,
    //     content: string,
    //     filenameInArchive: string,
    //     zipFile: string
    // ) {
    //     // TODO
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
