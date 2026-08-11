<h1><span class="h1-kicker">Smart Pointers</span>Rc, Arc & Shared Ownership</h1>

Ownership's rule of "exactly one owner" is usually exactly right. But sometimes a value genuinely needs **several** owners — a node in a graph pointed to by many edges, a configuration shared across your whole program — and it should live until the *last* owner is done with it. That's what **`Rc<T>`** (reference counted) and its thread-safe sibling **`Arc<T>`** (atomically reference counted) provide.

## Why single ownership isn't always enough

With `Box<T>`, exactly one variable owns the data and the compiler knows statically when it dies. That works whenever ownership forms a **tree** — every value has one parent. It breaks down the moment your data forms a **graph**:

- A cache where several parts of the program hold the same entry.
- A GUI where a widget appears in both a layout tree and a focus list.
- A parsed document where many nodes reference one shared symbol table.
- Configuration that every module reads but none of them owns.

In each case the question "who should free this?" has no single right answer at compile time — it depends on which handle happens to die last. Reference counting answers it **at runtime**: the data is freed by whoever turns out to be last.

> [!key] Reference counting moves an ownership decision from compile time to runtime
> That's the whole trade. `Box` costs nothing because the compiler works out the lifetime statically. `Rc` costs a counter and a little bookkeeping because it works it out *dynamically*. You reach for `Rc` precisely when the answer genuinely can't be known until the program runs — and not before, because the static answer is always cheaper.

## The idea: counting owners

`Rc<T>` keeps a running count of how many owners a piece of data has. Cloning an `Rc` doesn't copy the data — it just bumps the count and hands back another handle to the *same* data. When an `Rc` is dropped, the count goes down. When it hits **zero**, the data is finally freed.

