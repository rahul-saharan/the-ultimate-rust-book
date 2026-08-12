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

## The three-pointer dance: reversing in place

Reversing a list is *the* classic linked-list exercise, and in Rust the `.take()` trick carries it. You walk the list once, flipping each `next` pointer to face backwards:

<figure class="diagram">
<svg viewBox="0 0 640 220" role="img" aria-label="Reversing a linked list one node at a time using three pointers named prev, current and the saved rest of the list">
  <style>
    .rv-h { font: 700 11.5px var(--font-sans); fill: var(--text); }
    .rv-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .rv-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .rv-n { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
    .rv-cur { fill: var(--rust-100); stroke: var(--rust-500); stroke-width: 2; }
    .rv-done { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.6; }
  </style>
  <text x="20" y="16" class="rv-h">start — everything points forward</text>
  <rect x="20" y="26" width="56" height="26" rx="3" class="rv-cur"/><text x="38" y="44" class="rv-m">1</text>
  <rect x="100" y="26" width="56" height="26" rx="3" class="rv-n"/><text x="118" y="44" class="rv-m">2</text>
  <rect x="180" y="26" width="56" height="26" rx="3" class="rv-n"/><text x="198" y="44" class="rv-m">3</text>
  <path d="M78 39 L98 39" stroke="var(--text-mute)" stroke-width="1.6" marker-end="url(#arr-rev)"/>
  <path d="M158 39 L178 39" stroke="var(--text-mute)" stroke-width="1.6" marker-end="url(#arr-rev)"/>
  <text x="252" y="34" class="rv-c">prev = None</text>
  <text x="252" y="48" class="rv-c">cur = node 1</text>
  <text x="20" y="86" class="rv-h">after one step — node 1's pointer is flipped</text>
  <rect x="20" y="96" width="56" height="26" rx="3" class="rv-done"/><text x="38" y="114" class="rv-m">1</text>
  <rect x="100" y="96" width="56" height="26" rx="3" class="rv-cur"/><text x="118" y="114" class="rv-m">2</text>
  <rect x="180" y="96" width="56" height="26" rx="3" class="rv-n"/><text x="198" y="114" class="rv-m">3</text>
  <path d="M98 109 L78 109" stroke="var(--green)" stroke-width="2" marker-end="url(#arr-rev2)"/>
  <path d="M158 109 L178 109" stroke="var(--text-mute)" stroke-width="1.6" marker-end="url(#arr-rev)"/>
  <text x="252" y="104" class="rv-c">prev = node 1 (reversed part)</text>
  <text x="252" y="118" class="rv-c">cur = node 2 (rest, untouched)</text>
  <text x="20" y="156" class="rv-h">done — prev is the new head</text>
  <rect x="20" y="166" width="56" height="26" rx="3" class="rv-done"/><text x="38" y="184" class="rv-m">1</text>
  <rect x="100" y="166" width="56" height="26" rx="3" class="rv-done"/><text x="118" y="184" class="rv-m">2</text>
  <rect x="180" y="166" width="56" height="26" rx="3" class="rv-done"/><text x="198" y="184" class="rv-m">3</text>
  <path d="M98 179 L78 179" stroke="var(--green)" stroke-width="2" marker-end="url(#arr-rev2)"/>
  <path d="M178 179 L158 179" stroke="var(--green)" stroke-width="2" marker-end="url(#arr-rev2)"/>
  <text x="252" y="174" class="rv-c">cur = None → loop ends</text>
  <text x="252" y="188" class="rv-c">head = prev = node 3</text>
  <text x="20" y="212" class="rv-c">The saved <tspan font-family="var(--font-mono)">rest</tspan> is essential: overwrite <tspan font-family="var(--font-mono)">node.next</tspan> before saving it and you lose the remainder of the list.</text>
  <defs>
    <marker id="arr-rev" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker>
    <marker id="arr-rev2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--green)"/></marker>
  </defs>
</svg>
<figcaption>Reversal walks the list once, flipping each pointer. <b>Save the rest first</b>, then re-point, then advance.</figcaption>
</figure>

```rust
struct Node {
    value: i32,
    next: Option<Box<Node>>,
}

struct List {
    head: Option<Box<Node>>,
}

impl List {
    fn new() -> Self {
        List { head: None }
    }

    fn push_front(&mut self, value: i32) {
        self.head = Some(Box::new(Node { value, next: self.head.take() }));
    }

    /// Build from values in order, so [1,2,3] really reads 1 → 2 → 3.
    fn from_values(values: &[i32]) -> Self {
        let mut list = List::new();
        for &v in values.iter().rev() {
            list.push_front(v);
        }
        list
    }

    /// Reverse in place — O(n) time, O(1) extra space.
    fn reverse(&mut self) {
        let mut prev: Option<Box<Node>> = None;
        let mut current = self.head.take();

        while let Some(mut node) = current {
            current = node.next.take(); // 1. save the rest
            node.next = prev;           // 2. flip this pointer backwards
            prev = Some(node);          // 3. this node joins the reversed part
        }
        self.head = prev;
    }

    /// Middle element via slow/fast pointers — one pass, no length needed.
    fn middle(&self) -> Option<i32> {
        let mut slow = self.head.as_deref();
        let mut fast = self.head.as_deref();
        while let Some(f) = fast {
            fast = f.next.as_deref();
            if let Some(f2) = fast {
                fast = f2.next.as_deref();
                slow = slow.and_then(|s| s.next.as_deref());
            }
        }
        slow.map(|n| n.value)
    }

    fn to_vec(&self) -> Vec<i32> {
        let mut out = Vec::new();
        let mut cur = self.head.as_deref();
        while let Some(n) = cur {
            out.push(n.value);
            cur = n.next.as_deref();
        }
        out
    }
}

fn main() {
    let mut list = List::from_values(&[1, 2, 3, 4, 5]);
    println!("original  {:?}", list.to_vec());
    println!("middle    {:?}", list.middle());

    list.reverse();
    println!("reversed  {:?}", list.to_vec());

    // With an even count there are two middles; this returns the second.
    println!("middle of [1,2,3,4] = {:?}", List::from_values(&[1, 2, 3, 4]).middle());
}
```

> [!key] Slow and fast pointers find the middle in one pass
> Advance one pointer by one node and another by two. When the fast one runs off the end, the slow one is at the middle — no need to know the length, and no second traversal. This **two-speed** idea is the basis of several list algorithms: the middle, "is this a palindrome?", "find the nth node from the end", and cycle detection below. Whenever a list problem seems to need the length first, ask whether two pointers at different speeds would avoid that.

## Cycle detection — and why a `Box` list can't have one

<figure class="diagram">
<svg viewBox="0 0 640 200" role="img" aria-label="Floyd's tortoise and hare algorithm: a slow pointer moving one step and a fast pointer moving two steps inevitably meet inside a cycle">
  <style>
    .fl-h { font: 700 11.5px var(--font-sans); fill: var(--text); }
    .fl-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .fl-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .fl-n { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
    .fl-e { fill: var(--rust-100); stroke: var(--rust-500); stroke-width: 2; }
  </style>
  <text x="20" y="16" class="fl-h">a list whose tail links back into the middle</text>
  <circle cx="45" cy="60" r="14" class="fl-n"/><text x="41" y="64" class="fl-m">1</text>
  <circle cx="105" cy="60" r="14" class="fl-n"/><text x="101" y="64" class="fl-m">2</text>
  <circle cx="165" cy="60" r="14" class="fl-e"/><text x="161" y="64" class="fl-m">3</text>
  <circle cx="225" cy="60" r="14" class="fl-n"/><text x="221" y="64" class="fl-m">4</text>
  <circle cx="285" cy="60" r="14" class="fl-n"/><text x="281" y="64" class="fl-m">5</text>
  <path d="M59 60 L91 60" stroke="var(--text-mute)" stroke-width="1.6" marker-end="url(#arr-fl)"/>
  <path d="M119 60 L151 60" stroke="var(--text-mute)" stroke-width="1.6" marker-end="url(#arr-fl)"/>
  <path d="M179 60 L211 60" stroke="var(--text-mute)" stroke-width="1.6" marker-end="url(#arr-fl)"/>
  <path d="M239 60 L271 60" stroke="var(--text-mute)" stroke-width="1.6" marker-end="url(#arr-fl)"/>
  <path d="M285 74 C 285 110, 165 110, 165 76" stroke="var(--rust-500)" stroke-width="2" fill="none" marker-end="url(#arr-fl2)"/>
  <text x="188" y="106" class="fl-c" fill="var(--rust-600)">tail loops back to node 3</text>
  <text x="330" y="44" class="fl-c">slow moves 1 step, fast moves 2.</text>
  <text x="330" y="58" class="fl-c">Inside the loop, fast gains 1 step per</text>
  <text x="330" y="72" class="fl-c">iteration on slow — so it must catch up.</text>
  <text x="330" y="92" class="fl-c">They meet ⇒ there is a cycle.</text>
  <text x="330" y="106" class="fl-c">fast hits None ⇒ there is not.</text>
  <text x="20" y="146" class="fl-h">Finding <tspan font-style="italic">where</tspan> the cycle starts</text>
  <text x="20" y="164" class="fl-c">After they meet, move one pointer back to the head and advance both one step at a time.</text>
  <text x="20" y="178" class="fl-c">The node where they meet again is the cycle's entry point — here, node 3.</text>
  <text x="20" y="196" class="fl-c">O(n) time, <tspan font-weight="700">O(1) space</tspan> — no visited set required.</text>
  <defs>
    <marker id="arr-fl" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker>
    <marker id="arr-fl2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--rust-500)"/></marker>
  </defs>
</svg>
<figcaption><b>Floyd's tortoise and hare</b>: two pointers at different speeds detect a cycle in O(1) space, then locate its entry.</figcaption>
</figure>

> [!key] `Option<Box<Node>>` makes cycles *impossible* — that's a feature
> Every node **owns** its successor, and ownership forms a tree. To close a loop, some node would have to be owned twice, which `Box` forbids at compile time. So a safe `Box`-based list is *structurally acyclic*: you cannot write the bug that Floyd's algorithm detects. Cycle detection matters when links are **indices** into an arena, or `Rc`/`Weak` handles — both of which can point anywhere. That's the trade: indices are flexible and can be wrong; `Box` is rigid and can't.

```rust
/// An index-based list, where a cycle IS expressible.
struct Arena {
    value: Vec<i32>,
    next: Vec<Option<usize>>,
}

impl Arena {
    /// Chain the values in order; `cycle_to` makes the tail point back.
    fn new(values: &[i32], cycle_to: Option<usize>) -> Self {
        let n = values.len();
        let mut next: Vec<Option<usize>> =
            (0..n).map(|i| if i + 1 < n { Some(i + 1) } else { None }).collect();
        if let Some(target) = cycle_to {
            next[n - 1] = Some(target);
        }
        Arena { value: values.to_vec(), next }
    }

    /// Floyd's tortoise and hare — O(n) time, O(1) space.
    /// Returns the index where the cycle begins, if there is one.
    fn find_cycle_start(&self) -> Option<usize> {
        let (mut slow, mut fast) = (Some(0usize), Some(0usize));

        // Phase 1: do they ever meet?
        loop {
            slow = self.next[slow?];
            fast = self.next[self.next[fast?]?]; // two steps; `?` exits if we hit None
            if slow? == fast? {
                break;
            }
        }

        // Phase 2: one pointer back to the head, then step both together.
        let mut from_head = 0usize;
        let mut from_meeting = slow?;
        while from_head != from_meeting {
            from_head = self.next[from_head]?;
            from_meeting = self.next[from_meeting]?;
        }
        Some(from_head)
    }

    fn has_cycle(&self) -> bool {
        self.find_cycle_start().is_some()
    }
}

fn main() {
    let plain = Arena::new(&[1, 2, 3, 4, 5], None);
    println!("plain list  — cycle? {}", plain.has_cycle());

    let looped = Arena::new(&[1, 2, 3, 4, 5], Some(2));
    println!("looped list — cycle? {}", looped.has_cycle());
    let start = looped.find_cycle_start().unwrap();
    println!("  cycle begins at index {start} (value {})", looped.value[start]);

    let self_loop = Arena::new(&[7], Some(0));
    println!("self-loop   — begins at {:?}", self_loop.find_cycle_start());
}
```

> [!deep] Why phase two lands exactly on the cycle entry
> Let `m` be the distance from the head to the cycle entry, and `c` the cycle's length. When the two pointers meet, the slow one has travelled some distance `d`, the fast one `2d`, and their difference `d` must be a whole number of laps: `d = k·c`. So the slow pointer is `k·c` steps from the head — meaning it is *exactly* `m` steps short of having gone `m + k·c`. Walking `m` more steps from either the head or the meeting point therefore arrives at the same node: the entry. That's why phase two needs no arithmetic at all, just two pointers moving in lockstep.

## Merging two sorted lists

Merging is where linked lists genuinely shine: you re-link existing nodes rather than copying, so it's O(1) extra space. It's also the merge step of [merge sort](#/ch/dsa-divide-conquer).

```rust
struct Node {
    value: i32,
    next: Option<Box<Node>>,
}

struct List {
    head: Option<Box<Node>>,
}

impl List {
    fn new() -> Self {
        List { head: None }
    }

    fn from_values(values: &[i32]) -> Self {
        let mut list = List::new();
        for &v in values.iter().rev() {
            list.head = Some(Box::new(Node { value: v, next: list.head.take() }));
        }
        list
    }

    fn to_vec(&self) -> Vec<i32> {
        let mut out = Vec::new();
        let mut cur = self.head.as_deref();
        while let Some(n) = cur {
            out.push(n.value);
            cur = n.next.as_deref();
        }
        out
    }

    /// Merge two sorted lists into one, reusing the nodes.
    /// `tail` is a &mut to the slot where the next node goes — the idiomatic
    /// way to append without a dummy head or unsafe.
    fn merge_sorted(mut a: List, mut b: List) -> List {
        let mut out = List::new();
        let mut tail: &mut Option<Box<Node>> = &mut out.head;

        loop {
            let take_from_a = match (a.head.as_ref(), b.head.as_ref()) {
                (Some(x), Some(y)) => x.value <= y.value, // <= keeps it stable
                (Some(_), None) => true,
                (None, Some(_)) => false,
                (None, None) => break,
            };

            let source = if take_from_a { &mut a.head } else { &mut b.head };
            let mut node = source.take().expect("checked above");
            *source = node.next.take(); // detach it from its list
            *tail = Some(node);         // attach it to the output
            tail = &mut tail.as_mut().expect("just assigned").next;
        }
        out
    }
}

fn main() {
    let a = List::from_values(&[1, 4, 7]);
    let b = List::from_values(&[2, 3, 9]);
    println!("merged {:?}", List::merge_sorted(a, b).to_vec());
}
```

## Giving your list an iterator

This is where building a list in Rust genuinely teaches you something no other language does. Implementing `Iterator` turns your type into a first-class citizen — `for` loops, `.map()`, `.sum()`, and every other adapter start working:

```rust
struct Node {
    value: i32,
    next: Option<Box<Node>>,
}

struct List {
    head: Option<Box<Node>>,
}

/// Borrowing iterator: holds a reference to the current node.
struct Iter<'a> {
    current: Option<&'a Node>,
}

impl<'a> Iterator for Iter<'a> {
    type Item = &'a i32;
    fn next(&mut self) -> Option<Self::Item> {
        self.current.map(|node| {
            self.current = node.next.as_deref(); // advance
            &node.value
        })
    }
}

/// Consuming iterator: pops the list apart as it goes.
struct IntoIter(List);

impl Iterator for IntoIter {
    type Item = i32;
    fn next(&mut self) -> Option<i32> {
        self.0.head.take().map(|node| {
            self.0.head = node.next;
            node.value
        })
    }
}

impl List {
    fn from_values(values: &[i32]) -> Self {
        let mut list = List { head: None };
        for &v in values.iter().rev() {
            list.head = Some(Box::new(Node { value: v, next: list.head.take() }));
        }
        list
    }
    fn iter(&self) -> Iter<'_> {
        Iter { current: self.head.as_deref() }
    }
    fn into_iter(self) -> IntoIter {
        IntoIter(self)
    }
}

fn main() {
    let list = List::from_values(&[1, 2, 3, 4, 5]);

    // Every iterator adapter now works, for free.
    println!("collected {:?}", list.iter().copied().collect::<Vec<_>>());
    println!("sum       {}", list.iter().sum::<i32>());
    println!("evens     {:?}", list.iter().filter(|v| *v % 2 == 0).collect::<Vec<_>>());
    println!("max       {:?}", list.iter().max());

    for v in list.into_iter() {
        print!("{v} ");
    }
    println!();
}
```

> [!best] `as_deref()` is the method that makes list iterators pleasant
> Walking a list needs to turn an `&Option<Box<Node>>` into an `Option<&Node>`, and writing that by hand is noisy: `self.head.as_ref().map(|b| &**b)`. **`as_deref()`** does exactly that in one call, and it's the reason the traversal code above reads cleanly. It works because `Box<Node>` derefs to `Node` — see [Deref & Drop](#/ch/deref-drop). Keep it in mind for any `Option<Box<T>>`, `Option<String>`, or `Option<Vec<T>>` you need to peer inside.

## The recursive-drop trap

Here's a genuine Rust-specific hazard that the elegant ownership story hides:

```rust
struct Node {
    value: i32,
    next: Option<Box<Node>>,
}

struct List {
    head: Option<Box<Node>>,
}

impl List {
    fn new() -> Self {
        List { head: None }
    }
    fn push_front(&mut self, value: i32) {
        self.head = Some(Box::new(Node { value, next: self.head.take() }));
    }
}

/// Without this, dropping the list recurses once per node and overflows
/// the stack on a long list. Popping in a loop keeps it iterative.
impl Drop for List {
    fn drop(&mut self) {
        let mut current = self.head.take();
        while let Some(mut node) = current {
            current = node.next.take(); // node is freed here, no recursion
        }
    }
}

fn main() {
    let mut list = List::new();
    for i in 0..500_000 {
        list.push_front(i);
    }
    println!("built a 500,000-node list");
    drop(list);
    println!("dropped it iteratively — no stack overflow ✅");
}
```

> [!warning] The automatic drop of a long list overflows the stack
> Earlier we praised automatic cleanup: dropping the head drops its `next`, which drops *its* next, and so on. That's true — and it's **recursive**. Each nested `Box` drop is another stack frame, so a list of half a million nodes aborts with `fatal runtime error: stack overflow` rather than panicking cleanly. I confirmed this: remove the `Drop` impl above and the program dies. Any linked structure you build in Rust needs a hand-written **iterative `Drop`** like this one, and this is precisely why `std::collections::LinkedList` has one. It's the hazard nobody mentions when they show off how neatly ownership frees a list.

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
- **Reverse** with three pointers: save the rest, flip the pointer, advance. **`as_deref()`** keeps traversal code readable.
- **Slow and fast pointers** find the middle, the nth-from-end, and cycles in one pass with O(1) space.
- **`Option<Box<Node>>` cannot form a cycle** — ownership forbids it. Floyd's tortoise and hare matters for **index-** or `Rc`-based links, where a loop *is* expressible.
- **Merging** sorted lists re-links nodes in O(1) space; the `&mut Option<Box<Node>>` tail cursor appends without a dummy head or `unsafe`.
- Implementing **`Iterator`** unlocks every adapter (`map`, `sum`, `filter`) for free — the part of this exercise that genuinely teaches Rust.
- **Write an iterative `Drop`.** The automatic recursive drop overflows the stack on long lists; 500,000 nodes is enough to abort.
- Rust makes linked lists *hard* because they rely on shared mutable aliasing — **doubly-linked** lists need `Rc<RefCell<>>` + `Weak` to break the owning cycle.
- **In practice, prefer `Vec`/`VecDeque`** — cache locality makes them faster for almost everything; even std recommends this. Build a linked list to *learn*, not to *ship*.

> [!exercise] Try it yourself
> 1. Add a `peek(&self) -> Option<&i32>` method that returns the head value without removing it.
> 2. Add `push_back` and `len` in O(1) by keeping a `tail` pointer and a counter. Why is the tail pointer awkward with `Box`, and what would you need instead?
> 3. Explain in one sentence why a doubly-linked list needs `Weak` for its `prev` pointers.
> 4. Write `nth_from_end(&self, n: usize)` in a single pass using two pointers spaced `n` apart.
> 5. Use slow/fast pointers plus `reverse` to test whether a list is a **palindrome** in O(n) time and O(1) space.
> 6. Delete the `Drop` impl from the last example and run it. What exactly does it print, and why is that not a normal panic?
> 7. Add an `iter_mut()` returning `Iterator<Item = &mut i32>` and double every value in place. (This one is genuinely harder than `iter()` — think about why.)
> 8. Implement `split_at(&mut self, n)` returning the second half as a new list in O(n) time and O(1) space. This is the operation linked lists actually beat `Vec` at.

Next, a structure that's fast *because* of clever indexing rather than pointers — the **hash table**, built from scratch.
