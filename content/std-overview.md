<h1><span class="h1-kicker">The Standard Library, Deep</span>A Tour of std</h1>

Rust's **standard library** (`std`) is your always-available toolbox — collections, I/O, threading, time, formatting, and more, on every platform, with no dependencies to add. This part of the book is a guided reference to its most useful corners. We start with a map: how `std` is organized, what the *prelude* gives you for free, and where to find things.

## The three layers: `core`, `alloc`, `std`

> [!key] std is built in layers
> - **`core`** — the foundation: types and traits that need *no operating system and no heap* (`Option`, `Result`, `Iterator`, primitives, `Ordering`). This is what `#![no_std]` embedded code uses.
> - **`alloc`** — adds heap allocation: `Box`, `Vec`, `String`, `Rc`, `Arc`, `BTreeMap`. Available anywhere there's an allocator.
> - **`std`** — everything above **plus** OS services: files, networking, threads, time, environment. This is what normal programs use.
>
> On a normal desktop/server target you just use `std`, which re-exports `core` and `alloc`. On embedded/WASM you might drop to `#![no_std]` + `alloc`.

## The prelude: what you get for free

You've never had to `use` `Option`, `Vec`, `String`, or `println!` — because they're in the **prelude**, a small set of items automatically imported into every Rust file. It's why the language feels batteries-included:

```rust
fn main() {
    // All of these work with NO `use` statement — they're in the prelude:
    let maybe: Option<i32> = Some(5);
    let result: Result<i32, String> = Ok(10);
    let list: Vec<i32> = vec![1, 2, 3];
    let text: String = String::from("hi");
    println!("{maybe:?} {result:?} {list:?} {text}");
}
```

The prelude includes the core types (`Option`, `Result`, `Box`, `Vec`, `String`), the common traits (`Clone`, `Copy`, `Debug`, `Iterator`, `From`/`Into`, `Default`, `Drop`), and the print macros. Almost everything *else* in `std` you bring in with `use`.

