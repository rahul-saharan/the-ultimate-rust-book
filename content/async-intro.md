<h1><span class="h1-kicker">Asynchronous Rust</span>Async & Await: The Big Picture</h1>

Threads are great for using many CPU cores. But a different problem dominates modern software: **waiting**. A web server handling 10,000 connections spends almost all its time *waiting* — for the network, the database, the disk. Spawning 10,000 OS threads to sit and wait is wasteful. **Async** is Rust's answer: a way to juggle thousands of waiting tasks on just a handful of threads. This chapter builds your intuition before we dive into the machinery.

## Concurrency vs. parallelism, one more time

> [!key] Async is about *waiting efficiently*, not *computing faster*
> - **Parallelism** (threads, Rayon) = doing many things *at the same time* on multiple cores. Best for **CPU-bound** work (crunching numbers).
> - **Async concurrency** = making progress on many things by *never blocking* while one waits. Best for **I/O-bound** work (network, files, databases) — where the CPU would otherwise sit idle.
>
> Async doesn't make your computation faster; it stops one waiting task from hogging a thread that could serve thousands of others.

<figure class="diagram">
<svg viewBox="0 0 640 210" role="img" aria-label="Blocking threads sit idle while waiting; async lets one thread switch between tasks during their waits">
  <style>
    .ash { font: 700 12px var(--font-sans); }
    .asc { font: 10.5px var(--font-sans); fill: var(--text-mute); }
    .work { fill: var(--rust-400); }
    .wait { fill: var(--border-strong); }
  </style>
  <text x="20" y="24" class="ash" fill="var(--red)">Blocking (one thread per task) — mostly idle:</text>
  <text x="20" y="46" class="asc">T1</text><rect x="50" y="36" width="40" height="14" class="work"/><rect x="90" y="36" width="180" height="14" class="wait"/><rect x="270" y="36" width="40" height="14" class="work"/>
  <text x="20" y="70" class="asc">T2</text><rect x="50" y="60" width="40" height="14" class="work"/><rect x="90" y="60" width="180" height="14" class="wait"/><rect x="270" y="60" width="40" height="14" class="work"/>
  <text x="330" y="56" class="asc">grey = thread blocked, doing nothing 😴</text>
  <text x="20" y="120" class="ash" fill="var(--green)">Async (one thread, many tasks) — always busy:</text>
  <text x="20" y="142" class="asc">T1</text>
  <rect x="50" y="132" width="40" height="14" class="work"/>
  <rect x="90" y="132" width="40" height="14" fill="var(--blue)"/>
  <rect x="130" y="132" width="40" height="14" fill="var(--purple)"/>
  <rect x="170" y="132" width="40" height="14" class="work"/>
  <rect x="210" y="132" width="40" height="14" fill="var(--blue)"/>
  <rect x="250" y="132" width="40" height="14" fill="var(--purple)"/>
  <text x="330" y="143" class="asc">colors = different tasks; the thread switches</text>
  <text x="330" y="159" class="asc">to another task whenever one would wait.</text>
  <text x="20" y="195" class="asc">Same work, far fewer threads — that's how one machine serves tens of thousands of connections.</text>
</svg>
<figcaption>Blocking threads idle during I/O waits; an async runtime keeps the thread busy by switching tasks.</figcaption>
</figure>

### Why not just use more threads?

It's a fair question — threads are simpler. The answer is cost per unit of waiting:

| | OS thread | Async task |
|---|---|---|
| Memory | ~8 MB of stack reserved (Linux default) | a few hundred bytes — just its state machine |
| Creation | a syscall, tens of microseconds | an allocation, tens of nanoseconds |
| Switching | kernel context switch (~1–2 µs) | a function return into the scheduler (~ns) |
| Practical ceiling | thousands | millions |

> [!key] The arithmetic is what makes async necessary
> 10,000 blocked threads would reserve roughly **80 GB** of address space and force the kernel to schedule 10,000 entities that are all doing nothing. 10,000 async tasks fit in a few megabytes and cost the scheduler nothing while parked. That's the entire justification for async's added complexity — and also why it buys you *nothing* for CPU-bound work, where every unit really does need a core.

## `async` and `await`

Two keywords do the heavy lifting:

