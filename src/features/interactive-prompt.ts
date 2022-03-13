//----------------------------------------------------------------------------------------------------------------------
// Prompt the user for input
//----------------------------------------------------------------------------------------------------------------------

class InteractivePrompt {

    private static readonly PROMPT = "> ";

    //------------------------------------------------------------------------------------------------------------------
    // Customisation options
    //------------------------------------------------------------------------------------------------------------------

    private static readonly as = <T>(value: T) => value;

    private static readonly DEFAULT_OPTIONS = {
        question: this.as<string | string[]>(""),
        acceptBlankInput: this.as<boolean>(false),
        isPassword: this.as<boolean>(false),
        validate: this.as<undefined | ((input: string) => boolean)>(undefined),
        defaultAnswer: this.as<undefined | string>(undefined),
        suppressExtraEmptyLineAfterInput: this.as<boolean>(false),
    };

    //------------------------------------------------------------------------------------------------------------------
    // Prompt the user for input
    //------------------------------------------------------------------------------------------------------------------

    public static async prompt(options?: Partial<typeof InteractivePrompt.DEFAULT_OPTIONS>): Promise<string> {
        const effectiveOptions: (typeof InteractivePrompt.DEFAULT_OPTIONS) = { ...this.DEFAULT_OPTIONS, ...options };
        this.displayQuestion(effectiveOptions.question);
        while (true) {
            const answer = await this.readLine({ isPassword: effectiveOptions.isPassword });
            const result = this.mapAndValidate(answer, effectiveOptions);
            if (result.isPresent()) {
                if (!effectiveOptions.suppressExtraEmptyLineAfterInput) {
                    console.log("");
                }
                return result.getOrThrow();
            }
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Prompt for a yes/no question
    //------------------------------------------------------------------------------------------------------------------

    public static async promptYesNo(question: string | string[]): Promise<boolean> {
        const array = "string" === typeof question ? [question] : [...question];
        if (array.length) {
            array[array.length - 1] += " [y/n]";
        }
        this.displayQuestion(array);
        while (true) {
            const answer = await this.prompt({ suppressExtraEmptyLineAfterInput: true });
            if (answer.match(/^y(es)?$/)) {
                console.log("");
                return true;
            } else if (answer.match(/^n(o)?$/)) {
                console.log("");
                return false;
            } else {
                console.log("Please enter y or n")
            }
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Show the question (if given)
    //------------------------------------------------------------------------------------------------------------------

    private static displayQuestion(question?: string | string[]) {
        const message = (Array.isArray(question) ? question : [question])
            .filter(line => null !== line && undefined !== line)
            .join("\n")
            .replace(/^\s*/mg, "")
            .replace(/(\r?\n)+/g, "\n")
            .trim();
        if (message) {
            console.log(message);
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
        if (0 === answer.trim().length && !options.acceptBlankInput) {
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

    private static async readLine(options?: { isPassword: boolean }): Promise<string> {
        const readlineInterface = node.readline.createInterface({ input: process.stdin, output: process.stdout });
        if (options?.isPassword) {
            (readlineInterface as unknown as { [index: string]: (text: string) => void })._writeToOutput = (text: string) => {
                if (text === this.PROMPT) {
                    process.stdout.write(this.PROMPT);
                }
            };
        }
        return new Promise(resolve => readlineInterface.question(this.PROMPT, answer => {
            readlineInterface.close();
            resolve(answer);
        }));
    }
}
