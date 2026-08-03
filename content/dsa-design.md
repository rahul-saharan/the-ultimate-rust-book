<h1><span class="h1-kicker">Data Structures & Algorithms</span>Designing Your Own Data Structures</h1>

You've met arrays, lists, trees, heaps, and hash maps. But sometimes the perfect structure for *your* problem isn't in the standard library — a bounded ring buffer, a stack that also reports its minimum in `O(1)`, a graph on a fixed grid. This chapter is about the *craft*: a repeatable process for designing a data structure, the Rust-specific choices that matter, and two fully worked examples you can run. By the end you'll be able to turn "I need something that does X fast" into a clean, correct type.

## The design process

Designing a structure is answering five questions, in order. Skipping the first three is why home-made structures end up slow or buggy.

<figure class="diagram">
<svg viewBox="0 0 680 130" role="img" aria-label="Five design steps: define the operations, pick complexity targets, choose a representation, state the invariants, then design the API">
  <style>
    .dp-b { font: 700 11px var(--font-sans); fill: var(--text); }
    .dp-c { font: 10.5px var(--font-sans); fill: var(--text-mute); }
    .s1 { fill: var(--blue-soft);   stroke: var(--blue);   stroke-width: 1.4; }
    .s2 { fill: var(--green-soft);  stroke: var(--green);  stroke-width: 1.4; }
    .s3 { fill: var(--amber-soft);  stroke: var(--amber);  stroke-width: 1.4; }
    .s4 { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.4; }
    .s5 { fill: var(--rust-100);    stroke: var(--rust-400); stroke-width: 1.4; }
  </style>
  <rect x="10"  y="40" width="120" height="50" rx="8" class="s1"/><text x="22" y="62" class="dp-b">1. Operations</text><text x="22" y="80" class="dp-c">what must it do?</text>
  <rect x="146" y="40" width="120" height="50" rx="8" class="s2"/><text x="158" y="62" class="dp-b">2. Complexity</text><text x="158" y="80" class="dp-c">how fast? (Big-O)</text>
  <rect x="282" y="40" width="120" height="50" rx="8" class="s3"/><text x="294" y="62" class="dp-b">3. Representation</text><text x="294" y="80" class="dp-c">backing storage</text>
  <rect x="418" y="40" width="120" height="50" rx="8" class="s4"/><text x="430" y="62" class="dp-b">4. Invariants</text><text x="430" y="80" class="dp-c">always-true rules</text>
  <rect x="554" y="40" width="116" height="50" rx="8" class="s5"/><text x="566" y="62" class="dp-b">5. API</text><text x="566" y="80" class="dp-c">safe methods</text>
  <path d="M130 65 L144 65" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#dpa)"/>
  <path d="M266 65 L280 65" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#dpa)"/>
  <path d="M402 65 L416 65" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#dpa)"/>
  <path d="M538 65 L552 65" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#dpa)"/>
  <defs><marker id="dpa" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>Decide <b>what</b> and <b>how fast</b> first; only then choose <b>how</b> to store it, the rules that must stay true, and the public methods.</figcaption>
</figure>

1. **Operations** — list exactly what callers need (`push`, `pop`, `peek`, `min`, `contains`, `range`). This is your spec.
2. **Complexity targets** — decide the Big-O each operation must hit. "`min` in `O(1)`" changes the whole design vs. "`min` in `O(n)` is fine."
3. **Representation** — pick the backing storage that can meet those targets (below).
4. **Invariants** — the properties that must *always* hold (e.g. "`len ≤ capacity`", "`mins.last()` is the minimum of `data`"). Every method must preserve them.
5. **API** — expose methods that make illegal states unreachable; keep fields private so the invariants can't be broken from outside.

## Choosing a representation

The backing store determines your complexity ceiling. The usual candidates:

| Backing store | Great at | Weak at |
|---|---|---|
| **`Vec<T>`** (contiguous) | index `O(1)`, push/pop back `O(1)`, cache-friendly scans | insert/remove in the middle `O(n)` |
| **`VecDeque<T>`** (ring) | push/pop at *both* ends `O(1)` | random insert `O(n)` |
| **`HashMap<K, V>`** | lookup/insert by key `O(1)` avg | no order, no range queries |
| **`BTreeMap<K, V>`** | sorted keys, range queries `O(log n)` | slower point lookups than hash |
| **linked nodes (via indices)** | `O(1)` splice given a handle | poor cache locality; more code |
| **combination** (e.g. map + list) | hit two targets at once (LRU cache!) | more invariants to maintain |

