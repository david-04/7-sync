//----------------------------------------------------------------------------------------------------------------------
// Validate the configuration (or parts thereof)
//----------------------------------------------------------------------------------------------------------------------

class ConfigValidator {

    //------------------------------------------------------------------------------------------------------------------
    // Validate the configuration
    //------------------------------------------------------------------------------------------------------------------

    public static validate(configFile: string, json: JsonConfig): string | true {
        return [
            this.validateConfigFile(configFile, true),
            this.validateSourceDirectory(configFile, json.source),
            this.validateDestinationDirectory(configFile, json.source, json.destination),
            this.validateSevenZip(json.sevenZip)
        ].find(result => true !== result && undefined !== result) ?? true;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Validate the configuration file name/path
    //------------------------------------------------------------------------------------------------------------------

    public static validateConfigFile(config: string, mustExist: boolean): string | true {
        const directory = FileUtils.getParent(config);
        if (mustExist && !FileUtils.exists(config)) {
            return `Config file "${config}" does not exist`;
        } else if (mustExist && !FileUtils.existsAndIsFile(config)) {
            return `Config file "${config}" is not a regular file`;
        } else if (!config.endsWith(".cfg")) {
            return `${config} does not end with .cfg`;
        } else if (FileUtils.existsAndIsFile(config)) {
            return true;
        } else if (FileUtils.exists(config)) {
            return `${config} is not a regular file`;
        } else if (FileUtils.existsAndIsDirectory(directory)) {
            return true
        } else if (FileUtils.exists(directory)) {
            return `Directory ${directory} is not a directory`;
        } else {
            return `Directory ${directory} does not exist`;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Validate the source directory
    //------------------------------------------------------------------------------------------------------------------

    public static validateSourceDirectory(config: string, source: string): string | true {
        const resolvedSource = FileUtils.resolve(config, source ?? "");
        if (!FileUtils.exists(resolvedSource)) {
            return `Directory ${resolvedSource} does not exist`;
        } else if (!FileUtils.existsAndIsDirectory(resolvedSource)) {
            return `${resolvedSource} is not a directory`;
        } else if (FileUtils.isParentChild(resolvedSource, config)) {
            return "The source directory must not contain the configuration file";
        } else {
            return true;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Validate the destination directory
    //------------------------------------------------------------------------------------------------------------------

    public static validateDestinationDirectory(config: string, source: string, destination: string): string | true {
        const resolvedSource = FileUtils.resolve(config, source ?? "");
        const resolvedDestination = FileUtils.resolve(config, destination ?? "");
        if (!FileUtils.exists(resolvedDestination)) {
            return `Directory ${resolvedDestination} does not exist`;
        } else if (!FileUtils.existsAndIsDirectory(resolvedDestination)) {
            return `${resolvedDestination} is not a directory`;
        } else if (FileUtils.equals(resolvedSource, resolvedDestination)) {
            return "The destination directory can't be the same as the source directory";
        } else if (FileUtils.isParentChild(resolvedDestination, config)) {
            return "The destination directory must not contain the configuration file"
        } else if (FileUtils.isParentChild(resolvedDestination, resolvedSource)) {
            return "The source directory must not be inside the destination directory";
        } else if (FileUtils.isParentChild(resolvedSource, resolvedDestination)) {
            return "The destination directory must not be inside the source directory.";
        } else {
            return true;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Validate the 7-zip executable
    //------------------------------------------------------------------------------------------------------------------

    public static validateSevenZip(sevenZip: string): string | true {
        try {
            SevenZip.assertThatSevenZipIsWorking(sevenZip);
            return true;
        } catch (exception) {
            return `Can't execute "${sevenZip}". Please specify an absolute path if 7-Zip is not in the search path.`;
        }
    }
}
