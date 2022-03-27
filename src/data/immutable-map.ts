//----------------------------------------------------------------------------------------------------------------------
// An immutable wrapper for a map
//----------------------------------------------------------------------------------------------------------------------

class ImmutableMap<T extends MappedFile | MappedSubDirectory> {

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(private readonly map: Map<string, T>) { }

    //------------------------------------------------------------------------------------------------------------------
    // Check if a value exists
    //------------------------------------------------------------------------------------------------------------------

    public has(key: string) {
        return this.map.has(key);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get the value for the given key
    //------------------------------------------------------------------------------------------------------------------

    public get(key: string) {
        return this.map.get(key);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Perform an action for each entry
    //------------------------------------------------------------------------------------------------------------------

    public forEach(consumer: (value: T, key: string) => void) {
        this.map.forEach(consumer);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get entries
    //------------------------------------------------------------------------------------------------------------------

    public entries() {
        return this.map.entries();
    }

    //------------------------------------------------------------------------------------------------------------------
    // Get values
    //------------------------------------------------------------------------------------------------------------------

    public values() {
        return this.map.values();
    }

    //------------------------------------------------------------------------------------------------------------------
    // Retrieve the values as an array that's sorted case-insensitive by the source name
    //------------------------------------------------------------------------------------------------------------------

    public sorted() {
        return Array.from(this.map.entries()).sort((entry1, entry2) => {
            const name1 = entry1[0].toLowerCase();
            const name2 = entry2[0].toLowerCase();
            if (name1 < name2) {
                return -1;
            } else if (name1 === name2) {
                return 0;
            } else {
                return 1;
            }
        }).map(entry => entry[1]);
    }
}