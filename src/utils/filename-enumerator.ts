//----------------------------------------------------------------------------------------------------------------------
// Enumerate filenames
//----------------------------------------------------------------------------------------------------------------------

class FilenameEnumerator {

    public static readonly DEFAULT_LETTERS = "abcdefghijkmnpqrstuvwxyz123456789"; // cspell: disable-line
    public static readonly RECOVERY_FILE = "---recovery---";

    private readonly firstLetter;
    private readonly nextLetter;
    private readonly reservedNames = new Set<string>();

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(letters: string) {
        const array = FilenameEnumerator.getUniqueLetters(letters);
        if (0 < array.length) {
            this.firstLetter = array[0];
            this.nextLetter = FilenameEnumerator.getNextLetters(array);
        } else {
            throw new Error("Internal error: No letters have been passed to the FilenameEnumerator");
        }
        this.reservedNames.add(FilenameEnumerator.RECOVERY_FILE);
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

    private static getNextLetters(letters: string[]) {
        const nextLetter = new Map<string, string>();
        for (let index = 1; index < letters.length; index++) {
            nextLetter.set(letters[index - 1], letters[index]);
        }
        return nextLetter;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the first or next filename
    //------------------------------------------------------------------------------------------------------------------

    public getNextFilename(currentFilename?: string) {
        if (currentFilename) {
            let nextFilename = currentFilename;
            do {
                nextFilename = this.calculateNextFilename(currentFilename);
            } while (this.reservedNames.has(nextFilename));
            return nextFilename;
        } else {
            return this.firstLetter;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Calculate the next filename after the current one
    //------------------------------------------------------------------------------------------------------------------

    private calculateNextFilename(currentFilename: string) {
        const array = currentFilename.split("");
        for (let index = array.length - 1; 0 <= index; index--) {
            const nextLetter = this.nextLetter.get(array[index]);
            if (nextLetter) {
                array[index] = nextLetter;
                return array.join("");
            } else {
                array[index] = this.firstLetter;
            }
        }
        return this.firstLetter + array.join("");
    }
}
