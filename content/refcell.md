<h1><span class="h1-kicker">Smart Pointers</span>RefCell & Interior Mutability</h1>

Everything you've learned says: to mutate a value, you need a `&mut` to it, and the borrow checker enforces that *at compile time*. **Interior mutability** is a controlled way to bend that rule — mutating data through a *shared* (`&`) reference — while keeping Rust safe by moving the borrow checking to **runtime**. The tool for this is **`RefCell<T>`**, and it unlocks patterns (like shared, mutable graph nodes) that are otherwise impossible.

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

> [!warning] `RefCell` moves borrow bugs from compile time to runtime
> This is the trade-off: with normal references, a double-borrow is a *compile error* (caught before shipping). With `RefCell`, it's a *runtime panic* (caught only when that path runs). You give up a compile-time guarantee for flexibility — so keep `RefCell` borrows short and scoped, and never hold a `borrow_mut()` while calling code that might borrow again.

## `Cell` — interior mutability without borrows

For simple `Copy` values (numbers, booleans), there's a lighter option: **`Cell<T>`**. Instead of handing out references, it lets you `get()` a copy and `set()` a whole new value — so there are no borrows to track and it never panics:

```rust
use std::cell::Cell;

fn main() {
    let counter = Cell::new(0);
    counter.set(counter.get() + 1);
    counter.set(counter.get() + 1);
    println!("{}", counter.get()); // 2
}
```

Rule of thumb: **`Cell`** for `Copy` values you replace wholesale; **`RefCell`** for everything else (where you need to borrow the inner value).

## The killer combo: `Rc<RefCell<T>>`

Recall that [`Rc`](#/ch/rc-arc) gives *shared ownership* but only *immutable* access. Combine it with `RefCell` and you get **shared ownership of mutable data** — multiple owners who can all read *and* write. This is the standard pattern for graphs, trees with shared nodes, and observer-style designs:

```rust
use std::rc::Rc;
use std::cell::RefCell;

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

> [!best] Reach for interior mutability last, not first
> `RefCell` is powerful but it's an escape hatch. Most code should use plain ownership and `&mut` — they're checked at compile time and free. Before adding `Rc<RefCell<T>>`, ask whether you can restructure to have clear single ownership (often you can). Use interior mutability when the data genuinely has a shared, mutable, graph-like shape — not to dodge a borrow error you could fix properly.

> [!note] Across threads: `Mutex`, not `RefCell`
> `RefCell` and `Cell` are single-threaded (they're not `Sync`). The thread-safe equivalent of "interior mutability" is **`Mutex<T>`** or **`RwLock<T>`**, usually as `Arc<Mutex<T>>`. Same idea — controlled mutation of shared data — but with locking instead of a runtime borrow flag. That's the subject of the [shared-state concurrency chapter](#/ch/shared-state).

## Summary

- **Interior mutability** lets you mutate data through a shared (`&`) reference; **`RefCell<T>`** provides it by checking the borrowing rules at **runtime**.
- Use **`.borrow()`** for read access and **`.borrow_mut()`** for write access; violating "one writer XOR many readers" **panics** at runtime.
- **`Cell<T>`** is the lighter option for `Copy` values (`get`/`set`, no borrows, never panics).
- **`Rc<RefCell<T>>`** combines shared ownership with mutability — the go-to for graph/tree structures with shared, mutable nodes.
- It's an **escape hatch**: prefer plain ownership and `&mut`; reach for `RefCell` only when the data's shape truly demands it. Across threads, use `Mutex`/`RwLock` instead.

> [!exercise] Try it yourself
> 1. Put a counter in a `RefCell<i32>` and increment it from a function that only takes `&RefCell<i32>` (shared ref).
> 2. Trigger the double-`borrow_mut()` panic, then fix it by scoping the first borrow in its own block.
> 3. Build an `Rc<RefCell<Vec<String>>>`, clone it, push from both handles, and confirm both see all the items.

Smart pointers like `Box` and `Rc` "just work" with `*` and method calls, and clean up automatically. That magic comes from two traits you can implement yourself: **`Deref` and `Drop`**.
