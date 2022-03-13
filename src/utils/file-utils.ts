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
        return this.getProperties(path).map(item => item.isFile()).getOrDefault(false);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Check if the given path is a directory
    //------------------------------------------------------------------------------------------------------------------

    public static existsAndIsDirectory(path: string) {
        return this.getProperties(path).map(item => item.isDirectory()).getOrDefault(false);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get file properties
    //------------------------------------------------------------------------------------------------------------------

    public static getProperties(path: string) {
        return Optional.of(this.exists(path) ? node.fs.lstatSync(path) : undefined);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the parent path
    //------------------------------------------------------------------------------------------------------------------

    public static getParent(path: string) {
        return node.path.dirname(path);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Normalise the path
    //------------------------------------------------------------------------------------------------------------------

    public static normalise(path: string) {
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
    // Get the normalised absolute path
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
}
