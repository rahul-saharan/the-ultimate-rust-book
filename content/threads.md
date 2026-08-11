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

## The fearless part

Here's why Rust's concurrency is special. Try to share mutable data between threads incorrectly, and it simply **won't compile**:

```rust,ignore
use std::thread;
fn main() {
    let mut counter = 0;
    for _ in 0..10 {
        thread::spawn(move || {
            counter += 1; // each thread gets its OWN copy — or the borrow checker stops you
        });
    }
    println!("{counter}"); // this wouldn't do what you'd hope anyway
}
```

The compiler forces you to be explicit about *how* data is shared — through **channels** (message passing) or **`Arc<Mutex<T>>`** (shared state), the subjects of the next chapters. There's no way to accidentally create a data race; the type system won't allow it.

> [!key] The rule that makes it fearless
> Data races require **shared mutable state accessed without synchronization**. Rust's ownership rules already forbid shared mutable access — so a data race literally cannot be expressed in safe Rust. You either move data to one thread, or share it through a synchronized type (`Mutex`, atomic, channel). The compiler is your concurrency reviewer, and it never gets tired.

## Summary

- Create a **thread** with **`thread::spawn(closure)`**; it runs concurrently, possibly on another core.
- **`join()`** the returned **`JoinHandle`** to wait for the thread and collect its return value — without it, `main` exiting kills the threads.
- Use **`move`** to transfer ownership of captured data into a thread (required when the thread may outlive the caller).
- **`thread::scope`** lets threads safely **borrow** local data, auto-joining them at the scope's end — ideal for fork-join work.
- Rust catches **data races at compile time**: you must share data explicitly via channels or synchronized types, so races can't happen in safe code.

> [!exercise] Try it yourself
> 1. Spawn a thread that prints 1–5 while `main` prints "tick" three times; `join` it and observe the interleaving.
> 2. Spawn a thread that takes ownership of a `String` via `move` and returns its length; print the length from `main`.
> 3. Use `thread::scope` to have two threads compute the sum and the max of a shared slice, then print both from `main`.

Threads can run — but how do they *communicate*? The first, and often best, answer is to pass messages down a **channel**.
