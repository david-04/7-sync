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
        const node: Node<T> = { value };
        node.previous = this.lastNode;
        if (this.lastNode) {
            this.lastNode.next = node;
        } else {
            this.firstNode = node;
            this.lastNode = node;
        }
        return node;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Remove a given node from the list
    //------------------------------------------------------------------------------------------------------------------

    public remove(node: Node<T>) {
        if (node.previous) {
            node.previous.next = node.next;
        }
        if (node.next) {
            node.next.previous = node.previous;
        }
        if (node === this.firstNode) {
            this.firstNode = node.next;
        }
        if (node === this.lastNode) {
            this.lastNode = node.previous;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Obtain the lists first node
    //------------------------------------------------------------------------------------------------------------------

    public get head() {
        return this.firstNode;
    }
}
