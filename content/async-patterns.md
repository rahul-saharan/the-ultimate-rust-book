<h1><span class="h1-kicker">Asynchronous Rust</span>Streams, select! & Cancellation</h1>

Spawning tasks is the start; real async programs need richer patterns. A **stream** is an async sequence of values (a future that yields many items over time). **`select!`** lets you race several futures and act on whichever finishes first. And because futures are lazy state machines, **cancellation** is delightfully simple — you just stop polling. This chapter covers the patterns you'll use to build robust async systems.

## Streams: async iterators

A **`Stream`** is the async cousin of `Iterator`: instead of `next() -> Option<T>`, it has an async `next().await -> Option<T>`, yielding items as they become ready. Think "a channel, a series of incoming requests, or lines from a socket." You consume one with `while let` and the `StreamExt` trait's `.next()`:

```rust
use futures::stream::{self, StreamExt};

#[tokio::main]
async fn main() {
    let mut numbers = stream::iter(vec![1, 2, 3, 4, 5]);

    let mut sum = 0;
    while let Some(n) = numbers.next().await {
        sum += n;
    }
    println!("stream sum = {sum}"); // 15
}
```

> [!jargon] Stream vs. Iterator
> An **iterator** produces values one after another, *synchronously* (the next value is available immediately). A **stream** produces values *asynchronously* — each may require awaiting (the next chat message hasn't arrived yet). Streams get the same adapters you love (`map`, `filter`, `take`, `fold`) via the `StreamExt` trait, but each step can `.await`.

Streams support familiar adapters. `buffer_unordered` is especially powerful — it runs up to *N* async operations **concurrently**, a clean way to bound parallelism (e.g. "fetch these 100 URLs, 10 at a time"):

```rust
use futures::stream::{self, StreamExt};

#[tokio::main]
async fn main() {
    let results: Vec<u32> = stream::iter(1..=6u32)
        .map(|n| async move {
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            n * n
        })
        .buffer_unordered(3) // at most 3 of these futures run at once
        .collect()
        .await;

    println!("{results:?}"); // squares 1..=6 (order may vary)
}
```

## `select!`: race several futures

`tokio::select!` polls multiple futures at once and runs the branch for whichever completes **first**, automatically dropping (cancelling) the rest. It's the workhorse for timeouts, "first response wins," and reacting to whichever of several events happens:

```rust
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    let fast = sleep(Duration::from_millis(10));
    let slow = sleep(Duration::from_millis(100));

    tokio::select! {
        _ = fast => println!("the fast future finished first"),
        _ = slow => println!("the slow future finished first"),
    }
    // As soon as one arm fires, the other future is dropped.
}
```

<figure class="diagram">
<svg viewBox="0 0 640 130" role="img" aria-label="select! polls several futures and runs the branch of whichever completes first, dropping the others">
  <style>
    .selm { font: 600 12px var(--font-mono); fill: var(--text); }
    .selc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .win { fill: var(--green-soft); stroke: var(--green); stroke-width: 2; }
    .lose { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; stroke-dasharray: 4 3; }
  </style>
  <text x="20" y="24" class="selm">tokio::select! {</text>
  <rect x="40" y="36" width="260" height="26" class="win"/><text x="52" y="54" class="selm">_ = fast =&gt; … ✅ ran (finished first)</text>
  <rect x="40" y="68" width="260" height="26" class="lose"/><text x="52" y="86" class="selc">_ = slow =&gt; … ✗ dropped/cancelled</text>
  <text x="20" y="112" class="selc">All branches are polled together; the first to be ready wins, the rest are cancelled.</text>
</svg>
<figcaption><code>select!</code> races futures — first ready wins, and the losers are simply dropped.</figcaption>
</figure>

> [!warning] `select!` branches must be cancellation-safe
> When one branch wins, the others are **dropped mid-flight** — cancelled. If a losing future was halfway through something that must complete (e.g. it read half a message off a socket), dropping it can lose that partial state. Only put **cancellation-safe** operations in `select!` arms, or keep the future in a variable across loop iterations so it resumes. This is subtle; when unsure, prefer simpler structures.

## Cancellation is (almost) free

Here's a lovely consequence of the [poll model](#/ch/futures): to **cancel** a future, you just **stop polling it and drop it**. There's no special "cancel" call, no cleanup protocol — the future's state machine is dropped like any value, running its destructors. `timeout` and `select!` cancel this way automatically:

```rust
use tokio::time::{timeout, sleep, Duration};

#[tokio::main]
async fn main() {
    // Give a slow operation 20ms; cancel it if it's not done.
    let result = timeout(Duration::from_millis(20), async {
        sleep(Duration::from_millis(200)).await; // too slow
        "completed"
    }).await;

    match result {
        Ok(v) => println!("got: {v}"),
        Err(_) => println!("cancelled after timeout ⏱"), // this branch
    }
}
```

> [!key] "Drop = cancel" is a superpower
> Because dropping a future cancels it cleanly, async Rust makes timeouts, races, and shutdown trivial to express — no thread to kill, no flag to check everywhere. Just stop awaiting. (The flip side is the cancellation-safety caveat above: make sure a half-finished future can be safely abandoned.)

## Graceful shutdown

A common real pattern: a long-running worker that loops until told to stop. Combine `select!` with a shutdown channel so the worker finishes its current step and then exits cleanly:

```rust
use tokio::sync::mpsc;
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    let (shutdown_tx, mut shutdown_rx) = mpsc::channel::<()>(1);

    let worker = tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = sleep(Duration::from_millis(5)) => println!("…working…"),
                _ = shutdown_rx.recv() => {
                    println!("shutdown signal received — cleaning up");
                    break; // leave the loop gracefully
                }
            }
        }
    });

    sleep(Duration::from_millis(18)).await;
    let _ = shutdown_tx.send(()).await; // ask the worker to stop
    worker.await.unwrap();              // wait for it to finish cleanly
    println!("shut down cleanly ✅");
}
```

> [!tip] Racing patterns you'll reuse
> - **Timeout**: `tokio::time::timeout(dur, fut)` — cancel if too slow.
> - **First-wins**: `select!` across two request futures — take whichever responds first.
> - **Shutdown**: `select!` a work step against a shutdown signal (channel, or `tokio::signal::ctrl_c()`).
> - **Bounded concurrency**: `stream.buffer_unordered(n)` — run *n* operations at a time.
> - **Wait for all**: `futures::future::join_all(futs)` or `tokio::join!(a, b, c)`.

## Summary

- A **`Stream`** is an async sequence — like an iterator whose `next()` you `.await`; consume with `while let` + `StreamExt::next`, and use adapters like **`buffer_unordered(n)`** to bound concurrency.
- **`tokio::select!`** races multiple futures, runs the first-ready branch, and **drops (cancels) the rest** — beware **cancellation safety** in losing arms.
- **Cancellation is just "stop polling and drop the future"** — which is why `timeout` and `select!` cancel cleanly with no special protocol.
- Build **graceful shutdown** by `select!`-ing a work loop against a shutdown signal, then awaiting the worker to finish.
- Keep a mental toolbox: timeout, first-wins, shutdown, bounded concurrency, join-all.

> [!exercise] Try it yourself
> 1. Build a `stream::iter` of numbers, use `.map` + `.buffer_unordered(2)` to square them with a small sleep, and collect the results.
> 2. Use `select!` to race two `sleep`s of different durations and print which "won".
> 3. Implement the graceful-shutdown loop, then change the timing so the worker runs more (or fewer) iterations before shutdown.

There's one intimidating corner of async left — the `Pin<&mut Self>` in every `poll` signature. Let's finally understand **pinning**.
