//----------------------------------------------------------------------------------------------------------------------
// Prompt the user for input
//----------------------------------------------------------------------------------------------------------------------

class InteractivePrompt {

    private static readonly PROMPT = "> ";

    //------------------------------------------------------------------------------------------------------------------
    // Customization options
    //------------------------------------------------------------------------------------------------------------------

    private static readonly as = <T>(value: T) => value;

    private static readonly DEFAULT_OPTIONS = {
        question: this.as<string | string[]>(""),
        acceptBlankInput: this.as<boolean>(false),
        isPassword: this.as<boolean>(false),
        validate: this.as<undefined | ((input: string) => boolean)>(undefined),
        defaultAnswer: this.as<undefined | string>(undefined),
        suppressExtraEmptyLineAfterInput: this.as<boolean>(false),
        useStderr: this.as<boolean>(false)
    };

    //------------------------------------------------------------------------------------------------------------------
    // Prompt the user for input
    //------------------------------------------------------------------------------------------------------------------

    public static async prompt(options?: Partial<typeof InteractivePrompt.DEFAULT_OPTIONS>) {
        const effectiveOptions: (typeof InteractivePrompt.DEFAULT_OPTIONS) = { ...this.DEFAULT_OPTIONS, ...options };
        const print = effectiveOptions.useStderr ? console.error : console.log;
        this.displayQuestion(print, effectiveOptions.question);
        while (true) {
            const answer = await this.readLine({ ...effectiveOptions });
            const result = this.mapAndValidate(answer, effectiveOptions);
            if (result.isPresent()) {
                if (!effectiveOptions.suppressExtraEmptyLineAfterInput) {
                    print("");
                }
                return result.getOrThrow();
            }
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Prompt for a yes/no question
    //------------------------------------------------------------------------------------------------------------------

    public static async promptYesNo(
        options: Partial<typeof InteractivePrompt.DEFAULT_OPTIONS> & { question: string | string[]; }
    ): Promise<boolean> {
        const print = options.useStderr ? console.error : console.log;
        const array = "string" === typeof options.question ? [options.question] : [...options.question];
        if (array.length) {
            array[array.length - 1] += " [y/n]";
        }
        this.displayQuestion(print, array);
        while (true) {
            const answer = await this.prompt({ ...options, suppressExtraEmptyLineAfterInput: true });
            if (answer.match(/^y(es)?$/)) {
                print("");
                return true;
            } else if (answer.match(/^n(o)?$/)) {
                print("");
                return false;
            } else {
                print("Please enter y or n");
            }
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Show the question (if given)
    //------------------------------------------------------------------------------------------------------------------

    private static displayQuestion(print: (message: string) => void, question: string | string[]) {
        const message = (Array.isArray(question) ? question : [question])
            .filter(line => null !== line && undefined !== line)
            .join("\n")
            .replace(/^\s*/mg, "")
            .replace(/(\r?\n)+/g, "\n")
            .trim();
        if (message) {
            print(message);
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Post-process and filter input
    //------------------------------------------------------------------------------------------------------------------

    private static mapAndValidate(answer: string, options: typeof InteractivePrompt.DEFAULT_OPTIONS): Optional<string> {
        if (!(options.isPassword ?? false)) {
            answer = answer.trim();
        }
        if (0 === answer.length && undefined !== options.defaultAnswer) {
            return Optional.of(options.defaultAnswer);
        }
        if (0 === answer.length && !options.acceptBlankInput) {
            return Optional.empty();
        }
        if (options.validate && !options.validate(answer)) {
            return Optional.empty();
        }
        return Optional.of(answer);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Read a line of user input
    //------------------------------------------------------------------------------------------------------------------

    private static readLine(options: { isPassword: boolean, useStderr: boolean; }): Promise<string> {
        const readlineInterface = node.readline.createInterface({
            input: process.stdin,
            output: options.useStderr ? process.stderr : process.stdout
        });
        if (options.isPassword) {
            const implementation = readlineInterface as unknown as { [index: string]: (text: string) => void; };
            implementation._writeToOutput = (text: string) => {
                if (text === this.PROMPT) {
                    (options.useStderr ? process.stderr : process.stdout).write(this.PROMPT);
                }
            };
        }
        return new Promise(resolve => readlineInterface.question(this.PROMPT, answer => {
            readlineInterface.close();
            resolve(answer);
        }));
    }
}
