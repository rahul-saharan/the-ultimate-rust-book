<h1><span class="h1-kicker">Smart Pointers</span>Rc, Arc & Shared Ownership</h1>

Ownership's rule of "exactly one owner" is usually exactly right. But sometimes a value genuinely needs **several** owners — a node in a graph pointed to by many edges, a configuration shared across your whole program — and it should live until the *last* owner is done with it. That's what **`Rc<T>`** (reference counted) and its thread-safe sibling **`Arc<T>`** (atomically reference counted) provide.

## The idea: counting owners

`Rc<T>` keeps a running count of how many owners a piece of data has. Cloning an `Rc` doesn't copy the data — it just bumps the count and hands back another handle to the *same* data. When an `Rc` is dropped, the count goes down. When it hits **zero**, the data is finally freed.

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="Three Rc handles all point to the same heap data, which has a reference count of three">
  <style>
    .rm { font: 600 12px var(--font-mono); fill: var(--text); }
    .rc2 { font: 11px var(--font-sans); fill: var(--text-mute); }
    .own { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .datb { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 2; }
  </style>
  <rect x="20" y="20" width="90" height="28" class="own"/><text x="34" y="39" class="rm">a</text>
  <rect x="20" y="60" width="90" height="28" class="own"/><text x="34" y="79" class="rm">b</text>
  <rect x="20" y="100" width="90" height="28" class="own"/><text x="34" y="119" class="rm">c</text>
  <rect x="380" y="52" width="200" height="46" class="datb"/>
  <text x="398" y="72" class="rm">"shared data"</text>
  <text x="398" y="90" class="rc2">strong_count = 3</text>
  <path d="M112 34 C 260 34, 300 68, 378 72" stroke="var(--rust-500)" stroke-width="2" fill="none" marker-end="url(#arc1)"/>
  <path d="M112 74 L378 74" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#arc1)"/>
  <path d="M112 114 C 260 114, 300 82, 378 78" stroke="var(--rust-500)" stroke-width="2" fill="none" marker-end="url(#arc1)"/>
  <text x="130" y="150" class="rc2">Three owners, one allocation. Freed only when the count reaches 0.</text>
  <defs><marker id="arc1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker></defs>
</svg>
<figcaption><code>Rc&lt;T&gt;</code> lets several handles co-own one allocation; the data lives until the last owner drops.</figcaption>
</figure>

## Using `Rc` and watching the count

You share an `Rc` with `Rc::clone`, and you can inspect the live count with `Rc::strong_count`:

```rust
use std::rc::Rc;

fn main() {
    let a = Rc::new(String::from("shared config"));
    println!("count = {}", Rc::strong_count(&a)); // 1

    let b = Rc::clone(&a); // NOT a deep copy — just another owner
    println!("count = {}", Rc::strong_count(&a)); // 2

    {
        let c = Rc::clone(&a);
        println!("count = {}", Rc::strong_count(&a)); // 3
    } // c drops here → count goes back down

    println!("count = {}", Rc::strong_count(&a)); // 2
    println!("value is still: {a}");               // all handles see the same data
}
```

> [!key] `Rc::clone` is cheap — it doesn't copy the data
> `Rc::clone(&a)` only increments a counter and returns a new pointer to the *same* allocation. It does **not** duplicate the underlying value (that would be `(*a).clone()`). This is why sharing via `Rc` is fast even for large data. By convention we write `Rc::clone(&a)` rather than `a.clone()` precisely to signal "cheap refcount bump," not "expensive deep copy."

> [!jargon] "Strong" count?
> Rc tracks two counts: a **strong count** (owners that keep the data alive) and a **weak count** (non-owning references that don't). We'll meet weak references in the [cycles chapter](#/ch/weak-cycles). For now, "the count" means the strong count — the number of true owners.

## `Rc` shares *immutable* data

Here's a crucial constraint: `Rc<T>` only gives you **shared, read-only** access to the data. You can't get a `&mut` through an `Rc`, because that would let one owner mutate data others are reading — violating the borrowing rules:

```rust,ignore
use std::rc::Rc;
fn main() {
    let a = Rc::new(vec![1, 2, 3]);
    let b = Rc::clone(&a);
    a.push(4); // ❌ cannot borrow as mutable — Rc gives shared access only
}
```

To get *shared* ownership **and** mutability, you pair `Rc` with a type that provides *interior mutability* — usually `Rc<RefCell<T>>`. That combination is so common it gets its own [chapter next](#/ch/refcell).

## `Rc` is single-threaded; use `Arc` across threads

`Rc` updates its counter with plain, non-atomic operations — fast, but unsafe if two threads touched it at once. So `Rc` is **not** shareable between threads (the compiler enforces this). When you need shared ownership *across threads*, use **`Arc<T>`** — the **A**tomically reference counted pointer. Its API is identical; only the counter is thread-safe:

```rust
use std::sync::Arc;
use std::thread;

fn main() {
    let data = Arc::new(vec![1, 2, 3]);
    let mut handles = vec![];

    for id in 0..3 {
        let data = Arc::clone(&data); // each thread gets its own owning handle
        handles.push(thread::spawn(move || {
            println!("thread {id} sees {:?}", data);
        }));
    }

    for h in handles {
        h.join().unwrap();
    }
    println!("final count = {}", Arc::strong_count(&data)); // back to 1
}
```

> [!performance] Prefer `Rc`, upgrade to `Arc` only when crossing threads
> `Arc`'s atomic counter updates are slightly more expensive than `Rc`'s plain ones. So use **`Rc`** for single-threaded sharing and reach for **`Arc`** only when the data must cross thread boundaries. Don't reach for `Arc` "just in case" — the compiler will tell you the moment you actually need it (`Rc` won't compile in a `thread::spawn`).

> [!best] The mental model
> Think of the four in a grid:
> - Single owner, one thread → **`Box<T>`**
> - Many owners, one thread → **`Rc<T>`**
> - Many owners, across threads → **`Arc<T>`**
> - Need to *mutate* shared data → wrap the inner type: **`Rc<RefCell<T>>`** (one thread) or **`Arc<Mutex<T>>`** (across threads).
>
> This grid answers "which pointer?" almost every time.

## Summary

- **`Rc<T>`** enables **shared ownership**: several handles co-own one heap allocation, freed only when the last owner drops.
- **`Rc::clone`** is a cheap **reference-count bump**, not a deep copy; inspect owners with **`Rc::strong_count`**.
- `Rc` gives **read-only** shared access — combine with `RefCell` for shared *mutable* data.
- **`Arc<T>`** is the thread-safe version (atomic counter); use it only when sharing **across threads**, since it's slightly costlier.
- Choose with the grid: `Box` (one owner), `Rc` (shared, one thread), `Arc` (shared, many threads), plus `RefCell`/`Mutex` to mutate.

> [!exercise] Try it yourself
> 1. Create an `Rc<String>`, clone it three times, and print `strong_count` after each clone and after one is dropped in an inner scope.
> 2. Try to `push` to an `Rc<Vec<i32>>` and read the error — then predict what wrapper you'd need to make it work.
> 3. Share an `Arc<Vec<i32>>` across four threads that each print its sum.

`Rc` shares data but keeps it immutable. To mutate shared data safely, we need a way to bend the borrowing rules *at runtime* — **interior mutability with `RefCell`**.
