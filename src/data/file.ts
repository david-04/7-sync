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
        this.relativePath = parent instanceof SubDirectory ? node.path.join(parent.relativePath, name) : name;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get file properties
    //------------------------------------------------------------------------------------------------------------------

    public getProperties() {
        return this.assertFileExists(() => FileUtils.getProperties(this.absolutePath));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete the file
    //------------------------------------------------------------------------------------------------------------------

    public delete() {
        return this.assertFileExists(() => node.fs.rmSync(this.absolutePath, { force: true }));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Assert that the file exists (and is a file) and execute the given action
    //------------------------------------------------------------------------------------------------------------------

    private assertFileExists<T>(action: () => T): T {
        if (!FileUtils.exists(this.absolutePath)) {
            throw new Error(`Internal error: ${this.absolutePath} does not exist`);
        } else if (!FileUtils.existsAndIsFile(this.absolutePath)) {
            throw new Error(`Internal error: ${this.absolutePath} is not a file`);
        } else {
            return action();
        }
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
