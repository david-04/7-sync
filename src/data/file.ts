//----------------------------------------------------------------------------------------------------------------------
// A file in the file system
//----------------------------------------------------------------------------------------------------------------------

class File {

    public readonly absolutePath;
    public readonly relativePath;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(public readonly parent: Directory, public readonly name: string) {
        this.absolutePath = node.path.join(parent.absolutePath, name);
        this.relativePath = parent instanceof Subdirectory ? node.path.join(parent.relativePath, name) : name;
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Mapping between a source and destination file
//----------------------------------------------------------------------------------------------------------------------

class MappedFile {

    constructor(
        public readonly parent: MappedDirectory,
        public readonly source: File,
        public readonly destination: File,
        public readonly created: number,
        public readonly modified: number,
        public readonly size: number
    ) { }
}