> [!key] The prelude is versioned by **edition**
> This surprises people: the prelude isn't fixed. Rust **2021** added `TryFrom`, `TryInto`, and `FromIterator` to it, which is why this compiles with no `use` on a modern edition:
> ```rust
> fn main() {
>     let big: i64 = 300;
>     println!("{:?}", u8::try_from(big).is_err());  // true — doesn't fit
>     let fits: u8 = u8::try_from(42i64).expect("fits");
>     println!("{fits}");
>     let v = Vec::from_iter([1, 2, 3]);
>     println!("{v:?}");
> }
> ```
> The *same file* on edition 2015 fails with `no associated function named 'try_from'`, plus a help line suggesting `use std::convert::TryFrom;`. So if you're reading older code or an older tutorial and wondering why it imports things you don't need to, the edition is usually the answer. Adding to the prelude is a **breaking change** — a new trait in scope can make previously unambiguous method calls ambiguous — which is exactly the kind of change [editions](#/ch/editions) exist to gate.

## What `std` deliberately leaves out

Just as useful as knowing what's in `std` is knowing what *isn't* — and that these are choices, not gaps:

| You might expect | `std` has | You need |
|---|---|---|
| random numbers | ✗ nothing | [`rand`](#/ch/rand-crate) |
| dates and calendars | only `Instant`/`SystemTime` | [`chrono`](#/ch/datetime) or `time` |
| regular expressions | ✗ nothing | [`regex`](#/ch/regex) |
| JSON / serialization | ✗ nothing | [`serde`](#/ch/serde) |
| an async runtime | `Future` trait only, no executor | [`tokio`](#/ch/tokio) or `smol` |
| HTTP client or server | `TcpStream` only | [`reqwest`](#/ch/reqwest), [`axum`](#/ch/axum) |
| error type with backtrace | `Error` trait only | [`anyhow`](#/ch/error-strategy), `thiserror` |
| a logging implementation | ✗ nothing | [`tracing`](#/ch/tracing), `log` + a backend |
| CLI argument parsing | `env::args()` only | [`clap`](#/ch/clap) |
| compression, crypto, TLS | ✗ nothing | `flate2`, `ring`, `rustls` |

> [!key] `std` is small on purpose, and that's a stability decision
> Every item in `std` is **stable forever** — Rust cannot remove or change it without breaking the ecosystem. Deprecated functions stay compilable indefinitely (`std::mem::uninitialized` is deprecated and still there). That guarantee is the reason `std` stays deliberately minimal: a `std::json` shipped in 2015 would be frozen at 2015's understanding of JSON, unable to evolve, and everyone would use a crate instead anyway.
>
> Compare with languages that shipped large standard libraries early and now carry modules nobody should use. Rust's answer is that `std` holds the things that **must** be universal — the vocabulary types every library needs to agree on (`Option`, `Result`, `String`, `Vec`, `Iterator`, `Error`) — and everything that benefits from independent versioning lives on [crates.io](#/ch/crates-overview). It's why `Cargo.toml` isn't optional in real Rust, and why "there's no std module for that" is usually a feature.

## A map of the modules

Here are the modules you'll reach for, and which chapter of this part covers each:

| Module | What's inside | Chapter |
|--------|---------------|---------|
| `std::collections` | `HashMap`, `BTreeMap`, `VecDeque`, `HashSet`, `BinaryHeap` | [Collections Reference](#/ch/std-collections-ref) |
| `std::io` | `Read`, `Write`, `BufReader`, stdin/stdout | [std::io](#/ch/std-io) |
| `std::fs` | files, directories, metadata | [std::fs](#/ch/std-fs) |
| `std::string` / `std::str` | `String`, `str`, parsing, `Cow` | [String & str](#/ch/std-string-str) |
| `std::fmt` | `Display`, `Debug`, `format!` internals | [Formatting](#/ch/std-fmt) |
| `std::time` | `Instant`, `Duration`, `SystemTime` | [Time](#/ch/std-time) |
| `std::env` / `std::process` | args, env vars, child processes | [Env & Process](#/ch/std-env-process) |
| `std::net` | TCP, UDP sockets | [std::net](#/ch/std-net) |
| `std::sync` / `std::thread` | `Arc`, `Mutex`, `RwLock`, threads, atomics | [std::sync](#/ch/std-sync) |
| `std::iter` | the `Iterator` trait & helpers | [Iterator Reference](#/ch/std-iterator) |
| `std::option` / `std::result` | `Option`/`Result` methods | [Option & Result](#/ch/std-option-result) |

<figure class="diagram">
<svg viewBox="0 0 640 180" role="img" aria-label="std is built on alloc, which is built on core; the prelude imports common items automatically">
  <style>
    .som { font: 600 12px var(--font-mono); fill: var(--text); }
    .soc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .l1 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .l2 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .l3 { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
  </style>
  <rect x="60" y="20" width="520" height="40" rx="8" class="l3"/><text x="74" y="45" class="som">std — + OS: files, net, threads, time, env</text>
  <rect x="110" y="66" width="420" height="40" rx="8" class="l2"/><text x="124" y="91" class="som">alloc — + heap: Box, Vec, String, Rc, Arc</text>
  <rect x="170" y="112" width="300" height="40" rx="8" class="l1"/><text x="184" y="137" class="som">core — no-OS, no-heap basics</text>
  <text x="60" y="172" class="soc">Each layer builds on the one below. Normal programs use std; embedded may use only core (+ alloc).</text>
</svg>
<figcaption><code>std</code> wraps <code>alloc</code> wraps <code>core</code> — pick the layer your target supports.</figcaption>
</figure>

## Finding your way around the docs

> [!tip] Learn to navigate `std` docs — it's a superpower
> The [std documentation](https://doc.rust-lang.org/std/) (also offline via `rustup doc`) is superb and searchable. Two habits pay off enormously: (1) when you have a value and wonder "what can I do with it?", open its type's page and skim the **method list** — the answer is almost always there; (2) use the search box (press `S`) for a method name across all of `std`. Most "how do I…?" questions in Rust are answered by five minutes in the type's doc page.

Four things on a `std` doc page are worth knowing how to read, because they answer questions the method list alone doesn't:

| On the page | What it tells you |
|---|---|
| **Trait Implementations** | what the type can *do* — `Iterator`, `Display`, `From<X>`. Often where the method you want actually lives |
| **`impl<T: Clone> Vec<T>`** | these methods exist **only** when `T` is `Clone`. Explains "method exists but isn't found" errors |
| **Methods from Deref** | a separate collapsed section — every `str` method on `String` is here, not in `String`'s own list |
| **`source` link** | `std` source is short and readable; for "what does this actually do?", it's often faster than the prose |

> [!best] "Method not found" usually means a missing trait bound or a missing `use`
> Two causes account for nearly every one of these errors. **The trait isn't in scope** — `read_to_string` needs `use std::io::Read;` even though the method is on `File`; Rust requires a trait be imported before its methods are callable. The compiler now names the missing import in the error, which is why reading the full message matters.
>
> **Or the bound isn't satisfied** — `vec.dedup()` needs `T: PartialEq`, `vec.sort()` needs `T: Ord`. The docs group these under `impl<T: Ord> Vec<T>` headings, so when a method seems to be missing, check which `impl` block it lives in before assuming it doesn't exist. This is also why `f64` can't use `sort()` (no total order thanks to `NaN`) and needs `sort_by(f64::total_cmp)`.

## Traits that appear everywhere

A handful of `std` traits show up constantly; recognizing them unlocks huge amounts of the library. Most of them are what makes some piece of *syntax* work:

| Trait | Powers | Derivable? |
|---|---|---|
| `From` / `Into` | `.into()`, `?` error conversion | no — write it by hand |
| `TryFrom` / `TryInto` | fallible conversion, returns `Result` | no |
| `Iterator` | `for` loops, all the adapters | no |
| `IntoIterator` | what `for x in collection` actually calls | no |
| `Display` | `{}` and `.to_string()` | no — must be hand-written |
| `Debug` | `{:?}` and `{:#?}` | **yes** — usually just derive it |
| `Default` | `Default::default()`, `..Default::default()` | **yes** |
| `Clone` / `Copy` | `.clone()`, implicit copies | **yes** |
| `PartialEq` / `Eq` | `==` and `!=` | **yes** |
| `PartialOrd` / `Ord` | `<`, `sort()`, `BTreeMap` keys | **yes** |
| `Hash` | `HashMap`/`HashSet` keys | **yes** |
| `Deref` | method inheritance, `&String` → `&str` ([see](#/ch/deref-drop)) | no |
| `Drop` | automatic cleanup | no |
| `Error` | `Box<dyn Error>`, `?` in `main` | no |
| `Add`, `Mul`, `Index`, … | operator overloading (`std::ops`) | no |

> [!key] `Display` is the one you must write yourself, and that's deliberate
> Every other formatting-adjacent trait can be derived, but `Display` cannot — because there's no way for the compiler to guess how a type should look to a *human*. `Debug` has an obvious mechanical answer (field names and values), so deriving it is safe; `Display` is a product decision.
>
> The practical consequence: implement `Display` on any type that crosses a boundary into user-facing output — error types especially, since [`main` prints errors with `Debug`](#/ch/question-mark) and `Debug` output reads like a struct dump. `Debug` is for you; `Display` is for your users.

```rust
fn main() {
    // From/Into conversions are everywhere:
    let s: String = String::from("hello");
    let n: i64 = i64::from(42i32);
    let owned: String = "world".into();

    // Default gives a type's zero value:
    let empty: Vec<i32> = Vec::default();
    let zero: i32 = i32::default();

    println!("{s} {owned} {n} {zero} {empty:?}");
}
```

## Summary

- `std` is layered: **`core`** (no OS/heap) → **`alloc`** (heap types) → **`std`** (OS services); normal programs use `std`, embedded may use `core`/`alloc`.
- The **prelude** auto-imports the essentials — and it's **versioned by edition**: 2021 added `TryFrom`, `TryInto`, and `FromIterator`, so older code imports things you no longer need to.
- **`std` deliberately omits** random numbers, dates, regex, serialization, an async executor, HTTP, and logging. Everything in `std` is stable *forever*, so it holds only what must be universal; the rest benefits from independent versioning on crates.io.
- On a doc page, read the **Trait Implementations** and **`impl<T: Bound>`** sections — "method not found" almost always means a **missing `use`** for the trait or an **unsatisfied bound**.
- Most pervasive traits exist to make **syntax** work: `Display` for `{}`, `Iterator` for `for`, `Deref` for method inheritance, `std::ops` for operators.
- **`Display` can't be derived** and `Debug` can — because only a human can decide how a type should read. `Debug` is for you; `Display` is for your users.

> [!exercise] Try it yourself
> 1. Open `rustup doc`, navigate to `Vec`, and skim its methods — find three you haven't used.
> 2. Compile the `try_from` example above with `--edition 2015` and read the error. What does the `help:` line suggest, and why isn't it needed in 2021?
> 3. Use `Default` to create the zero value of `i32`, `bool`, `String`, and `Vec<u8>`, and print them.
> 4. Call `File::open("x")?.read_to_string(&mut s)` without importing `std::io::Read`. Read the error, then find `read_to_string` on the `Read` trait's doc page rather than `File`'s.
> 5. Try `vec![1.0f64, 2.0].sort()`. Why does it fail when `vec![1i32, 2].sort()` works, and what does `sort_by(f64::total_cmp)` do differently?
> 6. Pick three crates from the "deliberately leaves out" table and find what each provides that `std` genuinely could not.
> 7. Write a type with both `Debug` (derived) and `Display` (hand-written), then print it with `{}`, `{:?}`, and `{:#?}`. Which would you show a user?

Let's begin the deep dive with the two types you reach for most — a complete reference to **`Option` and `Result`**.
