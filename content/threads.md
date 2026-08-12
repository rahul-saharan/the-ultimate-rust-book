<h1><span class="h1-kicker">Fearless Concurrency</span>Threads</h1>

Modern computers have many CPU cores, and using them means running code on multiple **threads** at once. In most languages, threading is a minefield of data races and heisenbugs. Rust earns the phrase **"fearless concurrency"** because its ownership system catches data races *at compile time* — if it compiles, it's free of that entire class of bug. This part shows how, starting with spawning threads.

## Spawning a thread

A **thread** is an independent path of execution — the OS can run several at the same time on different cores. Create one with `thread::spawn`, passing a closure with the work to do:

```rust
use std::thread;
use std::time::Duration;

fn main() {
    // Spawn a new thread. It runs concurrently with main.
    let handle = thread::spawn(|| {
        for i in 1..=5 {
            println!("  spawned thread: {i}");
            thread::sleep(Duration::from_millis(1));
        }
    });

    for i in 1..=3 {
        println!("main thread: {i}");
        thread::sleep(Duration::from_millis(1));
    }

    handle.join().unwrap(); // wait for the spawned thread to finish
}
```

> [!jargon] Thread & concurrency
> A **thread** lets your program do more than one thing at a time. **Concurrency** is structuring a program as multiple independent tasks; when they truly run *simultaneously* on multiple cores, that's **parallelism**. `thread::spawn` gives you both — the OS schedules threads across your cores.

> [!key] The interleaving is not yours to predict
> Run that example twice and the lines may come out in a different order. Thread scheduling belongs to the operating system: it decides who runs, on which core, for how long, and it may preempt a thread mid-loop. Nothing in your source implies an ordering between two threads unless you create one explicitly (with `join`, a channel, or a lock).
>
> This has a practical edge: **never rely on incidental ordering**, and be suspicious of a test that passes on your laptop and fails in CI. A different core count or a busier machine reshuffles the interleaving and exposes assumptions you didn't know you'd made. Bugs of this shape are called *heisenbugs* precisely because adding a `println!` changes the timing enough to hide them.

## `join`: waiting for a thread to finish

`spawn` returns a **`JoinHandle`**. Calling `.join()` on it blocks the current thread until the spawned one completes. This matters:

> [!warning] Without `join`, `main` may end first — killing your threads
> When `main` returns, the whole program exits **immediately**, even if spawned threads aren't done. Remove the `handle.join()` above and you'll often see the spawned thread's later numbers never print. Always `join` the threads whose results (or completion) you need.

`join` also delivers the thread's **return value**, wrapped so you can handle a thread that panicked:

```rust
use std::thread;

fn main() {
    let handle = thread::spawn(|| {
        // This thread computes a value and returns it:
        (1..=100).sum::<i32>()
    });

    let sum = handle.join().unwrap(); // .unwrap() handles a panicked thread
    println!("The thread computed: {sum}"); // 5050
}
```

Dropping a `JoinHandle` without joining doesn't stop the thread — it **detaches** it. The thread keeps running, unsupervised, and you lose both its result and any notice that it panicked. That's occasionally what you want (a background logger), and usually a bug.

## When a thread panics

A panic doesn't take down the process — it unwinds **only the panicking thread**. The failure is delivered to whoever calls `join`, as an `Err`:

```rust
use std::thread;

fn main() {
    let ok = thread::spawn(|| "worked fine");
    let bad = thread::spawn(|| -> &str {
        panic!("something went wrong in here");
    });

    // join() returns Result<T, Box<dyn Any + Send>>
    println!("ok thread:  {:?}", ok.join());

    match bad.join() {
        Ok(v) => println!("bad thread returned {v}"),
        Err(payload) => {
            // Recover the panic message if it was a &str or String:
            let msg = payload
                .downcast_ref::<&str>()
                .copied()
                .unwrap_or("<non-string panic payload>");
            println!("bad thread panicked with: {msg}");
        }
    }

    println!("main is still alive and in control");
}
```

