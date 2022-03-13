//----------------------------------------------------------------------------------------------------------------------
// Log levels
//----------------------------------------------------------------------------------------------------------------------

class LogLevel {

    public static readonly ERROR = new LogLevel(1, "ERROR");
    public static readonly WARN = new LogLevel(2, "WARN ");
    public static readonly INFO = new LogLevel(3, "INFO ");
    public static readonly DEBUG = new LogLevel(4, "DEBUG");

    private constructor(public readonly index: number, public readonly paddedName: string) { }
}

//----------------------------------------------------------------------------------------------------------------------
// Base class for all loggers
//----------------------------------------------------------------------------------------------------------------------

class Logger {

    public static readonly SEPARATOR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(() => "----------").join("");

    //------------------------------------------------------------------------------------------------------------------
    // Initialisation
    //------------------------------------------------------------------------------------------------------------------

    public constructor(protected readonly logLevel: LogLevel, protected readonly outputStream: OutputStream) { }

    //------------------------------------------------------------------------------------------------------------------
    // Add log entries for different severities
    //------------------------------------------------------------------------------------------------------------------

    public debug(...message: (string | object)[]) {
        this.formatAndAppend(LogLevel.DEBUG, message);
    }

    public info(...message: (string | object)[]) {
        this.formatAndAppend(LogLevel.INFO, message);
    }

    public warn(...message: (string | object)[]) {
        this.formatAndAppend(LogLevel.WARN, message);
    }

    public error(...message: (string | object)[]) {
        this.formatAndAppend(LogLevel.ERROR, message);
    }

    public separator() {
        this.outputStream.log(Logger.SEPARATOR);
        // this.formatAndAppend(Logger.SEPARATOR.logLevel, [Logger.SEPARATOR.message]);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Format the line and append it to the logfile
    //------------------------------------------------------------------------------------------------------------------

    private formatAndAppend(logLevel: LogLevel, messages: (string | object)[]) {
        if (logLevel.index <= this.logLevel.index) {
            this.outputStream.log(Logger.getCurrentTimestamp(), logLevel.paddedName, ...messages);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Obtain the current timestamp
    //------------------------------------------------------------------------------------------------------------------

    private static getCurrentTimestamp() {
        const now = new Date();
        return [
            this.formatNumber(now.getFullYear(), 4),
            "-",
            this.formatNumber(now.getMonth() + 1, 2),
            "-",
            this.formatNumber(now.getDate(), 2),
            " ",
            this.formatNumber(now.getHours(), 2),
            ":",
            this.formatNumber(now.getMinutes(), 2),
            ":",
            this.formatNumber(now.getSeconds(), 2),
            ".",
            this.formatNumber(now.getMilliseconds(), 3),
        ].join("")
    }

    //------------------------------------------------------------------------------------------------------------------
    // Pad a number with leading zeros
    //------------------------------------------------------------------------------------------------------------------

    private static formatNumber(number: number, length: number) {
        const result = number.toFixed(0);
        return "0000".substring(0, Math.max(0, length - result.length)) + result;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Purge old logfile entries
    //------------------------------------------------------------------------------------------------------------------

    public static async purge(file: string, numberOfSectionsToKeep: number) {
        if (FileUtils.existsAndIsFile(file)) {
            const actualNumberOfSections = await this.countSeparators(file);
            if (numberOfSectionsToKeep < actualNumberOfSections) {
                await this.removeSections(file, actualNumberOfSections - numberOfSectionsToKeep);
            }
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // count the number of separators in the logfile
    //------------------------------------------------------------------------------------------------------------------

    private static async countSeparators(file: string) {
        let count = 0;
        const io = node.readline.createInterface({
            input: node.fs.createReadStream(file),
            output: process.stdout,
            terminal: false
        });
        io.on("line", line => count += this.isSeparator(line) ? 1 : 0);
        return new Promise<number>(resolve => {
            io.on("close", () => resolve(count))
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Determine if the given line is a separator
    //------------------------------------------------------------------------------------------------------------------

    private static isSeparator(line: string) {
        return line === Logger.SEPARATOR;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Remove the first sections
    //------------------------------------------------------------------------------------------------------------------

    private static async removeSections(file: string, numberOfSectionsToRemove: number) {
        const tmpFile = `${file}~`;
        const outputStream = new FileOutputStream(tmpFile, false);
        const io = node.readline.createInterface({
            input: node.fs.createReadStream(file),
            output: node.process.stdout,
            terminal: false
        });
        io.on("line", line => {
            if (this.isSeparator(line)) {
                numberOfSectionsToRemove--;
            }
            if (numberOfSectionsToRemove < 0) {
                outputStream.log(line);
            }
        });
        return new Promise<void>(resolve => {
            io.on('close', () => {
                resolve();
            });
        }).then(() => {
            node.fs.rmSync(file);
            node.fs.renameSync(tmpFile, file)
        });
    }
}
