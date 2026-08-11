<h1><span class="h1-kicker">Asynchronous Rust</span>The Tokio Runtime</h1>

**Tokio** is the async runtime that powers most production Rust — from web frameworks to databases to cloud infrastructure. It provides the executor that drives your futures, plus async versions of everything you need: timers, tasks, channels, file and network I/O, and synchronization. This chapter is a practical tour of the tools you'll reach for every day. (All examples run on the in-book playground, which includes tokio.)

## Starting the runtime

The simplest way to get a runtime is the `#[tokio::main]` attribute on `main`. It quietly builds a multi-threaded runtime and runs your async `main` on it:

```rust
#[tokio::main]
async fn main() {
    println!("Running on the Tokio runtime!");
    let n = compute().await;
    println!("computed {n}");
}

async fn compute() -> i32 {
    40 + 2
}
```

> [!note] What `#[tokio::main]` expands to
> It's just sugar. `#[tokio::main] async fn main()` rewrites to a normal `fn main()` that builds a runtime and calls `runtime.block_on(async { … })`. You can write that by hand for more control (e.g. configuring the number of worker threads with `Runtime::builder`), but the attribute is what you'll use 95% of the time.

## Spawning tasks

`tokio::spawn` launches an async **task** onto the runtime — the async analogue of `thread::spawn`. Tasks run concurrently and are incredibly cheap (thousands are no problem). It returns a `JoinHandle` you can `.await` for the result:

```rust
#[tokio::main]
async fn main() {
    let handle = tokio::spawn(async {
        // This runs concurrently with main.
        let sum: i32 = (1..=100).sum();
        sum
    });

    println!("main is doing other work…");
    let result = handle.await.unwrap(); // await the task's result
    println!("task returned {result}");
}
```

> [!jargon] Task vs. thread
> A **task** is a unit of async work the runtime schedules — a future being driven. Unlike an OS **thread** (which costs ~MBs of memory and a kernel resource), a task is just a small state machine; a runtime multiplexes thousands of tasks onto a handful of threads. "Spawn a task" ≈ "here's more work, fit it in whenever a thread is free."

## Running many tasks and collecting results

To run a dynamic number of tasks and gather their results, spawn them into a `Vec` of handles, then await each — or use `futures::future::join_all`:

```rust
#[tokio::main]
async fn main() {
    let mut handles = vec![];
    for id in 0..5 {
        handles.push(tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            id * id
        }));
    }

    let mut total = 0;
    for h in handles {
        total += h.await.unwrap();
    }
    println!("sum of squares 0..5 = {total}"); // 30
}
```

## Timers and delays

Tokio provides async timing in `tokio::time`. Crucially, `tokio::time::sleep` is **non-blocking** — while a task sleeps, the runtime happily runs others:

```rust
use tokio::time::{sleep, timeout, Duration};

#[tokio::main]
async fn main() {
    sleep(Duration::from_millis(10)).await;
    println!("woke up");

    // timeout wraps any future, cancelling it if it takes too long:
    let slow = sleep(Duration::from_secs(5));
    match timeout(Duration::from_millis(20), slow).await {
        Ok(_) => println!("finished in time"),
        Err(_) => println!("timed out! (as expected)"),
    }
}
```

> [!mistake] Never call blocking code in an async task
> Using `std::thread::sleep` (or a blocking file read, or a heavy CPU loop) inside an `async fn` **blocks the whole worker thread**, freezing every other task scheduled on it. Always use the async equivalent (`tokio::time::sleep`, `tokio::fs`, etc.). For unavoidable blocking or CPU-heavy work, offload it with **`tokio::task::spawn_blocking`**, which runs it on a separate thread pool so the async workers stay free.

## Periodic tasks: `interval` and ticks

`sleep` waits *once*; **`interval`** fires **repeatedly** at a fixed rate — the tool for "do this every N seconds": heartbeats, polling, metrics flushes, cache refreshes, game loops. You hold an `Interval` and call `.tick().await`, which resolves on each beat.

