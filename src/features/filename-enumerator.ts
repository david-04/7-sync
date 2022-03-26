//----------------------------------------------------------------------------------------------------------------------
// Enumerate filenames
//----------------------------------------------------------------------------------------------------------------------

class FilenameEnumerator {

    private static readonly LETTERS = "abcdefghijkmnpqrstuvwxyz123456789"; // cspell: disable-line
    public static readonly RECOVERY_FILE_NAME_PREFIX = "_____RECOVERY_____";

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
    // Get the first or next filename
    //------------------------------------------------------------------------------------------------------------------

    public getNextFilename(currentFilename?: string) {
        if (currentFilename) {
            let nextFilename = currentFilename;
            do {
                nextFilename = this.calculateNext(currentFilename);
            } while (nextFilename.startsWith(FilenameEnumerator.RECOVERY_FILE_NAME_PREFIX));
            return nextFilename;
        } else {
            return this.firstLetter;
        }
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
            next = this.getNextFilename(next);
            const filename = prefix + next + suffix;
            const filenameWithPath = node.path.join(path, filename);
            if (!FileUtils.exists(filenameWithPath) && !next.startsWith(FilenameEnumerator.RECOVERY_FILE_NAME_PREFIX)) {
                return { enumeratedName: next, filename, filenameWithPath };
            } else {
                this.logger.debug(`The next filename is already occupied: ${filename}`);
                this.logger.warn(`The database seems to be lagging behind the destination directory`);
            }
        }
    }
}
