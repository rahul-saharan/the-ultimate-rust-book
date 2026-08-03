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

## Summary

- A **panic** is a controlled, immediate crash for **unrecoverable** errors (bugs). It prints a message and, by default, **unwinds** the stack, running cleanup.
- You'll usually hit panics *indirectly* — out-of-bounds indexing, `.unwrap()` on `None`/`Err` — and each is a **safe** stop, not memory corruption.
- Use **`RUST_BACKTRACE=1`** to see the call chain behind a panic.
- Panic-on-purpose with `panic!`, `assert!`, `assert_eq!`, `unreachable!`, and `todo!`.
- Rule of thumb: **panic for bugs, return `Result` for expected, recoverable situations.**

> [!exercise] Try it yourself
> 1. Trigger an out-of-bounds panic with a vector, then read the message. What line does it point to?
> 2. Replace a `.unwrap()` on a `None` with a `.expect("I expected a config value here")` and compare the messages.
> 3. Use `assert_eq!` to check that `2 + 2 == 5` and read the helpful failure output.

Panics are for bugs. For the *expected* errors that make up most of real programming, Rust has a far more powerful tool that lives in the type system: **`Result` and `Option`**.
