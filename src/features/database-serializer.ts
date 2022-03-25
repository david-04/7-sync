//----------------------------------------------------------------------------------------------------------------------
// Serialize the registry into a JSON object
//----------------------------------------------------------------------------------------------------------------------

class DatabaseSerializer {

    //------------------------------------------------------------------------------------------------------------------
    // Serialize a database into stringified JSON
    //------------------------------------------------------------------------------------------------------------------

    public static serialize(database: MappedRootDirectory) {
        const json: JsonDatabase = {
            directories: database.directories.map(directory => this.directoryToJson(directory)),
            files: database.files.map(file => this.fileToJson(file)),
            last: database.last
        };
        JsonValidator.validateDatabase(json);
        return JSON.stringify(json, undefined, 4);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Convert a directory to JSON
    //------------------------------------------------------------------------------------------------------------------

    private static directoryToJson(directory: MappedSubDirectory): JsonDirectory {
        return {
            source: directory.source.name,
            destination: directory.destination.name,
            directories: directory.directories.map(subDirectory => this.directoryToJson(subDirectory)),
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
