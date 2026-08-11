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

## You need a runtime

`async`/`await` is *syntax*; something has to actually **drive** the futures — poll them, and when one is waiting on I/O, park it and run another. That something is an **async runtime**. Rust's standard library deliberately doesn't ship one, so you pick a crate — overwhelmingly **[tokio](#/ch/tokio)**. The `#[tokio::main]` attribute you saw sets one up and runs your async `main` on it.

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

## Async vs. threads: when to use which

| Use **async** when… | Use **threads/Rayon** when… |
|---------------------|------------------------------|
| Work is **I/O-bound** (network, files, DB) | Work is **CPU-bound** (number crunching) |
| You have **many** concurrent tasks (thousands) | You have a **few** heavy tasks |
| Tasks spend most time **waiting** | Tasks spend most time **computing** |
| e.g. web servers, proxies, chat, scrapers | e.g. image processing, simulations, parsing |

> [!best] Don't reach for async by default
> Async adds real complexity (a runtime, `.await` everywhere, trickier lifetimes). If your program isn't juggling lots of I/O — a CLI tool, a batch script, CPU work — plain functions and threads are simpler and just as fast. Choose async when you genuinely need to handle **many concurrent I/O operations**; otherwise keep it synchronous.

## Summary

- **Async** is concurrency for **I/O-bound** work — it juggles thousands of *waiting* tasks on a few threads (vs. parallelism, which uses many cores for *computing*).
- **`async fn`** returns a **future**; **`.await`** pauses until it's ready **without blocking the thread**, letting the runtime run other tasks.
- Futures are **lazy** — they do nothing until awaited (or spawned); a forgotten `.await` means nothing runs.
- Async needs a **runtime** (you don't get one in `std`); **tokio** is the de-facto choice, started via `#[tokio::main]`.
- Run futures concurrently with **`tokio::join!`**; sequential `.await`s don't overlap their waits.
- Prefer async only when you have **lots of concurrent I/O** — otherwise stay synchronous.

> [!exercise] Try it yourself
> 1. Write two `async fn`s that each `sleep` and return a string; `.await` them sequentially, then with `tokio::join!`, and compare the elapsed time.
> 2. Create a future with `let f = my_async();` but *don't* await it — confirm its body never runs.
> 3. Explain in one sentence why a web server prefers async but an image-resizing batch job prefers Rayon.

You've got the intuition. Now let's peek under the hood: what *is* a future, really, and how does a runtime drive it? Enter the **`Future` trait and the poll model**.