> [!key] Most custom structures are a `Vec` in disguise
> Before reaching for pointers or trees, ask whether a `Vec` (or two) can meet your targets — it usually can, and it's the fastest, simplest, most cache-friendly option. Heaps, stacks, queues, ring buffers, and even many "tree" structures are just a `Vec` with an indexing rule on top.

## The Rust angle: ownership shapes the design

Rust's ownership rules make some textbook designs (which assume free-floating pointers) awkward — and nudge you toward better ones.

- **Don't reach for `Rc<RefCell<Node>>` first.** Pointer-graph structures (doubly-linked lists, trees with parent pointers) fight the borrow checker. The idiomatic Rust answer is an **arena**: store all nodes in a `Vec` and use **`usize` indices** as "pointers." Indices are `Copy`, need no lifetimes, and can't dangle within the arena.
- **Encapsulate the invariants.** Keep fields private; the only way to mutate is through methods that preserve the invariants. This is Rust's version of "make illegal states unrepresentable."
- **Be generic where it's free.** `struct Thing<T>` works for any element type; add trait bounds (`T: Ord`, `T: Clone`) only on the methods that need them.
- **Implement the standard traits** so your type feels native: `Iterator`/`IntoIterator` for iteration, `Default`, `Debug`, and `FromIterator` for `collect()`.

Here's the arena idea in miniature — a singly-linked list with **indices instead of pointers**, which the borrow checker accepts happily:

```rust
struct Node<T> { value: T, next: Option<usize> } // `next` is an INDEX, not a pointer

struct List<T> { nodes: Vec<Node<T>>, head: Option<usize> }

impl<T> List<T> {
    fn new() -> Self { List { nodes: Vec::new(), head: None } }

    fn push_front(&mut self, value: T) {
        let idx = self.nodes.len();                 // the new node's slot
        self.nodes.push(Node { value, next: self.head });
        self.head = Some(idx);
    }

    fn iter(&self) -> impl Iterator<Item = &T> {
        let mut cur = self.head;
        std::iter::from_fn(move || {
            let i = cur?;                            // stop at None
            let node = &self.nodes[i];
            cur = node.next;
            Some(&node.value)
        })
    }
}

fn main() {
    let mut list = List::new();
    list.push_front(3);
    list.push_front(2);
    list.push_front(1);
    let items: Vec<_> = list.iter().collect();
    println!("{items:?}"); // [1, 2, 3]
}
```

## Worked example 1: a ring buffer

Let's design a **ring buffer** (a.k.a. circular queue): a fixed-capacity FIFO that overwrites nothing and wraps around a single `Vec`. It's the backbone of audio buffers, event queues, and rate limiters.

Following the process: **Operations** = `push` (back), `pop` (front), `len`, `is_full`. **Complexity** = every op `O(1)`. **Representation** = one `Vec` of `capacity` slots plus a `head` index and a `len`. **Invariant** = `len ≤ capacity`, and the live elements occupy `head, head+1, …` *modulo* capacity.

