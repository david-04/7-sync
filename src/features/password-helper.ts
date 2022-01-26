//----------------------------------------------------------------------------------------------------------------------
// Hash and validate passwords
//----------------------------------------------------------------------------------------------------------------------

class PasswordHelper {

    //------------------------------------------------------------------------------------------------------------------
    // Create a salted hash for the given password
    //------------------------------------------------------------------------------------------------------------------

    public static createSaltedHash(password: string) {
        return this.createHash(node.crypto.randomBytes(16).toString("hex"), password);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Validate a passworda gainst the given salted hash
    //------------------------------------------------------------------------------------------------------------------

    public static validatePassword(password: string, saltedHash: string) {
        return saltedHash === this.createHash(saltedHash.replace(/:.*/, ""), password);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Create a salted hash
    //------------------------------------------------------------------------------------------------------------------

    private static createHash(salt: string, password: string) {
        const hash = node.crypto.scryptSync(password, salt, 64, { N: 1024 }).toString("base64");
        return `${salt}:${hash}`;
    }
}
