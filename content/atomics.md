<h1><span class="h1-kicker">Fearless Concurrency</span>Atomics & Lock-Free Basics</h1>

For a single shared counter or flag, wrapping it in a `Mutex` works — but it's heavier than necessary. **Atomic types** let multiple threads update a value safely *without a lock*, using special CPU instructions that are guaranteed to be indivisible. This is your first taste of **lock-free** programming — and, as you'll see, it's also the machinery that locks themselves are built from. This chapter goes deep but stays practical: how atomics work, why you'd use them, how to use them in real projects, and the tips and traps around them.

## What "atomic" means, and the problem it solves

> [!jargon] Atomic operation
> An **atomic** operation completes in a single, indivisible step — no other thread can observe it half-done. "Add 1 to this counter" normally involves read-modify-write (three steps), and two threads doing it at once can lose an update. An *atomic add* does all three as one uninterruptible instruction, so no update is ever lost. ("Atomic" = from Greek *atomos*, "indivisible.")

To feel *why* this matters, look at what happens with an ordinary `+= 1` when two threads run it at the same time. Incrementing is really three micro-steps — **read** the value, **add** one, **write** it back — and the threads can interleave so both read the same old value and both write the same new one. One increment silently vanishes. An atomic performs all three as one hardware step, so that can't happen:

<figure class="diagram">
<svg viewBox="0 0 700 240" role="img" aria-label="Two threads doing a non-atomic increment can both read 0 and both write 1, losing an update; an atomic fetch_add does read-modify-write as one indivisible step so the result is correct">
  <style>
    .at-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .at-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .at-h { font: 700 12px var(--font-sans); }
    .bad { fill: var(--red-soft);   stroke: var(--red);   stroke-width: 1.3; }
    .ok  { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.3; }
    .step{ fill: var(--surface-2);  stroke: var(--border-strong); stroke-width: 1.2; }
  </style>
  <text x="14" y="20" class="at-h" fill="var(--red)">Non-atomic  counter += 1  (two threads interleave)</text>
  <rect x="14"  y="30" width="150" height="24" class="step"/><text x="24" y="47" class="at-b">T1 read → 0</text>
  <rect x="14"  y="58" width="150" height="24" class="step"/><text x="24" y="75" class="at-b">T2 read → 0</text>
  <rect x="14"  y="86" width="150" height="24" class="step"/><text x="24" y="103" class="at-b">T1 write 1</text>
  <rect x="14"  y="114" width="150" height="24" class="bad"/><text x="24" y="131" class="at-b">T2 write 1</text>
  <text x="180" y="103" class="at-c">both saw 0, both wrote 1…</text>
  <rect x="180" y="114" width="150" height="24" class="bad"/><text x="190" y="131" class="at-b">result = 1  ✗ (lost!)</text>
  <text x="380" y="20" class="at-h" fill="var(--green)">Atomic  fetch_add(1)  (one indivisible step each)</text>
  <rect x="380" y="30" width="200" height="24" class="ok"/><text x="390" y="47" class="at-b">T1: read-add-write → 0→1</text>
  <rect x="380" y="58" width="200" height="24" class="ok"/><text x="390" y="75" class="at-b">T2: read-add-write → 1→2</text>
  <text x="380" y="103" class="at-c">no thread can slip in mid-step…</text>
  <rect x="380" y="114" width="200" height="24" class="ok"/><text x="390" y="131" class="at-b">result = 2  ✓</text>
</svg>
<figcaption>The <b>lost update</b>: a plain <code>+=</code> is three steps threads can interleave. An atomic RMW is one step, so every increment counts.</figcaption>
</figure>

Under the hood, the CPU does this with a special read-modify-write instruction (a `LOCK`-prefixed op on x86, a load-linked/store-conditional pair on ARM) plus the cache-coherence protocol that keeps every core's view of that memory location consistent. You don't write any of that — you just call a method — but it's why atomics are *slightly* more expensive than a plain variable and *much* cheaper than a lock. (In fact, safe Rust won't even let you write the buggy version on the left: sharing a plain `&mut` across threads doesn't compile — you're forced to reach for an atomic or a `Mutex`.)

## The atomic types

`std::sync::atomic` provides an atomic version of each primitive integer, plus a bool and a raw pointer:

