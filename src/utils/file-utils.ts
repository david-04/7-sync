//----------------------------------------------------------------------------------------------------------------------
// File system helper
//----------------------------------------------------------------------------------------------------------------------

class FileUtils {

    //------------------------------------------------------------------------------------------------------------------
    // Check if the given path exists as any type (e.g. file, directory, link, ...)
    //------------------------------------------------------------------------------------------------------------------

    public static exists(path: string) {
        return node.fs.existsSync(path);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Check if the given path is a file
    //------------------------------------------------------------------------------------------------------------------

    public static existsAndIsFile(path: string) {
        return this.exists(path) && this.getProperties(path).isFile();
    }

    //------------------------------------------------------------------------------------------------------------------
    // Check if the given path is a directory
    //------------------------------------------------------------------------------------------------------------------

    public static existsAndIsDirectory(path: string) {
        return this.exists(path) && this.getProperties(path).isDirectory();
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get file properties
    //------------------------------------------------------------------------------------------------------------------

    public static getProperties(path: string) {
        return node.fs.lstatSync(path);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the parent path
    //------------------------------------------------------------------------------------------------------------------

    public static getParent(path: string) {
        return node.path.dirname(path);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Normalize the path
    //------------------------------------------------------------------------------------------------------------------

    public static normalize(path: string) {
        return node.path.normalize(path);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Resolve a path relative to the config file (unless it's an absolute path)
    //------------------------------------------------------------------------------------------------------------------

    public static resolve(configFile: string, path: string) {
        if (node.path.isAbsolute(path)) {
            return node.path.normalize(path);
        } else {
            return node.path.normalize(node.path.join(configFile, "..", path));
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the normalized absolute path
    //------------------------------------------------------------------------------------------------------------------

    public static getAbsolutePath(path: string) {
        return node.path.resolve(path);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Check if the first path is parent of the second
    //------------------------------------------------------------------------------------------------------------------

    public static isParentChild(parent: string, child: string) {
        return this.getAbsolutePath(child).startsWith(this.getAbsolutePath(parent) + node.path.sep);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Check if two paths are the same
    //------------------------------------------------------------------------------------------------------------------

    public static equals(path1: string, path2: string) {
        return this.getAbsolutePath(path1) === this.getAbsolutePath(path2);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Retrieve a directory's children (files and sub-directories)
    //------------------------------------------------------------------------------------------------------------------

    public static getChildren(directory: string) {
        const array = node.fs.readdirSync(directory, { withFileTypes: true });
        const map = new Map<string, Dirent>();
        array.forEach(item => map.set(item.name, item));
        return { array, map };
    }

    //------------------------------------------------------------------------------------------------------------------
    // Retrieve a directory's children if the directory exists (and return an empty array otherwise)
    //------------------------------------------------------------------------------------------------------------------

    public static getChildrenIfDirectoryExists(directory: string) {
        return this.exists(directory) ? this.getChildren(directory) : { array: [], map: new Map<string, Dirent>() };
    }
}
