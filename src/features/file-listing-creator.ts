//----------------------------------------------------------------------------------------------------------------------
// Compile a file listing that maps source names to enumerated destination names
//----------------------------------------------------------------------------------------------------------------------

class FileListingCreator {

    //------------------------------------------------------------------------------------------------------------------
    // Create a file listing for the given database
    //------------------------------------------------------------------------------------------------------------------

    public static create(database: MappedRootDirectory) {
        return this.createFileIndex(database, []).join("\n") + "\n"
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create the the file index
    //------------------------------------------------------------------------------------------------------------------

    private static createFileIndex(directory: MappedDirectory, lines: string[]) {
        this.addToIndex(directory, lines);
        directory.subdirectories.bySourceName.sorted().forEach(subdirectory => this.createFileIndex(subdirectory, lines));
        directory.files.bySourceName.sorted().forEach(file => this.addToIndex(file, lines));
        return lines;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Add a single file or directory to the index
    //------------------------------------------------------------------------------------------------------------------

    private static addToIndex(fileOrDirectory: MappedFile | MappedDirectory, lines: string[]) {
        if (fileOrDirectory instanceof MappedSubdirectory || fileOrDirectory instanceof MappedFile) {
            lines.push(`${fileOrDirectory.source.relativePath} => ${fileOrDirectory.destination.relativePath}`);
        }
    }
}
