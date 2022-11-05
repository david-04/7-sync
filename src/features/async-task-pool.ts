//----------------------------------------------------------------------------------------------------------------------
// Schedule and run asynchronous tasks
//----------------------------------------------------------------------------------------------------------------------

class AsyncTaskPool {

    private readonly tasks = new DoubleLinkedList<() => Promise<void>>();
    private readonly promises = new Array<Promise<void>>();
    private runningTaskCount = 0;

    //------------------------------------------------------------------------------------------------------------------
    // Initialization
    //------------------------------------------------------------------------------------------------------------------

    public constructor(private readonly maxParallelTasks: number) { }

    //------------------------------------------------------------------------------------------------------------------
    // Enqueue a task to run asynchronously
    //------------------------------------------------------------------------------------------------------------------

    public enqueue(callback: () => Promise<void>) {
        this.tasks.append(callback);
        this.startNextTask();
    }

    //------------------------------------------------------------------------------------------------------------------
    // Start another task if capacity permits
    //------------------------------------------------------------------------------------------------------------------

    private startNextTask() {
        const task = this.tasks.head;
        if (task && this.runningTaskCount < this.maxParallelTasks) {
            this.tasks.remove(task);
            this.runningTaskCount++;
            const execute = async () => {
                await task.value();
                this.runningTaskCount--;
                this.startNextTask();
            };
            this.promises.push(execute());
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Wait until all tasks have run
    //------------------------------------------------------------------------------------------------------------------

    public async waitForAllTasksToComplete() {
        await Promise.all(this.promises);
    }
}