<figure class="diagram">
<svg viewBox="0 0 670 205" role="img" aria-label="Three worker threads where the middle one panics. The panic unwinds only that thread; the other two finish normally and main receives an Err from join for the failed one, staying in control.">
  <style>
    .pn-h { font: 700 11.5px var(--font-sans); }
    .pn-m { font: 600 10px var(--font-mono); fill: var(--text); }
    .pn-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .pn-ok { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.4; }
    .pn-bad { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.6; }
    .pn-main { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="12" y="80" width="86" height="40" rx="6" class="pn-main"/>
  <text x="22" y="98" class="pn-m">main</text><text x="22" y="113" class="pn-c">spawns 3</text>
  <rect x="150" y="16" width="200" height="26" rx="5" class="pn-ok"/><text x="160" y="34" class="pn-m">worker 1 → Ok("done")</text>
  <rect x="150" y="86" width="200" height="26" rx="5" class="pn-bad"/><text x="160" y="104" class="pn-m">worker 2 → panic! 💥</text>
  <rect x="150" y="156" width="200" height="26" rx="5" class="pn-ok"/><text x="160" y="174" class="pn-m">worker 3 → Ok("done")</text>
  <path d="M100 92 L148 30" stroke="var(--text-mute)" stroke-width="1.2"/>
  <path d="M100 100 L148 99" stroke="var(--text-mute)" stroke-width="1.2"/>
  <path d="M100 108 L148 168" stroke="var(--text-mute)" stroke-width="1.2"/>
  <rect x="392" y="16" width="266" height="26" rx="5" class="pn-ok"/><text x="402" y="34" class="pn-m">join() → Ok(value)</text>
  <rect x="392" y="86" width="266" height="26" rx="5" class="pn-bad"/><text x="402" y="104" class="pn-m">join() → Err(panic payload)</text>
  <rect x="392" y="156" width="266" height="26" rx="5" class="pn-ok"/><text x="402" y="174" class="pn-m">join() → Ok(value)</text>
  <path d="M352 29 L390 29" stroke="var(--green)" stroke-width="1.5"/>
  <path d="M352 99 L390 99" stroke="var(--red)" stroke-width="1.5"/>
  <path d="M352 169 L390 169" stroke="var(--green)" stroke-width="1.5"/>
  <text x="12" y="148" class="pn-c">One thread's panic</text>
  <text x="12" y="162" class="pn-c">does NOT abort the</text>
  <text x="12" y="176" class="pn-c">others or the process.</text>
  <text x="392" y="200" class="pn-c">…unless panic = "abort" is set, which kills everything.</text>
</svg>
<figcaption>A panic unwinds only its own thread. Other threads continue, and <code>join</code> hands the failure to the parent as an <code>Err</code>.</figcaption>
</figure>

> [!mistake] `.join().unwrap()` turns a worker's panic into the parent's panic
> That's often fine — it propagates the failure — but be deliberate about it. In a program spawning many workers, one `unwrap` on a joined handle takes down `main` too, losing the other threads' results. If partial success is acceptable, `match` on the `Result` and carry on. Note also that a panic while a [`Mutex`](#/ch/shared-state) is held **poisons** the lock, so the failure can propagate to other threads that never panicked — covered in that chapter.
>
> One exception to all of this: if your profile sets `panic = "abort"` (see [Appendix G](#/ch/appendix-details)), there is no unwinding, and any panic kills the entire process immediately — no `Err`, no other threads finishing.

## `move`: giving data to a thread

A spawned thread might outlive the function that created it, so it can't *borrow* local variables — the borrow could dangle. The compiler enforces this, and the fix is the **`move`** keyword, which makes the closure take **ownership** of what it captures:

```rust
use std::thread;

fn main() {
    let data = vec![1, 2, 3];

    // `move` transfers ownership of `data` into the thread:
    let handle = thread::spawn(move || {
        println!("The thread owns: {data:?}");
        data.iter().sum::<i32>()
    });

    // `data` can no longer be used here — the thread owns it now.
    println!("sum from thread: {}", handle.join().unwrap());
}
```

<figure class="diagram">
<svg viewBox="0 0 640 180" role="img" aria-label="Main spawns two threads that run concurrently, then joins them back">
  <style>
    .thm { font: 600 12px var(--font-mono); fill: var(--text); }
    .thc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .mainl { stroke: var(--rust-500); stroke-width: 3; }
    .worker { stroke: var(--blue); stroke-width: 3; }
  </style>
  <text x="20" y="24" class="thm" fill="var(--rust-600)">main</text>
  <line x1="60" y1="40" x2="200" y2="40" class="mainl"/>
  <circle cx="200" cy="40" r="4" fill="var(--rust-500)"/>
  <text x="150" y="30" class="thc">spawn ↓</text>
  <line x1="200" y1="40" x2="440" y2="40" class="mainl" stroke-dasharray="4 3"/>
  <text x="300" y="30" class="thc">main keeps working…</text>
  <line x1="440" y1="40" x2="560" y2="40" class="mainl"/>
  <text x="470" y="30" class="thc">join ← wait</text>
  <line x1="200" y1="100" x2="440" y2="100" class="worker"/>
  <text x="20" y="105" class="thm" fill="var(--blue)">worker</text>
  <text x="240" y="122" class="thc">runs concurrently on another core</text>
  <path d="M200 44 L200 96" stroke="var(--text-mute)" stroke-width="1.5" stroke-dasharray="3 3"/>
  <path d="M440 96 L440 44" stroke="var(--text-mute)" stroke-width="1.5" stroke-dasharray="3 3" marker-end="url(#ath)"/>
  <text x="20" y="160" class="thc">spawn starts the worker; join blocks main until the worker finishes and hands back its result.</text>
  <defs><marker id="ath" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>Threads run concurrently after <code>spawn</code>; <code>join</code> waits for a thread and collects its result.</figcaption>
</figure>

## Scoped threads: borrow instead of move

Moving data in works, but what if several threads just need to *read* the same local data, and you want it back afterward? **Scoped threads** (`thread::scope`) let threads **borrow** local variables safely, because the scope guarantees all threads finish before it returns:

```rust
use std::thread;

fn main() {
    let numbers = vec![1, 2, 3, 4, 5];

    thread::scope(|s| {
        s.spawn(|| {
            println!("thread A sees: {numbers:?}"); // borrows, doesn't move
        });
        s.spawn(|| {
            let sum: i32 = numbers.iter().sum();
            println!("thread B sum: {sum}");
        });
        // The scope automatically joins both threads here.
    });

    // `numbers` is still ours — it was only borrowed!
    println!("main still owns: {numbers:?}");
}
```

> [!tip] Reach for `thread::scope` when threads only borrow
> Scoped threads are perfect for "fork-join" work — split a slice among threads, let each read its part, and collect results — without cloning data or wrestling with `Arc`. Because the scope can't return until every thread joins, the borrows are guaranteed valid. Use `spawn` + `move` when a thread must *outlive* the current function; use `scope` when it doesn't.

## Fork-join: real work, measured

The pattern that earns threads their keep: split a big job into chunks, let each thread take one, then combine. `chunks()` plus scoped threads makes this remarkably clean, and the speedup is real:

<figure class="diagram">
<svg viewBox="0 0 670 200" role="img" aria-label="A slice of data split into four chunks, each handed to a worker thread that computes a partial sum, with the four partial results combined into a final total after the scope joins all threads.">
  <style>
    .fj-h { font: 700 11.5px var(--font-sans); }
    .fj-m { font: 600 10px var(--font-mono); fill: var(--text); }
    .fj-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .fj-d { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
    .fj-w { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.3; }
    .fj-r { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.4; }
    .fj-l { stroke: var(--text-mute); stroke-width: 1.1; }
  </style>
  <text x="12" y="16" class="fj-h">fork</text>
  <rect x="60" y="24" width="128" height="22" rx="4" class="fj-d"/><text x="70" y="40" class="fj-m">data[0..250k]</text>
  <rect x="196" y="24" width="128" height="22" rx="4" class="fj-d"/><text x="206" y="40" class="fj-m">data[250k..500k]</text>
  <rect x="332" y="24" width="128" height="22" rx="4" class="fj-d"/><text x="342" y="40" class="fj-m">data[500k..750k]</text>
  <rect x="468" y="24" width="128" height="22" rx="4" class="fj-d"/><text x="478" y="40" class="fj-m">data[750k..1M]</text>
  <path d="M124 46 L124 66" class="fj-l"/><path d="M260 46 L260 66" class="fj-l"/>
  <path d="M396 46 L396 66" class="fj-l"/><path d="M532 46 L532 66" class="fj-l"/>
  <rect x="60" y="68" width="128" height="34" rx="5" class="fj-w"/><text x="70" y="82" class="fj-m">thread 1</text><text x="70" y="96" class="fj-c">partial sum</text>
  <rect x="196" y="68" width="128" height="34" rx="5" class="fj-w"/><text x="206" y="82" class="fj-m">thread 2</text><text x="206" y="96" class="fj-c">partial sum</text>
  <rect x="332" y="68" width="128" height="34" rx="5" class="fj-w"/><text x="342" y="82" class="fj-m">thread 3</text><text x="342" y="96" class="fj-c">partial sum</text>
  <rect x="468" y="68" width="128" height="34" rx="5" class="fj-w"/><text x="478" y="82" class="fj-m">thread 4</text><text x="478" y="96" class="fj-c">partial sum</text>
  <text x="12" y="88" class="fj-h">work</text>
  <path d="M124 102 C 124 124 300 124 328 138" class="fj-l"/>
  <path d="M260 102 C 260 124 320 128 328 138" class="fj-l"/>
  <path d="M396 102 C 396 124 348 128 340 138" class="fj-l"/>
  <path d="M532 102 C 532 124 360 124 340 138" class="fj-l"/>
  <text x="12" y="152" class="fj-h">join</text>
  <rect x="252" y="140" width="164" height="26" rx="5" class="fj-r"/>
  <text x="262" y="157" class="fj-m">sum of partials</text>
  <text x="12" y="186" class="fj-c">Each thread touches a DISJOINT slice, so no locking is needed — the split itself is the synchronization.</text>
</svg>
<figcaption>Fork-join: disjoint chunks mean no shared mutable state, so no locks — just split, compute, combine.</figcaption>
</figure>

```rust
use std::thread;
use std::time::Instant;

/// Deliberately expensive per-element work so the parallelism is visible.
fn cost(n: u64) -> u64 {
    let mut acc = n;
    for _ in 0..200 {
        acc = acc.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    }
    acc >> 33
}

fn main() {
    let data: Vec<u64> = (0..400_000).collect();

    // --- Single-threaded baseline ---
    let t = Instant::now();
    let single: u64 = data.iter().map(|&n| cost(n)).sum();
    let single_ms = t.elapsed().as_millis();

    // --- Fork-join across N threads ---
    let threads = thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
    let chunk_size = data.len().div_ceil(threads);

    let t = Instant::now();
    let total: u64 = thread::scope(|s| {
        let handles: Vec<_> = data
            .chunks(chunk_size)                 // disjoint slices — no locking needed
            .map(|chunk| s.spawn(move || chunk.iter().map(|&n| cost(n)).sum::<u64>()))
            .collect();
        handles.into_iter().map(|h| h.join().unwrap()).sum()
    });
    let multi_ms = t.elapsed().as_millis();

    println!("threads used : {threads}");
    println!("single-thread: {single_ms:>4} ms");
    println!("fork-join    : {multi_ms:>4} ms");
    println!("results match: {}", single == total);
    if multi_ms > 0 {
        println!("speedup      : {:.1}x", single_ms as f64 / multi_ms as f64);
    }
}
```

Two details make this work without a single lock: each thread gets a **disjoint** `&[u64]`, and each returns its partial result rather than writing to shared state. When you can express work this way, it's both the fastest and the simplest option.

> [!performance] Expect sub-linear speedup — 8 cores does not mean 8×
> On an 8-core machine this example measures roughly **3.5×**, not 8×, and that's normal. Several things eat the difference: "8 cores" often means 4 physical cores with hyperthreading (which shares execution units); memory bandwidth is shared, so a memory-bound loop saturates before the cores do; the chunks may finish at slightly different times, leaving cores idle at the end; and thread spawn plus join is pure overhead. **Amdahl's law** sets the ceiling — whatever fraction of your program is serial can never be parallelized away. Treat any real speedup above ~2× as a win, and always measure rather than assuming: a "parallel" version that's *slower* than serial is a common and entirely unsurprising outcome for small workloads, where spawn overhead dominates the work itself.

> [!best] For data parallelism, reach for Rayon instead
> That whole example collapses to `data.par_iter().map(|&n| cost(n)).sum()` with [Rayon](#/ch/rayon) — which also splits work more intelligently (work-stealing, so a slow chunk doesn't leave cores idle). Hand-rolled fork-join is worth writing once to understand it; in production, use Rayon for CPU-bound iteration and save manual threads for long-lived workers with distinct jobs.

## How many threads should you spawn?

More is not better. A thread is an OS-level object with real costs:

| Cost | Typical | Why it matters |
|---|---|---|
| Stack | 2 MB reserved (Rust default) | 1,000 threads reserve ~2 GB of address space |
| Creation | tens of microseconds | spawning per small task is pure overhead |
| Context switch | ~1–2 µs | more threads than cores means the OS thrashes between them |

> [!key] Match thread count to cores, not to work items
> For **CPU-bound** work, the useful number of threads is roughly your core count — extra threads just add switching overhead without adding compute. Ask the OS rather than guessing:
> ```rust
> fn main() {
>     let n = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1);
>     println!("spawn about {n} worker threads for CPU-bound work");
> }
> ```
> For **I/O-bound** work — thousands of concurrent connections that mostly wait — threads are the wrong tool entirely, because each one costs a stack while doing nothing. That's what [async](#/ch/async-intro) is for. The dividing line is whether your tasks are *computing* or *waiting*.

## Naming threads and sizing stacks with `Builder`

`thread::spawn` is the convenient front door; **`thread::Builder`** is the version with knobs. The two that matter in practice are a **name** (which appears in panic messages and debuggers — invaluable when eight threads are running) and a **stack size**:

```rust
use std::thread;

fn main() {
    let handle = thread::Builder::new()
        .name("report-generator".to_string())
        .stack_size(4 * 1024 * 1024) // 4 MB, e.g. for a deeply recursive job
        .spawn(|| {
            let me = thread::current();
            println!("running on thread named: {}", me.name().unwrap_or("<unnamed>"));
            "report complete"
        })
        .expect("failed to spawn thread"); // Builder::spawn returns io::Result

    println!("{}", handle.join().unwrap());
}
```

Note that `Builder::spawn` returns an `io::Result` — spawning a thread is a syscall and *can* fail (out of memory, hitting a process thread limit), whereas `thread::spawn` simply panics in that case. For a server that spawns threads dynamically, the `Result` is the version you want.

## The fearless part

Here's why Rust's concurrency is special — but the guarantee is precise, so it's worth seeing exactly where the compiler stops you and where it doesn't. Try to *share* a mutable local across threads and it won't compile:

```rust,ignore
use std::thread;

fn main() {
    let mut counter = 0;
    for _ in 0..10 {
        // No `move`: the closure tries to BORROW `counter` mutably.
        thread::spawn(|| {
            counter += 1;
        });
    }
    println!("{counter}");
}
// error[E0373]: closure may outlive the current function, but it borrows `counter`
// error[E0499]: cannot borrow `counter` as mutable more than once at a time
```

Three separate objections, all correct: the thread may outlive `main`'s frame, and ten threads can't each hold a mutable borrow of one integer. **That** is the data race being prevented.

Adding `move` makes it compile — but read carefully, because it does *not* do what you might hope:

```rust
use std::thread;

fn main() {
    let counter = 0;
    let mut handles = Vec::new();

    for _ in 0..10 {
        // `move` COPIES the i32 into each thread (i32 is Copy).
        // Each thread increments its own private copy.
        handles.push(thread::spawn(move || {
            let mut local = counter;
            local += 1;
            local
        }));
    }

    let results: Vec<i32> = handles.into_iter().map(|h| h.join().unwrap()).collect();
    println!("each thread returned: {results:?}");
    println!("the original counter is still: {counter}");
}
```

> [!mistake] The compiler prevents data races, not logic errors
> This is the distinction to hold onto. Rust guarantees you cannot have *unsynchronized concurrent access* to the same memory — a genuine data race. It does **not** guarantee your concurrent logic is correct. Here, `move` on a `Copy` type silently gives each thread its own copy, so ten increments produce ten separate `1`s and the original never changes. It compiles, it's perfectly memory-safe, and it's still the wrong program.
>
> The fix isn't a borrow trick — it's choosing a type that expresses *shared* mutation: an [`Arc<Mutex<i32>>`](#/ch/shared-state), an [`AtomicI32`](#/ch/atomics), or a [channel](#/ch/channels) that collects each thread's contribution. When a threaded program compiles but gives the wrong answer, look for accidentally-copied state first.

> [!key] The rule that makes it fearless
> Data races require **shared mutable state accessed without synchronization**. Rust's ownership rules already forbid shared mutable access — so a data race literally cannot be expressed in safe Rust. You either move data to one thread, or share it through a synchronized type (`Mutex`, atomic, channel). The compiler is your concurrency reviewer, and it never gets tired.

## The rest of the `thread` toolbox

| Function | Does |
|---|---|
| `thread::sleep(dur)` | park this thread for a duration |
| `thread::yield_now()` | hint to the scheduler to run someone else now |
| `thread::current()` | handle to this thread — `.name()`, `.id()` |
| `thread::park()` / `Thread::unpark()` | low-level block/wake, the primitive locks are built from |
| `available_parallelism()` | how many threads can genuinely run at once |

`park`/`unpark` is worth knowing exists but rarely worth using directly — a [channel](#/ch/channels) or [`Condvar`](#/ch/std-sync) expresses "wait until something happens" far more clearly and is much harder to get wrong.

## Summary

- Create a **thread** with **`thread::spawn(closure)`**; it runs concurrently, possibly on another core.
- **`join()`** the returned **`JoinHandle`** to wait for the thread and collect its return value — without it, `main` exiting kills the threads. Dropping a handle **detaches** the thread.
- **Interleaving is nondeterministic** — never rely on incidental ordering between threads.
- A **panic unwinds only its own thread**; `join` returns `Err(payload)` so the parent stays in control (unless `panic = "abort"`).
- Use **`move`** to transfer ownership of captured data into a thread (required when the thread may outlive the caller).
- **`thread::scope`** lets threads safely **borrow** local data, auto-joining them at the scope's end — ideal for **fork-join** over disjoint chunks, which needs no locks at all.
- Match thread count to **cores** (`available_parallelism`), not to work items; threads cost ~2 MB of stack each, so they're the wrong tool for thousands of *waiting* tasks — use [async](#/ch/async-intro).
- **`thread::Builder`** adds thread **names** (visible in panics and debuggers) and stack sizes, and returns a `Result` because spawning can fail.
- Rust catches **data races at compile time** — but **not logic errors**: `move` on a `Copy` type silently gives each thread its own copy. Real sharing needs `Arc<Mutex<T>>`, an atomic, or a channel.

> [!exercise] Try it yourself
> 1. Spawn a thread that prints 1–5 while `main` prints "tick" three times; `join` it and observe the interleaving. Run it several times — does the order change?
> 2. Spawn a thread that takes ownership of a `String` via `move` and returns its length; print the length from `main`.
> 3. Use `thread::scope` to have two threads compute the sum and the max of a shared slice, then print both from `main`.
> 4. Spawn a thread that panics. Handle the `Err` from `join` without crashing `main`, and print the panic message via `downcast_ref::<&str>()`.
> 5. Run the fork-join benchmark and record the speedup. Then spawn 4× as many threads as you have cores and measure again — explain the result.
> 6. Rewrite the fork-join example with Rayon's `par_iter()` and compare both the line count and the timing.
> 7. Use `thread::Builder` to name a thread, then make it panic. Find the thread's name in the panic message.
> 8. Fix the broken counter: make ten threads actually increment one shared counter to 10, using `Arc<Mutex<i32>>`. Then do it again with `AtomicI32` and compare.

Threads can run — but how do they *communicate*? The first, and often best, answer is to pass messages down a **channel**.
