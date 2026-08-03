<h1><span class="h1-kicker">The Standard Library, Deep</span>std::sync — Synchronization Primitives</h1>

The [concurrency part](#/ch/threads) taught the big ones — `Arc`, `Mutex`, `RwLock`, atomics — in depth. This reference gathers *all* of `std::sync` in one place, including the ones we haven't met: `Once`, `OnceLock`, `Barrier`, and `Condvar`. Think of it as your synchronization cheat-sheet.

## The core trio (recap)

You know these; here they are for completeness:

| Type | Purpose |
|------|---------|
| **`Arc<T>`** | shared ownership across threads (atomic refcount) |
| **`Mutex<T>`** | one accessor at a time (mutual exclusion) |
| **`RwLock<T>`** | many readers *or* one writer |

The canonical shared-mutable-state pattern is `Arc<Mutex<T>>`, covered in [Shared State](#/ch/shared-state). Now the additions.

## One-time initialization: `OnceLock` & `LazyLock`

A frequent need: initialize a global value **exactly once**, the first time it's used, safely even if many threads race to be first. **`OnceLock<T>`** does this — perfect for lazily-computed globals and caches:

```rust
use std::sync::OnceLock;

// A global computed once, on first access:
static CONFIG: OnceLock<String> = OnceLock::new();

fn config() -> &'static str {
    CONFIG.get_or_init(|| {
        println!("(computing config — happens only once)");
        "loaded configuration".to_string()
    })
}

fn main() {
    println!("{}", config()); // triggers init
    println!("{}", config()); // reuses the cached value — no re-init
}
```

**`LazyLock<T>`** is an even more convenient form for globals with a fixed initializer — it initializes on first deref:

```rust
use std::sync::LazyLock;

// Initialized automatically on first use:
static GREETING: LazyLock<String> = LazyLock::new(|| "Hello!".to_string());

fn main() {
    println!("{}", *GREETING); // computes here
    println!("{}", GREETING.len()); // already computed
}
```

> [!key] `OnceLock`/`LazyLock` replaced the old `lazy_static`/`once_cell`
> For years, thread-safe lazy globals meant reaching for the `lazy_static!` macro or the `once_cell` crate. Modern Rust has these built into `std`: use **`LazyLock`** for a global with a fixed initializer, and **`OnceLock`** when you need to set the value later or compute it with runtime data. No crate needed anymore.

## `Once`: run a side effect once

**`Once`** is the lower-level primitive for running *initialization code* (not producing a value) exactly once — e.g. installing a global logger or signal handler:

```rust
use std::sync::Once;

static INIT: Once = Once::new();

fn setup() {
    INIT.call_once(|| {
        println!("one-time setup runs");
    });
}

fn main() {
    setup();
    setup(); // the closure does NOT run again
    setup();
}
```

## `Barrier`: rendezvous point

A **`Barrier`** makes a group of threads wait until *all* of them reach a certain point before any continues — useful for phased parallel algorithms ("everyone finish phase 1 before anyone starts phase 2"):

```rust
use std::sync::{Arc, Barrier};
use std::thread;

fn main() {
    let barrier = Arc::new(Barrier::new(3)); // wait for 3 threads
    let mut handles = vec![];

    for id in 0..3 {
        let barrier = Arc::clone(&barrier);
        handles.push(thread::spawn(move || {
            println!("thread {id}: phase 1 done");
            barrier.wait(); // block here until all 3 arrive
            println!("thread {id}: starting phase 2");
        }));
    }
    for h in handles { h.join().unwrap(); }
}
```

## `Condvar`: wait for a condition

A **condition variable** (`Condvar`) lets a thread *sleep* until another thread signals that some condition became true — without busy-waiting. It's always paired with a `Mutex` guarding the condition. This is the classic building block for producer/consumer queues:

```rust
use std::sync::{Arc, Mutex, Condvar};
use std::thread;

fn main() {
    let pair = Arc::new((Mutex::new(false), Condvar::new()));
    let pair2 = Arc::clone(&pair);

    thread::spawn(move || {
        let (lock, cvar) = &*pair2;
        let mut ready = lock.lock().unwrap();
        *ready = true;
        cvar.notify_one(); // wake the waiter
    });

    let (lock, cvar) = &*pair;
    let mut ready = lock.lock().unwrap();
    while !*ready {
        ready = cvar.wait(ready).unwrap(); // sleep until notified & condition holds
    }
    println!("condition met — proceeding");
}
```

## Atomics

For lock-free single-value updates, **`std::sync::atomic`** offers `AtomicBool`, `AtomicUsize`, `AtomicI64`, etc. — covered in depth in the [Atomics chapter](#/ch/atomics). Reach for them for counters and flags where a full `Mutex` is overkill.

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="A decision guide for choosing a std::sync primitive">
  <style>
    .sym2 { font: 600 11px var(--font-mono); fill: var(--text); }
    .syc2 { font: 11px var(--font-sans); fill: var(--text-mute); }
    .cell2 { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; }
    .hi { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="14" y="16" width="300" height="26" class="hi"/><text x="26" y="34" class="sym2">Share mutable data → Arc&lt;Mutex&lt;T&gt;&gt;</text>
  <rect x="14" y="46" width="300" height="26" class="cell2"/><text x="26" y="64" class="syc2">read-heavy? → Arc&lt;RwLock&lt;T&gt;&gt;</text>
  <rect x="14" y="76" width="300" height="26" class="cell2"/><text x="26" y="94" class="syc2">just a counter/flag? → Atomic*</text>
  <rect x="14" y="106" width="300" height="26" class="cell2"/><text x="26" y="124" class="syc2">lazy global? → LazyLock / OnceLock</text>
  <rect x="330" y="16" width="296" height="26" class="cell2"/><text x="342" y="34" class="syc2">run setup once → Once</text>
  <rect x="330" y="46" width="296" height="26" class="cell2"/><text x="342" y="64" class="syc2">all threads sync at a point → Barrier</text>
  <rect x="330" y="76" width="296" height="26" class="cell2"/><text x="342" y="94" class="syc2">sleep until a condition → Condvar</text>
  <rect x="330" y="106" width="296" height="26" class="cell2"/><text x="342" y="124" class="syc2">pass messages instead → mpsc channel</text>
</svg>
<figcaption>Pick the lightest primitive that fits — and prefer message passing (channels) when you can.</figcaption>
</figure>

> [!best] Prefer channels and the simplest primitive
> Reach for the *least* powerful tool that solves your problem: a **channel** (message passing) if you can avoid shared state entirely; an **atomic** for a lone counter/flag; a **`Mutex`** for shared mutable data; `RwLock` only when reads vastly outnumber writes. `Once`/`OnceLock`/`LazyLock` handle initialization; `Barrier`/`Condvar` handle thread coordination. The more complex primitives (`Condvar` especially) are error-prone — use them only when nothing simpler fits.

## Summary

- The **core trio**: `Arc<T>` (shared ownership), `Mutex<T>` (exclusive access), `RwLock<T>` (many readers/one writer) — usually as `Arc<Mutex<T>>`.
- **One-time init**: `LazyLock` (fixed initializer, on first use), `OnceLock` (set/compute later) — the modern replacements for `lazy_static`/`once_cell`; `Once` runs setup code once.
- **Coordination**: `Barrier` makes threads wait for each other at a point; `Condvar` sleeps a thread until a condition is signaled.
- **Atomics** (`std::sync::atomic`) for lock-free counters/flags.
- Prefer the **simplest** primitive — and message passing (channels) over shared state when possible.

> [!exercise] Try it yourself
> 1. Use a `LazyLock<Vec<i32>>` global initialized to `vec![1, 2, 3]` and read it from `main`.
> 2. Use `OnceLock` with `get_or_init` and prove (with a `println!` inside) the initializer runs only once across two calls.
> 3. Use a `Barrier` so three threads all print "phase 1" before any prints "phase 2".

The last `std` reference is one you use in every program without thinking — the formatting system behind `println!`: **`Display`, `Debug` & `format!`**.
