//----------------------------------------------------------------------------------------------------------------------
// Base class for validators
//----------------------------------------------------------------------------------------------------------------------

abstract class Validator {

    public abstract validate(path: string, value: unknown): void;

    protected throw(path: string, message: string) {
        const location = path ? ` at ${path}` : "";
        throw new FriendlyException(`${message}${location}`);
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Validators for scalar values
//----------------------------------------------------------------------------------------------------------------------

class NonEmptyStringValidator extends Validator {
    public validate(path: string, value: string) {
        if ("string" !== typeof value) {
            this.throw(path, `Expected a string but found ${typeof value}`);
        } else if (!value) {
            this.throw(path, `String is empty`);
        }
    }
}

class StringValidator extends Validator {
    public validate(path: string, value: string) {
        if ("string" !== typeof value) {
            this.throw(path, `Expected a string but found ${typeof value}`);
        }
    }
}

class NumberValidator extends Validator {

    public constructor(private readonly min?: number, private readonly max?: number) {
        super();
    }

    public validate(path: string, value: number) {
        if ("number" !== typeof value) {
            this.throw(path, `Expected a number but found ${typeof path}`);
        } else if (undefined !== this.min && value < this.min) {
            this.throw(path, `Expected a minimum value of ${this.min} but found ${value}`);
        } else if (undefined !== this.max && this.max < value) {
            this.throw(path, `Expected a maximum value of ${this.max} but found ${value}`);
        }
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Object validator
//----------------------------------------------------------------------------------------------------------------------

class ObjectValidator<T extends object> extends Validator {

    public constructor(private readonly propertyValidators: { [index: string]: Validator; }) {
        super();
    }

    public setValidator(key: string, validator: Validator) {
        this.propertyValidators[key] = validator;
    }

    public validate(path: string, value: T) {
        if ("object" !== typeof value) {
            this.throw(path, `Expected an object but found ${typeof value}`);
        } else if (null === value) {
            this.throw(path, `Expected an object but found null`);
        } else if (Array.isArray(value)) {
            this.throw(path, `Expected an object but found an array`);
        } else {
            for (const key of Object.keys(this.propertyValidators)) {
                if (!Object.prototype.hasOwnProperty.call(value, key)) {
                    this.throw(path, `Property "${key}" is missing`);
                } else {
                    this.propertyValidators[key].validate(`${path}/${key}`, asAny(value)[key]);
                }
            }
            for (const key of Object.keys(value)) {
                if (!Object.prototype.hasOwnProperty.call(this.propertyValidators, key)) {
                    this.throw(path, `Unknown property "${key}"`);
                }
            }
        }
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Array validator
//----------------------------------------------------------------------------------------------------------------------

class ArrayValidator<T> extends Validator {

    public constructor(private readonly itemValidator: Validator) {
        super();
    }

    public validate(path: string, value: T[]) {
        if ("object" !== typeof value) {
            this.throw(path, `Expected an array but found ${typeof path}`);
        } else if (!value) {
            this.throw(path, `Expected an array but found null`);
        } else if (!Array.isArray(value)) {
            this.throw(path, `Expected an array but found an object`);
        } else {
            value.forEach((item, index) => this.itemValidator.validate(`${path}/${index}`, item));
        }
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Validators for specific JSON objects
//----------------------------------------------------------------------------------------------------------------------

class JsonValidator {

    //------------------------------------------------------------------------------------------------------------------
    // Validation rules
    //------------------------------------------------------------------------------------------------------------------

    private static readonly SOURCE_AND_DESTINATION_VALIDATORS = {
        source: new NonEmptyStringValidator(),
        destination: new NonEmptyStringValidator(),
    };

    private static readonly LAST_VALIDATOR = {
        last: new StringValidator()
    };

    private static getConfigValidator() {
        return new ObjectValidator<JsonConfig>({
            ...JsonValidator.SOURCE_AND_DESTINATION_VALIDATORS,
            password: new NonEmptyStringValidator(),
            sevenZip: new NonEmptyStringValidator()
        });
    }

    private static getFileValidator() {
        return new ObjectValidator<JsonFile>({
            ...this.SOURCE_AND_DESTINATION_VALIDATORS,
            created: new NumberValidator(0),
            modified: new NumberValidator(0),
            size: new NumberValidator(0)
        });
    }

    private static getDirectoryValidator() {
        const validator = new ObjectValidator<JsonDirectory>({
            ...this.SOURCE_AND_DESTINATION_VALIDATORS,
            files: new ArrayValidator(this.getFileValidator()),
            ...this.LAST_VALIDATOR
        });
        validator.setValidator("directories", new ArrayValidator(validator));
        return validator;
    }

    private static getDatabaseValidator() {
        return new ObjectValidator<JsonDatabase>({
            files: new ArrayValidator(this.getFileValidator()),
            directories: new ArrayValidator(this.getDirectoryValidator()),
            ...this.LAST_VALIDATOR
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Perform the validation
    //------------------------------------------------------------------------------------------------------------------

    public static validateConfig(json: JsonConfig) {
        this.getConfigValidator().validate("", json);
    }

    public static validateDatabase(json: JsonDatabase) {
        this.getDatabaseValidator().validate("", json);
    }
}
