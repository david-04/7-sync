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

class Subdirectory extends RootDirectory {

    public readonly relativePath: string;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(parent: Directory, public readonly name: string) {
        super(node.path.join(parent.absolutePath, name));
        this.relativePath = parent instanceof Subdirectory ? node.path.join(parent.relativePath, name) : name;
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Any directory
//----------------------------------------------------------------------------------------------------------------------

type Directory = RootDirectory | Subdirectory;

//----------------------------------------------------------------------------------------------------------------------
// Mapping of a source directory to a destination
//----------------------------------------------------------------------------------------------------------------------

abstract class MappedDirectoryBase<T extends RootDirectory> {

    private readonly _files = {
        bySourceName: new Map<string, MappedFile>(),
        byDestinationName: new Map<string, MappedFile>()
    } as const;

    public readonly files = {
        bySourceName: new ImmutableMap(this._files.bySourceName),
        byDestinationName: new ImmutableMap(this._files.byDestinationName)
    } as const;

    private readonly _subdirectories = {
        bySourceName: new Map<string, MappedSubdirectory>(),
        byDestinationName: new Map<string, MappedSubdirectory>()
    } as const;

    public readonly subdirectories = {
        bySourceName: new ImmutableMap(this._subdirectories.bySourceName),
        byDestinationName: new ImmutableMap(this._subdirectories.byDestinationName)
    } as const;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    constructor(public readonly source: T, public readonly destination: T, private _last: string) { }

    //------------------------------------------------------------------------------------------------------------------
    // Get the "last" filename
    //------------------------------------------------------------------------------------------------------------------

    public get last() {
        return this._last;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Set the "last" filename
    //------------------------------------------------------------------------------------------------------------------

    public set last(last: string) {
        this._last = last;
        this.markAsModified();
    }

    //------------------------------------------------------------------------------------------------------------------
    // Add a file or subdirectory
    //------------------------------------------------------------------------------------------------------------------

    public add(fileOrSubdirectory: MappedFile | MappedSubdirectory) {
        this.markAsModified();
        if (fileOrSubdirectory instanceof MappedFile) {
            this.addTo(this._files.bySourceName, fileOrSubdirectory.source.name, fileOrSubdirectory);
            this.addTo(this._files.byDestinationName, fileOrSubdirectory.destination.name, fileOrSubdirectory);
        } else {
            this.addTo(this._subdirectories.bySourceName, fileOrSubdirectory.source.name, fileOrSubdirectory);
            this.addTo(this._subdirectories.byDestinationName, fileOrSubdirectory.destination.name, fileOrSubdirectory);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Add a key-value pair to the given map - or throw an exception if it already exist
    //------------------------------------------------------------------------------------------------------------------

    private addTo<V extends MappedFile | MappedSubdirectory>(map: Map<string, V>, key: string, value: V) {
        if (map.has(key)) {
            const type = value instanceof MappedFile ? "File" : "Subdirectory";
            const path = value.source.relativePath;
            throw new Error(`Internal error: ${type} ${path} has already been added to the database`);
        } else {
            map.set(key, value);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Delete a file or subdirectory
    //------------------------------------------------------------------------------------------------------------------

    public delete(fileOrSubdirectory: MappedFile | MappedSubdirectory) {
        this.markAsModified();
        if (fileOrSubdirectory instanceof MappedFile) {
            this.deleteFrom(this._files.bySourceName, fileOrSubdirectory.source.name, fileOrSubdirectory);
            this.deleteFrom(this._files.byDestinationName, fileOrSubdirectory.destination.name, fileOrSubdirectory);
        } else {
            this.deleteFrom(this._subdirectories.bySourceName, fileOrSubdirectory.source.name, fileOrSubdirectory);
            this.deleteFrom(
                this._subdirectories.byDestinationName, fileOrSubdirectory.destination.name, fileOrSubdirectory
            );
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Add a key-value pair to the given map - or throw an exception if it already exist
    //------------------------------------------------------------------------------------------------------------------

    private deleteFrom<V extends MappedFile | MappedSubdirectory>(map: Map<string, V>, key: string, value: V) {
        const mapValue = map.get(key);
        if (undefined === mapValue) {
            throw new Error(`Internal error: Directory entry ${key} does not exist`);
        } else if (mapValue !== value) {
            throw new Error(`Internal error: ${key} points to the wrong directory entry`);
        } else {
            map.delete(key);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Recursively count the the children
    //------------------------------------------------------------------------------------------------------------------

    public countChildren(statistics?: { files: number, subdirectories: number; }) {
        const realStatistics = statistics ?? { files: 0, subdirectories: 0 };
        realStatistics.files += this._files.byDestinationName.size;
        realStatistics.subdirectories += this._subdirectories.byDestinationName.size;
        this._subdirectories.byDestinationName.forEach(subdirectory => subdirectory.countChildren(realStatistics));
        return realStatistics;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Mark the database as modified
    //------------------------------------------------------------------------------------------------------------------

    public abstract markAsModified(): void;
}

//----------------------------------------------------------------------------------------------------------------------
// A mapped root directory
//----------------------------------------------------------------------------------------------------------------------

class MappedRootDirectory extends MappedDirectoryBase<RootDirectory> {

    private static readonly MILLISECONDS_PER_SECOND = 1_000;

    private lastSavedAtMs?: number;
    private _hasUnsavedChanges = true;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    constructor(source: RootDirectory, destination: RootDirectory, last: string) {
        super(source, destination, last);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Check if the database has unsaved changes
    //------------------------------------------------------------------------------------------------------------------

    public hasUnsavedChanges() {
        return this._hasUnsavedChanges;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Check if the database was saved within the last ... seconds
    //------------------------------------------------------------------------------------------------------------------

    public wasSavedWithinTheLastSeconds(seconds: number) {
        return undefined === this.lastSavedAtMs
            ? false
            : new Date().getTime() - this.lastSavedAtMs <= seconds * MappedRootDirectory.MILLISECONDS_PER_SECOND;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Mark the database as saved
    //------------------------------------------------------------------------------------------------------------------

    public markAsSaved(saved = true) {
        this.lastSavedAtMs = new Date().getTime();
        this._hasUnsavedChanges = !saved;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Mark the database as modified
    //------------------------------------------------------------------------------------------------------------------

    public markAsModified() {
        this._hasUnsavedChanges = true;
    }
}

//----------------------------------------------------------------------------------------------------------------------
// A mapped destination directory
//----------------------------------------------------------------------------------------------------------------------

class MappedSubdirectory extends MappedDirectoryBase<Subdirectory> {

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    constructor(
        public readonly parent: MappedDirectory,
        source: Subdirectory,
        destination: Subdirectory,
        last: string
    ) {
        super(source, destination, last);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Mark the database as modified
    //------------------------------------------------------------------------------------------------------------------

    public markAsModified() {
        this.parent.markAsModified();
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Any mapped directory
//----------------------------------------------------------------------------------------------------------------------

type MappedDirectory = MappedRootDirectory | MappedSubdirectory;
