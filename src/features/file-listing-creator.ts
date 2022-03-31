//----------------------------------------------------------------------------------------------------------------------
// Create a list that shows how plain-text source paths map to enumerated paths in the destination
//----------------------------------------------------------------------------------------------------------------------

class FileListingCreator {

    //------------------------------------------------------------------------------------------------------------------
    // Create a file listing
    //------------------------------------------------------------------------------------------------------------------

    public static create(database: MappedRootDirectory) {
        return this.recurseInto(database, []).join("\n") + "\n"
    }

    //------------------------------------------------------------------------------------------------------------------
    // Add listings for all files and subdirectories
    //------------------------------------------------------------------------------------------------------------------

    private static recurseInto(directory: MappedDirectory, lines: string[]) {
        this.addToIndex(directory, lines);
        directory.subdirectories.bySourceName.sorted().forEach(subdirectory => this.recurseInto(subdirectory, lines));
        directory.files.bySourceName.sorted().forEach(file => this.addToIndex(file, lines));
        return lines;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Add the listing for the given file or subdirectory
    //------------------------------------------------------------------------------------------------------------------

    private static addToIndex(fileOrDirectory: MappedFile | MappedDirectory, lines: string[]) {
        if (fileOrDirectory instanceof MappedSubdirectory || fileOrDirectory instanceof MappedFile) {
            lines.push(`${fileOrDirectory.source.relativePath} => ${fileOrDirectory.destination.relativePath}`);
        }
    }
}
