<h1><span class="h1-kicker">Fearless Concurrency</span>Message Passing with Channels</h1>

There are two great ways for threads to work together: *share memory* (which we'll cover next, with locks) or *pass messages*. Rust — echoing the Go slogan *"don't communicate by sharing memory; share memory by communicating"* — makes message passing wonderfully safe with **channels**. A channel moves ownership of data from one thread to another, so there's nothing to lock and nothing to race. This chapter shows how.

## A channel has two ends

A **channel** is a one-way pipe with a **transmitter** (`tx`, the sending end) and a **receiver** (`rx`, the receiving end). You create both with `mpsc::channel`, then move the transmitter into a thread that sends values, while the main thread receives them:

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel(); // tx = transmitter, rx = receiver

    thread::spawn(move || {
        let messages = vec!["hi", "from", "the", "thread"];
        for msg in messages {
            tx.send(msg).unwrap(); // send moves the value down the channel
            thread::sleep(std::time::Duration::from_millis(1));
        }
    });

    // rx.recv() blocks until a value arrives:
    for received in rx {
        println!("Got: {received}");
    }
}
```

> [!jargon] mpsc = "multiple producer, single consumer"
> The channel type lives at `std::sync::mpsc`, which stands for **m**ultiple **p**roducer, **s**ingle **c**onsumer. That means you can have **many senders** (`tx`) feeding one **receiver** (`rx`). You get this by *cloning* the transmitter — each clone is another producer.

## Sending transfers ownership

The key safety property: when you `send` a value, you **give it away** — ownership moves into the channel and out to the receiver. You can't accidentally use it afterward:

```rust,ignore
use std::sync::mpsc;
use std::thread;
fn main() {
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let data = String::from("owned");
        tx.send(data).unwrap();
        // println!("{data}"); // ❌ error: `data` was moved by send
    });
    println!("{}", rx.recv().unwrap());
}
```

> [!key] Why channels are race-free
> Because `send` **moves** the value, only one thread ever owns a given piece of data at a time — the sender before sending, the receiver after. There's no shared access, so there's nothing to race over and nothing to lock. The ownership system turns "safe message passing" from a discipline you must remember into a rule the compiler enforces.

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="Producer threads send values through a channel to a single consumer">
  <style>
    .chm { font: 600 12px var(--font-mono); fill: var(--text); }
    .chc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .prod { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .chan { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
    .cons { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="20" y="20" width="120" height="30" class="prod"/><text x="34" y="40" class="chm">producer tx</text>
  <rect x="20" y="90" width="120" height="30" class="prod"/><text x="34" y="110" class="chm">producer tx</text>
  <rect x="250" y="55" width="150" height="30" class="chan"/><text x="264" y="75" class="chm">channel queue</text>
  <rect x="500" y="55" width="120" height="30" class="cons"/><text x="514" y="75" class="chm">receiver rx</text>
  <path d="M142 35 C 200 35, 200 65, 248 65" stroke="var(--blue)" stroke-width="2" fill="none" marker-end="url(#ach)"/>
  <path d="M142 105 C 200 105, 200 78, 248 78" stroke="var(--blue)" stroke-width="2" fill="none" marker-end="url(#ach)"/>
  <path d="M402 70 L498 70" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#ach)"/>
  <text x="20" y="145" class="chc">Many producers (clone tx) → one queue → one consumer. Values move; ownership travels with them.</text>
  <defs><marker id="ach" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>An <b>mpsc</b> channel: multiple producers feed one receiver, each message carrying ownership.</figcaption>
</figure>

## Multiple producers

Clone the transmitter to have several threads send into the same receiver. Iterating the receiver ends automatically once **all** transmitters have been dropped:

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    for id in 0..3 {
        let tx = tx.clone(); // each thread gets its own sending end
        thread::spawn(move || {
            tx.send(format!("message from worker {id}")).unwrap();
        });
    }
    drop(tx); // drop the ORIGINAL tx so the channel can close when workers finish

    // The loop ends when every tx (all clones + original) has been dropped:
    for msg in rx {
        println!("{msg}");
    }
}
```

> [!mistake] "My `for msg in rx` loop hangs forever!"
> The receiver's iterator only ends when **every** transmitter is dropped. If you clone `tx` for workers but forget to `drop` the *original* `tx` still held by `main`, the channel never closes and the loop blocks forever waiting for more. The fix is exactly the `drop(tx)` above — or ensure every `tx` naturally goes out of scope.

## `recv` vs `try_recv`

- **`rx.recv()`** blocks until a message arrives (or returns `Err` when the channel is closed and empty).
- **`rx.try_recv()`** returns immediately — `Ok(msg)` if one's ready, `Err` if not — so a thread can check for messages while doing other work.

```rust
use std::sync::mpsc;
fn main() {
    let (tx, rx) = mpsc::channel();
    tx.send(42).unwrap();
    drop(tx);

    match rx.try_recv() {
        Ok(v) => println!("ready: {v}"),
        Err(_) => println!("nothing yet"),
    }
}
```

## Iterating a receiver, and when it stops

