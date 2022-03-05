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

    private stream: {
        write(chunk: string, callback?: (error: Error | null | undefined) => void): boolean;
        write(chunk: string, encoding: BufferEncoding, callback?: (error: Error | null | undefined) => void): boolean;
    };

    //------------------------------------------------------------------------------------------------------------------
    // Initialisation
    //------------------------------------------------------------------------------------------------------------------

    public constructor(file: string, append: boolean) {
        super();
        try {
            this.stream = node.fs.createWriteStream(file, append ? { flags: 'a' } : {});
        } catch (exception) {
            throw new FriendlyException(`Failed to open file ${file} - ${exception}`);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Append a message to the logfile
    //------------------------------------------------------------------------------------------------------------------

    protected doLog(line: string) {
        this.stream.write(line + "\n");
    }
}
