//----------------------------------------------------------------------------------------------------------------------
// A node within a double-linked list
//----------------------------------------------------------------------------------------------------------------------

interface Node<T> {
    readonly value: T;
    previous?: Node<T>;
    next?: Node<T>;
}

//----------------------------------------------------------------------------------------------------------------------
// A double-linked list
//----------------------------------------------------------------------------------------------------------------------

class DoubleLinkedList<T> {

    private firstNode?: Node<T> = undefined;
    private lastNode?: Node<T> = undefined;

    //------------------------------------------------------------------------------------------------------------------
    // Append a value to the end of the list
    //------------------------------------------------------------------------------------------------------------------

    public append(value: T) {
        const newNode: Node<T> = { value };
        newNode.previous = this.lastNode;
        if (this.lastNode) {
            this.lastNode.next = newNode;
            this.lastNode = newNode;
        } else {
            this.firstNode = newNode;
            this.lastNode = newNode;
        }
        return newNode;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Remove a given node from the list
    //------------------------------------------------------------------------------------------------------------------

    public remove(nodeToDelete: Node<T>) {
        if (nodeToDelete.previous) {
            nodeToDelete.previous.next = nodeToDelete.next;
        }
        if (nodeToDelete.next) {
            nodeToDelete.next.previous = nodeToDelete.previous;
        }
        if (nodeToDelete === this.firstNode) {
            this.firstNode = nodeToDelete.next;
        }
        if (nodeToDelete === this.lastNode) {
            this.lastNode = nodeToDelete.previous;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Obtain the lists first node
    //------------------------------------------------------------------------------------------------------------------

    public get head() {
        return this.firstNode;
    }
}
