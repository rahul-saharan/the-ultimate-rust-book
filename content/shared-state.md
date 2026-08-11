<h1><span class="h1-kicker">Fearless Concurrency</span>Shared State: Mutex & RwLock</h1>

Channels let threads *pass* data. But sometimes multiple threads genuinely need to read and write the *same* piece of data — a shared counter, a cache, a game world. Doing that safely requires a **lock**: a guarantee that only one thread touches the data at a time. Rust's **`Mutex<T>`** provides it, and — beautifully — the type system makes it *impossible to access the data without locking first*.

## The Mutex: mutual exclusion

A **`Mutex`** (from *mutual exclusion*) wraps a value and hands it out to only one thread at a time. To touch the data you must `lock()` the mutex; that returns a guard you use to read or write, and the lock is released automatically when the guard goes out of scope:

```rust
use std::sync::Mutex;

fn main() {
    let m = Mutex::new(5);

    {
        let mut num = m.lock().unwrap(); // acquire the lock (blocks if held)
        *num += 10;                       // now we have exclusive access
    } // lock released here as `num` (the guard) is dropped

    println!("m = {:?}", m.lock().unwrap()); // 15
}
```

> [!key] You cannot access the data without locking — by design
> In most languages, a mutex and the data it protects are *separate*, so nothing stops you from forgetting to lock. Rust's `Mutex<T>` **owns** the data `T`; the only way to reach the value is through `lock()`, which returns a guard. Forgetting to lock isn't a discipline you must remember — it's **impossible to express**. The lock and the data are inseparable.

