//----------------------------------------------------------------------------------------------------------------------
// Enumerate filenames
//----------------------------------------------------------------------------------------------------------------------

class FilenameEnumerator {

    private static readonly LETTERS = "abcdefghijkmnpqrstuvwxyz123456789"; // cspell: disable-line

    private static hasDetectedCollisions = false;

    private readonly firstLetter;
    private readonly nextLetter;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(private readonly logger: Logger) {
        const array = FilenameEnumerator.getUniqueLetters(FilenameEnumerator.LETTERS);
        if (0 < array.length) {
            this.firstLetter = array[0];
            this.nextLetter = FilenameEnumerator.getNextLetterMap(array);
        } else {
            throw new Error("Internal error: No letters have been passed to the FilenameEnumerator");
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Split the string into letters and remove duplicate letters and whitespace
    //------------------------------------------------------------------------------------------------------------------

    private static getUniqueLetters(letters: string) {
        const processedLetters = new Set<string>();
        return letters.split("")
            .filter(letter => !letter.match(/\s/))
            .filter(letter => {
                if (processedLetters.has(letter)) {
                    return false;
                } else {
                    processedLetters.add(letter);
                    return true;
                }
            });
    }

    //------------------------------------------------------------------------------------------------------------------
    // For each letter, calculate the next letter
    //------------------------------------------------------------------------------------------------------------------

    private static getNextLetterMap(letters: string[]) {
        const map = new Map<string, string>();
        for (let index = 1; index < letters.length; index++) {
            map.set(letters[index - 1], letters[index]);
        }
        return map;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Calculate the next filename after the current one
    //------------------------------------------------------------------------------------------------------------------

    private calculateNext(last: string) {
        const array = last.split("");
        for (let index = array.length - 1; 0 <= index; index--) {
            const nextLetter = this.nextLetter.get(array[index]);
            if (nextLetter) {
                array[index] = nextLetter;
                return array.join("");
            } else {
                array[index] = this.firstLetter;
            }
        }
        return array.join("") + this.firstLetter;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Determine the next file name
    //------------------------------------------------------------------------------------------------------------------

    public getNextAvailableFilename(path: string, last: string, prefix: string, suffix: string) {
        let next = last;
        while (true) {
            next = next ? this.calculateNext(next) : this.firstLetter;
            const filename = prefix + next + suffix;
            const filenameWithPath = node.path.join(path, filename);
            if (FileUtils.exists(filenameWithPath)) {
                this.warnAboutOutOfSyncDatabase(path, filename);
            } else if (!MetadataManager.isMetadataArchiveName(next)) {
                return { enumeratedName: next, filename, filenameWithPath };
            }
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // On the first occasion only, warn about an out-of-sync database
    //------------------------------------------------------------------------------------------------------------------

    private warnAboutOutOfSyncDatabase(path: string, name: string) {
        if (!FilenameEnumerator.hasDetectedCollisions) {
            this.logger.warn(`The next filename is already occupied: ${path} => ${name}`);
            this.logger.warn(`The database seems to be out of sync with the destination directory`);
            FilenameEnumerator.hasDetectedCollisions = true;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Determine if at least one generated filename was already in use
    //------------------------------------------------------------------------------------------------------------------

    public static hasDetectedFilenameCollisions() {
        return this.hasDetectedCollisions;
    }
}
