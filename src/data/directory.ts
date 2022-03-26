//----------------------------------------------------------------------------------------------------------------------
// The root directory of the source or destination tree
//----------------------------------------------------------------------------------------------------------------------

class RootDirectory {

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(public readonly absolutePath: string) { }
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
    public readonly subdirectories = new Array<MappedSubDirectory>();

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    constructor(
        public readonly source: T,
        public readonly destination: T,
        public last: string
    ) { }

    //------------------------------------------------------------------------------------------------------------------
    // Sort children alphabetically
    //------------------------------------------------------------------------------------------------------------------

    public sortFilesAndSubdirectories() {
        this.files.sort(MappedDirectoryBase.compareFilesOrSubdirectories);
        this.subdirectories.sort(MappedDirectoryBase.compareFilesOrSubdirectories);
        this.subdirectories.forEach(subdirectory => subdirectory.sortFilesAndSubdirectories())
    }

    //------------------------------------------------------------------------------------------------------------------
    // Compare two files or subdirectories case-insensitive
    //------------------------------------------------------------------------------------------------------------------

    private static compareFilesOrSubdirectories(a: { source: { name: string } }, b: { source: { name: string } }) {
        const name1 = a.source.name.toLowerCase();
        const name2 = b.source.name.toLowerCase();
        if (name1 < name2) {
            return -1;
        } else {
            return name1 === name2 ? 0 : 1;
        }
    }
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
        last: string
    ) {
        super(source, destination, last);
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Any mapped directory
//----------------------------------------------------------------------------------------------------------------------

type MappedDirectory = MappedRootDirectory | MappedSubDirectory;
