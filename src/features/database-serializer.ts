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
            context.logger.info(`Would save database ${file}`);
            context.print("Would save updated database");
        } else {
            context.logger.info(`Saving database ${file}`);
            context.print("Saving the database");
            node.fs.writeFileSync(file, this.serialize(database));
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Serialize a database into stringified JSON
    //------------------------------------------------------------------------------------------------------------------

    private static serialize(database: MappedRootDirectory) {
        const json: JsonDatabase = {
            directories: database.subdirectories.map(directory => this.directoryToJson(directory)),
            files: database.files.map(file => this.fileToJson(file)),
            last: database.last
        };
        JsonValidator.validateDatabase(json);
        return JSON.stringify(json);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Convert a directory to JSON
    //------------------------------------------------------------------------------------------------------------------

    private static directoryToJson(directory: MappedSubDirectory): JsonDirectory {
        return {
            source: directory.source.name,
            destination: directory.destination.name,
            directories: directory.subdirectories.map(subDirectory => this.directoryToJson(subDirectory)),
            files: directory.files.map(file => this.fileToJson(file)),
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