- **`async`** turns a function into one that returns a **future** — a value representing a computation that isn't finished yet.
- **`.await`** *pauses* the current async function until a future is ready, **without blocking the thread** — while it waits, the runtime runs other tasks.

```rust
# // The in-book playground includes tokio.
use tokio::time::{sleep, Duration};

// `async fn` returns a Future; the body runs only when awaited.
async fn fetch_data(source: &str) -> String {
    sleep(Duration::from_millis(20)).await; // simulate I/O — yields the thread
    format!("data from {source}")
}

#[tokio::main] // sets up the async runtime and runs `main` on it
async fn main() {
    let result = fetch_data("the API").await; // pause here until it's ready
    println!("{result}");
}
```

> [!jargon] Future
> A **future** is a value that represents a computation that will *eventually* produce a result — Rust's equivalent of a "promise" or "task" in other languages. Calling an `async fn` gives you a future; the code inside runs only when you `.await` it (or hand it to the runtime).

### What `.await` really means: a yield point

The most useful mental model: **`.await` marks a place where your function may be paused and set aside.** When you write

```rust,ignore
let data = fetch(url).await;   // ← yield point
process(data);
```

you're telling the runtime: *if `fetch` isn't ready, suspend me here, go run something else, and resume me on this line later.* Everything between two `.await`s runs straight through without interruption — async in Rust is **cooperative**, so a task keeps the thread until it reaches an `.await` and yields voluntarily.

Two consequences worth carrying forward, both of which explain errors you'll meet later:

- Code with **no `.await` never yields**, so a long computation inside an async function starves everything else on that thread (see "never block," below).
- Local variables must survive across a yield point, so the compiler stores them in the future's state machine. That's why holding a lock guard or a plain reference across an `.await` can fail to compile — the value has to still be valid when the task resumes, possibly on a different thread.

