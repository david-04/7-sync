//----------------------------------------------------------------------------------------------------------------------
// Enumerate filenames
//----------------------------------------------------------------------------------------------------------------------

class FilenameEnumerator {

    private static readonly LETTERS = "abcdefghijkmnpqrstuvwxyz123456789"; // cspell: disable-line

    private readonly firstLetter;
    private readonly nextLetter;
    private readonly letterToIndex;
    private readonly allLetters;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(private readonly logger: Logger) {
        const uniqueLetters = FilenameEnumerator.getUniqueLetters(FilenameEnumerator.LETTERS);
        const array = uniqueLetters.array;
        this.allLetters = uniqueLetters.set;
        if (0 < array.length) {
            this.firstLetter = array[0];
            this.nextLetter = FilenameEnumerator.getNextLetterMap(array);
            this.letterToIndex = FilenameEnumerator.getLetterToIndexMap(array);
        } else {
            throw new Error("Internal error: No letters have been passed to the FilenameEnumerator");
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Split the string into letters and remove duplicate letters and whitespace
    //------------------------------------------------------------------------------------------------------------------

    private static getUniqueLetters(letters: string) {
        const set = new Set<string>();
        const array = letters.split("")
            .filter(letter => !letter.match(/\s/))
            .filter(letter => {
                if (set.has(letter)) {
                    return false;
                } else {
                    set.add(letter);
                    return true;
                }
            });
        return { set, array };
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
    // Map each letter to its sort index
    //------------------------------------------------------------------------------------------------------------------

    private static getLetterToIndexMap(letters: string[]) {
        const map = new Map<string, number>();
        for (let index = 0; index < letters.length; index++) {
            map.set(letters[index], index);
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
                this.logger.warn(`The next filename is already occupied: ${path} => ${filename}`);
            } else if (!MetadataManager.isMetadataArchiveName(next)) {
                return { enumeratedName: next, filename, filenameWithPath };
            }
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Recalculate the last filename based on current directory entries
    //------------------------------------------------------------------------------------------------------------------

    public recalculateLastFilename(last: string, filenames: string[]) {
        return filenames
            .map(filename => filename.endsWith(".7z") ? filename.substring(0, filename.length - 3) : filename)
            .filter(basename => this.isEnumeratedName(basename))
            .reduce((a, b) => this.getLastFilename(a, b), this.isEnumeratedName(last) ? last : "");
    }

    //------------------------------------------------------------------------------------------------------------------
    // Determine if a filename (without extension) is an enumerated one
    //------------------------------------------------------------------------------------------------------------------

    private isEnumeratedName(filenameWithoutExtension: string) {
        for (let index = 0; index < filenameWithoutExtension.length; index++) {
            if (!this.allLetters.has(filenameWithoutExtension.charAt(index))) {
                return false;
            }
        }
        return true;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Compare two enumerated filenames and return the last
    //------------------------------------------------------------------------------------------------------------------

    private getLastFilename(name1: string, name2: string) {
        const lengthDifference = name1.length - name2.length;
        if (lengthDifference) {
            return lengthDifference < 0 ? name2 : name1;
        } else {
            for (let index = 0; index < name1.length; index++) {
                const letterDifference = this.compareEnumeratedLetters(name1.charAt(index), name2.charAt(index));
                if (0 !== letterDifference) {
                    return letterDifference < 0 ? name2 : name1;
                }
            }
            return name1;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Compare two enumerated letters
    //------------------------------------------------------------------------------------------------------------------

    private compareEnumeratedLetters(letter1: string, letter2: string) {
        const index1 = this.letterToIndex.get(letter1);
        const index2 = this.letterToIndex.get(letter2);
        if (undefined === index1 || undefined === index2) {
            throw new InternalError(`Not an enumerated letter: ${undefined === index1 ? letter1 : letter2}`);
        } else {
            return index1 - index2;
        }
    }
}