<figure class="diagram">
<svg viewBox="0 0 640 215" role="img" aria-label="Three Rc handles on the stack all point to a single heap allocation containing a strong count, a weak count and the data itself">
  <style>
    .rm { font: 600 12px var(--font-mono); fill: var(--text); }
    .rc2 { font: 11px var(--font-sans); fill: var(--text-mute); }
    .rh { font: 700 12px var(--font-sans); }
    .own { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .datb { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 2; }
    .cnt { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
  </style>
  <text x="20" y="18" class="rh" fill="var(--blue)">STACK — three handles, 8 bytes each</text>
  <rect x="20" y="28" width="90" height="26" class="own"/><text x="34" y="46" class="rm">a</text>
  <rect x="20" y="62" width="90" height="26" class="own"/><text x="34" y="80" class="rm">b</text>
  <rect x="20" y="96" width="90" height="26" class="own"/><text x="34" y="114" class="rm">c</text>
  <text x="330" y="18" class="rh" fill="var(--rust-600)">HEAP — ONE allocation (the "RcBox")</text>
  <rect x="330" y="28" width="270" height="26" class="cnt"/><text x="342" y="46" class="rm">strong = 3</text>
  <rect x="330" y="54" width="270" height="26" class="cnt"/><text x="342" y="72" class="rm">weak = 0</text>
  <rect x="330" y="80" width="270" height="42" class="datb"/><text x="342" y="106" class="rm">"shared data"  ← the T</text>
  <path d="M112 41 L326 41" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#arc1)"/>
  <path d="M112 75 C 240 75, 250 45, 326 43" stroke="var(--rust-500)" stroke-width="2" fill="none" marker-end="url(#arc1)"/>
  <path d="M112 109 C 240 109, 250 48, 326 45" stroke="var(--rust-500)" stroke-width="2" fill="none" marker-end="url(#arc1)"/>
  <text x="20" y="152" class="rc2">The counters live <tspan font-weight="700">inside</tspan> the same allocation as the data — that's why an Rc handle is just one pointer.</text>
  <text x="20" y="170" class="rc2">clone → strong += 1 · drop → strong −= 1 · strong reaches 0 → drop the T, then free the whole box</text>
  <text x="20" y="196" class="rc2">Consequence: you cannot free the data while any handle lives, and you cannot leak it while none does</text>
  <text x="20" y="210" class="rc2">— unless the handles form a <tspan font-style="italic">cycle</tspan>, which is the one failure mode and the subject of a later chapter.</text>
  <defs><marker id="arc1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker></defs>
</svg>
<figcaption><code>Rc&lt;T&gt;</code> lets several handles co-own one allocation. Both counters sit alongside the data, so the handle itself stays pointer-sized.</figcaption>
</figure>

## How to create one

`Rc::new` covers most cases, but the conversions are what let you build the cheap shared strings and slices covered later in this chapter. Every route below has an identical `Arc` form:

```rust
use std::rc::Rc;
use std::sync::Arc;

fn main() {
    // From a value you own:
    let a = Rc::new(5i32);            // the usual constructor
    let b: Rc<i32> = Rc::from(7);     // via From
    let c: Rc<i32> = 9.into();        // via Into — same impl
    let d: Rc<i32> = Rc::default();   // T::default(), shared → 0
    println!("{a} {b} {c} {d}");

    // Unsized targets — these are the interesting ones, because they store
    // the data INSIDE the refcount allocation (one allocation, not two):
    let from_literal: Rc<str> = Rc::from("a borrowed literal");
    let from_string: Rc<str> = Rc::from(String::from("an owned String"));
    let from_vec: Rc<[i32]> = Rc::from(vec![1, 2, 3]);
    let from_slice: Rc<[i32]> = Rc::from(&[4, 5, 6][..]);
    let collected: Rc<[i32]> = (1..4).collect(); // straight from an iterator
    println!("{from_literal} / {from_string}");
    println!("{from_vec:?} {from_slice:?} {collected:?}");

    // Arc is identical in every case:
    let shared: Arc<str> = Arc::from("works across threads");
    println!("{shared}");

    // And a pinned allocation, for self-referential types:
    let pinned = Rc::pin(42);
    println!("{pinned}");

    // Sharing is always Rc::clone — never Rc::new(*existing), which would
    // allocate a second copy instead of sharing the first.
    let shared_handle = Rc::clone(&a);
    println!("shared, count = {}", Rc::strong_count(&shared_handle));
}
```

| To create | Use | Notes |
|---|---|---|
| `Rc<T>` from a `T` | `Rc::new(value)` | the standard constructor; count starts at 1 |
| `Rc<T>` from a `T` | `Rc::from(value)` / `value.into()` | identical; handy in generic code |
| `Rc<T>` with a default | `Rc::default()` | requires `T: Default` |
| **another handle** | `Rc::clone(&rc)` | **+1 to the count — this is how you share** |
| `Rc<str>` | `Rc::from("literal")` or `Rc::from(string)` | data stored inline; **one** allocation |
| `Rc<[T]>` | `Rc::from(vec)` or `Rc::from(&slice[..])` | data stored inline |
| `Rc<[T]>` | `iter.collect()` | note `Rc<str>` has **no** `FromIterator` |
| `Rc<T>` holding a `Weak<T>` to itself | `Rc::new_cyclic(\|weak\| …)` | see [Weak & Cycles](#/ch/weak-cycles) |
| `Pin<Rc<T>>` | `Rc::pin(value)` | for self-referential types ([Pin](#/ch/pinning)) |
| the `T` back out | `Rc::try_unwrap(rc)` / `Rc::into_inner(rc)` | only succeeds when you're the last owner |

> [!mistake] `Rc::new(*existing)` allocates a copy — you wanted `Rc::clone`
> These look similar and do opposite things. `Rc::clone(&a)` bumps a counter and shares the *same* data. `Rc::new((*a).clone())` deep-copies the value into a brand-new allocation with its own count of 1 — so mutations and identity checks no longer line up, and you've paid for an allocation you didn't want. If you find `Rc::ptr_eq` returning `false` for two handles you thought were shared, this is almost always why.

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
        println!("c sees: {c}");
    } // c drops here → count goes back down

    println!("count = {}", Rc::strong_count(&a)); // 2
    println!("value is still: {a}");               // all handles see the same data

    // All handles point at the SAME allocation — ptr_eq proves it.
    println!("same allocation? {}", Rc::ptr_eq(&a, &b));

    // Compare that with a genuine deep copy:
    let deep = Rc::new((*a).clone());
    println!("deep copy equal? {}", *a == *deep);            // true — same contents
    println!("deep copy same alloc? {}", Rc::ptr_eq(&a, &deep)); // false — different data
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

There are, however, two legitimate escape hatches built into `Rc` itself — and they're much less well known than they should be.

### `get_mut`: mutate when you happen to be the only owner

`Rc::get_mut` hands you a `&mut T` **only if** the strong count is 1 and the weak count is 0. If anyone else holds a handle, you get `None`:

```rust
use std::rc::Rc;

fn main() {
    let mut solo = Rc::new(vec![1, 2, 3]);

    // Uniquely owned → mutation is safe, and allowed.
    if let Some(v) = Rc::get_mut(&mut solo) {
        v.push(4);
    }
    println!("after solo mutation: {solo:?}");

    let _other = Rc::clone(&solo); // now shared

    // Shared → refused, because someone else could be reading.
    match Rc::get_mut(&mut solo) {
        Some(_) => println!("mutated"),
        None => println!("refused: strong_count is {}", Rc::strong_count(&solo)),
    }
}
```

### `make_mut`: clone-on-write

`Rc::make_mut` is the more useful one. It always gives you a `&mut T` — by cloning the data first **if** it's currently shared. That makes `Rc<T>` a copy-on-write container:

```rust
use std::rc::Rc;

fn main() {
    let mut original = Rc::new(vec![1, 2, 3]);
    let snapshot = Rc::clone(&original);
    println!("shared, count = {}", Rc::strong_count(&original));

    // Because count > 1, make_mut CLONES the data, points `original` at the
    // copy, and mutates that. `snapshot` is untouched.
    Rc::make_mut(&mut original).push(4);

    println!("original: {original:?}");
    println!("snapshot: {snapshot:?}   ← unchanged");
    println!("same allocation now? {}", Rc::ptr_eq(&original, &snapshot));
    println!("original count = {}", Rc::strong_count(&original));

    // Now that `original` is unique again, make_mut mutates in place —
    // no clone, no allocation.
    Rc::make_mut(&mut original).push(5);
    println!("after second push: {original:?}  (no clone this time)");
}
```

> [!best] `Rc::make_mut` gives you cheap immutable snapshots
> This is the pattern behind persistent data structures and undo stacks. Hand out `Rc::clone`s freely as read-only snapshots — each is a pointer bump. When a holder actually needs to change its copy, `make_mut` pays for a clone *at that moment*, and only then. If nobody ever mutates, you never pay at all. It's the same idea as [`Cow`](#/ch/conversions), applied to shared ownership rather than borrowing, and it requires only `T: Clone`.

For genuinely *shared* mutation — where every holder must see the same change — you need **interior mutability** instead: `Rc<RefCell<T>>`. That combination is so common it gets its own [chapter next](#/ch/refcell).

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
            println!("thread {id} sees {:?}, sum = {}", data, data.iter().sum::<i32>());
        }));
    }

    for h in handles {
        h.join().unwrap();
    }
    println!("final count = {}", Arc::strong_count(&data)); // back to 1
}
```

> [!note] The compiler stops you using `Rc` across threads — for a real reason
> Swap `Arc` for `Rc` above and you get an error about `Rc<Vec<i32>>` not being `Send`. That's not pedantry. Two threads incrementing a non-atomic counter simultaneously can both read `2`, both write `3`, and lose an increment — so the count drops to zero while a handle is still alive, the data is freed, and the surviving handle becomes a dangling pointer. This is a use-after-free, and in C++ with a non-atomic `shared_ptr` it's exactly the bug you'd get silently. Rust makes it a compile error via [`Send` and `Sync`](#/ch/send-sync).

| | `Rc<T>` | `Arc<T>` |
|---|---|---|
| Counter updates | plain integer ops | **atomic** ops |
| Thread-safe | no — not `Send`/`Sync` | yes |
| Clone cost | ~1 ns (an increment) | a few ns, worse under contention |
| Use in `thread::spawn` | compile error | ✅ |
| API | identical | identical |
| Reach for it | single-threaded sharing | sharing across threads |

> [!performance] Prefer `Rc`, upgrade to `Arc` only when crossing threads
> `Arc`'s atomic counter updates are slightly more expensive than `Rc`'s plain ones. So use **`Rc`** for single-threaded sharing and reach for **`Arc`** only when the data must cross thread boundaries. Don't reach for `Arc` "just in case" — the compiler will tell you the moment you actually need it (`Rc` won't compile in a `thread::spawn`).

> [!warning] Cloning one `Arc` in a hot loop across threads causes real contention
> An atomic increment isn't just "a slightly slower increment" — it requires the CPU cores to agree on the value, so the cache line holding that counter bounces between them. Eight threads each cloning the *same* `Arc` a million times will spend most of their time on cache coherence, not work. The fix is to clone the `Arc` **once per thread, outside the loop**, and then use the cheap `&T` inside it. If profiling shows atomics dominating, this is almost always why — see [Optimization](#/ch/optimization).

## Shared strings and slices

`Rc` and `Arc` support unsized types, which gives you something genuinely useful: a cheaply shareable string or slice with no capacity overhead:

```rust
use std::rc::Rc;
use std::mem::size_of;