| Type | Use it for |
|---|---|
| `AtomicBool` | flags (running?, ready?, shutdown?) |
| `AtomicI8 … AtomicI64`, `AtomicU8 … AtomicU64` | integers of a fixed width |
| `AtomicUsize` / `AtomicIsize` | counters, sizes, indices (pointer-width) |
| `AtomicPtr<T>` | raw pointers — for hand-built lock-free structures |

There is no atomic float; store the bits in an `AtomicU64` (`f64::to_bits` / `from_bits`) if you must. Note too that 64-bit atomics aren't available on every 32-bit target — `AtomicUsize` is the portable choice for counters.

## A lock-free counter

Here's the same "10 threads increment a counter" example from the [Mutex chapter](#/ch/shared-state), but with an atomic — no lock, no guard:

```rust
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::thread;

fn main() {
    let counter = Arc::new(AtomicUsize::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        handles.push(thread::spawn(move || {
            // Atomically add 1 — no lock needed, no update ever lost:
            counter.fetch_add(1, Ordering::Relaxed);
        }));
    }

    for h in handles {
        h.join().unwrap();
    }
    println!("Count: {}", counter.load(Ordering::Relaxed)); // exactly 10
}
```

Notice there's no `.lock()` and no guard to drop — `fetch_add` is a single safe operation. Notice also that the atomic itself provides *interior mutability*: we mutate it through a shared `&` reference (that's why `Arc<AtomicUsize>` works without a `Mutex`).

> [!performance] Atomics are cheaper than a lock — for simple values
> For a lone counter or flag, an atomic avoids the overhead of acquiring and releasing a mutex, and can't deadlock. But atomics only cover **single primitive values**. The moment you need to keep *two* values consistent, or protect a `Vec`/`HashMap`, you need a `Mutex` (or a proper lock-free data-structure crate). Atomics are a scalpel, not a general tool.

## The common atomic operations

```rust
use std::sync::atomic::{AtomicI64, AtomicBool, Ordering};

fn main() {
    let n = AtomicI64::new(10);

    n.store(100, Ordering::Relaxed);              // set a new value
    let current = n.load(Ordering::Relaxed);       // read the value
    let previous = n.fetch_add(5, Ordering::Relaxed); // add, return the OLD value
    println!("current was {current}, before add {previous}, now {}", n.load(Ordering::Relaxed));

    let flag = AtomicBool::new(false);
    flag.store(true, Ordering::Relaxed);
    println!("flag = {}", flag.load(Ordering::Relaxed));
}
```

| Method | Does |
|--------|------|
| `load(ordering)` | read the current value |
| `store(v, ordering)` | write a new value |
| `fetch_add(v, …)` / `fetch_sub` | add/subtract, return the **old** value |
| `fetch_and` / `fetch_or` / `fetch_xor` | bitwise op, return the old value |
| `swap(v, …)` | set a new value, return the old |
| `compare_exchange(old, new, …)` | set to `new` **only if** it currently equals `old` |
| `fetch_update(…, f)` | apply a closure in a retry loop (a CAS loop for you) |

## `compare_exchange` and the CAS loop

The real power tool is **`compare_exchange`** (often called *CAS*, compare-and-swap): "set the value to `new`, but *only if* it's still `old`." If another thread changed it in the meantime, the swap fails and hands you the actual value, so you can retry:

```rust
use std::sync::atomic::{AtomicUsize, Ordering};

fn main() {
    let value = AtomicUsize::new(5);

    // "Change 5 → 10, but only if it's still 5":
    let result = value.compare_exchange(5, 10, Ordering::SeqCst, Ordering::SeqCst);
    println!("first attempt: {result:?}");   // Ok(5) — succeeded

    // Now it's 10, so trying to swap from 5 again fails:
    let result = value.compare_exchange(5, 20, Ordering::SeqCst, Ordering::SeqCst);
    println!("second attempt: {result:?}");  // Err(10) — it wasn't 5
    println!("final value: {}", value.load(Ordering::SeqCst)); // 10
}
```

Most lock-free updates that are *more* than a plain add use this in a **retry loop**: read the current value, compute the new one, try to swap — and if someone beat you to it, loop with the value they left. Here's a thread-safe "keep the maximum" (a high-score tracker), which no single `fetch_*` can express:

