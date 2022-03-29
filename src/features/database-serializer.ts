//----------------------------------------------------------------------------------------------------------------------
// Serialize the registry into a JSON object
//----------------------------------------------------------------------------------------------------------------------

class DatabaseSerializer {

    //------------------------------------------------------------------------------------------------------------------
    // Save the database
    //------------------------------------------------------------------------------------------------------------------

    public static saveDatabase(context: Context, database: MappedRootDirectory) {
        const file = context.files.database;
        if (context.options.dryRun) {
            context.logger.info(`Would save database as ${file}`);
            context.print("Would save updated database");
            return true;
        } else {
            context.logger.info(`Saving database as ${file}`);
            context.print("Saving the database");
            try {
                node.fs.writeFileSync(file, this.serialize(database));
                if (!FileUtils.existsAndIsFile(file)) {
                    throw new Error("No exception was raised");
                }
                return true;
            } catch (exception) {
                context.print("===> FAILED")
                context.logger.error(`Failed to save database ${file} - ${firstLineOnly(exception)}`);
                return false;
            }
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Serialize a database into stringified JSON
    //------------------------------------------------------------------------------------------------------------------

    private static serialize(database: MappedRootDirectory) {
        const json: JsonDatabase = {
            directories: database.subdirectories.bySourceName.sorted().map(directory => this.directoryToJson(directory)),
            files: database.files.bySourceName.sorted().map(file => this.fileToJson(file)),
            last: database.last
        };
        JsonValidator.validateDatabase(json);
        return JSON.stringify(json);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Convert a directory to JSON
    //------------------------------------------------------------------------------------------------------------------

    private static directoryToJson(directory: MappedSubdirectory): JsonDirectory {
        return {
            source: directory.source.name,
            destination: directory.destination.name,
            directories: directory.subdirectories.bySourceName.sorted().map(subDirectory => this.directoryToJson(subDirectory)),
            files: directory.files.bySourceName.sorted().map(file => this.fileToJson(file)),
            last: directory.last
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Convert a file to JSON
    //------------------------------------------------------------------------------------------------------------------

    private static fileToJson(file: MappedFile): JsonFile {
        return {
            source: file.source.name,
            destination: file.destination.name,
            created: file.created,
            modified: file.modified,
            size: file.size
        }
    }
}