fn main() {
    // Rc<str> — a shared, immutable string. Two words, no capacity field.
    let name: Rc<str> = Rc::from("a very long shared string");
    let alias = Rc::clone(&name); // no allocation, no copy of the text
    println!("{name} / {alias}");
    println!("count = {}", Rc::strong_count(&name));

    // Rc<[T]> — a shared, immutable slice.
    let numbers: Rc<[i32]> = Rc::from(vec![1, 2, 3, 4]);
    println!("{numbers:?}, len {}", numbers.len());

    // You can build one straight from an iterator.
    let squares: Rc<[i32]> = (1..=5).map(|n| n * n).collect();
    println!("{squares:?}");

    println!("\nRc<String> = {} bytes + a separate String header",
        size_of::<Rc<String>>());
    println!("Rc<str>    = {} bytes, text inline in the allocation",
        size_of::<Rc<str>>());
}
```

> [!best] `Rc<str>` beats `Rc<String>` for shared immutable text
> `Rc<String>` means **two** heap allocations and a double indirection: the `Rc` box holds a `String` header, which holds a pointer to the bytes. `Rc<str>` stores the text *inside* the reference-counted allocation — one allocation, one hop, and no unused capacity field. Since you can't mutate through an `Rc` anyway, the growability a `String` offers is wasted. The same reasoning applies to `Arc<str>`, and `Rc<[T]>` versus `Rc<Vec<T>>`. For an interned string pool or a parsed AST, this is a large, easy win.

## The full API

Every method on `Rc` has an identical `Arc` counterpart — learn one table and you know both. Note that these are all **associated functions** (`Rc::foo(&x)`, not `x.foo()`), deliberately, so they can never be confused with methods on the inner `T`:

| Function | Returns | Purpose |
|---|---|---|
| `Rc::new(v)` | `Rc<T>` | allocate, count starts at 1 |
| `Rc::clone(&rc)` | `Rc<T>` | **+1 to the count** — cheap |
| `Rc::strong_count(&rc)` | `usize` | how many owners |
| `Rc::weak_count(&rc)` | `usize` | how many non-owning refs |
| `Rc::ptr_eq(&a, &b)` | `bool` | same **allocation**? (not same contents) |
| `Rc::downgrade(&rc)` | `Weak<T>` | a non-owning reference ([cycles](#/ch/weak-cycles)) |
| `Rc::get_mut(&mut rc)` | `Option<&mut T>` | mutate — only if uniquely owned |
| `Rc::make_mut(&mut rc)` | `&mut T` | mutate, **cloning first if shared** (`T: Clone`) |
| `Rc::try_unwrap(rc)` | `Result<T, Rc<T>>` | reclaim the `T` if count is 1 |
| `Rc::into_inner(rc)` | `Option<T>` | same idea, `Option` flavour |
| `Rc::new_cyclic(\|weak\| …)` | `Rc<T>` | build a value holding a `Weak` to itself |
| `Rc::as_ptr(&rc)` | `*const T` | the raw address, without consuming |
| `Rc::from("…")` | `Rc<str>` | shared string, one allocation |
| `Rc::from(vec)` / `.collect()` | `Rc<[T]>` | shared slice |
| `Rc::pin(v)` | `Pin<Rc<T>>` | pinned allocation |

```rust
use std::rc::Rc;

