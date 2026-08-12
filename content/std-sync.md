<h1><span class="h1-kicker">The Standard Library, Deep</span>std::sync — Synchronization Primitives</h1>

The [concurrency part](#/ch/threads) taught the big ones — `Arc`, `Mutex`, `RwLock`, atomics — in depth. This reference gathers *all* of `std::sync` in one place, including the ones we haven't met: `Once`, `OnceLock`, `Barrier`, and `Condvar`. Think of it as your synchronization cheat-sheet.

## The core trio (recap)

You know these; here they are for completeness:

| Type | Purpose |
|------|---------|
| **`Arc<T>`** | shared ownership across threads (atomic refcount) |
| **`Mutex<T>`** | one accessor at a time (mutual exclusion) |
| **`RwLock<T>`** | many readers *or* one writer |

The canonical shared-mutable-state pattern is `Arc<Mutex<T>>`, covered in [Shared State](#/ch/shared-state). Before the additions, three things about those three types that bite everyone at least once.

### Why `lock()` returns a `Result`: poisoning

If a thread panics *while holding* a lock, the data it was halfway through modifying may be inconsistent. Rust records that fact: the lock becomes **poisoned**, and every later `lock()` returns `Err`. The data is still reachable through the error — you just have to say out loud that you accept it:

```rust
use std::sync::{Arc, Mutex, RwLock};
use std::thread;

fn main() {
    std::panic::set_hook(Box::new(|_| {}));   // keep the deliberate panics quiet

    // A thread that panics while holding the lock POISONS it.
    let data = Arc::new(Mutex::new(vec![1, 2, 3]));
    let d2 = Arc::clone(&data);
    let handle = thread::spawn(move || {
        let mut guard = d2.lock().unwrap();
        guard.push(4);
        panic!("boom while holding the lock");   // <-- poisons the Mutex
    });
    let panicked = handle.join().is_err();
    println!("worker panicked: {panicked}");
    println!("is_poisoned:     {}", data.is_poisoned());

    // Every later lock() now returns Err -- but the data is still there.
    match data.lock() {
        Ok(_) => println!("lock succeeded"),
        Err(poisoned) => {
            let recovered = poisoned.into_inner();       // take the data anyway
            println!("recovered through the poison: {recovered:?}");
        }
    }
    // The common shorthand: treat poison as "use it regardless".
    let v = data.lock().unwrap_or_else(|e| e.into_inner());
    println!("unwrap_or_else(into_inner): {v:?}");
    drop(v);

    // RwLock poisons the same way -- but only a panicking WRITER does it.
    let rw = Arc::new(RwLock::new(0));
    let r2 = Arc::clone(&rw);
    let _ = thread::spawn(move || { let _g = r2.read().unwrap(); panic!("reader panic"); }).join();
    println!("after a reader panic, poisoned: {}", rw.is_poisoned());
    let w2 = Arc::clone(&rw);
    let _ = thread::spawn(move || { let _g = w2.write().unwrap(); panic!("writer panic"); }).join();
    println!("after a writer panic, poisoned: {}", rw.is_poisoned());
}
```

```text
worker panicked: true
is_poisoned:     true
recovered through the poison: [1, 2, 3, 4]
unwrap_or_else(into_inner): [1, 2, 3, 4]
after a reader panic, poisoned: false
after a writer panic, poisoned: true
```

Note the asymmetry in the last two lines: a panicking **reader** can't have corrupted anything, so it doesn't poison an `RwLock`; a panicking **writer** does.

> [!note] The `.unwrap()` you write after `.lock()` is a poison check, not a lock failure
> `Mutex::lock` doesn't fail because the lock is busy — it waits. The only `Err` is poisoning, which is why `lock().unwrap()` is idiomatic rather than sloppy: it says "if another thread died mid-update, I'd rather die too than work with wreckage." When you'd prefer to carry on, write `lock().unwrap_or_else(|e| e.into_inner())`. Poisoning is also why `parking_lot`'s mutexes (which don't poison and return the guard directly) feel lighter — that's the trade-off they made, and it's why the `PoisonError` type exists in `std`: to force the decision into the open.

### Guards live longer than you think

A `MutexGuard` releases the lock when it's dropped, and *when* that happens follows Rust's ordinary temporary rules — which are not intuitive in `match` and `while let`:

```rust
use std::sync::Mutex;

fn main() {
    let a = Mutex::new(vec![1, 2, 3]);

    // An `if` condition's temporary guard is released before the block runs:
    if !a.lock().unwrap().is_empty() {
        println!("inside if:        lock free? {}", a.try_lock().is_ok());
    }

    // A `match` scrutinee's temporary lives for the WHOLE match -- lock still held:
    match a.lock().unwrap().len() {
        0 => println!("empty"),
        _ => println!("inside match:     lock free? {}", a.try_lock().is_ok()),
    }

    // Same for `while let`: the guard is alive for every iteration of the body.
    let b = Mutex::new(vec![1, 2]);
    while let Some(x) = b.lock().unwrap().pop() {
        println!("inside while let:  popped {x}, lock free? {}", b.try_lock().is_ok());
    }

    // The fix in both cases: bind the value out, ending the guard's life.
    let len = a.lock().unwrap().len();               // guard dies at the semicolon
    match len {
        0 => println!("empty"),
        _ => println!("after binding:    lock free? {}", a.try_lock().is_ok()),
    }
}
```

```text
inside if:        lock free? true
inside match:     lock free? false
inside while let:  popped 2, lock free? false
inside while let:  popped 1, lock free? false
after binding:    lock free? true
```

> [!mistake] `while let Some(job) = queue.lock().unwrap().pop()` holds the lock through the body
> That line reads like "take one job, then work on it" but means "hold the lock while working on it" — so no other worker can take a job, and if the body tries to lock the same queue, the thread deadlocks against itself. Same for `match`. The fix is a two-step: `let job = { queue.lock().unwrap().pop() };` and then `match job { … }`, where the braces (or the semicolon) end the guard's life before the body runs. `if` happens to be safe here, which makes the inconsistency worse — don't rely on remembering which is which; bind the value out and the question disappears.

The other two guard hazards are worth seeing side by side:

```rust
use std::sync::Mutex;
use std::time::Duration;

fn main() {
    let a = Mutex::new("resource A");
    let b = Mutex::new("resource B");

    // Locking the same Mutex twice on one thread is a self-deadlock.
    // try_lock lets us SHOW that instead of hanging the program.
    let first = a.lock().unwrap();
    println!("second lock on the same thread is refused: {:?}", a.try_lock().is_err());
    drop(first);

    // Two locks taken in different orders by two threads is the classic deadlock.
    // Fix: one global order -- or try_lock so a conflict is recoverable.
    let ga = a.lock().unwrap();
    match b.try_lock() {
        Ok(gb) => println!("took A then B: {ga:?} + {gb:?}"),
        Err(_) => println!("B was busy; will release A and retry"),
    }
    drop(ga);

    // Keep the critical section tiny: copy out, then work outside the lock.
    let snapshot = { *a.lock().unwrap() };            // the guard dies at the closing brace
    std::thread::sleep(Duration::from_millis(1));      // "expensive work", lock NOT held
    println!("worked on {snapshot:?} with the lock released: {}", a.try_lock().is_ok());
}
```

```text
second lock on the same thread is refused: true
took A then B: "resource A" + "resource B"
worked on "resource A" with the lock released: true
```

> [!warning] Never hold a guard across a blocking call — or an `.await`
> The three rules that prevent almost every deadlock: **(1)** hold locks for as few lines as possible, cloning or copying the data out if you need to work on it; **(2)** if you must hold two locks, take them in the same order everywhere in the program (document that order); **(3)** never hold a guard across something that can block indefinitely — a network read, a channel `recv`, a `join`, or an `.await`. A `std::sync::MutexGuard` isn't `Send`, so holding one across an `.await` in a multithreaded async runtime won't even compile — take that error as a design hint rather than a nuisance, and use `tokio::sync::Mutex` only when the critical section genuinely must span an await.

### `Mutex` vs `RwLock` vs atomic, measured

The three differ in how much parallelism they allow and how much they cost. Here is each claim demonstrated rather than asserted:

<figure class="diagram">
<svg viewBox="0 0 640 214" role="img" aria-label="Timeline comparison: with a Mutex four threads run their critical sections one after another, while with an RwLock four readers overlap completely and a writer waits for them to finish">
  <style>
    .lk-h { font: 700 11px var(--font-sans); }
    .lk-c { font: 9.5px var(--font-sans); fill: var(--text-mute); }
    .lk-t { font: 600 9.5px var(--font-mono); fill: var(--text); }
    .lk-m { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.4; }
    .lk-r { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.4; }
    .lk-w { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.4; }
  </style>
  <text x="20" y="16" class="lk-h" fill="var(--rust-500)">Mutex — one at a time, whatever they were doing</text>
  <text x="20" y="36" class="lk-t">t1</text><rect x="52" y="24" width="120" height="16" rx="3" class="lk-m"/>
  <text x="20" y="56" class="lk-t">t2</text><rect x="176" y="44" width="120" height="16" rx="3" class="lk-m"/>
  <text x="20" y="76" class="lk-t">t3</text><rect x="300" y="64" width="120" height="16" rx="3" class="lk-m"/>
  <text x="20" y="96" class="lk-t">t4</text><rect x="424" y="84" width="120" height="16" rx="3" class="lk-m"/>
  <text x="556" y="64" class="lk-c">total: 4×</text>
  <text x="20" y="132" class="lk-h" fill="var(--green)">RwLock — readers overlap; a writer waits for all of them</text>
  <text x="20" y="152" class="lk-t">r1</text><rect x="52" y="140" width="120" height="16" rx="3" class="lk-r"/>
  <text x="20" y="170" class="lk-t">r2</text><rect x="52" y="158" width="120" height="16" rx="3" class="lk-r"/>
  <text x="20" y="188" class="lk-t">r3</text><rect x="52" y="176" width="120" height="16" rx="3" class="lk-r"/>
  <text x="184" y="170" class="lk-t">w1</text><rect x="212" y="158" width="120" height="16" rx="3" class="lk-w"/>
  <text x="344" y="152" class="lk-c">readers: 1× wall-clock for all three</text>
  <text x="344" y="168" class="lk-c">writer: exclusive, so it queues behind them</text>
  <text x="344" y="192" class="lk-c">An atomic needs no queue at all — but holds</text>
  <text x="344" y="206" class="lk-c">only one number, and does one operation.</text>
</svg>
<figcaption>A <code>Mutex</code> serialises everything; an <code>RwLock</code> lets readers run together at the cost of exclusive writes; an atomic skips the queue entirely.</figcaption>
</figure>

```rust
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::{Duration, Instant};

fn main() {
    // How many readers can be inside an RwLock at once? All of them.
    let lock = Arc::new(RwLock::new(0u32));
    let inside = Arc::new(AtomicUsize::new(0));
    let peak = Arc::new(AtomicUsize::new(0));
    let mut hs = vec![];
    for _ in 0..4 {
        let (l, i, p) = (Arc::clone(&lock), Arc::clone(&inside), Arc::clone(&peak));
        hs.push(thread::spawn(move || {
            let _g = l.read().unwrap();
            let n = i.fetch_add(1, Ordering::SeqCst) + 1;
            p.fetch_max(n, Ordering::SeqCst);
            thread::sleep(Duration::from_millis(40));
            i.fetch_sub(1, Ordering::SeqCst);
        }));
    }
    for h in hs { h.join().unwrap(); }
    println!("RwLock peak concurrent readers: {}", peak.load(Ordering::SeqCst));

    // The same experiment with a Mutex: strictly one at a time.
    let m = Arc::new(Mutex::new(0u32));
    let inside = Arc::new(AtomicUsize::new(0));
    let peak = Arc::new(AtomicUsize::new(0));
    let mut hs = vec![];
    for _ in 0..4 {
        let (l, i, p) = (Arc::clone(&m), Arc::clone(&inside), Arc::clone(&peak));
        hs.push(thread::spawn(move || {
            let _g = l.lock().unwrap();
            let n = i.fetch_add(1, Ordering::SeqCst) + 1;
            p.fetch_max(n, Ordering::SeqCst);
            thread::sleep(Duration::from_millis(10));
            i.fetch_sub(1, Ordering::SeqCst);
        }));
    }
    for h in hs { h.join().unwrap(); }
    println!("Mutex  peak concurrent holders: {}", peak.load(Ordering::SeqCst));

    // Counter cost: one atomic vs one Mutex, 200_000 increments per thread.
    let n = 200_000;
    let a = Arc::new(AtomicUsize::new(0));
    let t = Instant::now();
    let hs: Vec<_> = (0..4).map(|_| { let a = Arc::clone(&a); thread::spawn(move || {
        for _ in 0..n { a.fetch_add(1, Ordering::Relaxed); } }) }).collect();
    for h in hs { h.join().unwrap(); }
    let atomic_time = t.elapsed();

    let mu = Arc::new(Mutex::new(0usize));
    let t = Instant::now();
    let hs: Vec<_> = (0..4).map(|_| { let m = Arc::clone(&mu); thread::spawn(move || {
        for _ in 0..n { *m.lock().unwrap() += 1; } }) }).collect();
    for h in hs { h.join().unwrap(); }
    let mutex_time = t.elapsed();

    println!("800_000 increments: atomic {atomic_time:?} vs Mutex {mutex_time:?} ({:.1}x)",
             mutex_time.as_secs_f64() / atomic_time.as_secs_f64());
    println!("both totals correct: {} {}", a.load(Ordering::SeqCst), *mu.lock().unwrap());
}
```

```text
RwLock peak concurrent readers: 4
Mutex  peak concurrent holders: 1
800_000 increments: atomic 23.683906ms vs Mutex 46.822947ms (2.0x)
both totals correct: 800000 800000
```

| | `Mutex<T>` | `RwLock<T>` | `Atomic*` |
|---|---|---|---|
| holds | any `T` | any `T` | one integer, bool, or pointer |
| concurrency | one thread, period | many readers **or** one writer | every thread, always |
| cost when uncontended | one atomic op + a guard | slightly more bookkeeping | one instruction |
| cost when contended | the OS parks the losers | same, plus reader/writer fairness rules | no parking, but cache-line ping-pong |
| poisoning | yes | yes (writers only) | n/a |
| use it for | shared mutable data | data read far more often than written | counters, flags, IDs, `Drop` bookkeeping |

> [!performance] `RwLock` is not automatically the faster choice
> It only wins when readers genuinely dominate *and* hold the lock long enough for the overlap to matter. For a short critical section — bump a counter, look up a small map — the extra bookkeeping can make `RwLock` slower than `Mutex`, and `std`'s implementation gives no fairness guarantee, so a steady stream of readers can starve a writer indefinitely (or the reverse, depending on platform). Measure with your access pattern before switching. And the atomic-vs-`Mutex` ratio above swings between roughly 2× and 4× from run to run, because a single hot counter is limited by cache-line contention either way — the real fix for that shape of problem is per-thread counters summed at the end.

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

## Channels: `mpsc` and back-pressure

Before reaching for shared state, consider not sharing at all. `std::sync::mpsc` gives **m**ultiple **p**roducers a **s**ingle **c**onsumer, and the ownership rules make the handoff safe by construction — the value *moves* to the receiver:

```rust
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

fn main() {
    // Many producers, one consumer: clone the Sender.
    let (tx, rx) = mpsc::channel::<String>();
    for id in 0..3 {
        let tx = tx.clone();
        thread::spawn(move || {
            for j in 0..2 { tx.send(format!("worker {id} msg {j}")).unwrap(); }
        });
    }
    drop(tx);   // <-- the ORIGINAL sender must go too, or the loop below never ends
    let mut got: Vec<String> = rx.iter().collect();   // iterates until all senders are gone
    got.sort();
    println!("received {} messages, e.g. {:?}", got.len(), got.first());

    // recv() tells you when the last sender is dropped.
    let (tx, rx) = mpsc::channel::<i32>();
    tx.send(1).unwrap();
    drop(tx);
    println!("recv {:?} then {:?}", rx.recv(), rx.recv().map_err(|e| e.to_string()));

    // try_recv and recv_timeout: never block, or block with a bound.
    let (tx, rx) = mpsc::channel::<i32>();
    println!("try_recv on empty:   {:?}", rx.try_recv().err().map(|e| e.to_string()));
    println!("recv_timeout empty:  {:?}", rx.recv_timeout(Duration::from_millis(20)).is_err());
    thread::spawn(move || { thread::sleep(Duration::from_millis(30)); tx.send(7).unwrap(); });
    println!("recv_timeout waits:  {:?}", rx.recv_timeout(Duration::from_millis(200)));

    // send() fails if the RECEIVER is gone -- and gives your value back.
    let (tx, rx) = mpsc::channel::<String>();
    drop(rx);
    match tx.send("undeliverable".to_string()) {
        Err(e) => println!("send after drop -> Err, value returned: {:?}", e.0),
        Ok(()) => println!("unexpected"),
    }

    // Unbounded vs bounded: sync_channel applies BACKPRESSURE.
    let (tx, rx) = mpsc::sync_channel::<i32>(2);       // room for 2 in flight
    let t = Instant::now();
    let producer = thread::spawn(move || {
        for i in 0..5 { tx.send(i).unwrap(); }         // blocks once the buffer is full
        println!("producer was held back by the buffer: {:?}", t.elapsed() >= Duration::from_millis(90));
    });
    thread::sleep(Duration::from_millis(100));         // consumer deliberately slow to start
    let sum: i32 = rx.iter().sum();
    producer.join().unwrap();
    println!("bounded channel delivered sum {sum}");

    // A zero-capacity sync_channel is a rendezvous: send waits for a receiver.
    let (tx, rx) = mpsc::sync_channel::<&str>(0);
    let h = thread::spawn(move || { tx.send("handoff").unwrap(); "sender done" });
    thread::sleep(Duration::from_millis(30));
    println!("rendezvous: got {:?}, {}", rx.recv().unwrap(), h.join().unwrap());
}
```

```text
received 6 messages, e.g. Some("worker 0 msg 0")
recv Ok(1) then Err("receiving on a closed channel")
try_recv on empty:   Some("receiving on an empty channel")
recv_timeout empty:  true
recv_timeout waits:  Ok(7)
send after drop -> Err, value returned: "undeliverable"
producer was held back by the buffer: true
bounded channel delivered sum 10
rendezvous: got "handoff", sender done
```

| Need | Call |
|---|---|
| unbounded queue | `mpsc::channel()` — `send` never blocks, memory can grow without limit |
| bounded queue with back-pressure | `mpsc::sync_channel(n)` — `send` blocks while full |
| direct handoff | `mpsc::sync_channel(0)` — `send` waits for a matching `recv` |
| more producers | `tx.clone()` — and drop the original, or the receiver never sees the end |
| consume until everyone's gone | `for msg in rx` / `rx.iter()` |
| don't wait | `try_recv()` → `Err(Empty)` or `Err(Disconnected)` |
| wait, but not forever | `recv_timeout(d)` |
| several receivers | not in `std` — use `crossbeam-channel` (mpmc) or `tokio::sync::broadcast` |

> [!key] A channel's errors *are* its shutdown protocol
> `recv()` returning `Err` means every `Sender` has been dropped — that's how a worker learns there's no more work and exits, so `for msg in rx { … }` is a complete worker loop with no sentinel value needed. Symmetrically, `send()` returning `Err(SendError(value))` means the receiver is gone, and it hands your value back so nothing is lost. The classic beginner hang is forgetting to `drop(tx)` after cloning it for the workers: the original sender is still alive, so the receiver waits forever for a message that will never come.

> [!best] Unbounded channels are a memory leak with extra steps
> `mpsc::channel()` lets a fast producer queue millions of messages while a slow consumer falls behind, and the only signal you get is rising memory. **`sync_channel(n)`** turns that into back-pressure: the producer blocks, which slows the whole pipeline to the rate it can actually sustain. Pick a bound — even a generous one — for any pipeline whose input you don't control.

## `Condvar`: wait for a condition

A **condition variable** (`Condvar`) lets a thread *sleep* until another thread signals that some condition became true — without busy-waiting. It's always paired with a `Mutex` guarding the condition. This is the classic building block for producer/consumer queues:

```rust
use std::collections::VecDeque;
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::Duration;

fn main() {
    // A queue plus a Condvar is the classic producer/consumer.
    let shared = Arc::new((Mutex::new(VecDeque::<i32>::new()), Condvar::new()));

    let producer = {
        let shared = Arc::clone(&shared);
        thread::spawn(move || {
            for i in 1..=5 {
                thread::sleep(Duration::from_millis(10));
                let (lock, cvar) = &*shared;
                lock.lock().unwrap().push_back(i);
                cvar.notify_one();               // wake one waiting consumer
            }
            let (lock, cvar) = &*shared;
            lock.lock().unwrap().push_back(-1);  // sentinel = "no more"
            cvar.notify_all();
        })
    };

    let (lock, cvar) = &*shared;
    let mut received = vec![];
    loop {
        // wait_while parks the thread and RE-CHECKS the predicate on every wake-up,
        // which is what makes spurious wake-ups harmless.
        let mut q = cvar.wait_while(lock.lock().unwrap(), |q| q.is_empty()).unwrap();
        while let Some(v) = q.pop_front() {
            if v < 0 { println!("consumer received {received:?} then the sentinel");
                       producer.join().unwrap(); return; }
            received.push(v);
        }
    }
}
```

```text
consumer received [1, 2, 3, 4, 5] then the sentinel
```

`wait_while(guard, predicate)` is the form to learn: it atomically releases the lock, sleeps, re-acquires, and re-tests the predicate — so a wake-up that turns out to be premature simply goes back to sleep. And because a signal may never arrive at all, there's a bounded version:

```rust
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::Duration;

fn main() {
    // wait_timeout: never wait forever on a signal that may not come.
    let pair = Arc::new((Mutex::new(false), Condvar::new()));
    let (lock, cvar) = &*pair;
    let (guard, timeout) = cvar
        .wait_timeout_while(lock.lock().unwrap(), Duration::from_millis(50), |ready| !*ready)
        .unwrap();
    println!("nobody signalled: timed_out {} ready {}", timeout.timed_out(), *guard);
    drop(guard);

    // Now with a signaller.
    let p2 = Arc::clone(&pair);
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(20));
        let (lock, cvar) = &*p2;
        *lock.lock().unwrap() = true;
        cvar.notify_all();
    });
    let (guard, timeout) = cvar
        .wait_timeout_while(lock.lock().unwrap(), Duration::from_millis(500), |ready| !*ready)
        .unwrap();
    println!("after notify:    timed_out {} ready {}", timeout.timed_out(), *guard);
}
```

```text
nobody signalled: timed_out true ready false
after notify:    timed_out false ready true
```

> [!warning] `Condvar` waits can wake up for no reason
> Operating systems are permitted to wake a waiting thread **spuriously** — no notify, no state change. That is why a bare `cvar.wait(guard)` must always sit inside a `while !condition` loop, and why `wait_while`/`wait_timeout_while` exist to write that loop for you. Two more rules: change the state *while holding the mutex* before you notify (otherwise the waiter can miss it entirely), and prefer `notify_all` unless you're certain any single waiter can make progress. Nine times out of ten a `sync_channel` expresses the same design with none of these hazards — reach for `Condvar` when you need a condition that isn't "a message arrived."

## Scoped threads: the `Arc` you don't need

Most `Arc`s in tutorial code exist for one reason: `thread::spawn` requires `'static`, because the thread might outlive the caller. **`thread::scope`** promises it won't, so scoped threads can borrow locals directly:

```rust
use std::sync::Mutex;
use std::thread;

fn main() {
    // thread::scope lets threads BORROW locals -- no Arc, no 'static, no clones.
    let mut totals = vec![0u64; 4];
    let data: Vec<u64> = (1..=100).collect();
    thread::scope(|s| {
        for (i, slot) in totals.iter_mut().enumerate() {
            let data = &data;                    // a plain shared borrow
            s.spawn(move || { *slot = data.iter().skip(i).step_by(4).sum(); });
        }
    });                                          // all scoped threads are joined here
    println!("per-thread sums {totals:?} total {}", totals.iter().sum::<u64>());

    // Shared mutation still needs a lock, but the Mutex can live on the stack.
    let log = Mutex::new(Vec::new());
    thread::scope(|s| {
        for id in 0..3 {
            let log = &log;                  // borrow, not move
            s.spawn(move || log.lock().unwrap().push(id));
        }
    });
    let mut done = log.into_inner().unwrap();
    done.sort();
    println!("scoped threads logged {done:?} -- no Arc anywhere");
}
```

```text
per-thread sums [1225, 1250, 1275, 1300] total 5050
scoped threads logged [0, 1, 2] -- no Arc anywhere
```

Two things to notice. Each thread got a `&mut` to a *different* element via `iter_mut`, so no lock was needed for the results at all — the borrow checker verified the disjointness. And `log.into_inner()` recovers the `Vec` without locking, because by then the scope has joined every thread and the `Mutex` is uniquely owned again.

> [!best] Reach for `thread::scope` before `Arc`
> If the threads finish before the function returns — which covers most parallel work: split a slice, fan out a batch, run a few tasks and collect results — `thread::scope` removes the `Arc`, the clones, and the `'static` bound, and gives you compile-time-checked joining (the scope won't return until every thread is done, and a panic in any of them propagates). Keep `Arc` for threads that genuinely outlive their spawner: background workers, long-lived servers, anything stored in a struct.

## Atomics

For lock-free single-value updates, **`std::sync::atomic`** offers `AtomicBool`, `AtomicUsize`, `AtomicI64`, etc. — covered in depth in the [Atomics chapter](#/ch/atomics). Reach for them for counters and flags where a full `Mutex` is overkill.

| Method | Does |
|---|---|
| `load(ord)` / `store(v, ord)` | read / write |
| `fetch_add` / `sub` / `and` / `or` / `xor` / `max` / `min` | read-modify-write, returning the **old** value |
| `swap(v, ord)` | replace and return the old value |
| `compare_exchange(cur, new, ok, err)` | set only if it still equals `cur` — the building block for lock-free algorithms |
| `fetch_update(ok, err, f)` | the retry loop around `compare_exchange`, written for you |

The `Ordering` argument says how much the compiler and CPU may reorder *other* memory operations around this one. In practice: **`Relaxed`** for a counter whose value is all you care about (a hit count, a generated ID); **`Acquire`/`Release`** to publish data written before a flag and read it after — the pairing that makes "set `ready` after filling the buffer" safe; **`SeqCst`** when you want one global order and don't want to think about it. Start with `SeqCst`, relax deliberately, and read the [Atomics chapter](#/ch/atomics) before inventing a lock-free structure.

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
- **`lock()` returns `Result` only because of poisoning** — a thread that panicked while holding it. Recover with `unwrap_or_else(|e| e.into_inner())`; a panicking *reader* doesn't poison an `RwLock`, a writer does.
- **Guards live to the end of their temporary's scope.** `match`/`while let` hold the lock through the whole body (measured above), `if` doesn't — so bind the value out and stop guessing. Never hold a guard across a blocking call or an `.await`.
- Measured: an `RwLock` really did hold **4 concurrent readers** where a `Mutex` allowed **1**, and 800,000 increments took roughly 2–4× longer through a `Mutex` than an atomic. `RwLock` only wins when reads dominate *and* are long.
- **Channels first**: `mpsc::channel()` unbounded, **`sync_channel(n)` for back-pressure**, `sync_channel(0)` for a rendezvous. Errors are the shutdown protocol — `recv` fails when all senders drop (remember `drop(tx)`), and `send` hands your value back when the receiver is gone.
- **One-time init**: `LazyLock` (fixed initializer, on first use), `OnceLock` (set/compute later) — the modern replacements for `lazy_static`/`once_cell`; `Once` runs setup code once.
- **Coordination**: `Barrier` makes threads wait for each other at a point; `Condvar` sleeps until signalled — always via `wait_while`/`wait_timeout_while`, because wake-ups can be spurious.
- **`thread::scope`** lets threads borrow locals, deleting most `Arc`s and all the `'static` friction for work that finishes before the function returns.
- **Atomics** for lock-free counters/flags: `fetch_*` returns the old value, `compare_exchange` is the lock-free primitive, and `Ordering` starts at `SeqCst` until you have a reason to relax it.
- Prefer the **simplest** primitive — and message passing over shared state when you can.

> [!exercise] Try it yourself
> 1. Use a `LazyLock<Vec<i32>>` global initialized to `vec![1, 2, 3]` and read it from `main`.
> 2. Use `OnceLock` with `get_or_init` and prove (with a `println!` inside) the initializer runs only once across two calls.
> 3. Use a `Barrier` so three threads all print "phase 1" before any prints "phase 2".
> 4. Poison a `Mutex` on purpose from a spawned thread, then write a `fn lock_anyway<T>(m: &Mutex<T>) -> MutexGuard<'_, T>` helper that recovers and use it twice.
> 5. Write `while let Some(job) = queue.lock().unwrap().pop()` with two worker threads and watch throughput collapse; fix it by binding the pop out of the condition, and compare.
> 6. Build a bounded work queue with `sync_channel(4)`, four workers, and a producer of 100 jobs; print how long the producer spent blocked.
> 7. Replace the `Condvar` producer/consumer in this chapter with a `sync_channel` and count the lines of code each version needs.
> 8. Convert an `Arc<Mutex<Vec<u64>>>` parallel sum to `thread::scope` with `iter_mut` and no lock at all, then check both give the same total.

The last `std` reference is one you use in every program without thinking — the formatting system behind `println!`: **`Display`, `Debug` & `format!`**.
