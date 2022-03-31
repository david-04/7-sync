//----------------------------------------------------------------------------------------------------------------------
// Serialize the registry into a JSON object
//----------------------------------------------------------------------------------------------------------------------

class DatabaseSerializer {

    //------------------------------------------------------------------------------------------------------------------
    // Save the database
    //------------------------------------------------------------------------------------------------------------------

    public static serializeDatabase(database: MappedRootDirectory) {
        return tryCatchRethrowFriendlyException(
            () => this.serialize(database),
            error => `Failed to serialize the database - ${error}`
        );
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
