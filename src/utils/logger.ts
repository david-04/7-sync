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
}