<figure class="diagram">
<svg viewBox="0 0 640 130" role="img" aria-label="An interval fires its first tick immediately at time zero, then a tick every period along a timeline">
  <style>
    .iv-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .iv-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .tick { fill: var(--rust-500); }
  </style>
  <line x1="30" y1="60" x2="610" y2="60" stroke="var(--border-strong)" stroke-width="2"/>
  <g>
    <circle cx="60"  cy="60" r="8" class="tick"/><text x="46"  y="90" class="iv-b">tick 1</text><text x="46"  y="106" class="iv-c">t = 0 (now)</text>
    <circle cx="200" cy="60" r="8" class="tick"/><text x="188" y="90" class="iv-b">tick 2</text><text x="188" y="106" class="iv-c">+period</text>
    <circle cx="340" cy="60" r="8" class="tick"/><text x="328" y="90" class="iv-b">tick 3</text>
    <circle cx="480" cy="60" r="8" class="tick"/><text x="468" y="90" class="iv-b">tick 4</text>
  </g>
  <text x="30" y="34" class="iv-c">interval(period).tick().await — one beat at each mark; the schedule doesn't drift with slow work.</text>
</svg>
<figcaption>The first <code>tick()</code> is immediate; the rest arrive one <em>period</em> apart, measured from the scheduled time — not from when your code finishes.</figcaption>
</figure>

```rust
use tokio::time::{interval, Duration};

#[tokio::main]
async fn main() {
    let mut ticker = interval(Duration::from_millis(10)); // a beat every 10ms
    for i in 1..=3 {
        ticker.tick().await;      // 1st tick fires right away, then every 10ms
        println!("tick {i}");
    }
}
```

> [!note] The first tick is immediate, and ticks don't pile up
> `interval(period)` fires its **first** `tick()` at time 0, then every `period`. If a slow iteration makes a tick run late, tokio won't fire a burst to "catch up" — tune that with `set_missed_tick_behavior(MissedTickBehavior::{Burst, Delay, Skip})`. Use `interval_at(start, period)` to delay the first beat. Because each beat is timed from its *scheduled* moment, occasional slow work doesn't drift the whole schedule.

## Racing futures with `select!`

