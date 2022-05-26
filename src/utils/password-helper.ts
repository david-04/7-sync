//----------------------------------------------------------------------------------------------------------------------
// Hash and validate passwords
//----------------------------------------------------------------------------------------------------------------------

class PasswordHelper {

    private static readonly SALT_LENGTH = 16;

    private static readonly KEY_LENGTH = 64;

    //------------------------------------------------------------------------------------------------------------------
    // Create a salted hash for the given password
    //------------------------------------------------------------------------------------------------------------------

    public static createSaltedHash(password: string) {
        return this.createHash(node.crypto.randomBytes(PasswordHelper.SALT_LENGTH).toString("hex"), password);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Validate a password against the given salted hash
    //------------------------------------------------------------------------------------------------------------------

    public static validatePassword(password: string, saltedHash: string) {
        return saltedHash === this.createHash(saltedHash.replace(/:.*/, ""), password);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create a salted hash
    //------------------------------------------------------------------------------------------------------------------

    private static createHash(salt: string, password: string) {
        const hash = node.crypto.scryptSync(password, salt, PasswordHelper.KEY_LENGTH, { N: 1024 }).toString("base64");
        return `${salt}:${hash}`;
    }
}
