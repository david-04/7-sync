//----------------------------------------------------------------------------------------------------------------------
// Log levels
//----------------------------------------------------------------------------------------------------------------------

class LogLevel {

    private static readonly LOG_LEVEL_ERROR = 1;
    private static readonly LOG_LEVEL_WARN = 2;
    private static readonly LOG_LEVEL_INFO = 3;
    private static readonly LOG_LEVEL_DEBUG = 4;

    public static readonly ERROR = new LogLevel(this.LOG_LEVEL_ERROR, "ERROR  ");
    public static readonly WARN = new LogLevel(this.LOG_LEVEL_WARN, "WARNING");
    public static readonly INFO = new LogLevel(this.LOG_LEVEL_INFO, "INFO   ");
    public static readonly DEBUG = new LogLevel(this.LOG_LEVEL_DEBUG, "DEBUG  ");

    private constructor(public readonly index: number, public readonly paddedName: string) { }
}

//----------------------------------------------------------------------------------------------------------------------
// Base class for all loggers
//----------------------------------------------------------------------------------------------------------------------

class Logger {

    public static readonly SEPARATOR = "------------------------------------------------------------"
        + "------------------------------------------------------------";
    public static readonly PADDING = "\n                              ";

    public static readonly LENGTH_YEAR = 4;
    public static readonly LENGTH_MONTH = 2;
    public static readonly LENGTH_DAY = 2;
    public static readonly LENGTH_HOURS = 2;
    public static readonly LENGTH_MINUTES = 2;
    public static readonly LENGTH_SECONDS = 2;
    public static readonly LENGTH_MILLISECONDS = 3;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
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

    public log(logLevel: LogLevel, ...message: (string | object)[]) {
        this.formatAndAppend(logLevel, message);
    }

    public separator() {
        this.outputStream.log(Logger.SEPARATOR);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Format the line and append it to the log file
    //------------------------------------------------------------------------------------------------------------------

    private formatAndAppend(logLevel: LogLevel, messages: (string | object)[]) {
        if (logLevel.index <= this.logLevel.index) {
            this.outputStream.logAligned(
                Logger.PADDING, Logger.getCurrentTimestamp(), logLevel.paddedName, ...messages
            );
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Obtain the current timestamp
    //------------------------------------------------------------------------------------------------------------------

    private static getCurrentTimestamp() {
        const now = new Date();
        return [
            this.formatNumber(now.getFullYear(), Logger.LENGTH_YEAR),
            "-",
            this.formatNumber(now.getMonth() + 1, Logger.LENGTH_MONTH),
            "-",
            this.formatNumber(now.getDate(), Logger.LENGTH_DAY),
            " ",
            this.formatNumber(now.getHours(), Logger.LENGTH_HOURS),
            ":",
            this.formatNumber(now.getMinutes(), Logger.LENGTH_MINUTES),
            ":",
            this.formatNumber(now.getSeconds(), Logger.LENGTH_SECONDS),
            ".",
            this.formatNumber(now.getMilliseconds(), Logger.LENGTH_MILLISECONDS),
        ].join("");
    }

    //------------------------------------------------------------------------------------------------------------------
    // Pad a number with leading zeros
    //------------------------------------------------------------------------------------------------------------------

    public static formatNumber(number: number, length: number) {
        const result = number.toFixed(0);
        return "00000000000000000000".substring(0, Math.max(0, length - result.length)) + result;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Purge old log file entries
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
    // count the number of separators in the log file
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
            io.on("close", () => resolve(count));
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
        const readline = node.readline.createInterface({
            input: node.fs.createReadStream(file),
            output: node.process.stdout,
            terminal: false
        });
        readline.on("line", line => {
            if (this.isSeparator(line)) {
                numberOfSectionsToRemove--;
            }
            if (numberOfSectionsToRemove < 0) {
                outputStream.log(line);
            }
        });
        return new Promise<void>(resolve => {
            readline.on("close", () => {
                resolve();
            });
        }).then(() => {
            node.fs.rmSync(file);
            node.fs.renameSync(tmpFile, file);
        });
    }
}
