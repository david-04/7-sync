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

    private readonly _files = asReadonly({
        bySourceName: new Map<string, MappedFile>(),
        byDestinationName: new Map<string, MappedFile>()
    });

    public readonly files = asReadonly({
        bySourceName: new ImmutableMap(this._files.bySourceName),
        byDestinationName: new ImmutableMap(this._files.byDestinationName)
    });

    private readonly _subdirectories = asReadonly({
        bySourceName: new Map<string, MappedSubDirectory>(),
        byDestinationName: new Map<string, MappedSubDirectory>()
    });

    public readonly subdirectories = asReadonly({
        bySourceName: new ImmutableMap(this._subdirectories.bySourceName),
        byDestinationName: new ImmutableMap(this._subdirectories.byDestinationName)
    });

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    constructor(public readonly source: T, public readonly destination: T, public last: string) { }

    //------------------------------------------------------------------------------------------------------------------
    // Add a file or subdirectory
    //------------------------------------------------------------------------------------------------------------------

    public add(fileOrSubdirectory: MappedFile | MappedSubDirectory) {
        if (fileOrSubdirectory instanceof MappedFile) {
            this.addTo(this._files.bySourceName, fileOrSubdirectory.source.name, fileOrSubdirectory);
            this.addTo(this._files.bySourceName, fileOrSubdirectory.destination.name, fileOrSubdirectory);
        } else {
            this.addTo(this._subdirectories.bySourceName, fileOrSubdirectory.source.name, fileOrSubdirectory);
            this.addTo(this._subdirectories.byDestinationName, fileOrSubdirectory.destination.name, fileOrSubdirectory);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Add a key-value pair to the given map - or throw an exception if it already exist
    //------------------------------------------------------------------------------------------------------------------

    private addTo<V extends MappedFile | MappedSubDirectory>(map: Map<string, V>, key: string, value: V) {
        if (map.has(key)) {
            throw new Error(
                `Internal error: Subdirectory ${value.source.relativePath} has already been added to the database`
            );
        } else {
            map.set(key, value);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete a file or subdirectory
    //------------------------------------------------------------------------------------------------------------------

    public delete(fileOrSubdirectory: MappedFile | MappedSubDirectory) {
        if (fileOrSubdirectory instanceof MappedFile) {
            this.deleteFrom(this._files.bySourceName, fileOrSubdirectory.source.name, fileOrSubdirectory);
            this.deleteFrom(this._files.byDestinationName, fileOrSubdirectory.destination.name, fileOrSubdirectory);
        } else {
            this.deleteFrom(this._subdirectories.bySourceName, fileOrSubdirectory.source.name, fileOrSubdirectory);
            this.deleteFrom(this._subdirectories.byDestinationName, fileOrSubdirectory.destination.name, fileOrSubdirectory);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Add a key-value pair to the given map - or throw an exception if it already exist
    //------------------------------------------------------------------------------------------------------------------

    private deleteFrom<V extends MappedFile | MappedSubDirectory>(map: Map<string, V>, key: string, value: V) {
        const mapValue = map.get(key);
        if (undefined === mapValue) {
            throw new Error(`Internal error: Directory entry ${key} does not exist`);
        } else if (mapValue !== value) {
            throw new Error(`Internal error: ${key} points to the wrong directory entry`)
        } else {
            map.delete(key);
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