<figure class="diagram">
<svg viewBox="0 0 620 150" role="img" aria-label="A ring buffer stored in a fixed array where head marks the front and the tail wraps around modulo capacity">
  <style>
    .rb-b { font: 600 12px var(--font-mono); fill: var(--text); }
    .rb-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .empty { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
    .full  { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
  </style>
  <rect x="40"  y="50" width="70" height="44" class="empty"/><text x="66" y="77" class="rb-b">·</text><text x="66" y="112" class="rb-c" text-anchor="middle">0</text>
  <rect x="110" y="50" width="70" height="44" class="full"/><text x="136" y="77" class="rb-b">B</text><text x="145" y="112" class="rb-c" text-anchor="middle">1 ← head</text>
  <rect x="180" y="50" width="70" height="44" class="full"/><text x="206" y="77" class="rb-b">C</text><text x="215" y="112" class="rb-c" text-anchor="middle">2</text>
  <rect x="250" y="50" width="70" height="44" class="full"/><text x="276" y="77" class="rb-b">D</text><text x="285" y="112" class="rb-c" text-anchor="middle">3</text>
  <rect x="320" y="50" width="70" height="44" class="empty"/><text x="346" y="77" class="rb-b">·</text><text x="355" y="112" class="rb-c" text-anchor="middle">4 ← tail</text>
  <text x="430" y="66" class="rb-c">tail = (head + len) % capacity</text>
  <text x="430" y="86" class="rb-c">wraps past the end → back to 0</text>
  <path d="M390 40 C 430 20, 40 20, 75 44" stroke="var(--rust-500)" stroke-width="1.4" fill="none" marker-end="url(#rba)"/>
  <defs><marker id="rba" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker></defs>
</svg>
<figcaption>Front at <code>head</code>, next free slot at <code>(head + len) % capacity</code>; when it runs off the end it wraps to 0 — hence "ring."</figcaption>
</figure>

```rust
struct RingBuffer<T> {
    buf: Vec<Option<T>>, // fixed number of slots
    head: usize,         // index of the front element
    len: usize,          // how many elements are stored
}

impl<T> RingBuffer<T> {
    fn with_capacity(cap: usize) -> Self {
        let mut buf = Vec::with_capacity(cap);
        buf.resize_with(cap, || None); // fill with empty slots (no T: Clone needed)
        RingBuffer { buf, head: 0, len: 0 }
    }

    fn capacity(&self) -> usize { self.buf.len() }
    fn len(&self) -> usize { self.len }
    fn is_empty(&self) -> bool { self.len == 0 }
    fn is_full(&self) -> bool { self.len == self.capacity() }

    /// Push to the back. Returns false (and drops nothing) if full — invariant: len ≤ capacity.
    fn push(&mut self, value: T) -> bool {
        if self.is_full() { return false; }
        let tail = (self.head + self.len) % self.capacity(); // wrap!
        self.buf[tail] = Some(value);
        self.len += 1;
        true
    }

    /// Pop from the front.
    fn pop(&mut self) -> Option<T> {
        if self.is_empty() { return None; }
        let value = self.buf[self.head].take();       // vacate the slot
        self.head = (self.head + 1) % self.capacity(); // advance, wrapping
        self.len -= 1;
        value
    }
}

fn main() {
    let mut rb = RingBuffer::with_capacity(3);
    rb.push(1);
    rb.push(2);
    rb.push(3);
    println!("full? {}", rb.is_full());          // true
    println!("push when full: {}", rb.push(4));  // false — refused, nothing lost
    println!("pop: {:?}", rb.pop());             // Some(1)
    rb.push(4);                                   // fits now, wraps into slot 0
    let mut drained = vec![];
    while let Some(v) = rb.pop() { drained.push(v); }
    println!("drained in order: {:?}", drained); // [2, 3, 4]
}
```

Notice how the **invariant drives the code**: `push` checks `is_full` first, and both methods keep `head`/`len` consistent using modular arithmetic — the one idea that makes the "ring" work.

## Worked example 2: augmenting a structure (a min-stack)

A powerful design move is **augmentation**: take a structure you know and store a little extra bookkeeping so a new query becomes cheap. Classic challenge: a stack that also returns its **minimum in `O(1)`**. A naive `min` scans everything (`O(n)`); augmentation beats it.

The trick: alongside the data stack, keep a second stack of "the minimum so far." Its top is always the current minimum — that's the invariant.

<figure class="diagram">
<svg viewBox="0 0 560 160" role="img" aria-label="A min-stack keeps a data stack and a parallel mins stack whose top is always the current minimum">
  <style>
    .ms-b { font: 600 12px var(--font-mono); fill: var(--text); }
    .ms-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .d { fill: var(--blue-soft);  stroke: var(--blue);  stroke-width: 1.4; }
    .m { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.4; }
  </style>
  <text x="70" y="28" class="ms-c" fill="var(--blue)">data</text>
  <rect x="40" y="34" width="90" height="26" class="d"/><text x="76" y="52" class="ms-b">5</text>
  <rect x="40" y="62" width="90" height="26" class="d"/><text x="76" y="80" class="ms-b">2</text>
  <rect x="40" y="90" width="90" height="26" class="d"/><text x="76" y="108" class="ms-b">7 ← top</text>
  <text x="250" y="28" class="ms-c" fill="var(--green)">mins (min so far)</text>
  <rect x="250" y="34" width="90" height="26" class="m"/><text x="286" y="52" class="ms-b">5</text>
  <rect x="250" y="62" width="90" height="26" class="m"/><text x="286" y="80" class="ms-b">2</text>
  <rect x="250" y="90" width="90" height="26" class="m"/><text x="286" y="108" class="ms-b">2 ← min</text>
  <text x="40" y="140" class="ms-c">push x → also push min(x, current min). pop → pop both. min() = mins.top, O(1).</text>
</svg>
<figcaption>A parallel <code>mins</code> stack whose top mirrors the running minimum turns an O(n) query into O(1).</figcaption>
</figure>

```rust
struct MinStack {
    data: Vec<i32>,
    mins: Vec<i32>, // mins[i] == minimum of data[0..=i]  (the invariant)
}

impl MinStack {
    fn new() -> Self { MinStack { data: Vec::new(), mins: Vec::new() } }

    fn push(&mut self, x: i32) {
        let new_min = self.mins.last().map_or(x, |&m| m.min(x));
        self.data.push(x);
        self.mins.push(new_min); // keep the two stacks in lockstep
    }

    fn pop(&mut self) -> Option<i32> {
        self.mins.pop();     // pop both together to preserve the invariant
        self.data.pop()
    }

    fn top(&self) -> Option<i32> { self.data.last().copied() }
    fn min(&self) -> Option<i32> { self.mins.last().copied() } // O(1)!
}

fn main() {
    let mut s = MinStack::new();
    s.push(5);
    s.push(2);
    s.push(7);
    println!("min = {:?}", s.min()); // Some(2)
    s.pop();                         // removes 7
    s.pop();                         // removes 2
    println!("min = {:?}", s.min()); // Some(5) — the invariant restored it for free
}
```

The lesson generalizes: **store the answer to your expensive query incrementally as the structure changes**, and reads become `O(1)`. The same idea powers order-statistic trees, monotonic queues (sliding-window max), and segment trees.

> [!best] Test the invariant, not just the happy path
> A custom structure is only as good as its invariants. Write tests that hammer the edges — fill to capacity, drain to empty, wrap the ring around several times, push/pop in interleaved patterns — and assert the invariant holds throughout. A quick way is a **model test**: run random operations against both your structure and a simple reference (e.g. a `Vec`/`VecDeque`) and assert they agree. Reach for `#[derive(Debug)]` so failures print clearly.

## When *not* to build your own

> [!warning] Prefer the standard library and vetted crates
> Building a structure is a great way to *learn*, and occasionally the right call for a hot, specialized need — but for production, reach for `std` (`Vec`, `VecDeque`, `HashMap`, `BTreeMap`, `BinaryHeap`) or a proven crate (`indexmap`, `slotmap`, `petgraph`, `hashbrown`) first. They're faster, battle-tested, and handle the edge cases you'll forget. Hand-roll only when profiling shows a real need the library can't meet — and then, test it hard.

## Summary

- Design in order: **operations → complexity targets → representation → invariants → API**. The first two are a spec; the rest implement it.
- Pick the **backing store** that can hit your Big-O targets — usually a `Vec` (or two); use `VecDeque`, `HashMap`/`BTreeMap`, or combinations when the targets demand it.
- In Rust, avoid `Rc<RefCell<Node>>` graphs; use an **arena of `Vec` + `usize` indices**, keep fields **private** to protect invariants, be **generic**, and implement `Iterator`/`Debug`/`Default` so the type feels native.
- **Invariants drive the code** — every method must preserve them (the ring buffer's modular arithmetic; the min-stack's parallel stack).
- **Augmentation** — store extra bookkeeping so an expensive query becomes `O(1)`.
- **Test the invariants** with edge cases and model checks; prefer `std`/vetted crates in production and hand-roll only when profiling justifies it.

> [!exercise] Try it yourself
> 1. Add an `iter()` to `RingBuffer` that yields elements front-to-back (walk `head` forward `len` times, wrapping).
> 2. Extend `MinStack` with a `max()` in `O(1)` using a second auxiliary stack.
> 3. Design a fixed-size **LRU cache** with `get`/`put` in `O(1)` using a `HashMap` plus a `VecDeque` (or an index-based linked list) for recency order.
> 4. Write a model test that runs 1000 random `push`/`pop`s against your `RingBuffer` and a `VecDeque`, asserting they always agree.

That completes the data-structures-and-algorithms journey: you can now analyze, choose, use, *and build* the right structure for any problem.