A `Receiver` is an iterator, which makes the consumer loop pleasantly short — `for msg in rx` yields messages until the channel is **closed and drained**:

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    for id in 0..3 {
        let tx = tx.clone();
        thread::spawn(move || {
            tx.send(format!("worker {id} finished")).unwrap();
        }); // this clone of tx is dropped here, as the thread ends
    }

    // Drop the ORIGINAL sender — otherwise it stays alive in main
    // and the loop below would wait forever for a message that never comes.
    drop(tx);

    for msg in rx {
        println!("{msg}");
    }
    println!("channel closed — all senders are gone");
}
```

> [!mistake] The hang everyone hits once: forgetting to drop the last sender
> `for msg in rx` ends only when **every** `Sender` has been dropped. If `main` still holds the original `tx` after cloning it for the workers, the channel never closes, and the loop blocks forever waiting on a sender that will never send. There's no error and no CPU use — the program just stops, which makes it a confusing first encounter.
>
> Three ways to avoid it: **`drop(tx)`** explicitly once you've handed out the clones (as above); scope the original so it falls out of scope naturally; or skip the loop and call `rx.recv()` exactly as many times as you expect messages. The same rule explains `recv()` returning `Err(RecvError)` — that's not a failure, it's the channel telling you it's closed and empty.

<figure class="diagram">
<svg viewBox="0 0 670 190" role="img" aria-label="Three cloned senders and one original sender all feed one receiver. The receiver loop ends only after every sender including the original has been dropped; if the original is retained the loop blocks forever.">
  <style>
    .cn-h { font: 700 11.5px var(--font-sans); }
    .cn-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .cn-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .cn-tx { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.3; }
    .cn-keep { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.6; }
    .cn-rx { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
  </style>
  <rect x="12" y="24" width="150" height="22" rx="4" class="cn-tx"/><text x="22" y="40" class="cn-m">tx.clone() → worker 0</text>
  <rect x="12" y="52" width="150" height="22" rx="4" class="cn-tx"/><text x="22" y="68" class="cn-m">tx.clone() → worker 1</text>
  <rect x="12" y="80" width="150" height="22" rx="4" class="cn-tx"/><text x="22" y="96" class="cn-m">tx.clone() → worker 2</text>
  <rect x="12" y="112" width="150" height="22" rx="4" class="cn-keep"/><text x="22" y="128" class="cn-m">tx (original, in main)</text>
  <path d="M164 35 L286 68" stroke="var(--blue)" stroke-width="1.3"/>
  <path d="M164 63 L286 70" stroke="var(--blue)" stroke-width="1.3"/>
  <path d="M164 91 L286 74" stroke="var(--blue)" stroke-width="1.3"/>
  <path d="M164 123 L286 80" stroke="var(--red)" stroke-width="1.6" stroke-dasharray="4 3"/>
  <rect x="290" y="58" width="120" height="30" rx="6" class="cn-rx"/><text x="300" y="78" class="cn-m">rx</text>
  <text x="424" y="52" class="cn-c">Workers finish → their clones drop.</text>
  <text x="424" y="70" class="cn-c">But the original tx is still alive,</text>
  <text x="424" y="88" class="cn-c">so the channel stays OPEN…</text>
  <text x="424" y="112" class="cn-c" fill="var(--red)">…and `for msg in rx` blocks forever.</text>
  <text x="12" y="164" class="cn-c">The receiver closes when the sender COUNT reaches zero — every clone, plus the original.</text>
  <text x="12" y="180" class="cn-c">`drop(tx)` after cloning is the fix, and it is why you see it in almost every mpsc example.</text>
</svg>
<figcaption>The channel closes only when the <b>last</b> sender is dropped — including the original you cloned from.</figcaption>
</figure>

## Bounded channels for backpressure

`mpsc::channel()` is *unbounded* — senders never wait, but a fast producer can pile up unbounded memory. `mpsc::sync_channel(n)` is **bounded**: once `n` messages are buffered, `send` **blocks** until the receiver catches up. This is **backpressure** — it stops a fast producer from overwhelming a slow consumer.

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::sync_channel(2); // capacity 2
    thread::spawn(move || {
        for i in 1..=5 {
            tx.send(i).unwrap(); // blocks when the buffer is full
            println!("sent {i}");
        }
    });
    thread::sleep(std::time::Duration::from_millis(5));
    for v in rx {
        println!("received {v}");
    }
}
```

> [!tip] For serious channel work, reach for `crossbeam` or `flume`
> `std`'s `mpsc` covers the basics. When you need **multiple consumers** too (MPMC), a `select!` across channels, or higher performance, the community crates **`crossbeam-channel`** and **`flume`** are excellent drop-in upgrades. In async code, you'll use `tokio::sync::mpsc` instead — same idea, awaitable. (`std::sync::mpsc` was itself rewritten on top of crossbeam internally.)

## Summary

- A **channel** (`mpsc::channel()`) has a **transmitter** (`tx`) and **receiver** (`rx`); `tx.send(v)` **moves** `v` to the receiver.
- Because sending transfers **ownership**, only one thread owns the data at a time — so channels are inherently **race-free**.
- **`mpsc`** = multiple producers (clone `tx`), single consumer; iterating `rx` ends only when **all** transmitters are dropped (remember `drop(tx)`).
- **`recv`** blocks; **`try_recv`** doesn't. **`sync_channel(n)`** is bounded and provides **backpressure**.
- For MPMC, `select`, or speed, use **`crossbeam-channel`**/**`flume`**; for async, `tokio::sync::mpsc`.

> [!exercise] Try it yourself
> 1. Spawn a thread that sends the numbers 1–10 down a channel; sum them as you receive them in `main`.
> 2. Clone `tx` across three worker threads that each send their id, and collect all messages (remember to `drop` the original `tx`).
> 3. Use `sync_channel(1)` and add `println!`s to observe the sender blocking until the receiver takes each value.

Channels move data between threads. Sometimes, though, threads must all read *and write* the same data. For that we need shared state, guarded by a **`Mutex`**.
