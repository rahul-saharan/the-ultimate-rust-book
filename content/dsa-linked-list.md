<h1><span class="h1-kicker">Data Structures & Algorithms</span>Linked Lists (the Hard Way)</h1>

The linked list is a rite of passage in Rust. In most languages it's a beginner exercise; in Rust it's famously tricky — so much so that there's a legendary tutorial called *"Learning Rust With Entirely Too Many Linked Lists."* Why the difficulty? Because linked lists are built from *shared, mutable, aliased* pointers — exactly what Rust's [ownership](#/ch/ownership) rules restrain. Working *through* that friction teaches you ownership deeply. Let's build one properly.

## What a linked list is

A **linked list** stores each element in a **node** that holds a value and a pointer to the *next* node. Unlike an array's contiguous block, nodes are scattered across the heap, chained together:

<figure class="diagram">
<svg viewBox="0 0 640 100" role="img" aria-label="A singly linked list: nodes each holding a value and a pointer to the next, ending in None">
  <style>
    .llm { font: 600 12px var(--font-mono); fill: var(--text); }
    .llc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .nodel { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="14" y="30" class="llm" fill="var(--rust-600)">head</text>
  <rect x="60" y="34" width="100" height="34" class="nodel"/><text x="72" y="56" class="llm">1 | ●</text>
  <rect x="200" y="34" width="100" height="34" class="nodel"/><text x="212" y="56" class="llm">2 | ●</text>
  <rect x="340" y="34" width="100" height="34" class="nodel"/><text x="352" y="56" class="llm">3 | ●</text>
  <text x="470" y="56" class="llm">None</text>
  <path d="M162 51 L198 51" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#all)"/>
  <path d="M302 51 L338 51" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#all)"/>
  <path d="M442 51 L466 51" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#all)"/>
  <defs><marker id="all" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--rust-500)"/></marker></defs>
</svg>
<figcaption>A singly linked list: each node owns the next via a pointer, ending in <code>None</code>.</figcaption>
</figure>

## Modeling a node in Rust

The natural Rust encoding: each node owns its successor via `Option<Box<Node>>`. `Box` because the type is [recursive](#/ch/box) (it needs a fixed size), and `Option` because the last node has no next:

```rust
struct Node {
    value: i32,
    next: Option<Box<Node>>, // owns the rest of the list, or None at the end
}

struct LinkedList {
    head: Option<Box<Node>>,
}
```

> [!key] Why `Option<Box<Node>>` is the right shape
> `Box<Node>` gives the recursive type a known size (a pointer) and single ownership — each node **owns** the next one. `Option` models "there might be no next node." When the head `Box` is dropped, it drops its `next`, which drops *its* next… the whole list frees automatically, in order, with zero manual cleanup. This is a *singly* linked list with clear ownership — the version Rust handles gracefully.

## Push and pop with the `.take()` trick

The key technique is **`Option::take()`** — it moves the value out of an `Option`, leaving `None` behind. This lets you restructure the links without violating ownership (you can't just *move* out of `self.head` while it's borrowed):

```rust
struct Node {
    value: i32,
    next: Option<Box<Node>>,
}

struct LinkedList {
    head: Option<Box<Node>>,
}

impl LinkedList {
    fn new() -> Self {
        LinkedList { head: None }
    }

    // Add to the front — O(1).
    fn push_front(&mut self, value: i32) {
        let new_node = Box::new(Node {
            value,
            next: self.head.take(), // take the old head, leaving None
        });
        self.head = Some(new_node); // new node becomes the head
    }

    // Remove from the front — O(1).
    fn pop_front(&mut self) -> Option<i32> {
        self.head.take().map(|node| {
            self.head = node.next; // the next node becomes the new head
            node.value
        })
    }

    // Count nodes by walking the chain — O(n).
    fn len(&self) -> usize {
        let mut count = 0;
        let mut current = &self.head;
        while let Some(node) = current {
            count += 1;
            current = &node.next; // follow the pointer
        }
        count
    }
}

fn main() {
    let mut list = LinkedList::new();
    list.push_front(3);
    list.push_front(2);
    list.push_front(1);

    println!("length: {}", list.len()); // 3
    while let Some(v) = list.pop_front() {
        print!("{v} "); // 1 2 3
    }
    println!();
}
```

## Why the borrow checker fights you

Push/pop at the *front* are fine. The pain starts with more complex operations — inserting in the middle, doubly-linked lists, or anything where two things point at one node:

> [!mistake] The classic linked-list struggles in Rust
> - **Traversal with mutation**: walking the list while modifying it means holding a `&mut` that keeps moving — the borrow checker is strict about this. The `.take()` dance and careful re-linking are needed.
> - **Doubly-linked lists**: each node points to both `next` *and* `prev` — that's a **cycle** of owning pointers, which single ownership forbids. You need `Rc<RefCell<Node>>` + `Weak` for the back-links ([reference cycles](#/ch/weak-cycles)), and it gets verbose and runtime-checked.
> - This friction is *the point*: linked lists are built on shared mutable aliasing, precisely the bug-prone pattern Rust makes you handle explicitly.

## The honest advice: usually, don't

> [!warning] Prefer `Vec` and `VecDeque` over linked lists — almost always
> Here's the pragmatic truth: on modern hardware, **`Vec` and `VecDeque` beat linked lists for nearly everything**, even operations linked lists are "supposed" to be good at. Why? Cache locality — a `Vec`'s contiguous memory is far friendlier to the CPU than chasing pointers scattered across the heap ([see arrays](#/ch/dsa-arrays)). Rust's `std::collections::LinkedList` exists, but its own docs recommend `Vec`/`VecDeque` instead. Build a linked list to *understand* pointers and ownership — reach for `Vec`/`VecDeque` in real code.

Linked lists genuinely win in only narrow cases: O(1) splicing of large sublists, or when you need stable addresses of elements that never move. For "a list of things," use a `Vec`.

## Complexity

| Operation | Linked list | `Vec` |
|-----------|-------------|-------|
| Push/pop front | O(1) | O(n) (`Vec`); O(1) (`VecDeque`) |
| Push/pop back | O(n)* / O(1) with tail | O(1) amortized |
| Index access | O(n) | **O(1)** |
| Cache friendliness | ❌ poor | ✅ excellent |

<small>*Without a tail pointer.</small>

## Summary

- A **linked list** chains **nodes** (value + pointer to next), modeled in Rust as **`Option<Box<Node>>`** — `Box` for the recursive size, `Option` for the end.
- **`Option::take()`** is the essential trick for restructuring links without violating ownership; front push/pop are clean **O(1)**.
- Rust makes linked lists *hard* because they rely on shared mutable aliasing — **doubly-linked** lists need `Rc<RefCell<>>` + `Weak` to break the owning cycle.
- **In practice, prefer `Vec`/`VecDeque`** — cache locality makes them faster for almost everything; even std recommends this. Build a linked list to *learn*, not to *ship*.

> [!exercise] Try it yourself
> 1. Add a `peek(&self) -> Option<&i32>` method to the `LinkedList` that returns the head value without removing it.
> 2. Add a `reverse(&mut self)` that reverses the list in place (hint: repeatedly `take` the head and re-link).
> 3. Explain in one sentence why a doubly-linked list needs `Weak` for its `prev` pointers.

Next, a structure that's fast *because* of clever indexing rather than pointers — the **hash table**, built from scratch.
