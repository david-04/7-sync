//----------------------------------------------------------------------------------------------------------------------
// Initialise the configuration file and update the password
//----------------------------------------------------------------------------------------------------------------------

class SetupWizard {

    //------------------------------------------------------------------------------------------------------------------
    // Initialise the configuration
    //------------------------------------------------------------------------------------------------------------------

    public static async initialiseConfigFile(options: InitOptions) {
        console.log("");
        console.log("--------------------------------------------------------------------------------");
        console.log("7-sync configuration wizard");
        console.log("--------------------------------------------------------------------------------");
        console.log("");
        const configFile = await this.prompt({
            question: [
                "Please enter the name of the configuration file to create.",
                "It must end with .cfg and can include a relative or absolute path.",
                "It must be located outside the directories where to sync from and to.",
                `Press Enter to use the default: ${CommandLineParser.DEFAULT_CONFIG_FILE}`
            ],
            presetAnswer: options.config,
            defaultAnswer: CommandLineParser.DEFAULT_CONFIG_FILE,
            normalisePath: true,
            validate: file => this.validateConfigFile(file),
        });
        const referencePath = FileUtils.getAbsolutePath(FileUtils.normalise(FileUtils.getParent(configFile)));
        const sourceDirectory = await this.prompt({
            question: [
                "Please enter the source directory where to sync files from.",
                `The path can be absolute or relative to ${referencePath}.`
            ],
            normalisePath: true,
            validate: source => this.validateSourceDirectory(configFile, source),
        });
        const destinationDirectory = await this.prompt({
            question: [
                "Please enter the destination directory for the encrypted files.",
                referencePath ? `The path can be relative to ${referencePath}` : ""
            ],
            normalisePath: true,
            validate: destination => this.validateDestinationDirectory(configFile, sourceDirectory, destination),
        });
        const password = await this.promptForPassword();
        const config: JsonConfig = {
            source: FileUtils.resolve(sourceDirectory, configFile),
            destination: FileUtils.resolve(destinationDirectory, configFile),
            password
        };
        node.fs.writeFileSync(configFile, JSON.stringify(config, undefined, 4));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Prompt for an answer and validate/confirm the result
    //------------------------------------------------------------------------------------------------------------------

    private static async prompt(options: {
        question: string | string[],
        defaultAnswer?: string
        presetAnswer?: string,
        validate?: (input: string) => Promise<boolean | string>,
        normalisePath?: boolean,
        isPassword?: boolean
    }) {
        let answer = options.presetAnswer;
        while (true) {
            if (undefined !== answer) {
                if (true === options.normalisePath) {
                    answer = FileUtils.normalise(answer);
                }
                const validationResult = options.validate ? (await options.validate(answer)) : true;
                if (true === validationResult) {
                    return answer;
                } else if ("string" === typeof validationResult) {
                    console.log(validationResult);
                    console.log("");
                }
            }
            answer = await InteractivePrompt.prompt({
                question: options.question,
                defaultAnswer: options.defaultAnswer,
                isPassword: options.isPassword
            });
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Validate the config file
    //------------------------------------------------------------------------------------------------------------------

    private static async validateConfigFile(configFile: string) {
        if (!configFile.endsWith(".cfg")) {
            return `ERROR: The filename must end with .cfg.`
        } else if (FileUtils.existsAndIsFile(configFile)) {
            return InteractivePrompt.promptYesNo(`${configFile} already exists. Do you want to overwrite it?`);
        } else if (FileUtils.exists(configFile)) {
            return `ERROR: ${configFile} already exists but is not a regular file and can't be overwritten.`
        } else {
            const directory = FileUtils.getParent(configFile);
            if (FileUtils.existsAndIsDirectory(directory)) {
                return true;
            } else if (FileUtils.exists(directory)) {
                return `ERROR: ${directory} is not a directory.`
            } else {
                return `ERROR: Directory ${directory} does not exist.`
            }
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Validate the source directory
    //------------------------------------------------------------------------------------------------------------------

    private static async validateSourceDirectory(configFile: string, sourceDirectory: string) {
        const resolvedSourceDirectory = FileUtils.resolve(sourceDirectory, configFile);
        if (FileUtils.existsAndIsDirectory(resolvedSourceDirectory)) {
            if (FileUtils.isParentChild(resolvedSourceDirectory, configFile)) {
                return `ERROR: The source directory must not contain ${configFile}.`
            } else {
                return true;
            }
        } else if (FileUtils.exists(resolvedSourceDirectory)) {
            return `ERROR: ${resolvedSourceDirectory} is not a directory.`
        } else {
            return `ERROR: Directory ${resolvedSourceDirectory} does not exist.`
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Validate the destination directory
    //------------------------------------------------------------------------------------------------------------------

    private static async validateDestinationDirectory(
        configFile: string,
        sourceDirectory: string,
        destinationDirectory: string
    ) {
        const resolvedSourceDirectory = FileUtils.resolve(sourceDirectory, configFile);
        const resolvedDestinationDirectory = FileUtils.resolve(destinationDirectory, configFile);
        if (FileUtils.existsAndIsDirectory(resolvedDestinationDirectory)) {
            if (FileUtils.equals(resolvedSourceDirectory, resolvedDestinationDirectory)) {
                return `ERROR: The source and destination directory can't be the same.`;
            } else if (FileUtils.isParentChild(resolvedDestinationDirectory, configFile)) {
                return `ERROR: The destination directory must not contain the configuration file ${configFile}.`;
            } else if (FileUtils.isParentChild(resolvedDestinationDirectory, resolvedSourceDirectory)) {
                return `ERROR: The source directory can't be inside the destination directory.`;
            } else if (FileUtils.isParentChild(resolvedSourceDirectory, resolvedDestinationDirectory)) {
                return `ERROR: The destination directory can't be inside the source directory.`;
            } else {
                return true;
            }
        } else if (FileUtils.exists(resolvedDestinationDirectory)) {
            return `ERROR: ${resolvedDestinationDirectory} is not a directory.`
        } else {
            return `ERROR: Directory ${resolvedDestinationDirectory} does not exist.`
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Obtain the password
    //------------------------------------------------------------------------------------------------------------------

    private static async promptForPassword(): Promise<string> {
        const password1 = await this.prompt({
            question: [
                "Please enter the encryption password.",
            ],
            isPassword: true
        });
        const password2 = await this.prompt({
            question: [
                "Please repeat the password.",
            ],
            isPassword: true
        });
        if (password1 === password2) {
            return PasswordHelper.createSaltedHash(password1);
        } else {
            console.log("");
            console.log("ERROR: The passwords don't match.");
            console.log("");
            return this.promptForPassword();
        }
    }
}
