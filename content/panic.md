<h1><span class="h1-kicker">Error Handling</span>Unrecoverable Errors with panic!</h1>

Rust splits errors into two families, and treats them very differently. **Recoverable** errors (a file isn't found, input won't parse) are expected and handled with values — the next chapters cover those. **Unrecoverable** errors are bugs so serious that continuing would be dangerous or meaningless — and for those, Rust *panics*. This short chapter explains what a panic is, when it happens, and how to read one.

## What is a panic?

A **panic** is Rust's way of saying "something went so wrong that I'm going to stop rather than limp along in a broken state." When a panic happens, your program prints an error message and then, by default, unwinds and exits.

You can trigger one yourself with the `panic!` macro:

```rust
fn main() {
    println!("Everything is fine so far…");
    panic!("something went terribly wrong");
    // This line never runs:
    // println!("unreachable");
}
```

Run it and you'll see a message like:

```text
thread 'main' panicked at src/main.rs:3:5:
something went terribly wrong
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

> [!jargon] Panic / unwind / abort
> A **panic** is an immediate, controlled crash. By default Rust then **unwinds** the stack — walking back up through every active function, running each value's cleanup (`drop`) code so resources are released properly. The alternative is to **abort**, which stops instantly without cleanup (smaller binaries, but the OS reclaims everything).

Those two strategies behave very differently, and the difference is visible:

<figure class="diagram">
<svg viewBox="0 0 640 260" role="img" aria-label="Unwinding walks back up the call stack running each destructor in turn, while aborting stops the process immediately without running any cleanup">
  <style>
    .pn-h { font: 700 12px var(--font-sans); }
    .pn-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .pn-c { font: 10.5px var(--font-sans); fill: var(--text-mute); }
    .pn-frame { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
    .pn-boom { fill: var(--red-soft); stroke: var(--red); stroke-width: 2; }
    .pn-drop { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .pn-dead { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; stroke-dasharray: 4 3; }
  </style>
  <text x="20" y="18" class="pn-h" fill="var(--green)">panic = "unwind"  (the default)</text>
  <rect x="20" y="28" width="150" height="26" rx="3" class="pn-frame"/><text x="28" y="46" class="pn-m">main</text>
  <rect x="20" y="58" width="150" height="26" rx="3" class="pn-frame"/><text x="28" y="76" class="pn-m">load_config</text>
  <rect x="20" y="88" width="150" height="26" rx="3" class="pn-frame"/><text x="28" y="106" class="pn-m">parse</text>
  <rect x="20" y="118" width="150" height="26" rx="3" class="pn-boom"/><text x="28" y="136" class="pn-m">💥 panic!</text>
  <rect x="184" y="118" width="150" height="26" rx="3" class="pn-drop"/><text x="192" y="136" class="pn-c">drop locals</text>
  <rect x="184" y="88" width="150" height="26" rx="3" class="pn-drop"/><text x="192" y="106" class="pn-c">drop File → closed</text>
  <rect x="184" y="58" width="150" height="26" rx="3" class="pn-drop"/><text x="192" y="76" class="pn-c">drop MutexGuard → unlocked</text>
  <rect x="184" y="28" width="150" height="26" rx="3" class="pn-drop"/><text x="192" y="46" class="pn-c">exit code 101</text>
  <path d="M176 131 L176 44" stroke="var(--green)" stroke-width="2.5" marker-end="url(#arr-pn)"/>
  <text x="20" y="164" class="pn-c">Walks back up. Every destructor runs, so files close and locks release.</text>
  <text x="20" y="178" class="pn-c">Catchable with catch_unwind; a panicking thread doesn't kill the process.</text>
  <text x="380" y="18" class="pn-h" fill="var(--red)">panic = "abort"</text>
  <rect x="380" y="28" width="150" height="26" rx="3" class="pn-dead"/><text x="388" y="46" class="pn-m">main</text>
  <rect x="380" y="58" width="150" height="26" rx="3" class="pn-dead"/><text x="388" y="76" class="pn-m">load_config</text>
  <rect x="380" y="88" width="150" height="26" rx="3" class="pn-dead"/><text x="388" y="106" class="pn-m">parse</text>
  <rect x="380" y="118" width="150" height="26" rx="3" class="pn-boom"/><text x="388" y="136" class="pn-m">💥 SIGABRT</text>
  <text x="380" y="164" class="pn-c">Process dies here. No destructors run at all.</text>
  <text x="380" y="178" class="pn-c">Smaller binary, no unwind tables — but no cleanup.</text>
  <text x="20" y="212" class="pn-h">Why unwinding is the default</text>
  <text x="20" y="230" class="pn-c">A server that panics on one request should release that request's locks and connections and keep serving.</text>
  <text x="20" y="244" class="pn-c">Aborting would leave a poisoned mutex and drop every other in-flight request too.</text>
  <defs><marker id="arr-pn" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--green)"/></marker></defs>
</svg>
<figcaption><b>Unwinding</b> runs every destructor on the way out, so resources are released; <b>aborting</b> stops the process where it stands.</figcaption>
</figure>

## Panics you'll trigger by accident

You'll rarely call `panic!` directly. Far more often, a panic comes from the standard library catching a bug for you. The two you'll meet most:

```rust
fn main() {
    let v = vec![1, 2, 3];
    let item = v[99]; // 💥 panic: index out of bounds: the len is 3 but the index is 99
    println!("{item}");
}
```

```rust
fn main() {
    let maybe: Option<i32> = None;
    let value = maybe.unwrap(); // 💥 panic: called `Option::unwrap()` on a `None` value
    println!("{value}");
}
```

> [!key] A Rust panic is a *safe* crash
> Notice what these panics are *not*: they're not silent data corruption, not a security hole, not reading someone else's memory. When you index past the end of a vector in C, you might read garbage or leak secrets. In Rust you get a clean, immediate, well-labeled stop at the exact line. A panic is the safe outcome — Rust converting an unpredictable disaster into a predictable halt.

Almost every panic in real code comes from a short list of operations, and almost every one has a non-panicking twin. This table is worth knowing by heart:

| This panics | When | Use instead |
|---|---|---|
| `v[i]` | index out of range | `v.get(i)` → `Option` |
| `&s[a..b]` | range out of bounds, or mid-character in a `&str` | `s.get(a..b)` → `Option` |
| `opt.unwrap()` | the value is `None` | `unwrap_or`, `unwrap_or_else`, `ok_or(..)?` |
| `res.unwrap()` | the value is `Err` | `?`, `unwrap_or_default`, `match` |
| `a / b`, `a % b` | `b` is zero | `a.checked_div(b)` → `Option` |
| `a + b` on integers | overflow — **in debug builds only** | `checked_add`, `saturating_add`, `wrapping_add` |
| `refcell.borrow_mut()` | already borrowed | `try_borrow_mut()` → `Result` |
| `mutex.lock().unwrap()` | the mutex is poisoned | handle the `Err`, or accept the panic |
| `iter.max().unwrap()` | the iterator was empty | `if let Some(m) = iter.max()` |
| `s.parse::<i32>().unwrap()` | the text isn't a number | `.parse().ok()`, or propagate with `?` |
| `arr.copy_from_slice(src)` | lengths differ | check `len()` first |
| `expect("…")` | same as `unwrap`, with your message | the same alternatives |

> [!warning] Integer overflow panics in debug and *wraps* in release
> This is the one panic that changes behaviour based on how you compiled. `255u8 + 1` panics with "attempt to add with overflow" in a debug build, and silently produces `0` in a release build — because the overflow check costs a branch that Rust won't impose on optimized code. So an overflow bug can be caught by your tests and then quietly corrupt data in production. When arithmetic operates on real-world numbers, reach for the `checked_*` family, or set `overflow-checks = true` under `[profile.release]` and accept the small cost.

```rust
fn main() {
    let big: u8 = 250;

    // Each of these is explicit about what happens at the limit —
    // and none of them depends on the build profile.
    println!("checked_add:     {:?}", big.checked_add(10));      // None
    println!("saturating_add:  {}", big.saturating_add(10));      // 255, clamped
    println!("wrapping_add:    {}", big.wrapping_add(10));        // 4, wrapped
    println!("overflowing_add: {:?}", big.overflowing_add(10));   // (4, true)

    // Division by zero has the same treatment.
    println!("checked_div(0):  {:?}", 10i32.checked_div(0));      // None

    // And the safe accessors that avoid the two most common panics:
    let v = vec![1, 2, 3];
    println!("v.get(99):       {:?}", v.get(99));                 // None
    println!("café get(0..4):  {:?}", "café".get(0..4));          // None — mid-character
}
```

## Reading a backtrace

When you don't know *where* a panic came from, a **backtrace** (the chain of function calls that led to the crash) is your map. Set an environment variable and rerun:

```bash
RUST_BACKTRACE=1 cargo run
```

You'll get a numbered list of the functions on the stack at the moment of the panic — read from the top to find the last of *your* functions involved. It's the single most useful debugging tool for a panic.

> [!tip] The panic-helper macros
> The standard library gives you expressive ways to panic *on purpose*, which are far clearer than a bare `panic!`:
> ```rust,ignore
> assert!(user.age >= 18, "must be an adult");     // panic if condition is false
> assert_eq!(result, 42);                           // panic if the two differ (shows both)
> unreachable!("this enum variant can't occur here"); // "I proved this never happens"
> todo!("implement payment handling");               // a compiling placeholder
> unimplemented!();                                   // like todo!, for stubs
> ```
> `assert!`/`assert_eq!` are the heart of testing; `todo!` lets unfinished code still compile so you can build the rest.

## When *should* you panic?

This is a design question you'll face constantly. The guideline:

> [!best] Panic for bugs, return `Result` for expected problems
> - **Panic** when the error means *your code is wrong* — a broken invariant, an impossible state, an out-of-range index. These should never happen in a correct program, so crashing to expose the bug is right.
> - **Return a `Result`** (next chapter) when the error is a *normal, expected possibility* the caller should handle — a missing file, invalid user input, a network hiccup. Callers deserve the chance to recover.
>
> Ask yourself: *"Is this a bug, or a situation?"* Bugs panic; situations return `Result`.

> [!mistake] `.unwrap()` and `.expect()` are panics in disguise
> Every `.unwrap()` is a hidden `panic!` waiting for the value to be `None`/`Err`. It's fine in examples, prototypes, and tests. In production code, treat each one as a potential crash and prefer proper handling. When you *do* use `.expect("reason")`, write a message explaining *why you believe it can't fail* — future-you will thank you when it does.

## Choosing abort over unwind

For the smallest possible binary (embedded systems, some CLIs), you can tell Cargo to `abort` on panic instead of unwinding — skipping all the cleanup code:

```toml
[profile.release]
panic = "abort"
```

Most programs keep the default (`unwind`), which cleans up gracefully and lets tests catch panics.

| | `unwind` (default) | `abort` |
|---|---|---|
| destructors run | yes | **no** |
| binary size | larger (unwind tables) | smaller |
| `catch_unwind` works | yes | no |
| `#[should_panic]` tests | work | **cannot run** |
| a panicking thread | kills only that thread | kills the whole process |
| good for | servers, libraries, anything long-lived | embedded, small CLIs |