fn main() {
    // try_unwrap / into_inner: get the T back when you're the last owner.
    let solo = Rc::new(String::from("reclaimable"));
    match Rc::try_unwrap(solo) {
        Ok(inner) => println!("reclaimed: {inner}"),
        Err(still_shared) => println!("still shared: {still_shared}"),
    }

    // With a second handle alive, it hands the Rc back instead.
    let shared = Rc::new(String::from("nope"));
    let _other = Rc::clone(&shared);
    match Rc::try_unwrap(shared) {
        Ok(inner) => println!("reclaimed: {inner}"),
        Err(still_shared) => println!("refused, count = {}", Rc::strong_count(&still_shared)),
    }

    // into_inner is the same operation with an Option result.
    println!("into_inner: {:?}", Rc::into_inner(Rc::new(42)));
}
```

> [!mistake] `Rc::ptr_eq` compares addresses; `==` compares contents
> These answer different questions and it's easy to reach for the wrong one. `a == b` derefs to the inner values and compares them — two separate allocations holding `"hello"` are equal. `Rc::ptr_eq(&a, &b)` asks whether they're *the same object*. When you're deduplicating shared nodes, checking whether a cache handed back the same entry, or detecting a cycle, you want `ptr_eq`. When you're comparing data, you want `==`.

## Choosing a pointer

> [!best] The mental model
> Think of the four in a grid:
> - Single owner, one thread → **`Box<T>`**
> - Many owners, one thread → **`Rc<T>`**
> - Many owners, across threads → **`Arc<T>`**
> - Need to *mutate* shared data → wrap the inner type: **`Rc<RefCell<T>>`** (one thread) or **`Arc<Mutex<T>>`** (across threads).
>
> This grid answers "which pointer?" almost every time.

| What you need | Single-threaded | Multi-threaded |
|---|---|---|
| one owner | `Box<T>` | `Box<T>` |
| many owners, read-only | **`Rc<T>`** | **`Arc<T>`** |
| many owners, copy-on-write | `Rc<T>` + `make_mut` | `Arc<T>` + `make_mut` |
| many owners, shared mutation | `Rc<RefCell<T>>` | `Arc<Mutex<T>>` |
| many owners, read-heavy mutation | `Rc<RefCell<T>>` | `Arc<RwLock<T>>` |
| many owners, just a counter | `Rc<Cell<u32>>` | `Arc<AtomicU32>` |
| a non-owning link (break a cycle) | `Weak<T>` | `Weak<T>` |
| shared immutable text | `Rc<str>` | `Arc<str>` |

> [!warning] `Rc` can leak memory — the one hole in its guarantee
> Reference counting has a well-known failure mode: if `a` holds an `Rc` to `b` and `b` holds one back to `a`, neither count ever reaches zero, so neither is ever freed — even after every external handle is gone. A parent/child tree where children point back at parents hits this immediately. This is the one case where safe Rust will leak, and the fix is `Weak<T>`, which points without owning. That's the [next chapter but one](#/ch/weak-cycles).

## Summary

- **`Rc<T>`** enables **shared ownership**: several handles co-own one heap allocation, freed only when the last owner drops. Use it when the "who frees this?" answer genuinely isn't knowable at compile time.
- Both counters live **inside the same allocation** as the data, so an `Rc` handle is just one pointer.
- **`Rc::clone`** is a cheap **reference-count bump**, not a deep copy; inspect owners with **`Rc::strong_count`** and identity with **`Rc::ptr_eq`**.
- `Rc` gives **read-only** shared access — but **`Rc::get_mut`** mutates when uniquely owned, and **`Rc::make_mut`** gives you **copy-on-write** for free.
- Reclaim the inner value with **`try_unwrap`** or **`into_inner`** when you're the last owner.
- **`Arc<T>`** is the thread-safe version (atomic counter). Prefer `Rc`; the compiler tells you when you need `Arc`. Clone an `Arc` **once per thread**, not inside a hot loop.
- **`Rc<str>` / `Rc<[T]>`** store data inline — one allocation instead of two, and no wasted capacity.
- Choose with the grid: `Box` (one owner), `Rc`/`Arc` (shared), plus `RefCell`/`Mutex` to mutate.
- Reference **cycles leak**. `Weak<T>` is the fix.

> [!exercise] Try it yourself
> 1. Create an `Rc<String>`, clone it three times, and print `strong_count` after each clone and after one is dropped in an inner scope.
> 2. Try to `push` to an `Rc<Vec<i32>>` and read the error — then predict what wrapper you'd need to make it work.
> 3. Use `Rc::make_mut` on a shared `Rc<Vec<i32>>` and confirm with `Rc::ptr_eq` that the allocation changed. Then call it again on the now-unique handle and confirm it *didn't*.
> 4. Build two `Rc<String>`s with identical contents. Show that `==` says they're equal but `Rc::ptr_eq` says they're not.
> 5. Share an `Arc<Vec<i32>>` across four threads that each print its sum. Then change `Arc` to `Rc` and read the compiler error carefully — which trait is missing, and why does that matter?
> 6. Convert an `Rc<String>` to an `Rc<str>` and explain how many heap allocations each involves.
> 7. Use `Rc::try_unwrap` to reclaim a `String`, first with one handle alive and then with two. Explain both results.

`Rc` shares data but keeps it immutable. To mutate shared data safely, we need a way to bend the borrowing rules *at runtime* — **interior mutability with `RefCell`**.
