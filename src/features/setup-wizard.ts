//----------------------------------------------------------------------------------------------------------------------
// Initialize the configuration file and update the password
//----------------------------------------------------------------------------------------------------------------------

class SetupWizard {

    //------------------------------------------------------------------------------------------------------------------
    // Initialize a new configuration file
    //------------------------------------------------------------------------------------------------------------------

    public static async initialize(options: InitOptions) {
        return this.initializeOrReconfigure({ config: options.config });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Reconfigure an existing configuration file
    //------------------------------------------------------------------------------------------------------------------

    public static async reconfigure(options: ReconfigureOptions) {
        const logger = new Logger(LogLevel.ERROR, new NullOutputStream());
        const config = JsonLoader.loadAndValidateConfig(options, logger);
        return this.initializeOrReconfigure({ config: options.config, ...config.originalConfig });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Acquire all information and update the file
    //------------------------------------------------------------------------------------------------------------------

    public static async initializeOrReconfigure(presets: Partial<JsonConfig> & { config: string }) {
        console.log("");
        console.log("--------------------------------------------------------------------------------");
        console.log("7-sync configuration wizard");
        console.log("--------------------------------------------------------------------------------");
        console.log("");
        const hasPresets = undefined !== presets.source;
        const config = await this.getConfigFile(hasPresets, presets.config);
        const base = FileUtils.getAbsolutePath(FileUtils.normalize(FileUtils.getParent(config)));
        const source = await this.getSourceDirectory(config, base, presets?.source);
        const destination = await this.getDestinationDirectory(config, base, source, presets.destination)
        const password = await this.getPassword(presets.password);
        const sevenZip = await this.getSevenZip(hasPresets, presets.sevenZip ?? "7z");
        const configJson: JsonConfig = {
            source: FileUtils.resolve(config, source),
            destination: FileUtils.resolve(config, destination),
            password,
            sevenZip
        };
        node.fs.writeFileSync(config, JSON.stringify(configJson, undefined, 4));
        if (hasPresets) {
            console.log(`Config file "${config}" has been updated.`);
        } else {
            console.log(`The config file "${config}" has been created.`);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the config file
    //------------------------------------------------------------------------------------------------------------------

    private static async getConfigFile(hasPresets: boolean, preset: string) {
        if (hasPresets) {
            console.log(`This wizard will reconfigure ${preset}.`);
            console.log("");
            return preset;
        } else {
            return this.prompt({
                question: [
                    "Please enter the name of the configuration file to create.",
                    "It must end with .cfg and can include a relative or absolute path.",
                    "It must be located outside the directories where to sync from and to.",
                    `Press Enter to use the default: ${preset}`
                ],
                defaultAnswer: preset,
                normalizePath: true,
                validate: async (file) => {
                    if (FileUtils.existsAndIsFile(file)) {
                        const prompt = `${file} already exists. Do you want to overwrite it?`
                        if (!await InteractivePrompt.promptYesNo(prompt)) {
                            return false;
                        }
                    }
                    return this.formatValidationResult(ConfigValidator.validateConfigFile(file, false));
                }
            });
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the source directory from where to sync
    //------------------------------------------------------------------------------------------------------------------

    private static async getSourceDirectory(configFile: string, base: string, preset?: string) {
        return this.prompt({
            question: [
                "Please enter the source directory where to sync files from.",
                base ? `The path can be absolute or relative to ${base}` : "The path can be absolute or relative.",
                ...(preset ? [`Press Enter to use the current setting: ${preset}`] : [])
            ],
            normalizePath: true,
            defaultAnswer: preset,
            validate: source => Promise.resolve(
                this.formatValidationResult(ConfigValidator.validateSourceDirectory(configFile, source))
            )
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the destination directory
    //------------------------------------------------------------------------------------------------------------------

    private static async getDestinationDirectory(config: string, base: string, source: string, preset?: string) {
        return this.prompt({
            question: [
                "Please enter the destination directory for the encrypted files.",
                base ? `The path can be absolute or relative to ${base}` : "The path can be absolute or relative.",
                ...(preset ? [`Press Enter to use the current setting: ${preset}`] : [])
            ],
            normalizePath: true,
            defaultAnswer: preset,
            validate: destination => Promise.resolve(
                this.formatValidationResult(ConfigValidator.validateDestinationDirectory(config, source, destination))
            )
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the password
    //------------------------------------------------------------------------------------------------------------------

    private static async getPassword(preset?: string): Promise<string> {
        while (true) {
            const question = preset
                ? [
                    "Please enter a new password if you want to change it.",
                    "The next synchronization will delete and re-encrypt all files.",
                    "Press enter to keep the current password (without changing it)."
                ]
                : [
                    "Please enter the password."
                ];
            const password = await this.prompt({ question: question, isPassword: true, acceptBlankInput: !!preset });
            if (!password && preset) {
                console.log("");
                return preset;
            }
            if (password === await this.prompt({ question: ["Please repeat the password."], isPassword: true })) {
                console.log("");
                return PasswordHelper.createSaltedHash(password);
            } else {
                console.log("");
                console.log("ERROR: The passwords don't match.");
                console.log("");
            }
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the 7-Zip command
    //------------------------------------------------------------------------------------------------------------------

    private static async getSevenZip(hasPresets: boolean, preset: string) {
        return this.prompt({
            question: [
                "Please enter the command to run 7-Zip.",
                `Press Enter to use the ${hasPresets ? "current setting" : "default"}: ${preset}`
            ],
            normalizePath: true,
            defaultAnswer: preset,
            validate: sevenZip => Promise.resolve(
                this.formatValidationResult(this.validateSevenZip(sevenZip))
            )
        });
    }


    //------------------------------------------------------------------------------------------------------------------
    // Validate that the 7-Zip command can be executed
    //------------------------------------------------------------------------------------------------------------------

    private static validateSevenZip(sevenZip: string): string | true {
        try {
            throw new Error("The 7-Zip quick check is not implemented yet");
        } catch (exception) {
            return `Can't execute "${sevenZip}". Please specify an absolute path if 7-Zip is not in the search path.`;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Prompt for an answer and validate/confirm the result
    //------------------------------------------------------------------------------------------------------------------

    private static async prompt(options: {
        question: string | string[],
        defaultAnswer?: string
        presetAnswer?: string,
        validate?: (input: string) => Promise<boolean | string>,
        normalizePath?: boolean,
        isPassword?: boolean,
        acceptBlankInput?: boolean
    }) {
        let answer = options.presetAnswer;
        while (true) {
            if (undefined !== answer) {
                if (true === options.normalizePath) {
                    answer = FileUtils.normalize(answer);
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
                isPassword: options.isPassword,
                acceptBlankInput: options.acceptBlankInput
            });
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Format a validation error
    //------------------------------------------------------------------------------------------------------------------

    private static formatValidationResult(result: string | true): string | true {
        return "string" === typeof result ? `ERROR: ${result}` : result;
    }
}
