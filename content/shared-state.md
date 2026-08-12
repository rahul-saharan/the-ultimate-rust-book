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
> `lock()` returns a `MutexGuard`, a smart pointer that derefs to your `&mut T`. When the guard is dropped (end of scope), it **unlocks** the mutex automatically — the [RAII](#/ch/deref-drop) pattern again. You never manually "unlock"; you just let the guard fall out of scope. See [Cell and Lock Guards](#/ch/cell-guards) for the full `MutexGuard`/`RwLockGuard` API.

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

## Protecting an invariant, not just a value

A counter is the tutorial case. Real locks usually guard *several* fields that must stay consistent with each other — and that's the actual reason to lock. Put the related fields in **one struct behind one mutex**, so no thread can ever observe them half-updated:

```rust
use std::sync::{Arc, Mutex};
use std::thread;

/// The invariant: `total` must always equal the sum of all balances.
struct Ledger {
    alice: i64,
    bob: i64,
    total: i64,
}

impl Ledger {
    fn transfer_a_to_b(&mut self, amount: i64) {
        self.alice -= amount;
        self.bob += amount;
        // `total` is unchanged by a transfer — the invariant still holds.
    }
    fn invariant_holds(&self) -> bool {
        self.alice + self.bob == self.total
    }
}

fn main() {
    // 8 threads × 1000 transfers of 1 each = 8000 moved in total.
    let ledger = Arc::new(Mutex::new(Ledger { alice: 8000, bob: 0, total: 8000 }));
    let mut handles = vec![];

    for _ in 0..8 {
        let ledger = Arc::clone(&ledger);
        handles.push(thread::spawn(move || {
            for _ in 0..1000 {
                let mut l = ledger.lock().unwrap();
                l.transfer_a_to_b(1);
                // Both fields change under ONE lock, so no other thread can
                // ever see alice already debited but bob not yet credited.
                debug_assert!(l.invariant_holds());
            }
        }));
    }
    for h in handles { h.join().unwrap(); }

    let l = ledger.lock().unwrap();
    println!("alice {} + bob {} = {} (total {})", l.alice, l.bob, l.alice + l.bob, l.total);
    println!("invariant holds: {}", l.invariant_holds());
}
```

> [!best] One lock per invariant, not one lock per field
> A tempting mistake is `Mutex<i64>` for `alice` and another for `bob`. Now a transfer takes two locks, and between them another thread can see money that has left one account and not arrived in the other — the total looks wrong for an instant. **The unit of locking should be the unit of consistency.** Group the fields that must agree into one struct under one mutex; use separate mutexes only for data that is genuinely independent (which also gets you more parallelism, so it's worth doing when it's true).

## Two locked operations are not one atomic operation

This is the subtlest and most common shared-state bug, and the compiler cannot catch it. Each `lock()` is atomic *individually* — but a sequence of them is not:

```rust,ignore
// ❌ RACY: check and insert are two separate critical sections.
if !cache.lock().unwrap().contains_key(&key) {   // lock acquired… and released
    let value = expensive_compute(&key);
    cache.lock().unwrap().insert(key, value);     // lock acquired again
}
```

Between the two locks, another thread can run the identical check, also find the key missing, and also compute and insert. You get duplicated work, and if the insert isn't idempotent, corrupted state. This shape is called a **time-of-check to time-of-use (TOCTOU)** race.

<figure class="diagram">
<svg viewBox="0 0 670 215" role="img" aria-label="Two threads each lock a cache, find a key missing, release the lock, compute a value, then lock again and insert. Because the check and the insert are separate critical sections, both threads do the expensive work and both insert.">
  <style>
    .tc-h { font: 700 11.5px var(--font-sans); }
    .tc-m { font: 600 10px var(--font-mono); fill: var(--text); }
    .tc-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .tc-lock { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.3; }
    .tc-un { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; stroke-dasharray: 3 2; }
    .tc-bad { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.6; }
  </style>
  <text x="12" y="16" class="tc-h" fill="var(--red)">Check and insert in separate critical sections</text>
  <text x="12" y="40" class="tc-m">T1</text>
  <rect x="40" y="28" width="96" height="18" rx="3" class="tc-lock"/><text x="48" y="41" class="tc-c">lock: missing?</text>
  <rect x="140" y="28" width="150" height="18" rx="3" class="tc-un"/><text x="148" y="41" class="tc-c">UNLOCKED — computing</text>
  <rect x="294" y="28" width="80" height="18" rx="3" class="tc-lock"/><text x="302" y="41" class="tc-c">lock: insert</text>
  <text x="12" y="76" class="tc-m">T2</text>
  <rect x="100" y="64" width="96" height="18" rx="3" class="tc-lock"/><text x="108" y="77" class="tc-c">lock: missing?</text>
  <rect x="200" y="64" width="150" height="18" rx="3" class="tc-un"/><text x="208" y="77" class="tc-c">UNLOCKED — computing</text>
  <rect x="354" y="64" width="80" height="18" rx="3" class="tc-lock"/><text x="362" y="77" class="tc-c">lock: insert</text>
  <rect x="100" y="24" width="96" height="62" rx="4" fill="none" stroke="var(--red)" stroke-width="1.6" stroke-dasharray="4 3"/>
  <text x="448" y="42" class="tc-c">both saw "missing" —</text>
  <text x="448" y="58" class="tc-c">the gap between the two</text>
  <text x="448" y="74" class="tc-c">locks is where it breaks</text>
  <rect x="12" y="96" width="430" height="24" rx="4" class="tc-bad"/>
  <text x="22" y="112" class="tc-m">expensive work done TWICE; second insert overwrites the first</text>
  <text x="12" y="148" class="tc-h" fill="var(--green)">One critical section covering the whole decision</text>
  <text x="12" y="172" class="tc-m">T1</text>
  <rect x="40" y="160" width="230" height="18" rx="3" class="tc-lock"/><text x="48" y="173" class="tc-c">lock: check AND insert together (entry API)</text>
  <text x="12" y="196" class="tc-m">T2</text>
  <rect x="274" y="184" width="160" height="18" rx="3" class="tc-lock"/><text x="282" y="197" class="tc-c">lock: sees it present</text>
  <path d="M270 169 L272 186" stroke="var(--text-mute)" stroke-width="1.2"/>
  <text x="448" y="180" class="tc-c">T2 waits, then finds the</text>
  <text x="448" y="196" class="tc-c">key already there. Work done once.</text>
</svg>
<figcaption>Atomicity applies to <i>one</i> critical section. If a decision spans two locks, another thread can act in the gap.</figcaption>
</figure>

The fix is to make the whole read-decide-write sequence a **single** critical section:

```rust
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;
use std::sync::atomic::{AtomicUsize, Ordering};

static COMPUTES: AtomicUsize = AtomicUsize::new(0);

fn expensive_compute(key: &str) -> String {
    COMPUTES.fetch_add(1, Ordering::Relaxed); // count how often we really compute
    format!("value-for-{key}")
}

fn main() {
    let cache: Arc<Mutex<HashMap<String, String>>> = Arc::new(Mutex::new(HashMap::new()));
    let mut handles = vec![];

    for _ in 0..8 {
        let cache = Arc::clone(&cache);
        handles.push(thread::spawn(move || {
            // ONE lock held across the whole check-and-insert decision.
            let mut guard = cache.lock().unwrap();
            guard
                .entry("shared-key".to_string())
                .or_insert_with(|| expensive_compute("shared-key"));
        }));
    }
    for h in handles { h.join().unwrap(); }

    println!("cache entries : {}", cache.lock().unwrap().len());
    println!("times computed: {}", COMPUTES.load(Ordering::Relaxed));
    println!("(with the racy two-lock version, this could be up to 8)");
}
```

`HashMap::entry` exists precisely for this: it performs the lookup and the insertion as one operation, so there's no gap to race in.

> [!mistake] Releasing a lock between "check" and "act" is the bug
> Whenever you find yourself writing `if <something about the locked data> { ... lock again ... }`, stop. Either hold **one** guard across the whole decision, or use an API that fuses the steps (`entry().or_insert_with()`, `fetch_add`, `compare_exchange`). The giveaway is calling `.lock()` twice in one logical operation — the mutex is doing its job perfectly on each call, and your logic is still wrong.

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

> [!warning] Never take a second `read()` while already holding one
> `RwLock` looks forgiving because readers share, but recursive read locking can **deadlock**. If a writer is queued between your two `read()` calls, many implementations make the second reader wait behind that writer (to stop writers from starving) — while you're still holding the first read guard that the writer is waiting on. Classic circular wait. The same applies to calling `write()` while holding any guard on the same lock. Keep guard scopes flat: acquire, use, drop.

## Keep critical sections short

A lock is a serialization point: while one thread holds it, every other thread that wants it is *stopped*. The length of your critical section is therefore the width of the bottleneck:

```rust,ignore
// ❌ The lock is held across slow I/O — every other thread waits on the network.
let mut cache = cache.lock().unwrap();
let data = fetch_from_network(&key);   // 200 ms with the lock held!
cache.insert(key, data);

// ✅ Do the slow work outside, hold the lock only for the update.
let data = fetch_from_network(&key);   // nobody is blocked during this
cache.lock().unwrap().insert(key, data);
```

> [!performance] What belongs inside a lock, and what doesn't
> **Inside:** reading and writing the protected fields, and any check that must be consistent with those writes (per the TOCTOU section above).
> **Outside:** network calls, file I/O, expensive computation, logging, allocation of large values, and *anything that can panic in a way you'd rather not poison the lock with*.
>
> A useful discipline is to copy what you need out, release the guard, do the work, then re-acquire to write back — accepting that you must handle the "someone else changed it meanwhile" case. And never call **unknown code** (a user callback, a trait method you don't control) while holding a lock: it might try to take the same lock, and you've deadlocked yourself.

## Deadlock: the hazard locks bring with them

If thread A holds lock 1 and wants lock 2, while thread B holds lock 2 and wants lock 1, **neither can ever proceed**. Nothing errors; the program simply stops:

<figure class="diagram">
<svg viewBox="0 0 660 205" role="img" aria-label="Thread A holds mutex one and waits for mutex two while thread B holds mutex two and waits for mutex one, forming a circular wait. Locking both in a consistent global order breaks the cycle.">
  <style>
    .dk-h { font: 700 11.5px var(--font-sans); }
    .dk-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .dk-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .dk-t { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.4; }
    .dk-l { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.4; }
    .dk-ok { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.4; }
  </style>
  <text x="12" y="16" class="dk-h" fill="var(--red)">✗ Circular wait — deadlock</text>
  <rect x="20" y="30" width="96" height="28" rx="5" class="dk-t"/><text x="32" y="49" class="dk-m">thread A</text>
  <rect x="20" y="120" width="96" height="28" rx="5" class="dk-t"/><text x="32" y="139" class="dk-m">thread B</text>
  <rect x="200" y="30" width="96" height="28" rx="5" class="dk-l"/><text x="212" y="49" class="dk-m">mutex 1</text>
  <rect x="200" y="120" width="96" height="28" rx="5" class="dk-l"/><text x="212" y="139" class="dk-m">mutex 2</text>
  <path d="M118 44 L198 44" stroke="var(--green)" stroke-width="1.8" marker-end="url(#dka)"/>
  <text x="126" y="38" class="dk-c">holds</text>
  <path d="M118 134 L198 134" stroke="var(--green)" stroke-width="1.8" marker-end="url(#dka)"/>
  <text x="126" y="128" class="dk-c">holds</text>
  <path d="M200 52 C 150 80, 150 100, 200 126" stroke="var(--red)" stroke-width="1.8" fill="none" stroke-dasharray="4 3" marker-end="url(#dkb)"/>
  <text x="120" y="92" class="dk-c" fill="var(--red)">A wants 2</text>
  <path d="M296 126 C 346 100, 346 80, 296 52" stroke="var(--red)" stroke-width="1.8" fill="none" stroke-dasharray="4 3" marker-end="url(#dkb)"/>
  <text x="306" y="92" class="dk-c" fill="var(--red)">B wants 1</text>
  <text x="20" y="176" class="dk-c">Neither releases. No error, no CPU use —</text>
  <text x="20" y="192" class="dk-c">the program just stops responding forever.</text>
  <text x="392" y="16" class="dk-h" fill="var(--green)">✓ Consistent order — no cycle</text>
  <rect x="392" y="30" width="110" height="28" rx="5" class="dk-t"/><text x="404" y="49" class="dk-m">thread A</text>
  <rect x="392" y="70" width="110" height="28" rx="5" class="dk-t"/><text x="404" y="89" class="dk-m">thread B</text>
  <rect x="540" y="30" width="100" height="28" rx="5" class="dk-ok"/><text x="552" y="49" class="dk-m">1 then 2</text>
  <rect x="540" y="70" width="100" height="28" rx="5" class="dk-ok"/><text x="552" y="89" class="dk-m">1 then 2</text>
  <path d="M504 44 L538 44" stroke="var(--green)" stroke-width="1.6" marker-end="url(#dka)"/>
  <path d="M504 84 L538 84" stroke="var(--green)" stroke-width="1.6" marker-end="url(#dka)"/>
  <text x="392" y="126" class="dk-c">Both acquire in the SAME global order,</text>
  <text x="392" y="142" class="dk-c">so whoever gets mutex 1 first finishes first.</text>
  <text x="392" y="158" class="dk-c">The other simply waits, then proceeds.</text>
  <text x="392" y="182" class="dk-c">A cycle needs someone going 2 → 1.</text>
  <text x="392" y="196" class="dk-c">Forbid that, and deadlock is impossible.</text>
  <defs>
    <marker id="dka" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--green)"/></marker>
    <marker id="dkb" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--red)"/></marker>
  </defs>
