//----------------------------------------------------------------------------------------------------------------------
// Base class for all output streams
//----------------------------------------------------------------------------------------------------------------------

abstract class OutputStream {

    public log(...data: (string | object)[]) {
        this.doLog(
            data.map(item => "object" === typeof item ? JSON.stringify(item, undefined, 4) : `${item}`).join(" ")
        );
    }

    protected abstract doLog(data: string): void;
}

//----------------------------------------------------------------------------------------------------------------------
// A muted output stream
//----------------------------------------------------------------------------------------------------------------------

class NullOutputStream extends OutputStream {
    protected doLog(_data: string) {
        // supress all output
    }
}

//----------------------------------------------------------------------------------------------------------------------
// A console output stream (stdout)
//----------------------------------------------------------------------------------------------------------------------

class ConsoleOutputStream extends OutputStream {
    protected doLog(line: string) {
        console.log(line);
    }
}

//----------------------------------------------------------------------------------------------------------------------
// A file output stream
//----------------------------------------------------------------------------------------------------------------------

class FileOutputStream extends OutputStream {

    private fileDescriptor;

    //------------------------------------------------------------------------------------------------------------------
    // Initialisation
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
    // Append a message to the logfile
    //------------------------------------------------------------------------------------------------------------------

    protected doLog(line: string) {
        try {
            node.fs.writeSync(this.fileDescriptor, `${line}\n`);
        } catch (exception) {
            throw new FriendlyException(`Failed to write to log file ${this.file}: ${firstLineOnly(exception)}`);
        }
    }
}
