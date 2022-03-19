//----------------------------------------------------------------------------------------------------------------------
// Base class for all output streams
//----------------------------------------------------------------------------------------------------------------------

abstract class OutputStream {

    public log(...data: (string | object)[]) {
        this.doLog(
            data.map(item => "object" === typeof item ? JSON.stringify(item, undefined, 4) : `${item}`).join(" ")
        );
    }

    public logAligned(padding: string, ...data: (string | object)[]) {
        this.doLog(
            data.map(item => "object" === typeof item ? JSON.stringify(item, undefined, 4) : `${item}`)
                .join(" ")
                .split(/\r?\n/)
                .join(padding)
        );
    }

    public abstract close(): void;

    protected abstract doLog(data: string): void;
}

//----------------------------------------------------------------------------------------------------------------------
// A muted output stream
//----------------------------------------------------------------------------------------------------------------------

class NullOutputStream extends OutputStream {

    protected doLog(_data: string) {
        // suppress all output
    }

    public close() {
        // nothing to close
    }
}

//----------------------------------------------------------------------------------------------------------------------
// A console output stream (stdout)
//----------------------------------------------------------------------------------------------------------------------

class ConsoleOutputStream extends OutputStream {

    protected doLog(line: string) {
        console.log(line);
    }

    public close() {
        // nothing to close
    }
}

//----------------------------------------------------------------------------------------------------------------------
// A file output stream
//----------------------------------------------------------------------------------------------------------------------

class FileOutputStream extends OutputStream {

    private fileDescriptor;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(private readonly file: string, append: boolean) {
        super();
        try {
            this.fileDescriptor = node.fs.openSync(file, append ? "a" : "w");
        } catch (exception) {
            throw new FriendlyException(`Failed to open log file ${file}: ${exception}`);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Append a message to the log file
    //------------------------------------------------------------------------------------------------------------------

    protected doLog(line: string) {
        try {
            node.fs.writeSync(this.fileDescriptor, `${line}\n`);
        } catch (exception) {
            throw new FriendlyException(`Failed to write to log file ${this.file}: ${firstLineOnly(exception)}`);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Close the log file
    //------------------------------------------------------------------------------------------------------------------

    public close() {
        node.fs.closeSync(this.fileDescriptor);
    }
}