Often you must wait on **several** things at once and act on **whichever is ready first** — a message *or* a timeout, work *or* a shutdown signal. **`tokio::select!`** polls multiple branches concurrently, runs the body of the first that completes, and **cancels the rest**.

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="select polls several futures at once; the first to finish runs its branch and the other futures are cancelled">
  <style>
    .se-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .se-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .fut { fill: var(--blue-soft);  stroke: var(--blue);  stroke-width: 1.4; }
    .win { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .lose{ fill: var(--surface-2);  stroke: var(--border-strong); stroke-width: 1.3; }
  </style>
  <rect x="20" y="20" width="150" height="30" rx="6" class="fut"/><text x="32" y="40" class="se-b">future A (10ms)</text>
  <rect x="20" y="60" width="150" height="30" rx="6" class="fut"/><text x="32" y="80" class="se-b">future B (50ms)</text>
  <rect x="20" y="100" width="150" height="30" rx="6" class="fut"/><text x="32" y="120" class="se-b">future C (msg?)</text>
  <rect x="250" y="55" width="130" height="40" rx="8" fill="var(--rust-100)" stroke="var(--rust-400)" stroke-width="1.5"/>
  <text x="264" y="80" class="se-b" fill="var(--rust-700)">select! { … }</text>
  <path d="M170 35 L248 66" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#sea)"/>
  <path d="M170 75 L248 75" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#sea)"/>
  <path d="M170 115 L248 84" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#sea)"/>
  <rect x="440" y="30" width="180" height="30" rx="6" class="win"/><text x="452" y="50" class="se-b" fill="var(--green)">A ready first → run A</text>
  <rect x="440" y="70" width="180" height="30" rx="6" class="lose"/><text x="452" y="90" class="se-c">B, C cancelled (dropped)</text>
  <path d="M380 75 L438 45" stroke="var(--green)" stroke-width="1.4" marker-end="url(#sea)"/>
  <path d="M380 75 L438 85" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#sea)"/>
  <defs><marker id="sea" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption><code>select!</code> waits on all branches at once; the first to complete wins and the others are cancelled at their last <code>.await</code>.</figcaption>
</figure>

```rust
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    tokio::select! {
        _ = sleep(Duration::from_millis(50)) => println!("the slow branch won"),
        _ = sleep(Duration::from_millis(10)) => println!("the fast branch won"), // this one
    }
}
```

A hugely common use is "receive a message, but give up after a deadline" — combine a channel with a timer:

```rust,ignore
tokio::select! {
    Some(msg) = rx.recv()               => handle(msg),
    _ = sleep(Duration::from_secs(1))   => println!("no message within 1s"),
}
```

> [!warning] `select!` cancels the losers — mind partial work
> When a branch wins, the other futures are **dropped mid-flight** (cancelled at their last `.await`). That's ideal for timeouts, but it means a losing branch must be safe to abandon. Don't bury important state changes inside a branch that could be cancelled — do the awaiting in the branch and the *committing* after `select!` returns.

## Async channels

Threads had `std::sync::mpsc`; async has `tokio::sync::mpsc`. Same idea, but `send`/`recv` are **awaitable**, so waiting for a message yields the thread instead of blocking it:

```rust
use tokio::sync::mpsc;

#[tokio::main]
async fn main() {
    let (tx, mut rx) = mpsc::channel::<i32>(32); // bounded, capacity 32

    tokio::spawn(async move {
        for i in 1..=3 {
            tx.send(i).await.unwrap(); // .await — non-blocking send
        }
    });

    while let Some(value) = rx.recv().await { // .await — non-blocking recv
        println!("received {value}");
    }
}
```

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="The Tokio runtime multiplexes many small tasks onto a small pool of worker threads">
  <style>
    .tkm { font: 600 11px var(--font-mono); fill: var(--text); }
    .tkc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .tkt { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.2; }
    .tkw { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="20" y="22" class="tkc">Thousands of cheap tasks…</text>
  <g class="tkm">
    <rect x="20" y="32" width="46" height="22" class="tkt"/><text x="30" y="47">task</text>
    <rect x="72" y="32" width="46" height="22" class="tkt"/><text x="82" y="47">task</text>
    <rect x="124" y="32" width="46" height="22" class="tkt"/><text x="134" y="47">task</text>
    <rect x="176" y="32" width="46" height="22" class="tkt"/><text x="186" y="47">task</text>
    <rect x="228" y="32" width="46" height="22" class="tkt"/><text x="238" y="47">task</text>
    <rect x="280" y="32" width="46" height="22" class="tkt"/><text x="290" y="47">task</text>
    <rect x="332" y="32" width="46" height="22" class="tkt"/><text x="342" y="47">…</text>
  </g>
  <text x="20" y="92" class="tkc">…multiplexed by the runtime onto a few worker threads (≈ CPU cores):</text>
  <g class="tkm">
    <rect x="20" y="100" width="120" height="30" class="tkw"/><text x="34" y="120" class="tkm">worker 1</text>
    <rect x="150" y="100" width="120" height="30" class="tkw"/><text x="164" y="120" class="tkm">worker 2</text>
    <rect x="280" y="100" width="120" height="30" class="tkw"/><text x="294" y="120" class="tkm">worker 3</text>
    <rect x="410" y="100" width="120" height="30" class="tkw"/><text x="424" y="120" class="tkm">worker 4</text>
  </g>
  <text x="20" y="152" class="tkc">A blocked task yields its worker to another — so few threads serve enormous concurrency.</text>
</svg>
<figcaption>Tokio's scheduler juggles thousands of tasks over a small worker-thread pool, work-stealing to stay busy.</figcaption>
</figure>

## Async I/O: a tiny TCP echo idea

Tokio's real job is I/O. Its `tokio::net` and `tokio::io` mirror the standard library but are awaitable, so one task-per-connection scales to tens of thousands of connections on a few threads. A sketch of an echo server (needs a real network, so it's illustrative):

```rust,ignore
use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:8080").await?;
    loop {
        let (mut socket, _) = listener.accept().await?;
        // Handle each connection in its own task — cheap!
        tokio::spawn(async move {
            let mut buf = [0u8; 1024];
            while let Ok(n) = socket.read(&mut buf).await {
                if n == 0 { break; }
                let _ = socket.write_all(&buf[..n]).await; // echo it back
            }
        });
    }
}
```

## How Tokio runs your tasks: the work-stealing scheduler

By default, `#[tokio::main]` starts the **multi-threaded runtime**: a pool of worker threads (usually one per CPU core) that share your tasks. What makes it fast is a **work-stealing scheduler** — each worker keeps its own local queue of ready tasks, and whenever a worker runs out of work it *steals* tasks from a busier worker's queue. No core sits idle while another is swamped.

<figure class="diagram">
<svg viewBox="0 0 640 210" role="img" aria-label="Each Tokio worker thread has a local task queue; an idle worker steals tasks from a busy worker, and new tasks enter a shared global queue">
  <style>
    .wsm { font: 600 11px var(--font-mono); fill: var(--text); }
    .wsc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .wt { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .tk { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.2; }
    .gq { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
  </style>
  <rect x="210" y="12" width="220" height="26" class="gq"/><text x="224" y="29" class="wsm">global queue (new spawns)</text>
  <path d="M150 40 L120 66" stroke="var(--text-mute)" stroke-width="1.2" marker-end="url(#aws)"/>
  <path d="M320 40 L320 66" stroke="var(--text-mute)" stroke-width="1.2" marker-end="url(#aws)"/>
  <!-- worker 1: busy -->
  <rect x="30" y="70" width="130" height="28" class="wt"/><text x="44" y="89" class="wsm">worker 1</text>
  <rect x="40" y="104" width="26" height="18" class="tk"/><rect x="70" y="104" width="26" height="18" class="tk"/><rect x="100" y="104" width="26" height="18" class="tk"/>
  <!-- worker 2 -->
  <rect x="255" y="70" width="130" height="28" class="wt"/><text x="269" y="89" class="wsm">worker 2</text>
  <rect x="265" y="104" width="26" height="18" class="tk"/><rect x="295" y="104" width="26" height="18" class="tk"/>
  <!-- worker 3: idle, steals -->
  <rect x="480" y="70" width="130" height="28" class="wt"/><text x="494" y="89" class="wsm">worker 3 (idle)</text>
  <path d="M478 112 C 300 150, 180 150, 130 122" stroke="var(--rust-500)" stroke-width="2" fill="none" marker-end="url(#aws2)"/>
  <text x="250" y="168" class="wsc" fill="var(--rust-600)">worker 3 steals a task from worker 1's queue →</text>
  <text x="40" y="140" class="wsc">local run-queues (ready tasks)</text>
  <defs>
    <marker id="aws" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker>
    <marker id="aws2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker>
  </defs>
</svg>
<figcaption>Each worker drains its own queue; idle workers <b>steal</b> from busy ones, so all cores stay busy.</figcaption>
</figure>

You can watch tasks spread across the worker threads:

```rust
use std::collections::HashSet;

#[tokio::main(flavor = "multi_thread", worker_threads = 4)]
async fn main() {
    let mut handles = vec![];
    for _ in 0..8 {
        handles.push(tokio::spawn(async {
            std::thread::current().id() // which worker actually ran this task?
        }));
    }
    let mut workers = HashSet::new();
    for h in handles {
        workers.insert(h.await.unwrap());
    }
    println!("8 tasks were spread across {} worker thread(s)", workers.len());
}
```

> [!jargon] Work-stealing
> A scheduling strategy where each thread has its **own** queue of work, and threads that finish early **steal** items from others' queues rather than going idle. It keeps every core busy with minimal locking (workers only coordinate when stealing), which is why Tokio scales so well across cores. Go, Rayon, and .NET's thread pool use the same idea.

> [!key] Tasks are cooperative — they must yield
> Work-stealing balances tasks *between* threads, but within a thread tasks run **cooperatively**: a task keeps a worker until it hits an `.await`, which is where it can be paused and another task resumed. That's why a task that never `.await`s (a tight CPU loop) hogs its worker — there's no `.await` point for the scheduler to switch at. The fix is the next section: move such work off the async workers entirely.

## Blocking code: `spawn_blocking` and the blocking pool

An async task must never **block** — sit and wait synchronously (a `std::thread::sleep`, a synchronous file or database call, or a long CPU crunch with no `.await`). Because the runtime multiplexes many tasks onto few worker threads, a task that blocks its worker freezes every *other* task queued on that thread.

Tokio's answer is **`spawn_blocking`**: it runs your blocking closure on a **separate, dedicated pool of blocking threads**, leaving the async workers free to keep driving other tasks.

<figure class="diagram">
<svg viewBox="0 0 640 190" role="img" aria-label="Async worker pool is small and must never block; the blocking pool grows on demand and is where blocking work belongs">
  <style>
    .bpm { font: 600 11px var(--font-mono); fill: var(--text); }
    .bpc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .bph { font: 700 12px var(--font-sans); }
    .aw { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .bl { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="30" y="26" class="bph" fill="var(--blue)">async workers (≈ CPU cores)</text>
  <rect x="30" y="36" width="70" height="34" class="aw"/><rect x="106" y="36" width="70" height="34" class="aw"/><rect x="182" y="36" width="70" height="34" class="aw"/>
  <text x="30" y="90" class="bpc">fixed &amp; small · must NEVER block</text>
  <text x="380" y="26" class="bph" fill="var(--rust-600)">blocking pool (grows on demand)</text>
  <rect x="380" y="36" width="52" height="34" class="bl"/><rect x="438" y="36" width="52" height="34" class="bl"/><rect x="496" y="36" width="52" height="34" class="bl"/><rect x="554" y="36" width="52" height="34" class="bl"/>
  <text x="380" y="90" class="bpc">up to ~512 threads · made for blocking</text>
  <path d="M255 53 L378 53" stroke="var(--rust-500)" stroke-width="2.5" marker-end="url(#abp)"/>
  <text x="262" y="46" class="bpc" fill="var(--rust-600)">spawn_blocking →</text>
  <text x="30" y="150" class="bpc">Async I/O (tokio::fs, tokio::net) stays on the workers; synchronous / CPU-heavy work goes to the blocking pool.</text>
  <defs><marker id="abp" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker></defs>
</svg>
<figcaption><code>spawn_blocking</code> moves blocking work off the small async worker pool onto a dedicated blocking pool.</figcaption>
</figure>

```rust
use tokio::time::{Instant, Duration};

#[tokio::main]
async fn main() {
    let start = Instant::now();

    // A blocking / CPU-heavy operation, offloaded so it can't stall the runtime:
    let heavy = tokio::task::spawn_blocking(|| {
        std::thread::sleep(Duration::from_millis(50)); // stand-in for a blocking call
        (1..=1_000_000u64).sum::<u64>()                // ...or heavy CPU work
    });

    // The async side stays responsive while that runs on the blocking pool.
    let result = heavy.await.unwrap();
    println!("blocking work returned {result} in ~{:?}", start.elapsed());
}
```

> [!warning] Two pools, two rules
> The **async worker pool** is small (≈ CPU cores) and must *never* block. The **blocking pool** grows on demand (hundreds of threads) and is *made* for blocking. Put async I/O on the workers; put synchronous work — blocking DB drivers, file crunching, `std::thread::sleep`, heavy CPU — inside **`spawn_blocking`**. Blocking on a worker is the #1 cause of a "hung" or unresponsive Tokio app. For pure CPU parallelism, also consider [Rayon](#/ch/rayon) instead of the blocking pool.

## Runtime flavors & configuration

`#[tokio::main]` hides a runtime builder, and there are two flavors:

- **`multi_thread`** (the default) — the work-stealing pool above; best for servers using every core.
- **`current_thread`** — a single-threaded runtime; lighter and deterministic, ideal for tests, CLIs, or embedding one small async task in an otherwise sync program.

Build one explicitly when you want control:

```rust
fn main() {
    // A lightweight single-threaded runtime, built by hand:
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    let n = rt.block_on(async {
        tokio::time::sleep(std::time::Duration::from_millis(5)).await;
        21 * 2
    });
    println!("ran on a current-thread runtime: {n}");
}
```

…or tune the multi-threaded pool right in the macro:

```rust,ignore
#[tokio::main(flavor = "multi_thread", worker_threads = 8)]
async fn main() { /* ... */ }
```

### Building the runtime dynamically at runtime

The macro is convenient, but it bakes every choice in at compile time. Because `Builder` is just a normal value, you can decide the flavor and size **while the program is running** — from a config file, an environment variable, or the number of cores you detect. This is the pattern you reach for in a plain `fn main()` (no `#[tokio::main]`), in a library that shouldn't own the runtime, or when a sync program needs to spin up async work on demand.

```rust
use tokio::runtime::Builder;

fn main() {
    // Decide the shape of the runtime at runtime — e.g. from an env var:
    let heavy = std::env::var("HEAVY").is_ok();

    let mut builder = if heavy {
        Builder::new_multi_thread()
    } else {
        Builder::new_current_thread()
    };

    let rt = builder
        .worker_threads(if heavy { 4 } else { 1 }) // ignored by current_thread
        .thread_name("rb-worker")                  // name the OS threads (nice in logs/debuggers)
        .enable_all()                              // turn on the timer + I/O drivers
        .build()
        .unwrap();

    // Drive async work from synchronous code:
    let sum = rt.block_on(async {
        let a = tokio::spawn(async { (1..=50).sum::<i32>() });
        let b = tokio::spawn(async { (51..=100).sum::<i32>() });
        a.await.unwrap() + b.await.unwrap()
    });
    println!("built a {} runtime dynamically; sum = {sum}",
             if heavy { "multi-thread" } else { "current-thread" });
}
```

Once you hold a runtime you can hand out a lightweight, cloneable **`Handle`** so other threads (or sync code deep in your program) can `spawn` onto the *same* runtime without a reference to the `Runtime` itself:

```rust
use tokio::runtime::Runtime;

fn main() {
    let rt = Runtime::new().unwrap();      // multi-thread runtime, all defaults
    let handle = rt.handle().clone();      // cheap to clone; Send + 'static

    // Some other (sync) thread can now schedule async work on our runtime:
    let worker = std::thread::spawn(move || {
        handle.block_on(async {
            tokio::spawn(async { "hello from a spawned task" }).await.unwrap()
        })
    });

    println!("{}", worker.join().unwrap());
}
```

> [!note] Keep the `Runtime` alive
> The runtime lives as long as its `Runtime` value is in scope; dropping it shuts the workers down (and blocks until in-flight blocking tasks finish). Store it somewhere lasting — a field on your app struct, a `static`/`OnceCell`, or the top of `main` — if tasks must outlive the function that built it. Also: never build a second runtime *inside* an async task, and never call `block_on` from within an async context — both panic. Use a `Handle` to reach an existing runtime instead.

## Getting results back: `oneshot` and `broadcast`

Beyond `mpsc`, `tokio::sync` has channels shaped for other jobs:

- **`oneshot`** — send exactly **one** value back from a task (a "return channel" for spawned work).
- **`broadcast`** — send each message to **many** receivers at once (fan-out, pub/sub, shutdown signals).

```rust
use tokio::sync::oneshot;

#[tokio::main]
async fn main() {
    let (tx, rx) = oneshot::channel();

    tokio::spawn(async move {
        let answer = (1..=100).sum::<i32>();
        let _ = tx.send(answer); // send the single result back
    });

    println!("the task computed: {}", rx.await.unwrap()); // await that one value
}
```

## Shared state across `.await`: `tokio::sync::Mutex`

Channels pass *messages*; sometimes tasks instead share *data*. Tokio provides an async **`Mutex`** whose `lock()` is awaitable — a task waiting for the lock yields the worker instead of blocking it:

```rust
use std::sync::Arc;
use tokio::sync::Mutex;

#[tokio::main]
async fn main() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];
    for _ in 0..5 {
        let c = Arc::clone(&counter);
        handles.push(tokio::spawn(async move {
            let mut n = c.lock().await; // await the lock
            *n += 1;
        }));
    }
    for h in handles {
        h.await.unwrap();
    }
    println!("total = {}", *counter.lock().await); // 5
}
```

> [!key] Which Mutex — `std` or `tokio`?
> Use **`std::sync::Mutex`** for a quick lock you take and release *without* awaiting while you hold it (it's faster and simpler). Use **`tokio::sync::Mutex`** only when you must **hold the lock across an `.await`** (lock → await a DB/HTTP call → update), because a `std` guard held across `.await` isn't `Send` and can stall the runtime. There's a `tokio::sync::RwLock` too, for many-readers / one-writer.

## Limiting concurrency: `Semaphore`

A **semaphore** hands out a fixed number of *permits* — the standard way to cap "at most N of these at once": open database connections, in-flight downloads, or calls to a rate-limited API. A task acquires a permit before working; dropping the permit frees the slot for the next waiter.

```rust
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    let limit = Arc::new(Semaphore::new(2)); // at most 2 running at once
    let mut handles = vec![];
    for i in 1..=5 {
        let limit = Arc::clone(&limit);
        handles.push(tokio::spawn(async move {
            let _permit = limit.acquire().await.unwrap(); // wait for a free slot
            sleep(Duration::from_millis(10)).await;        // the limited work
            i
        })); // _permit drops here → slot freed for the next task
    }
    let mut sum = 0;
    for h in handles {
        sum += h.await.unwrap();
    }
    println!("ran all 5, never more than 2 at once (sum = {sum})"); // 15
}
```

## Broadcasting the latest value: `watch`

The **`watch`** channel holds a single value that a sender updates and many receivers observe — always the *latest* value (older ones collapse). It's perfect for live config reloads or a shutdown signal shared with many tasks:

```rust
use tokio::sync::watch;

#[tokio::main]
async fn main() {
    let (tx, mut rx) = watch::channel("v1");

    let reader = tokio::spawn(async move {
        while rx.changed().await.is_ok() {        // wakes on each new value
            println!("config is now {}", *rx.borrow());
        }
    });

    tx.send("v2").unwrap();
    tx.send("v3").unwrap();
    drop(tx);                                     // closing the sender ends the loop
    reader.await.unwrap();
}
```

## Cancelling tasks & graceful shutdown

A spawned task can be **cancelled** by calling `.abort()` on its `JoinHandle`; the task stops at its next `.await` point, and awaiting the handle reports the cancellation:

```rust
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    let task = tokio::spawn(async {
        sleep(Duration::from_secs(60)).await; // would run for a minute
        "done"
    });

    sleep(Duration::from_millis(10)).await;
    task.abort();                              // cancel it

    match task.await {
        Ok(v) => println!("finished: {v}"),
        Err(e) if e.is_cancelled() => println!("task was cancelled"), // this
        Err(e) => println!("task panicked: {e}"),
    }
}
```

For a whole program, the idiomatic **graceful shutdown** is a `select!` between your work and a shutdown signal (`Ctrl-C` via `tokio::signal`, or a `watch`), so in-flight work can stop cleanly:

```rust,ignore
let mut ticker = tokio::time::interval(Duration::from_secs(1));
loop {
    tokio::select! {
        _ = ticker.tick()            => do_periodic_work().await,
        _ = tokio::signal::ctrl_c()  => { println!("shutting down…"); break; }
    }
}
```

> [!tip] For many tasks, use `JoinSet` or `CancellationToken`
> To manage a *dynamic* group of tasks, **`tokio::task::JoinSet`** spawns them and yields results as they finish (aborting the rest when dropped). To signal cancellation *cooperatively* across many tasks, the `tokio-util` crate's **`CancellationToken`** is the standard tool — hand each task a clone and call `.cancel()` once to stop them all.

> [!best] The tokio toolbox at a glance
> - **`#[tokio::main]`** — start the runtime.
> - **`tokio::spawn`** — run a task concurrently (cheap; returns a `JoinHandle` you can `.abort()`).
> - **`tokio::time`** — `sleep`, `timeout`, and **`interval`** (periodic **ticks**) — all non-blocking.
> - **`tokio::select!`** — race several futures; first ready wins, the rest are cancelled.
> - **`tokio::sync`** — `mpsc`/`oneshot`/`broadcast`/`watch` channels, plus async `Mutex`/`RwLock` and `Semaphore`.
> - **`tokio::net` / `tokio::fs`** — awaitable TCP/UDP and file I/O.
> - **`spawn_blocking`** — escape hatch for blocking/CPU-heavy work; **`tokio::signal`** for shutdown.
>
> Reach for these instead of their blocking `std` equivalents anywhere inside async code.

## Summary

- **Tokio** is the dominant async runtime: start it with **`#[tokio::main]`** (sugar for `Runtime::block_on`).
- **`tokio::spawn`** runs a lightweight **task** concurrently and returns an awaitable `JoinHandle`; tasks are far cheaper than threads.
- Use tokio's **non-blocking** equivalents — `tokio::time::sleep`, `tokio::sync::mpsc`, `tokio::net`/`tokio::fs` — and **never** call blocking code in a task (offload with **`spawn_blocking`**).
- Collect many tasks' results by awaiting their handles (or `join_all`); wrap futures with **`timeout`** for deadlines, and run periodic work with **`interval`** ticks.
- **`select!`** races futures (first ready wins, losers are cancelled) — the basis of timeouts and **graceful shutdown** (with `tokio::signal::ctrl_c`).
- Share data across `.await` with **`tokio::sync::Mutex`/`RwLock`**, cap concurrency with **`Semaphore`**, broadcast the latest value with **`watch`**, and cancel tasks via **`JoinHandle::abort`** (or `JoinSet`/`CancellationToken` for groups).
- One task per connection over a small worker pool is how tokio scales to massive I/O concurrency.

> [!exercise] Try it yourself
> 1. Spawn 10 tasks that each return their index squared; await all handles and print the total.
> 2. Use `tokio::time::interval` to print a tick every 100 ms, five times, then stop.
> 3. Use `select!` to race a `tokio::sync::mpsc` receive against a 1-second `timeout`.
> 4. Cap 10 tasks to 3-at-a-time with a `Semaphore`, and confirm all 10 still complete.

Spawning and joining is just the start. Real async programs need to *race* futures, react to *streams* of events, and shut down *gracefully* — that's next.