<figure class="diagram">
<svg viewBox="0 0 560 200" role="img" aria-label="A compare-and-swap loop: load the current value, compute a new value, try compare_exchange; on success finish, on failure retry with the actual value">
  <style>
    .cl-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .cl-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .box { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
    .try { fill: var(--amber-soft); stroke: var(--amber); stroke-width: 1.4; }
    .ok  { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.4; }
  </style>
  <rect x="30" y="20" width="180" height="30" rx="6" class="box"/><text x="42" y="40" class="cl-b">load current value</text>
  <rect x="30" y="66" width="180" height="30" rx="6" class="box"/><text x="42" y="86" class="cl-b">compute new value</text>
  <rect x="30" y="112" width="180" height="34" rx="6" class="try"/><text x="42" y="133" class="cl-b">compare_exchange</text>
  <path d="M120 50 L120 64" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#cla)"/>
  <path d="M120 96 L120 110" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#cla)"/>
  <rect x="300" y="112" width="180" height="34" rx="6" class="ok"/><text x="312" y="133" class="cl-b">Ok → done</text>
  <path d="M210 129 L298 129" stroke="var(--green)" stroke-width="1.4" marker-end="url(#cla)"/>
  <path d="M120 146 C 120 180, 20 150, 20 35 L 28 35" stroke="var(--rust-500)" stroke-width="1.4" fill="none" marker-end="url(#clb)"/>
  <text x="150" y="176" class="cl-c" fill="var(--rust-600)">Err(actual) → retry with the real value</text>
  <defs>
    <marker id="cla" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker>
    <marker id="clb" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker>
  </defs>
</svg>
<figcaption>The CAS loop: try to swap; if the value moved under you, retry with what's actually there. This is the skeleton of most lock-free updates.</figcaption>
</figure>

```rust
use std::sync::atomic::{AtomicU64, Ordering};

fn record_high_score(best: &AtomicU64, candidate: u64) {
    let mut current = best.load(Ordering::Relaxed);
    loop {
        if candidate <= current {
            return; // not a new high score
        }
        // Try to install our candidate as the new max:
        match best.compare_exchange_weak(current, candidate, Ordering::Relaxed, Ordering::Relaxed) {
            Ok(_) => return,                 // we set it
            Err(actual) => current = actual, // someone else moved it — retry with their value
        }
    }
}

fn main() {
    let best = AtomicU64::new(0);
    record_high_score(&best, 5);
    record_high_score(&best, 3); // ignored (3 < 5)
    record_high_score(&best, 9);
    println!("high score = {}", best.load(Ordering::Relaxed)); // 9

    // `fetch_update` writes that whole loop for you:
    let _ = best.fetch_update(Ordering::Relaxed, Ordering::Relaxed, |v| Some(v.max(7)));
    println!("still = {}", best.load(Ordering::Relaxed)); // 9
}
```

> [!tip] `compare_exchange` vs `compare_exchange_weak`
> Inside a retry loop, prefer **`compare_exchange_weak`**: on some CPUs (ARM) it's cheaper but may fail *spuriously* (report a mismatch even when the value matched). That's harmless in a loop — you just retry — and it lets the compiler emit the single-instruction form. Use the plain **`compare_exchange`** for a *one-shot* swap where a spurious failure would be wrong, like the "change 5 → 10 exactly once" example above.

## Building a lock *from* an atomic: the spinlock

Here's the payoff that ties atomics and locks together: **a lock is just an atomic flag plus a compare-and-swap.** A `Mutex` internally uses an atomic to record "locked or free," and `lock()` is a CAS that flips it from free → locked. The simplest possible version is a **spinlock**: to acquire it, spin in a loop trying to swap the flag `false → true`; the winner proceeds, everyone else keeps trying until the holder stores `false` to release.

<figure class="diagram">
<svg viewBox="0 0 640 170" role="img" aria-label="A spinlock is an AtomicBool: acquiring compare-exchanges false to true, other threads spin, and releasing stores false">
  <style>
    .sp-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .sp-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .free { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .lock { fill: var(--red-soft);   stroke: var(--red);   stroke-width: 1.5; }
  </style>
  <rect x="40" y="55" width="150" height="52" rx="10" class="free"/><text x="60" y="78" class="sp-b" fill="var(--green)">false</text><text x="60" y="96" class="sp-c">FREE</text>
  <rect x="440" y="55" width="150" height="52" rx="10" class="lock"/><text x="460" y="78" class="sp-b" fill="var(--red)">true</text><text x="460" y="96" class="sp-c">LOCKED</text>
  <path d="M192 72 L438 72" stroke="var(--text-mute)" stroke-width="1.6" marker-end="url(#spa)"/>
  <text x="222" y="64" class="sp-c">acquire: compare_exchange(false → true, Acquire)</text>
  <path d="M438 96 L194 96" stroke="var(--text-mute)" stroke-width="1.6" marker-end="url(#spa)"/>
  <text x="240" y="118" class="sp-c">release: store(false, Release)</text>
  <text x="440" y="140" class="sp-c">losers spin_loop() and retry ↻</text>
  <defs><marker id="spa" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>A spinlock is one <code>AtomicBool</code>: <code>compare_exchange</code> to grab it, <code>store(false)</code> to release. This is a <code>Mutex</code>'s beating heart.</figcaption>
</figure>

```rust
use std::cell::UnsafeCell;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

struct SpinLock<T> {
    locked: AtomicBool,        // the flag: false = free, true = held
    data: UnsafeCell<T>,       // the protected data
}

// Promise the compiler it's safe to share between threads (the lock enforces it):
unsafe impl<T: Send> Sync for SpinLock<T> {}

impl<T> SpinLock<T> {
    fn new(value: T) -> Self {
        SpinLock { locked: AtomicBool::new(false), data: UnsafeCell::new(value) }
    }

    fn lock(&self) -> &mut T {
        // Spin until WE flip locked from false → true (i.e. we acquired it):
        while self
            .locked
            .compare_exchange(false, true, Ordering::Acquire, Ordering::Relaxed)
            .is_err()
        {
            std::hint::spin_loop(); // hint the CPU we're busy-waiting
        }
        // We hold the lock, so exclusive access is now safe:
        unsafe { &mut *self.data.get() }
    }

    fn unlock(&self) {
        self.locked.store(false, Ordering::Release); // publish our writes, free the lock
    }
}

fn main() {
    let lock = Arc::new(SpinLock::new(0u64));
    let mut handles = vec![];
    for _ in 0..8 {
        let lock = Arc::clone(&lock);
        handles.push(thread::spawn(move || {
            for _ in 0..1000 {
                let v = lock.lock();
                *v += 1;           // protected critical section
                lock.unlock();
            }
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
    println!("total = {}", unsafe { *lock.data.get() }); // 8000, exactly
}
```

That's a real, working mutual-exclusion lock in ~20 lines, built from one atomic. Note the **`Acquire`** on lock and **`Release`** on unlock — that pairing (next section) is what makes the writes inside the critical section visible to the next thread that acquires the lock.

> [!warning] Don't ship this spinlock — use `std::sync::Mutex`
> Our spinlock **busy-waits**, burning a whole CPU core while it spins. That's only acceptable when the critical section is tiny and contention is rare. A real `Mutex` is smarter: it briefly spins, then asks the OS to *park* the waiting thread (sleep it) so the core is free for other work, and wakes it when the lock frees. Build a spinlock to *understand* locks; reach for [`Mutex`/`RwLock`](#/ch/shared-state) in real code. (The `parking_lot` crate offers faster drop-in replacements.)

## Memory ordering: `Relaxed`, `Acquire`/`Release`, `SeqCst`

Every atomic operation takes an **`Ordering`** argument. It controls how that operation may be reordered relative to *other* memory accesses — because CPUs and compilers freely reorder ordinary reads and writes for speed, and atomics are how you rein that in where it matters. Start with these three levels:

<figure class="diagram">
<svg viewBox="0 0 660 150" role="img" aria-label="Relaxed only orders the atomic itself, Acquire/Release publish and subscribe to surrounding writes, SeqCst is a single global order">
  <style>
    .mo-h { font: 700 12px var(--font-mono); fill: var(--text); }
    .mo-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .a { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .b { fill: var(--blue-soft);  stroke: var(--blue);  stroke-width: 1.5; }
    .c { fill: var(--rust-100);   stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="12" y="24" width="205" height="104" rx="10" class="a"/>
  <text x="26" y="46" class="mo-h" fill="var(--green)">Relaxed</text>
  <text x="26" y="68" class="mo-c">Only the atomic itself is</text>
  <text x="26" y="84" class="mo-c">consistent. Fastest. Perfect</text>
  <text x="26" y="100" class="mo-c">for standalone counters &amp;</text>
  <text x="26" y="116" class="mo-c">metrics.</text>
  <rect x="227" y="24" width="205" height="104" rx="10" class="b"/>
  <text x="241" y="46" class="mo-h" fill="var(--blue)">Acquire / Release</text>
  <text x="241" y="68" class="mo-c">A Release store "publishes"</text>
  <text x="241" y="84" class="mo-c">prior writes; an Acquire load</text>
  <text x="241" y="100" class="mo-c">that sees it "subscribes" to</text>
  <text x="241" y="116" class="mo-c">them. Locks &amp; flags+data.</text>
  <rect x="442" y="24" width="206" height="104" rx="10" class="c"/>
  <text x="456" y="46" class="mo-h" fill="var(--rust-600)">SeqCst</text>
  <text x="456" y="68" class="mo-c">One single global order all</text>
  <text x="456" y="84" class="mo-c">threads agree on. Strongest,</text>
  <text x="456" y="100" class="mo-c">easiest to reason about, the</text>
  <text x="456" y="116" class="mo-c">safe default when unsure.</text>
</svg>
<figcaption>Three rungs: <b>Relaxed</b> (just the atomic), <b>Acquire/Release</b> (publish/subscribe surrounding data), <b>SeqCst</b> (one global order).</figcaption>
</figure>

The key idea beyond `Relaxed` is the **publish/subscribe** pairing. A thread writes some data, then does a **`Release`** store to a flag — that store "publishes" everything it wrote before. Another thread does an **`Acquire`** load of the same flag; the moment it *sees* the flag, it is guaranteed to also see all the data written before the release. This is exactly how the flag-then-data hand-off works:

```rust
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;

fn main() {
    let ready = Arc::new(AtomicBool::new(false));
    let data = Arc::new(AtomicU64::new(0));

    let (r, d) = (Arc::clone(&ready), Arc::clone(&data));
    let producer = thread::spawn(move || {
        d.store(42, Ordering::Relaxed);   // 1. write the data
        r.store(true, Ordering::Release);  // 2. PUBLISH: prior writes become visible with this flag
    });

    let consumer = thread::spawn(move || {
        while !ready.load(Ordering::Acquire) { // SUBSCRIBE: wait to see the flag
            std::hint::spin_loop();
        }
        // Having seen the Release via Acquire, we're guaranteed to see the data write:
        println!("consumer sees data = {}", data.load(Ordering::Relaxed)); // always 42
    });

    producer.join().unwrap();
    consumer.join().unwrap();
}
```

> [!warning] Memory ordering is genuinely hard — don't over-reach
> Getting `Relaxed`/`Acquire`/`Release` subtly wrong produces bugs that appear only on some CPUs under heavy load — nightmares to debug. Two safe rules: use **`Relaxed`** for a standalone counter/flag whose ordering relative to other data doesn't matter; use **`Acquire`/`Release`** for the publish/subscribe hand-off (or a lock); and reach for **`SeqCst`** whenever you're unsure. When you genuinely need to optimize orderings, study them first — *Rust Atomics and Locks* by Mara Bos is the definitive, free guide.

## Where you'll actually use atomics in a project

Most day-to-day atomic use is not exotic lock-free data structures — it's a handful of small, high-value patterns:

**1. A shutdown / "keep running" flag** — the cleanest way to ask a worker thread to stop:

```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

fn main() {
    let running = Arc::new(AtomicBool::new(true));

    let r = Arc::clone(&running);
    let worker = thread::spawn(move || {
        let mut ticks = 0u64;
        while r.load(Ordering::Relaxed) {   // check the flag each loop
            ticks += 1;                      // …do a unit of work…
        }
        ticks
    });

    thread::sleep(Duration::from_millis(20));
    running.store(false, Ordering::Relaxed); // ask it to stop (e.g. from a Ctrl-C handler)
    let ticks = worker.join().unwrap();
    println!("worker stopped after doing work: {}", ticks > 0); // true
}
```

**2. Live metrics / counters** — request counts, bytes processed, cache hits. `fetch_add(1, Relaxed)` from many threads with no lock:

```rust
use std::sync::atomic::{AtomicU64, Ordering};

static REQUESTS: AtomicU64 = AtomicU64::new(0); // a global, shared safely

fn handle_request() {
    REQUESTS.fetch_add(1, Ordering::Relaxed);
    // …serve the request…
}

fn main() {
    for _ in 0..1000 { handle_request(); }
    println!("served {} requests", REQUESTS.load(Ordering::Relaxed)); // 1000
}
```

**3. Unique ID generation** — hand out monotonically increasing ids with no lock and no coordination:

```rust
use std::sync::atomic::{AtomicU64, Ordering};

static NEXT_ID: AtomicU64 = AtomicU64::new(1);
fn next_id() -> u64 { NEXT_ID.fetch_add(1, Ordering::Relaxed) } // returns the OLD value

fn main() {
    println!("{} {} {}", next_id(), next_id(), next_id()); // 1 2 3 — unique across threads
}
```

**4. One-time initialization** — you rarely write this by hand; [`OnceLock`](#/ch/std-sync)/`LazyLock` (and the `once_cell` crate) give you a safe "run this exactly once" built *on* atomics. And every [`Arc`](#/ch/rc-arc) you clone is bumping an atomic reference count — so you're already relying on atomics constantly, even when you never type `Atomic`.

## Tips & pitfalls

> [!tip] Beware false sharing on hot counters
> Atomics live in CPU cache lines (~64 bytes). If two *different* atomics that different threads hammer happen to sit in the same cache line, the cores fight over that line and performance tanks — even though the values are unrelated. This is **false sharing**. If you profile a hot path and atomics are slow, pad them apart (e.g. `#[repr(align(64))]` wrappers, or the `crossbeam` `CachePadded` type) so each lives on its own line.

> [!mistake] The ABA problem
> `compare_exchange` only checks the *value*, not its history. If a value goes `A → B → A` between your read and your swap, the CAS still succeeds as if nothing changed — which can corrupt pointer-based lock-free structures. This is the **ABA problem**. You won't hit it with plain counters, but it's why hand-rolling lock-free stacks/queues is expert territory: use a vetted crate (`crossbeam`) instead.

> [!best] Reach for the highest-level tool that fits
> The concurrency ladder, simplest first: **channels** (message passing) → **`Mutex`/`RwLock`** (shared state) → **atomics** (lock-free primitives) → **`unsafe` + raw atomics** (hand-rolled lock-free structures). Climb *down* to atomics only when a lock is measurably too slow for a hot, simple counter/flag. Most programs never need to leave the top two rungs — and when they do, it's almost always for a flag or a counter, not a whole data structure.

## Summary

- A plain `+= 1` across threads can **lose updates** (read-modify-write interleaves); an **atomic** does it as one indivisible hardware step. Safe Rust forces you to use an atomic or a lock rather than share a plain `&mut`.
- The atomic types (`AtomicBool`, `AtomicUsize`, `AtomicU64`, `AtomicPtr`, …) provide **interior mutability**, so `Arc<AtomicUsize>` shares a value across threads with no `Mutex`.
- Core operations: **`load`/`store`**, **`fetch_add`/`fetch_sub`** (return the old value), **`swap`**, and **`compare_exchange`** — the basis of the **CAS retry loop** (use `compare_exchange_weak` inside loops; `fetch_update` writes the loop for you).
- **A lock is built from an atomic**: a spinlock is one `AtomicBool` + a `compare_exchange` to acquire and a `store(false)` to release — the heart of a real `Mutex` (which parks waiters instead of busy-spinning).
- Every op takes a memory **`Ordering`**: **`Relaxed`** for standalone counters, **`Acquire`/`Release`** for the publish/subscribe hand-off and locks, **`SeqCst`** when unsure.
- Real-world uses are mostly small: **shutdown flags**, **metrics counters**, **unique IDs**, and (under the hood) `Arc` refcounts and `OnceLock`. Watch out for **false sharing** and the **ABA problem**; prefer higher-level tools and vetted crates for anything structural.

> [!exercise] Try it yourself
> 1. Use an `Arc<AtomicUsize>` shared across 50 threads that each `fetch_add(1)`, and confirm the total is 50.
> 2. Turn the spinlock above into an RAII guard: return a small struct whose `Drop` calls `unlock()`, so you can't forget to release it.
> 3. Write a `compare_exchange_weak` loop that atomically keeps a running *minimum* across threads.
> 4. Build a shutdown flag with `AtomicBool` shared between a worker loop and the main thread; stop it after a short sleep.

Manual threads, locks, and atomics give you full control. But for the common case of "run this computation over a big collection in parallel," there's a crate that makes it a one-line change: **Rayon**.
