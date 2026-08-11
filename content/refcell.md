<h1><span class="h1-kicker">Smart Pointers</span>RefCell & Interior Mutability</h1>

Everything you've learned says: to mutate a value, you need a `&mut` to it, and the borrow checker enforces that *at compile time*. **Interior mutability** is a controlled way to bend that rule — mutating data through a *shared* (`&`) reference — while keeping Rust safe by moving the borrow checking to **runtime**. The tool for this is **`RefCell<T>`**, and it unlocks patterns (like shared, mutable graph nodes) that are otherwise impossible.

## Why interior mutability has to exist

Rust's central rule is **shared XOR mutable**: at any moment you may have many `&T` or exactly one `&mut T`, never both. That rule eliminates data races and iterator invalidation, and it's right the overwhelming majority of the time. But it's a *conservative* rule — it rejects some programs that are genuinely safe, because the compiler can't prove they are.

Three situations run into it constantly:

- **A method that takes `&self` but needs to record something.** A `len()` that memoizes, a lookup that counts cache hits, a parser that logs. Callers see a read-only operation; internally something must change.
- **Anything behind an `Rc`.** [`Rc<T>`](#/ch/rc-arc) only ever hands out `&T` — by design, since it can't know how many other owners are reading. So an `Rc` alone can never mutate its contents.
- **Graphs and trees with shared nodes.** If two parents point at the same child and either may modify it, no single owner exists to hold the `&mut`.

```rust
use std::cell::Cell;

// A cache that counts its own hits — through &self.
struct Lookup {
    values: Vec<i32>,
    hits: Cell<u32>, // interior mutability: changes without &mut self
}

impl Lookup {
    fn get(&self, index: usize) -> Option<i32> {
        // `&self`, yet we can still record the access.
        self.hits.set(self.hits.get() + 1);
        self.values.get(index).copied()
    }

    fn hits(&self) -> u32 {
        self.hits.get()
    }
}

fn main() {
    // Note: `lookup` is NOT declared `mut`, and `get` takes `&self`.
    let lookup = Lookup { values: vec![10, 20, 30], hits: Cell::new(0) };

    println!("{:?}", lookup.get(0));
    println!("{:?}", lookup.get(2));
    println!("{:?}", lookup.get(99));
    println!("hits recorded: {}", lookup.hits()); // 3

    // Without interior mutability, `get` would need `&mut self` — forcing
    // every caller to hold a mutable borrow just to READ a value.
}
```

> [!key] Interior mutability doesn't break the rules — it enforces them elsewhere
> This is the point people miss. `RefCell` doesn't grant permission to alias mutable data; it upholds **exactly the same** shared-XOR-mutable rule, just checked while the program runs rather than while it compiles. The guarantee is preserved — a violation becomes a panic rather than undefined behaviour. What you trade away is *when* you find out.

## Compile-time vs. runtime borrow checking

Normally Rust checks the borrowing rules while compiling. `RefCell<T>` checks the *same rules* — one `&mut` XOR many `&` — but does it as your program *runs*. Break a rule and it **panics** instead of failing to compile.

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="Regular references are checked at compile time; RefCell is checked at runtime">
  <style>
    .rfh { font: 700 12px var(--font-sans); }
    .rfm { font: 600 11px var(--font-mono); fill: var(--text); }
    .rfc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .comp { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .runt { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="16" y="20" width="296" height="120" rx="10" class="comp"/>
  <text x="30" y="44" class="rfh" fill="var(--blue)">Normal &amp; / &amp;mut</text>
  <text x="30" y="68" class="rfc">Checked at COMPILE time.</text>
  <text x="30" y="90" class="rfc">Break a rule → won't compile.</text>
  <text x="30" y="116" class="rfc">✅ Zero runtime cost. Catches</text>
  <text x="30" y="132" class="rfc">errors before you run.</text>
  <rect x="328" y="20" width="296" height="120" rx="10" class="runt"/>
  <text x="342" y="44" class="rfh" fill="var(--rust-600)">RefCell::borrow(_mut)</text>
  <text x="342" y="68" class="rfc">Checked at RUNTIME.</text>
  <text x="342" y="90" class="rfc">Break a rule → PANIC.</text>
  <text x="342" y="116" class="rfc">✅ Enables patterns the compiler</text>
  <text x="342" y="132" class="rfc">can't prove safe statically.</text>
</svg>
<figcaption>Same rules, different time: <code>RefCell</code> trades a tiny runtime check for flexibility the compiler can't grant.</figcaption>
</figure>

## The three cells, and how to make them

The `std::cell` module offers three tools with the same purpose and very different costs:

| Type | Access | Runtime cost | Can panic? | Use for |
|---|---|---|---|---|
| **`Cell<T>`** | `get()` / `set()` — copies values | **none** | no | `Copy` values you replace wholesale |
| **`RefCell<T>`** | `borrow()` / `borrow_mut()` — lends references | one flag check | **yes** | anything you need to borrow into |
| **`OnceCell<T>`** | `get()` / `set()` once | one check | no | a value initialized lazily, then fixed |

```rust
use std::cell::{Cell, OnceCell, RefCell};

fn main() {
    // Cell: for Copy values. No borrowing, so nothing to get wrong.
    let counter: Cell<u32> = Cell::new(0);
    counter.set(counter.get() + 1);
    println!("Cell: {}", counter.get());

    // RefCell: for values you need to reach *into*.
    let list: RefCell<Vec<i32>> = RefCell::new(vec![1, 2]);
    list.borrow_mut().push(3);
    println!("RefCell: {:?}", list.borrow());

    // OnceCell: write once, then read forever.
    let config: OnceCell<String> = OnceCell::new();
    println!("before init: {:?}", config.get());
    config.set(String::from("loaded")).expect("first set always succeeds");
    println!("after init: {:?}", config.get());
    println!("second set refused: {}", config.set(String::from("again")).is_err());

    // Every one of them can also be created from a plain value via Default:
    let d: RefCell<Vec<i32>> = RefCell::default();
    println!("default: {:?}", d.borrow());
}
```

> [!performance] `Cell<T>` is genuinely free; `RefCell<T>` costs 8 bytes and a branch
> `Cell<i32>` is **4 bytes** — exactly the size of an `i32`, with no overhead at all, because there's nothing to track. `RefCell<i32>` is **16 bytes**: the value plus an 8-byte borrow flag, and every `borrow()` reads and writes that flag. For a simple counter or a boolean, `Cell` is strictly better — no memory cost, no branch, and it *cannot* panic. Reach for `RefCell` only when you genuinely need a reference into the value rather than a copy of it.

## Using `RefCell`

You put a value in a `RefCell`, then call `.borrow()` for shared read access or `.borrow_mut()` for exclusive write access — *even though the `RefCell` itself is not `mut`*:

```rust
use std::cell::RefCell;

fn main() {
    let data = RefCell::new(5); // note: `data` is NOT declared `mut`

    *data.borrow_mut() += 10;   // mutate through a shared reference!
    *data.borrow_mut() *= 2;

    println!("{}", data.borrow()); // 30
}
```

`borrow_mut()` hands you a smart handle (`RefMut`) that derefs to `&mut T`; `borrow()` gives a `Ref` that derefs to `&T`. Each keeps the "loan" open until it goes out of scope.

> [!jargon] Interior mutability
> **Interior mutability** means a value that *looks* immutable from the outside (`&self`, no `mut`) can still change its insides. `RefCell` provides it by tracking borrows at runtime. It's the escape hatch for the rare cases where you know the access is safe but the compiler can't prove it.

### How the borrow flag actually works

Understanding the one integer inside a `RefCell` makes every panic predictable:

<figure class="diagram">
<svg viewBox="0 0 640 235" role="img" aria-label="The RefCell borrow flag is a single integer: zero means unborrowed, a positive number counts shared borrows, and negative one means mutably borrowed" >
  <style>
    .bf-h { font: 700 12px var(--font-sans); }
    .bf-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .bf-c { font: 10.5px var(--font-sans); fill: var(--text-mute); }
    .bf-free { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.6; }
    .bf-shared { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.6; }
    .bf-excl { fill: var(--rust-100); stroke: var(--rust-500); stroke-width: 2; }
    .bf-bad { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.6; }
  </style>
  <text x="20" y="18" class="bf-h">Inside every RefCell: one integer tracking the current loan</text>
  <rect x="20" y="30" width="180" height="52" rx="4" class="bf-free"/>
  <text x="32" y="50" class="bf-m">flag = 0</text>
  <text x="32" y="68" class="bf-c">nobody is borrowing</text>
  <rect x="230" y="30" width="180" height="52" rx="4" class="bf-shared"/>
  <text x="242" y="50" class="bf-m">flag = +n</text>
  <text x="242" y="68" class="bf-c">n readers · borrow() ok</text>
  <rect x="440" y="30" width="180" height="52" rx="4" class="bf-excl"/>
  <text x="452" y="50" class="bf-m">flag = −1</text>
  <text x="452" y="68" class="bf-c">one writer · nothing else ok</text>
  <path d="M202 46 L228 46" stroke="var(--blue)" stroke-width="2" marker-end="url(#arr-bf)"/>
  <text x="150" y="102" class="bf-c">borrow() → +1</text>
  <path d="M228 66 L202 66" stroke="var(--green)" stroke-width="2" marker-end="url(#arr-bf2)"/>
  <text x="150" y="118" class="bf-c">Ref dropped → −1</text>
  <path d="M412 46 L438 46" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#arr-bf3)"/>
  <text x="362" y="102" class="bf-c">borrow_mut()</text>
  <text x="362" y="118" class="bf-c">only from 0</text>
  <rect x="20" y="140" width="600" height="44" rx="4" class="bf-bad"/>
  <text x="32" y="160" class="bf-m">borrow_mut() while flag ≠ 0   ·   borrow() while flag = −1   →   💥 PANIC</text>
  <text x="32" y="176" class="bf-c">"already borrowed" / "already mutably borrowed" — the check is this simple</text>
  <text x="20" y="206" class="bf-c">The flag returns to 0 only when the <tspan font-family="var(--font-mono)">Ref</tspan>/<tspan font-family="var(--font-mono)">RefMut</tspan> guard is <tspan font-weight="700">dropped</tspan>. That is why scope matters so much:</text>
  <text x="20" y="222" class="bf-c">a guard held in a long-lived variable keeps the cell locked, while one used inside an expression releases immediately.</text>
  <defs>
    <marker id="arr-bf" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--blue)"/></marker>
    <marker id="arr-bf2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--green)"/></marker>
    <marker id="arr-bf3" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker>
  </defs>
</svg>
<figcaption>The whole mechanism is one integer. <code>Ref</code> and <code>RefMut</code> are <b>RAII guards</b> — the loan lasts exactly as long as the guard.</figcaption>
</figure>

## Break the rules and it panics

The safety is real — `RefCell` enforces the borrowing rules, just later. Take two mutable borrows at once and your program panics with a clear message:

```rust
use std::cell::RefCell;

fn main() {
    let data = RefCell::new(vec![1, 2, 3]);

    let borrow_one = data.borrow_mut();
    let borrow_two = data.borrow_mut(); // 💥 panics: already mutably borrowed
    println!("{:?} {:?}", borrow_one, borrow_two);
}
```

When a panic isn't acceptable, ask instead of assuming. `try_borrow` and `try_borrow_mut` return a `Result`:

```rust
use std::cell::RefCell;

fn main() {
    let data = RefCell::new(vec![1, 2, 3]);

    // Scoped borrow: released at the end of the block.
    {
        let mut guard = data.borrow_mut();
        guard.push(4);

        // While that guard is alive, further borrows are refused.
        println!("try_borrow while writing:     {:?}", data.try_borrow().is_ok());
        println!("try_borrow_mut while writing: {:?}", data.try_borrow_mut().is_ok());
    } // guard drops here → flag back to 0

    println!("try_borrow after release: {:?}", data.try_borrow().is_ok());

    // Two SHARED borrows at once are perfectly fine.
    let a = data.borrow();
    let b = data.borrow();
    println!("two readers: {:?} and {:?}", a.len(), b.len());
}
```

> [!warning] `RefCell` moves borrow bugs from compile time to runtime
> This is the trade-off: with normal references, a double-borrow is a *compile error* (caught before shipping). With `RefCell`, it's a *runtime panic* (caught only when that path runs). You give up a compile-time guarantee for flexibility — so keep `RefCell` borrows short and scoped, and never hold a `borrow_mut()` while calling code that might borrow again.

> [!mistake] The classic panic: a borrow held across a function call
> The most common real-world `RefCell` panic looks like this:
> ```rust,ignore
> // 💥 `self.items.borrow()` is still alive while `self.log()` runs —
> // and if log() borrows the same cell, it panics.
> for item in self.items.borrow().iter() {
>     self.log(item);
> }
> ```
> The guard returned by `borrow()` lives for the whole `for` loop. If anything called inside that loop borrows the same cell — even indirectly, three functions deep — you panic. The fix is to end the borrow before calling out: clone or collect what you need first (`let items: Vec<_> = self.items.borrow().clone();`), then iterate. As a rule: **never call unknown code while holding a guard.**

## `Cell` — interior mutability without borrows

For simple `Copy` values (numbers, booleans), there's a lighter option: **`Cell<T>`**. Instead of handing out references, it lets you `get()` a copy and `set()` a whole new value — so there are no borrows to track and it never panics:

```rust
use std::cell::Cell;

fn main() {
    let counter = Cell::new(0);
    counter.set(counter.get() + 1);
    counter.set(counter.get() + 1);
    println!("{}", counter.get()); // 2

    // replace returns the OLD value as it swaps in the new one.
    println!("old was {}, now {}", counter.replace(100), counter.get());

    // take() leaves T::default() behind — and works for non-Copy types too,
    // which is the one way to get a value *out* of a Cell without Copy.
    let owned = Cell::new(String::from("moved out"));
    println!("took {:?}, left {:?}", owned.take(), owned.take());

    // Two cells can swap contents.
    let a = Cell::new(1);
    let b = Cell::new(2);
    a.swap(&b);
    println!("after swap: a={} b={}", a.get(), b.get());
}
```

Rule of thumb: **`Cell`** for `Copy` values you replace wholesale; **`RefCell`** for everything else (where you need to borrow the inner value).

## The full API

Every method below takes `&self` — that's the whole point.

**`RefCell<T>`**

| Method | Returns | Notes |
|---|---|---|
| `RefCell::new(v)` | `RefCell<T>` | wrap a value |
| `borrow()` | `Ref<T>` | shared read; **panics** if mutably borrowed |
| `borrow_mut()` | `RefMut<T>` | exclusive write; **panics** if borrowed at all |
| `try_borrow()` | `Result<Ref<T>, _>` | the non-panicking form |
| `try_borrow_mut()` | `Result<RefMut<T>, _>` | the non-panicking form |
| `replace(v)` | `T` | swap in a new value, return the old |
| `replace_with(\|old\| …)` | `T` | same, computing the new value from the old |
| `take()` | `T` | replace with `T::default()`, return the old |
| `swap(&other)` | `()` | exchange contents with another `RefCell` |
| `into_inner()` | `T` | consume the cell (no check needed — you own it) |
| `get_mut()` | `&mut T` | **free** direct access, when you have `&mut self` |

**`Cell<T>`**

| Method | Returns | Notes |
|---|---|---|
| `Cell::new(v)` | `Cell<T>` | wrap a value |
| `get()` | `T` | a **copy** (requires `T: Copy`) |
| `set(v)` | `()` | overwrite |
| `replace(v)` | `T` | overwrite, returning the old value |
| `take()` | `T` | replace with `T::default()` — works without `Copy` |
| `swap(&other)` | `()` | exchange with another `Cell` |
| `into_inner()` | `T` | consume the cell |

**`OnceCell<T>`**

| Method | Returns | Notes |
|---|---|---|
| `OnceCell::new()` | `OnceCell<T>` | starts empty |
| `get()` | `Option<&T>` | `None` until set |
| `set(v)` | `Result<(), T>` | `Err` if already set — never overwrites |
| `get_or_init(\|\| …)` | `&T` | initialize on first access, then cache |
| `take()` | `Option<T>` | empty it again (needs `&mut self`) |

> [!tip] `get_mut()` is the free escape hatch you'll forget exists
> If you happen to hold a `&mut RefCell<T>` — inside a `&mut self` method, or on a local variable — then `get_mut()` gives you `&mut T` with **no runtime check and no possibility of panicking**, because the exclusive `&mut` already proves nobody else is borrowing. The same applies to `Cell::get_mut` and `into_inner()`. Whenever you find yourself calling `borrow_mut()` from a `&mut self` method, `get_mut()` is the better choice.

### Projecting into a field with `Ref::map`

A `Ref<T>` guards the whole cell, but you often want a reference to just one field. `Ref::map` narrows the guard without releasing the borrow:

```rust
use std::cell::{Ref, RefCell};

#[derive(Debug)]
struct Config {
    host: String,
    port: u16,
}

fn main() {
    let cfg = RefCell::new(Config { host: "localhost".into(), port: 8080 });

    // Instead of holding a Ref<Config> and writing guard.host everywhere,
    // narrow the guard to just the field you care about.
    let host: Ref<String> = Ref::map(cfg.borrow(), |c| &c.host);
    println!("host = {host}");
    println!("still borrowed, so try_borrow_mut fails: {}", cfg.try_borrow_mut().is_err());
    drop(host); // releasing the narrowed guard releases the whole borrow

    println!("now writable again: {}", cfg.try_borrow_mut().is_ok());
    cfg.borrow_mut().port = 443;
    println!("{:?}", cfg.borrow());
}
```

## The killer combo: `Rc<RefCell<T>>`

Recall that [`Rc`](#/ch/rc-arc) gives *shared ownership* but only *immutable* access. Combine it with `RefCell` and you get **shared ownership of mutable data** — multiple owners who can all read *and* write. This is the standard pattern for graphs, trees with shared nodes, and observer-style designs:

```rust
use std::cell::RefCell;
use std::rc::Rc;

fn main() {
    // A list several owners can all mutate:
    let shared = Rc::new(RefCell::new(vec![1, 2, 3]));

    let owner_a = Rc::clone(&shared);
    let owner_b = Rc::clone(&shared);

    owner_a.borrow_mut().push(4); // mutate through one handle…
    owner_b.borrow_mut().push(5); // …and another

    println!("{:?}", shared.borrow()); // [1, 2, 3, 4, 5] — all see the changes
    println!("owners: {}", Rc::strong_count(&shared)); // 3
}
```

Read `Rc<RefCell<T>>` as: **`Rc`** = "many owners," **`RefCell`** = "any of them may mutate it," checked at runtime.

> [!key] The order of the wrappers matters
> `Rc<RefCell<T>>` means *one shared cell that many owners can mutate* — everyone sees everyone else's changes. `RefCell<Rc<T>>` means *a mutable slot holding a shared pointer* — you can swap which value it points at, but not change the value itself. The first is what you almost always want. Getting them the wrong way round produces code that compiles and quietly doesn't share what you intended.

> [!best] Reach for interior mutability last, not first
> `RefCell` is powerful but it's an escape hatch. Most code should use plain ownership and `&mut` — they're checked at compile time and free. Before adding `Rc<RefCell<T>>`, ask whether you can restructure to have clear single ownership (often you can). Use interior mutability when the data genuinely has a shared, mutable, graph-like shape — not to dodge a borrow error you could fix properly.

> [!note] Across threads: `Mutex`, not `RefCell`
> `RefCell` and `Cell` are single-threaded (they're not `Sync`). The thread-safe equivalent of "interior mutability" is **`Mutex<T>`** or **`RwLock<T>`**, usually as `Arc<Mutex<T>>`. Same idea — controlled mutation of shared data — but with locking instead of a runtime borrow flag. That's the subject of the [shared-state concurrency chapter](#/ch/shared-state).

| Single-threaded | Thread-safe equivalent | Shared |
|---|---|---|
| `Cell<T>` | `Atomic*` (for integers/bools) | — |
| `RefCell<T>` | `Mutex<T>` | `Arc<Mutex<T>>` |
| `RefCell<T>`, read-heavy | `RwLock<T>` | `Arc<RwLock<T>>` |
| `OnceCell<T>` | `OnceLock<T>` | see [OnceLock & LazyLock](#/ch/lazy-statics) |
| `Rc<RefCell<T>>` | `Arc<Mutex<T>>` | the direct translation |

## Summary

- **Shared XOR mutable** is a conservative rule; **interior mutability** covers the safe cases it rejects — `&self` methods that record something, anything behind an `Rc`, and shared graph nodes.
- **`RefCell<T>`** upholds the *same* rule at **runtime**: `.borrow()` for reads, `.borrow_mut()` for writes, and a **panic** on violation.
- The mechanism is a single flag: **0** unborrowed, **+n** readers, **−1** one writer. `Ref`/`RefMut` are RAII guards, so the loan lasts exactly as long as the guard's scope.
- **`Cell<T>`** is free (no size overhead, no branch, cannot panic) but only copies values; **`OnceCell<T>`** is write-once.
- Use **`try_borrow`** when a panic is unacceptable, and **`get_mut()`** for a free, un-checked borrow whenever you hold `&mut`.
- **Never hold a guard while calling unknown code** — that's the classic panic. Clone or collect first.
- **`Ref::map`** narrows a guard to one field without releasing the borrow.
- **`Rc<RefCell<T>>`** = many owners, any may mutate. Mind the nesting order.
- It's an **escape hatch**: prefer plain ownership and `&mut`. Across threads, use `Mutex`/`RwLock` instead.

> [!exercise] Try it yourself
> 1. Put a counter in a `RefCell<i32>` and increment it from a function that only takes `&RefCell<i32>` (shared ref).
> 2. Trigger the double-`borrow_mut()` panic, then fix it by scoping the first borrow in its own block.
> 3. Rewrite the counter using `Cell<i32>` instead. Print `size_of` for both and explain the difference.
> 4. Write the "borrow held across a call" panic from the callout above, confirm it panics, then fix it by collecting first.
> 5. Replace a `borrow_mut()` inside a `&mut self` method with `get_mut()`. Why can the second one never panic?
> 6. Build an `Rc<RefCell<Vec<String>>>`, clone it, push from both handles, and confirm both see all the items.
> 7. Use `Ref::map` to hand out a `Ref<String>` to one field of a struct, then show that `try_borrow_mut` fails until you drop it.

Smart pointers like `Box` and `Rc` "just work" with `*` and method calls, and clean up automatically. That magic comes from two traits you can implement yourself: **`Deref` and `Drop`** — and once you've seen them, [Cell and Lock Guards](#/ch/cell-guards) covers the thread-safe siblings of `Ref` and `RefMut`.