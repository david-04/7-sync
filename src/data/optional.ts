//------------------------------------------------------------------------------------------------------------------
// Wrapper for an object that might or might not be present
//------------------------------------------------------------------------------------------------------------------

class Optional<T> {

    private static readonly EMPTY = new Optional<any>();

    //--------------------------------------------------------------------------------------------------------------
    // Initialisation
    //--------------------------------------------------------------------------------------------------------------

    private constructor(protected readonly value?: T) {
        if (null === this.value) {
            this.value = undefined;
        }
    }

    //--------------------------------------------------------------------------------------------------------------
    // Factory method
    //--------------------------------------------------------------------------------------------------------------

    private static create<T>(value?: T): Optional<NonNullable<T>> {
        if (undefined === value || null === value) {
            return Optional.EMPTY;
        } else {
            return new Optional(value as NonNullable<T>);
        }
    }

    //--------------------------------------------------------------------------------------------------------------
    // Create an Optional
    //--------------------------------------------------------------------------------------------------------------

    public static of<T>(value: T): Optional<NonNullable<T>> {
        return Optional.create(value);
    }

    //--------------------------------------------------------------------------------------------------------------
    // Create an empty Optional
    //--------------------------------------------------------------------------------------------------------------

    public static empty<T>(): Optional<NonNullable<T>> {
        return Optional.create();
    }

    //--------------------------------------------------------------------------------------------------------------
    // Retrieve the value
    //--------------------------------------------------------------------------------------------------------------

    public get(): T | undefined {
        return this.value;
    }

    //--------------------------------------------------------------------------------------------------------------
    // Retrieve the value or throw an exception if the Optional is empty
    //--------------------------------------------------------------------------------------------------------------

    public getOrThrow(): T {
        if (undefined === this.value) {
            throw new Error("The Optional is empty");
        } else {
            return this.value;
        }
    }

    //--------------------------------------------------------------------------------------------------------------
    // Retrieve the value or return the provided default if the Optional is empty
    //--------------------------------------------------------------------------------------------------------------

    public getOrDefault<D>(defaultValue: D): T | D {
        if (undefined === this.value) {
            return defaultValue;
        } else {
            return this.value;
        }
    }

    //--------------------------------------------------------------------------------------------------------------
    // Retrieve the value or extract it from the supplier if the Optional is empty
    //--------------------------------------------------------------------------------------------------------------

    public getOrCalculate<D>(supplier: () => D): T | D {
        if (undefined === this.value) {
            return supplier();
        } else {
            return this.value;
        }
    }

    //--------------------------------------------------------------------------------------------------------------
    // Verify that the Optional has a value (and is not empty)
    //--------------------------------------------------------------------------------------------------------------

    public isPresent() {
        return undefined !== this.value;
    }

    //--------------------------------------------------------------------------------------------------------------
    // Verify that the Optional is empty
    //--------------------------------------------------------------------------------------------------------------

    public isEmpty() {
        return undefined === this.value;
    }

    //--------------------------------------------------------------------------------------------------------------
    // Perform an action if the Optional has a value (and is not empty)
    //--------------------------------------------------------------------------------------------------------------

    public ifPresent(action: (value: T) => void): this {
        if (undefined !== this.value) {
            action(this.value);
        }
        return this;
    }

    //--------------------------------------------------------------------------------------------------------------
    // Perform an action if the Optional is empty
    //--------------------------------------------------------------------------------------------------------------

    public ifEmpty(action: () => void): this {
        if (undefined === this.value) {
            action();
        }
        return this;
    }

    //--------------------------------------------------------------------------------------------------------------
    // Map the value (if present) to another one
    //--------------------------------------------------------------------------------------------------------------

    public map<R>(mapper: (value: T) => R): Optional<NonNullable<R>> {
        return undefined === this.value ? Optional.EMPTY : Optional.create(mapper(this.value));
    }

    //--------------------------------------------------------------------------------------------------------------
    // Map the value and unbox the Optional returned by the mapper function
    //--------------------------------------------------------------------------------------------------------------

    public flatMap<R>(mapper: (value: T) => Optional<NonNullable<R>>): this | Optional<NonNullable<R>> {
        if (undefined === this.value) {
            return Optional.EMPTY;
        } else {
            const optional = mapper(this.value);
            if (optional instanceof Optional) {
                return optional;
            } else {
                throw new Error("The mapping function did not return an Optional instance");
            }
        }
    }

    //--------------------------------------------------------------------------------------------------------------
    // Filter out the value if it matches the filter
    //--------------------------------------------------------------------------------------------------------------

    public filter(filter: (value: T) => unknown): Optional<T> {
        if (undefined !== this.value && filter(this.value)) {
            return this;
        } else {
            return Optional.EMPTY;
        }
    }
}
