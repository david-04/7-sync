//----------------------------------------------------------------------------------------------------------------------
// The root directory of the source or destination tree
//----------------------------------------------------------------------------------------------------------------------

class RootDirectory {

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(public readonly absolutePath: string) { }

    //------------------------------------------------------------------------------------------------------------------
    // Delete the directory recursively
    //------------------------------------------------------------------------------------------------------------------

    public delete() {
        this.assertDirectoryExists(() => node.fs.rmSync(this.absolutePath, { recursive: true, force: true }));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Retrieve the child directories and files
    //------------------------------------------------------------------------------------------------------------------

    public getChildren() {
        this.assertDirectoryExists(() => FileUtils.getChildren(this.absolutePath));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Assert that the file exists (and is a file) and execute the given action
    //------------------------------------------------------------------------------------------------------------------

    private assertDirectoryExists<T>(action: () => T): T {
        if (!FileUtils.exists(this.absolutePath)) {
            throw new Error(`Internal error: ${this.absolutePath} does not exist`);
        } else if (!FileUtils.existsAndIsFile(this.absolutePath)) {
            throw new Error(`Internal error: ${this.absolutePath} is not a directory`);
        } else {
            return action();
        }
    }
}

//----------------------------------------------------------------------------------------------------------------------
// A sub-directory
//----------------------------------------------------------------------------------------------------------------------

class SubDirectory extends RootDirectory {

    public readonly relativePath: string;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(parent: Directory, public readonly name: string) {
        super(node.path.join(parent.absolutePath, name))
        this.relativePath = parent instanceof SubDirectory ? node.path.join(parent.relativePath, name) : name;
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Any directory
//----------------------------------------------------------------------------------------------------------------------

type Directory = RootDirectory | SubDirectory;

//----------------------------------------------------------------------------------------------------------------------
// Mapping of a source directory to a destination
//----------------------------------------------------------------------------------------------------------------------

class MappedDirectoryBase<T extends RootDirectory> {

    public readonly files = new Array<MappedFile>();
    public readonly directories = new Array<MappedSubDirectory>();

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    constructor(
        public readonly source: T,
        public readonly destination: T,
        public readonly next: string
    ) { }
}

//----------------------------------------------------------------------------------------------------------------------
// A mapped root directory
//----------------------------------------------------------------------------------------------------------------------

class MappedRootDirectory extends MappedDirectoryBase<RootDirectory> { }

//----------------------------------------------------------------------------------------------------------------------
// A mapped destination directory
//----------------------------------------------------------------------------------------------------------------------

class MappedSubDirectory extends MappedDirectoryBase<SubDirectory> {

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    constructor(
        public readonly parent: MappedDirectory,
        source: SubDirectory,
        destination: SubDirectory,
        next: string
    ) {
        super(source, destination, next);
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Any mapped directory
//----------------------------------------------------------------------------------------------------------------------

type MappedDirectory = MappedRootDirectory | MappedSubDirectory;