## A panic doesn't always end the program

A panic terminates the **thread** it happens on, not necessarily the process. If that thread is `main`, the program ends — but a panic in a spawned thread is contained, and it's reported to whoever calls `join`:

```rust
use std::thread;

fn main() {
    let handle = thread::spawn(|| {
        panic!("the worker failed");
    });

    // join() returns Result: Err means that thread panicked.
    match handle.join() {
        Ok(()) => println!("worker finished normally"),
        Err(_) => println!("caught it — the worker panicked, but we're still running"),
    }

    let good = thread::spawn(|| 6 * 7);
    println!("another worker returned {:?}", good.join());

    println!("main is alive and well");
}
```

> [!mistake] An unchecked `JoinHandle` swallows the panic silently
> If you never call `join()` — or you call it and ignore the `Result` — a worker thread can die and *nothing anywhere reports it*. The task simply stops happening. This is a genuinely nasty class of bug: a background job quietly stops running and no log line explains why. Always check the join result, or install a panic hook that logs. The same applies to `tokio::spawn`, whose `JoinHandle` also carries the panic. See [Threads](#/ch/threads) and [Debugging Rust](#/ch/debugging).

> [!deep] Panicking while already panicking aborts immediately
> If a destructor panics *during* unwinding, Rust gives up and aborts the process — there's no coherent way to unwind two panics at once. That's the main reason `Drop` implementations should never panic, and why cleanup code that can genuinely fail should also offer an explicit `close() -> Result<()>` method rather than relying on `Drop` alone. See [Rust Design Patterns](#/ch/idioms-patterns).

## Summary

- A **panic** is a controlled, immediate crash for **unrecoverable** errors (bugs). It prints a message and, by default, **unwinds** the stack, running every destructor on the way out.
- You'll usually hit panics *indirectly* — out-of-bounds indexing, `.unwrap()` on `None`/`Err`, divide by zero — and each is a **safe** stop, not memory corruption.
- Nearly every panicking operation has a **non-panicking twin**: `get` for `[]`, `checked_*` for arithmetic, `try_borrow_mut` for `RefCell`.
- **Integer overflow panics in debug and wraps in release** — the one panic whose behaviour depends on your build profile.
- Use **`RUST_BACKTRACE=1`** to see the call chain behind a panic.
- Panic-on-purpose with `panic!`, `assert!`, `assert_eq!`, `unreachable!`, and `todo!`.
- A panic ends the **thread**, not always the process. Check `JoinHandle::join()` or a worker's failure disappears silently.
- `panic = "abort"` shrinks the binary but runs **no** destructors, disables `catch_unwind`, and prevents `#[should_panic]` tests.
- Rule of thumb: **panic for bugs, return `Result` for expected, recoverable situations.**

> [!exercise] Try it yourself
> 1. Trigger an out-of-bounds panic with a vector, then read the message. What line does it point to?
> 2. Replace a `.unwrap()` on a `None` with a `.expect("I expected a config value here")` and compare the messages.
> 3. Use `assert_eq!` to check that `2 + 2 == 5` and read the helpful failure output.
> 4. Write `let x: u8 = 255; let y = x + 1;` and run it with `cargo run`, then with `cargo run --release`. Explain the two different outcomes.
> 5. Take three panicking lines (`v[99]`, `opt.unwrap()`, `10 / 0`) and rewrite each with its non-panicking twin so the program prints a message instead of crashing.
> 6. Spawn a thread that panics and *don't* call `join()`. Does your program report anything? Now add the `join()` and check the `Result`.

Panics are for bugs. For the *expected* errors that make up most of real programming, Rust has a far more powerful tool that lives in the type system: **`Result` and `Option`**.