</svg>
<figcaption>Deadlock needs a <b>cycle</b> in "who waits for whom". A consistent global lock order makes a cycle impossible.</figcaption>
</figure>

```rust,ignore
// ❌ This deadlocks roughly half the time — do not run it in real code.
let a = Arc::new(Mutex::new(0));
let b = Arc::new(Mutex::new(0));

let t1 = { let (a, b) = (a.clone(), b.clone()); thread::spawn(move || {
    let _g1 = a.lock().unwrap();
    thread::sleep(Duration::from_millis(10));
    let _g2 = b.lock().unwrap();   // waits for B's lock
})};

let t2 = { let (a, b) = (a.clone(), b.clone()); thread::spawn(move || {
    let _g1 = b.lock().unwrap();   // opposite order!
    thread::sleep(Duration::from_millis(10));
    let _g2 = a.lock().unwrap();   // waits for A's lock
})};
```

> [!warning] Deadlock is a logic error — the compiler cannot save you
> This is the honest limit of "fearless concurrency." Rust guarantees no *data races*; it does **not** guarantee no *deadlocks*. Both threads above are perfectly memory-safe and the program still hangs forever. Four rules prevent nearly all of it:
> 1. **Impose a global lock order** and always acquire in it (e.g. sort by address, by ID, or just "always accounts before ledger").
> 2. **Hold one lock at a time** whenever you can — the simplest way to make a cycle impossible.
> 3. **Never call unknown code** (callbacks, trait methods, `Drop` impls you don't control) while holding a lock.
> 4. **Don't lock recursively.** `std::sync::Mutex` is *not* reentrant: locking it twice from the same thread deadlocks instantly rather than counting.
>
> When you genuinely can't guarantee ordering, `try_lock()` returns immediately with an `Err` instead of blocking, letting you back off and retry — a pattern worth knowing but rarely needed if you follow rule 1.

## Poisoning, and how to recover from it

If a thread **panics** while holding a lock, Rust marks the mutex **poisoned** — subsequent `lock()` calls return `Err`. That's why you see `.lock().unwrap()` everywhere: it propagates the poison. The rationale is that the panicking thread may have left the data half-updated, breaking exactly the invariant the lock existed to protect.

Sometimes you know the data is still fine, or you can repair it. `PoisonError::into_inner()` gives you the guard anyway:

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let data = Arc::new(Mutex::new(vec![1, 2, 3]));

    // A thread panics while holding the lock → the mutex becomes poisoned.
    let d = Arc::clone(&data);
    let _ = thread::spawn(move || {
        let mut guard = d.lock().unwrap();
        guard.push(4);
        panic!("died mid-update");
    })
    .join(); // ignore the Err — we expect this thread to fail

    // Now every lock() returns Err(PoisonError).
    println!("poisoned? {}", data.is_poisoned());

    match data.lock() {
        Ok(guard) => println!("clean lock: {guard:?}"),
        Err(poisoned) => {
            // We've decided the data is still usable — take it anyway.
            let guard = poisoned.into_inner();
            println!("recovered after poisoning: {guard:?}");
        }
    }

    // A common shorthand when you've decided poisoning is acceptable:
    let guard = data.lock().unwrap_or_else(|e| e.into_inner());
    println!("value is {guard:?}");
}
```

> [!note] Poisoning is a warning, not a verdict
> Reaching for `unwrap_or_else(|e| e.into_inner())` everywhere defeats the purpose; reaching for `.unwrap()` everywhere turns one thread's panic into a cascade of panics across every thread that touches the lock. The right question is: *could a panic at any point in my critical section leave this data inconsistent?* For a `Vec` you were only pushing to, almost certainly not — recover. For a half-applied financial transfer, absolutely — propagate, or rebuild the state from scratch. Note also that `RwLock` poisons only on a **writer** panic, and that some third-party mutexes (notably `parking_lot`) don't implement poisoning at all, trading the safety net for speed and a simpler API.

## Choosing your synchronization tool

| Need | Reach for | Chapter |
|---|---|---|
| One shared value, mixed reads and writes | `Arc<Mutex<T>>` | this one |
| Read-heavy, write-rare | `Arc<RwLock<T>>` | this one |
| A single counter or flag | `AtomicUsize`, `AtomicBool` — no lock at all | [Atomics](#/ch/atomics) |
| Hand data off between threads | a channel | [Channels](#/ch/channels) |
| One-time initialization | `OnceLock`, `LazyLock` | [OnceLock & LazyLock](#/ch/lazy-statics) |
| Wait until a condition becomes true | `Condvar` | [std::sync](#/ch/std-sync) |
| Shared mutation on **one** thread | `RefCell<T>` (no locking cost) | [RefCell](#/ch/refcell) |
| Parallel iteration over a collection | Rayon — often no sharing needed | [Rayon](#/ch/rayon) |

> [!best] Prefer *not* sharing over sharing well
> The fastest and least buggy lock is the one you never take. Before reaching for `Arc<Mutex<T>>`, ask whether the work can be restructured so threads own **disjoint** data (the fork-join pattern from [Threads](#/ch/threads)), or whether ownership can be **passed** down a [channel](#/ch/channels) instead of shared. Shared mutable state is the source of deadlocks, contention, and poisoning; a design that avoids it sidesteps all three at once. Reach for a mutex when the data genuinely is shared — not as the default way to get data to a thread.

> [!warning] Don't hold a `std::sync` guard across an `.await`
> In async code, a `MutexGuard` held across an `.await` point makes the whole future non-`Send`, so `tokio::spawn` will reject it — and even where it compiles, you're blocking a runtime worker rather than yielding. Either shrink the guard's scope so it doesn't span the await, or use `tokio::sync::Mutex`, whose guard *is* `Send`. See [Send, Sync & Thread Safety](#/ch/send-sync) for why, and [The Tokio Runtime](#/ch/tokio) for the async-aware locks.

## Summary

- A **`Mutex<T>`** allows only one thread to access its data at a time; you must **`lock()`** to reach the value, and the lock releases automatically when the guard drops.
- Because the mutex **owns** the data, you *cannot* access it without locking — forgetting to lock is impossible.
- Share a mutex across threads with **`Arc<Mutex<T>>`** — the canonical shared-mutable-state pattern (`Arc` = many owners, `Mutex` = one accessor at a time).
- Lock the **unit of consistency**: group fields that must agree under one mutex, so no thread sees a half-applied update.
- **Two locked operations are not one atomic operation** — a check and an act in separate critical sections is a **TOCTOU race**. Hold one guard across the decision, or use a fused API like `entry().or_insert_with()`.
- **`RwLock`** permits many concurrent readers or one writer — use it for read-heavy data; never take a second `read()` while holding one.
- **Keep critical sections short**: no network calls, file I/O, or unknown callbacks while holding a lock.
- **Deadlock is a logic error the compiler cannot catch.** Prevent it with a consistent global lock order, one lock at a time, no unknown code under a lock, and no recursive locking (`std::sync::Mutex` is not reentrant).
- **Poisoning** flags data that a panic may have left inconsistent; recover deliberately with `into_inner()` when you know it's safe, propagate when it isn't.
- The best lock is often **no lock** — prefer disjoint ownership or channels when the design allows.

> [!exercise] Try it yourself
> 1. Have 100 threads each increment an `Arc<Mutex<i32>>` and confirm the total is exactly 100.
> 2. Build an `Arc<Mutex<Vec<String>>>` and let several threads each push a message; print the collected messages.
> 3. Rewrite a read-heavy example with `RwLock` and open two `read()` guards at once to see they coexist.
> 4. Rewrite the `Ledger` with `alice` and `bob` in **separate** mutexes. Add a check that reads both and verifies the total — then run it under load and watch the invariant break.
> 5. Implement the racy check-then-insert cache and count how many times `expensive_compute` runs with 8 threads. Then fix it with `entry().or_insert_with()` and compare.
> 6. Write the two-lock deadlock from this chapter and run it. Then fix it by making both threads lock in the same order.
> 7. Panic while holding a lock, then recover the data with `into_inner()`. Decide for your specific data whether recovering was actually safe.
> 8. Replace an `Arc<Mutex<u64>>` counter with an `AtomicU64` and compare both the code and the timing under 8 threads.

Two traits quietly make all of this safe — the compiler uses them to decide what may cross thread boundaries at all. Meet **`Send` and `Sync`**.
