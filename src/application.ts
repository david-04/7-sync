//----------------------------------------------------------------------------------------------------------------------
// The main program
//----------------------------------------------------------------------------------------------------------------------

class Application {

    //------------------------------------------------------------------------------------------------------------------
    // Entry point and error handling for the main program
    //------------------------------------------------------------------------------------------------------------------

    public static run() {
        try {
            this.main(process.argv.slice(2));
        } catch (exception) {
            console.error(exception instanceof FriendlyException ? exception.message : exception);
            nodeModules.process.exit(exception instanceof FriendlyException ? exception.exitCode : 1);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // The main processing logic
    //------------------------------------------------------------------------------------------------------------------

    private static main(argv: string[]) {
        const options = CommandLineParser.parse(argv);
        const context = new Context(options);
        console.log(context);
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Run the application when the whole script has been loaded
//----------------------------------------------------------------------------------------------------------------------

process.on("exit", () => Application.run());