The machinery underneath — how suspension and resumption actually work — is the next chapter, [Futures & the Poll Model](#/ch/futures).

## Futures are lazy — nothing runs until you await

This trips up newcomers coming from JavaScript, where calling an `async` function starts it immediately. In Rust, **a future does nothing until it's driven**:

```rust
use tokio::time::{sleep, Duration};

async fn say(msg: &str) {
    sleep(Duration::from_millis(1)).await;
    println!("{msg}");
}

#[tokio::main]
async fn main() {
    let future = say("hello"); // NOTHING happens yet — just built a future
    println!("future created, but 'hello' hasn't printed");
    future.await; // NOW it runs
    println!("done");
}
```

> [!key] Lazy futures = zero-cost, and you control when work starts
> Because a Rust future is inert until awaited, building one allocates nothing and starts nothing — you compose futures freely and the runtime drives them only when needed. The flip side: **a future you never `.await` (or spawn) simply never runs.** If your async code "doesn't do anything," the usual cause is a forgotten `.await`.

### Async blocks

Besides `async fn`, you can make a future inline with an **`async` block** — useful for handing a chunk of work to `spawn` or `join!` without naming a function:

```rust
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    // An async block is an expression that evaluates to a future.
    let task = async {
        sleep(Duration::from_millis(10)).await;
        "computed inside an async block"
    };

    // `async move` takes ownership of what it captures — needed for spawn.
    let owned = String::from("captured");
    let handle = tokio::spawn(async move {
        sleep(Duration::from_millis(5)).await;
        format!("{owned} by value")
    });

    println!("{}", task.await);
    println!("{}", handle.await.unwrap());
}
```

## You need a runtime

`async`/`await` is *syntax*; something has to actually **drive** the futures — poll them, and when one is waiting on I/O, park it and run another. That something is an **async runtime**. Rust's standard library deliberately doesn't ship one, so you pick a crate — overwhelmingly **[tokio](#/ch/tokio)**. The `#[tokio::main]` attribute you saw sets one up and runs your async `main` on it.

> [!note] Why `std` has no runtime
> Every other mainstream language bundles one; Rust deliberately doesn't, because a runtime encodes choices — thread pool shape, I/O backend, timer implementation — that are wrong for someone. Embedded firmware wants a tiny single-threaded executor with no allocator ([embassy](#/ch/project-embedded)); a web server wants work-stealing across every core. Keeping the runtime in userspace means both can exist, and the `Future` trait in `std` is the shared contract that lets libraries work with either. The cost is one line of boilerplate and the occasional version-mismatch headache — see [Choosing a Runtime](#/ch/async-ecosystem).

## Running tasks concurrently

The real power appears when you run multiple futures *concurrently*. `tokio::join!` drives several at once and waits for all — so three 20ms waits take ~20ms total, not 60ms:

```rust
use tokio::time::{sleep, Duration};

async fn fetch(name: &str, ms: u64) -> String {
    sleep(Duration::from_millis(ms)).await;
    format!("{name} done")
}

#[tokio::main]
async fn main() {
    let start = std::time::Instant::now();

    // All three run concurrently on one thread, overlapping their waits:
    let (a, b, c) = tokio::join!(
        fetch("users", 20),
        fetch("posts", 20),
        fetch("comments", 20),
    );

    println!("{a}, {b}, {c}");
    println!("took ~{}ms (not 60!)", start.elapsed().as_millis());
}
```

> [!mistake] `.await`ing in sequence throws away the concurrency
> Writing `let a = fetch(..).await; let b = fetch(..).await;` runs them **one after another** — each wait happens in full before the next starts (60ms total). To overlap their waits, drive them *together* with `tokio::join!` (wait for all) or `tokio::spawn` (run independently). Sequential `.await`s are correct but not concurrent — a very common performance trap.

### Sequential vs. `join!` vs. `spawn`

These three are the core vocabulary, and the difference is easiest to see as timelines:

<figure class="diagram">
<svg viewBox="0 0 670 275" role="img" aria-label="Three timelines. Sequential awaits run three twenty-millisecond waits back to back for sixty milliseconds total. join! overlaps all three on one task for twenty milliseconds. spawn also overlaps them but as independent tasks that may run on different threads and start immediately.">
  <style>
    .sq-h { font: 700 11.5px var(--font-sans); }
    .sq-m { font: 600 10px var(--font-mono); fill: var(--text); }
    .sq-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .sq-a { fill: var(--rust-400); }
    .sq-b { fill: var(--blue); }
    .sq-c3 { fill: var(--purple); }
    .sq-ax { stroke: var(--border-strong); stroke-width: 1; }
  </style>
  <text x="12" y="16" class="sq-h" fill="var(--red)">Sequential — .await each in turn: 60 ms</text>
  <rect x="120" y="24" width="150" height="15" class="sq-a"/><text x="126" y="36" class="sq-c" fill="#fff">fetch users</text>
  <rect x="272" y="24" width="150" height="15" class="sq-b"/><text x="278" y="36" class="sq-c" fill="#fff">fetch posts</text>
  <rect x="424" y="24" width="150" height="15" class="sq-c3"/><text x="430" y="36" class="sq-c" fill="#fff">fetch comments</text>
  <text x="12" y="36" class="sq-m">task</text>
  <text x="120" y="54" class="sq-c">each wait completes before the next begins — no overlap at all</text>
  <text x="12" y="88" class="sq-h" fill="var(--green)">join! — one task, three futures interleaved: 20 ms</text>
  <rect x="120" y="96" width="150" height="15" class="sq-a"/>
  <rect x="120" y="113" width="150" height="15" class="sq-b"/>
  <rect x="120" y="130" width="150" height="15" class="sq-c3"/>
  <text x="12" y="122" class="sq-m">task</text>
  <text x="284" y="107" class="sq-c">all three waits happen at the same time</text>
  <text x="284" y="123" class="sq-c">one task, one thread — join! polls each in turn</text>
  <text x="284" y="139" class="sq-c">finishes when the SLOWEST finishes</text>
  <text x="12" y="176" class="sq-h" fill="var(--blue)">spawn — three independent tasks: 20 ms</text>
  <rect x="120" y="184" width="150" height="15" class="sq-a"/><text x="284" y="196" class="sq-c">task 1 — may run on any worker thread</text>
  <rect x="120" y="201" width="150" height="15" class="sq-b"/><text x="284" y="213" class="sq-c">task 2 — starts immediately, no await needed</text>
  <rect x="120" y="218" width="150" height="15" class="sq-c3"/><text x="284" y="230" class="sq-c">task 3 — outlives the caller if not joined</text>
  <text x="12" y="212" class="sq-m">3 tasks</text>
  <line x1="118" y1="248" x2="600" y2="248" class="sq-ax"/>
  <text x="118" y="262" class="sq-c">0 ms</text><text x="256" y="262" class="sq-c">20 ms</text><text x="408" y="262" class="sq-c">40 ms</text><text x="560" y="262" class="sq-c">60 ms</text>
</svg>
<figcaption><code>join!</code> interleaves futures inside <i>one</i> task; <code>spawn</code> creates <i>independent</i> tasks the scheduler can place on any thread.</figcaption>
</figure>

| | Runs when | Threads | Use it when |
|---|---|---|---|
| sequential `.await` | one after another | current | later work *needs* the earlier result |
| `join!` | all together, one task | current only | you need every result, and they're related |
| `spawn` | immediately, independently | any worker | tasks are independent, or must outlive this scope |

Measured, so the difference isn't theoretical:

```rust
use tokio::time::{sleep, Duration};

async fn work(ms: u64) -> u64 {
    sleep(Duration::from_millis(ms)).await;
    ms
}

#[tokio::main]
async fn main() {
    // Sequential: waits add up.
    let t = std::time::Instant::now();
    let a = work(20).await + work(20).await + work(20).await;
    println!("sequential: {a} units in {:>3} ms", t.elapsed().as_millis());

    // join!: waits overlap.
    let t = std::time::Instant::now();
    let (x, y, z) = tokio::join!(work(20), work(20), work(20));
    println!("join!:      {} units in {:>3} ms", x + y + z, t.elapsed().as_millis());

    // spawn: also overlaps, and each task is independent.
    let t = std::time::Instant::now();
    let handles: Vec<_> = (0..3).map(|_| tokio::spawn(work(20))).collect();
    let mut total = 0;
    for h in handles { total += h.await.unwrap(); }
    println!("spawn:      {total} units in {:>3} ms", t.elapsed().as_millis());
}
```

## Never block inside async

This is the single most damaging async mistake, and it produces no error — just a mysteriously slow program. A **blocking** call (one that sleeps the *thread* rather than yielding the *task*) freezes an entire worker, and every task queued on it:

```rust,ignore
#[tokio::main]
async fn main() {
    // ❌ Blocks the whole worker thread for 1s. Every other task on it stalls.
    std::thread::sleep(std::time::Duration::from_secs(1));

    // ✅ Yields the task; the thread goes and runs something else.
    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
}
```

<figure class="diagram">
<svg viewBox="0 0 670 210" role="img" aria-label="One worker thread holding several tasks. With an awaiting sleep the worker keeps cycling through all tasks. With a thread-blocking sleep the worker is frozen and all its other tasks make no progress until it returns.">
  <style>
    .bl-h { font: 700 11.5px var(--font-sans); }
    .bl-m { font: 600 10px var(--font-mono); fill: var(--text); }
    .bl-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .bl-run { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.3; }
    .bl-stall { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.3; }
    .bl-frozen { fill: var(--red); }
    .bl-w { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.4; }
  </style>
  <text x="12" y="16" class="bl-h" fill="var(--green)">✓ .await — the worker keeps serving everyone</text>
  <rect x="12" y="26" width="86" height="52" rx="6" class="bl-w"/>
  <text x="22" y="46" class="bl-m">worker 1</text><text x="22" y="62" class="bl-c">busy, cycling</text>
  <rect x="112" y="26" width="104" height="22" rx="4" class="bl-run"/><text x="122" y="42" class="bl-m">task A ✓</text>
  <rect x="112" y="52" width="104" height="22" rx="4" class="bl-run"/><text x="122" y="68" class="bl-m">task B ✓</text>
  <rect x="226" y="26" width="104" height="22" rx="4" class="bl-run"/><text x="236" y="42" class="bl-m">task C ✓</text>
  <rect x="226" y="52" width="104" height="22" rx="4" class="bl-run"/><text x="236" y="68" class="bl-m">task D ✓</text>
  <text x="346" y="42" class="bl-c">A hits .await → yields → B runs → yields → C…</text>
  <text x="346" y="60" class="bl-c">All four progress. Latency stays low.</text>
  <text x="12" y="110" class="bl-h" fill="var(--red)">✗ thread::sleep — the worker is frozen</text>
  <rect x="12" y="120" width="86" height="52" rx="6" class="bl-w"/>
  <text x="22" y="140" class="bl-m">worker 1</text>
  <rect x="18" y="146" width="74" height="18" rx="3" class="bl-frozen"/>
  <text x="26" y="159" class="bl-m" fill="#fff">FROZEN 1s</text>
  <rect x="112" y="120" width="104" height="22" rx="4" class="bl-stall"/><text x="122" y="136" class="bl-m">task A (blocking)</text>
  <rect x="112" y="146" width="104" height="22" rx="4" class="bl-stall"/><text x="122" y="162" class="bl-m">task B ✗ stalled</text>
  <rect x="226" y="120" width="104" height="22" rx="4" class="bl-stall"/><text x="236" y="136" class="bl-m">task C ✗ stalled</text>
  <rect x="226" y="146" width="104" height="22" rx="4" class="bl-stall"/><text x="236" y="162" class="bl-m">task D ✗ stalled</text>
  <text x="346" y="136" class="bl-c">A never yields, so B, C, D cannot be polled.</text>
  <text x="346" y="154" class="bl-c">No error, no warning — just 1s of added latency</text>
  <text x="346" y="172" class="bl-c">for every request unlucky enough to land here.</text>
  <text x="12" y="200" class="bl-c">With N workers you lose 1/N of your capacity per blocked thread — and on a single-threaded runtime, all of it.</text>
</svg>
<figcaption>A blocking call doesn't just slow its own task — it stalls every task sharing that worker thread.</figcaption>
</figure>

> [!warning] The blocking calls that hide in plain sight
> `std::thread::sleep` is the obvious one, but these are just as blocking and much easier to write by accident:
> - **`std::fs`** — every file read/write. Use `tokio::fs`.
> - **Synchronous HTTP or DB clients** — a non-async `reqwest::blocking`, `postgres` (vs `tokio-postgres`), `rusqlite`.
> - **`Mutex::lock()`** from `std::sync` when the lock is *held* across an `.await` (see [Send, Sync](#/ch/send-sync)).
> - **Heavy CPU work** — parsing a 100 MB file, hashing a password with bcrypt, image resizing. Nothing is "waiting," but the task never yields either.
> - **`recv()`** on a `std::sync::mpsc` channel.
>
> The fix for genuinely blocking work is **`tokio::task::spawn_blocking`**, which moves it to a separate pool built for exactly this — covered in [The Tokio Runtime](#/ch/tokio). The rule of thumb: if a call can take more than ~100 µs and isn't `.await`ed, it doesn't belong in an async function.

## The sync/async boundary

One structural consequence of `.await` that surprises people: **you can only `.await` inside an async function.** This means "asyncness" propagates up your call stack — an async leaf function forces its callers to be async too, all the way to `main`. It's often called the *function coloring* problem.

```rust,ignore
async fn fetch() -> String { /* … */ }

fn sync_caller() {
    let data = fetch().await;  // ❌ error: `await` is only allowed inside
                                //    `async` functions and blocks
}
```

Three ways across the boundary, in order of preference:

```rust,ignore
// 1. Best: make the caller async too, up to #[tokio::main].
async fn better_caller() { let data = fetch().await; }

// 2. At the top of a sync program: create a runtime and block on it.
fn main() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let data = rt.block_on(fetch());
}

// 3. Inside an existing async context: never call block_on — it deadlocks
//    the worker. Use spawn_blocking for sync work instead.
```

> [!mistake] Don't call `block_on` from inside async code
> `Runtime::block_on` parks the current thread until the future completes — which is fine in a `fn main`, and a **deadlock** inside an async task, because the thread it parks is the very thread that was supposed to drive the future. Tokio detects the common case and panics with "Cannot start a runtime from within a runtime," but nested-runtime bugs can also just hang. `block_on` belongs at the *edge* of your program (a `main`, a test, a sync FFI callback), never in the middle.

## Async vs. threads: when to use which

| Use **async** when… | Use **threads/Rayon** when… |
|---------------------|------------------------------|
| Work is **I/O-bound** (network, files, DB) | Work is **CPU-bound** (number crunching) |
| You have **many** concurrent tasks (thousands) | You have a **few** heavy tasks |
| Tasks spend most time **waiting** | Tasks spend most time **computing** |
| e.g. web servers, proxies, chat, scrapers | e.g. image processing, simulations, parsing |

> [!best] Don't reach for async by default
> Async adds real complexity (a runtime, `.await` everywhere, trickier lifetimes). If your program isn't juggling lots of I/O — a CLI tool, a batch script, CPU work — plain functions and threads are simpler and just as fast. Choose async when you genuinely need to handle **many concurrent I/O operations**; otherwise keep it synchronous.

## Decoding common async errors

| Error | Cause | Fix |
|---|---|---|
| `await is only allowed inside async functions` | calling `.await` from a sync fn | make the caller `async`, or `block_on` at the edge |
| `unused implementer of Future that must be used` | you built a future and never awaited it | add `.await` or `spawn` it |
| `future cannot be sent between threads safely` | a non-`Send` value (e.g. `MutexGuard`, `Rc`) is held across an `.await` | shrink the guard's scope; see [Send, Sync](#/ch/send-sync) |
| `there is no reactor running` | using tokio APIs outside a tokio runtime | add `#[tokio::main]` or enter the runtime |
| `Cannot start a runtime from within a runtime` | `block_on` inside async code | use `.await`, or `spawn_blocking` |
| `borrowed value does not live long enough` in `spawn` | spawned task may outlive the borrow | use `async move` and owned data, or `Arc` |

## Summary

- **Async** is concurrency for **I/O-bound** work — it juggles thousands of *waiting* tasks on a few threads (vs. parallelism, which uses many cores for *computing*).
- The reason is **cost**: a thread reserves ~8 MB and a kernel switch; a task costs a few hundred bytes and a function return.
- **`async fn`** returns a **future**; **`.await`** pauses until it's ready **without blocking the thread**, letting the runtime run other tasks.
- **`.await` is a yield point** — the only place a task can be suspended. Async in Rust is *cooperative*, so code with no `.await` never yields.
- Futures are **lazy** — they do nothing until awaited (or spawned); a forgotten `.await` means nothing runs. **`async` blocks** create futures inline.
- Async needs a **runtime** (deliberately not in `std`, so embedded and servers can each have their own); **tokio** is the de-facto choice.
- **Sequential** `.await`s don't overlap; **`join!`** interleaves futures in one task; **`spawn`** creates independent tasks on any worker.
- **Never block inside async** — `thread::sleep`, `std::fs`, sync DB clients, and heavy CPU work freeze a whole worker and every task on it. Use the async equivalent, or **`spawn_blocking`**.
- `.await` only works inside `async`, so asyncness **propagates up** the call stack; use `block_on` only at the program's edge, never inside a task.
- Prefer async only when you have **lots of concurrent I/O** — otherwise stay synchronous.

> [!exercise] Try it yourself
> 1. Write two `async fn`s that each `sleep` and return a string; `.await` them sequentially, then with `tokio::join!`, and compare the elapsed time.
> 2. Create a future with `let f = my_async();` but *don't* await it — confirm its body never runs. Then call `my_async();` as a bare statement and read the `unused implementer of Future` warning. Why does the `let` binding not produce it?
> 3. Explain in one sentence why a web server prefers async but an image-resizing batch job prefers Rayon.
> 4. Replace a `tokio::time::sleep(...).await` with `std::thread::sleep(...)` inside three `join!`ed futures. Measure the total time and explain the change.
> 5. Rewrite the `join!` example with `tokio::spawn` and `.await` on the handles. What does `JoinHandle` return, and why is it a `Result`?
> 6. Try to `.await` inside a plain `fn`. Read the error, then make it work with `Runtime::new()` + `block_on`.
> 7. Spawn a task that borrows a local `String` without `move`. Read the lifetime error, then fix it two ways: `async move`, and `Arc`.
> 8. Time `join!` with three sleeps of 10 ms, 20 ms, and 30 ms. Which one determines the total, and why?

You've got the intuition. Now let's peek under the hood: what *is* a future, really, and how does a runtime drive it? Enter the **`Future` trait and the poll model**.