> [!jargon] The lock guard & RAII
> `lock()` returns a `MutexGuard`, a smart pointer that derefs to your `&mut T`. When the guard is dropped (end of scope), it **unlocks** the mutex automatically — the [RAII](#/ch/deref-drop) pattern again. You never manually "unlock"; you just let the guard fall out of scope.
See [Cell and Lock Guards](#/ch/cell-guards) for the full MutexGuard/RwLockGuard API."

## Sharing a Mutex across threads with `Arc`

A `Mutex` alone lives on one thread. To share it among many, you need shared ownership — and across threads that means [`Arc`](#/ch/rc-arc). The combination **`Arc<Mutex<T>>`** is *the* canonical Rust pattern for shared mutable state:

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    // Arc → many owners; Mutex → safe mutation. Together: shared mutable state.
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter = Arc::clone(&counter); // each thread gets an owning handle
        handles.push(thread::spawn(move || {
            let mut num = counter.lock().unwrap();
            *num += 1; // exclusive access — no race possible
        }));
    }

    for h in handles {
        h.join().unwrap();
    }
    println!("Final count: {}", *counter.lock().unwrap()); // exactly 10, always
}
```

Ten threads increment the same counter, and the answer is *always* exactly 10 — never a garbled value from a lost update, because the mutex serializes the writes.

> [!key] `Arc<Mutex<T>>` — read it as two jobs
> - **`Arc`** answers *"who owns it?"* → many threads can, via cheap reference-counted clones.
> - **`Mutex`** answers *"who can touch it right now?"* → exactly one thread, whoever holds the lock.
>
> Neither alone is enough: `Arc<T>` shares but stays immutable; `Mutex<T>` allows mutation but can't be shared across threads by itself. Together they give shared *and* mutable *and* safe.

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="Three threads each hold an Arc clone; only the one holding the Mutex lock may access the data">
  <style>
    .ssm { font: 600 12px var(--font-mono); fill: var(--text); }
    .ssc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .tbox { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .tlock { fill: var(--green-soft); stroke: var(--green); stroke-width: 2; }
    .datb2 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 2; }
  </style>
  <rect x="20" y="20" width="110" height="28" class="tlock"/><text x="34" y="39" class="ssm">T1 🔓 holds lock</text>
  <rect x="20" y="60" width="110" height="28" class="tbox"/><text x="34" y="79" class="ssm">T2 ⏳ waiting</text>
  <rect x="20" y="100" width="110" height="28" class="tbox"/><text x="34" y="119" class="ssm">T3 ⏳ waiting</text>
  <rect x="400" y="55" width="200" height="46" class="datb2"/><text x="416" y="75" class="ssm">Mutex&lt;i32&gt;</text><text x="416" y="93" class="ssc">only T1 may touch it now</text>
  <path d="M132 34 C 260 34, 300 72, 398 74" stroke="var(--green)" stroke-width="2.5" fill="none" marker-end="url(#ass)"/>
  <path d="M132 74 L398 78" stroke="var(--text-mute)" stroke-width="1.5" stroke-dasharray="4 3"/>
  <path d="M132 114 C 260 114, 300 84, 398 80" stroke="var(--text-mute)" stroke-width="1.5" fill="none" stroke-dasharray="4 3"/>
  <text x="20" y="150" class="ssc">All three own an Arc clone; the Mutex ensures only the lock-holder accesses the data at any instant.</text>
  <defs><marker id="ass" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--green)"/></marker></defs>
</svg>
<figcaption><code>Arc&lt;Mutex&lt;T&gt;&gt;</code>: everyone co-owns the data, but only the lock-holder may use it.</figcaption>
</figure>

## `RwLock`: many readers or one writer

A `Mutex` allows just one accessor at a time, even for reads. When your data is **read often but written rarely**, an **`RwLock`** (read-write lock) is faster: it permits *any number* of simultaneous readers, but a writer gets exclusive access:

```rust
use std::sync::RwLock;

fn main() {
    let config = RwLock::new(vec!["default"]);

    // Many readers can hold the lock at once:
    {
        let r1 = config.read().unwrap();
        let r2 = config.read().unwrap(); // both read concurrently — fine
        println!("readers see: {:?} and {:?}", r1, r2);
    }

    // A writer gets exclusive access:
    {
        let mut w = config.write().unwrap();
        w.push("override");
    }

    println!("final: {:?}", config.read().unwrap());
}
```

> [!tip] `Mutex` vs `RwLock`
> Use **`Mutex`** by default — it's simpler and often just as fast. Reach for **`RwLock`** only when you have *many concurrent readers* and *infrequent writers*, and the reader parallelism actually matters. `RwLock` has more overhead per operation, so for write-heavy or low-contention data, `Mutex` usually wins. Measure if it matters.

## The two hazards: deadlock and poisoning

Locks introduce two failure modes you must respect:

> [!warning] Deadlock: two threads waiting on each other forever
> If thread A locks mutex 1 then waits for mutex 2, while thread B locks mutex 2 then waits for mutex 1, **neither can proceed** — a *deadlock*. Rust's compiler can't prevent this (it's a logic error, not a memory-safety one). Avoid it by **always acquiring multiple locks in the same order**, holding locks for as short a time as possible, and never calling unknown code while holding a lock.

> [!note] Lock poisoning
> If a thread **panics** while holding a lock, Rust marks the mutex "poisoned" — subsequent `lock()` calls return an `Err`. That's why you see `.lock().unwrap()`: it propagates the poison. This is a safety feature: it warns you that the protected data might be in a half-updated, inconsistent state because the thread that was modifying it died mid-update.

## Summary

- A **`Mutex<T>`** allows only one thread to access its data at a time; you must **`lock()`** to reach the value, and the lock releases automatically when the guard drops.
- Because the mutex **owns** the data, you *cannot* access it without locking — forgetting to lock is impossible.
- Share a mutex across threads with **`Arc<Mutex<T>>`** — the canonical shared-mutable-state pattern (`Arc` = many owners, `Mutex` = one accessor at a time).
- **`RwLock`** permits many concurrent readers or one writer — use it for read-heavy data; otherwise prefer the simpler `Mutex`.
- Beware **deadlock** (acquire locks in a consistent order, hold them briefly) and understand **poisoning** (a panic while locked flags possibly-corrupt data).

> [!exercise] Try it yourself
> 1. Have 100 threads each increment an `Arc<Mutex<i32>>` and confirm the total is exactly 100.
> 2. Build an `Arc<Mutex<Vec<String>>>` and let several threads each push a message; print the collected messages.
> 3. Rewrite a read-heavy example with `RwLock` and open two `read()` guards at once to see they coexist.

Two traits quietly make all of this safe — the compiler uses them to decide what may cross thread boundaries at all. Meet **`Send` and `Sync`**.
