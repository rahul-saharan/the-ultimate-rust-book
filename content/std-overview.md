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

## Traits that appear everywhere

A handful of `std` traits show up constantly; recognizing them unlocks huge amounts of the library:

- **`From` / `Into`** — value conversions (`String::from("x")`, `let s: String = "x".into()`).
- **`Iterator`** — anything you can loop over.
- **`Display` / `Debug`** — formatting for `{}` and `{:?}`.
- **`Default`** — a sensible zero value (`Vec::default()`, `#[derive(Default)]`).
- **`Clone` / `Copy`** — duplicating values.
- **`PartialEq` / `Ord`** — comparison and sorting.

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
- The **prelude** auto-imports the essentials (`Option`, `Result`, `Vec`, `String`, common traits, print macros) — everything else you bring in with `use`.
- `std` is organized into modules (`collections`, `io`, `fs`, `net`, `sync`, `time`, …), each covered in this part of the book.
- Master the **docs**: skim a type's method list and use search — it answers most questions.
- A few pervasive traits (**`From`/`Into`**, `Iterator`, `Display`/`Debug`, `Default`, `Clone`) unlock much of the library.

> [!exercise] Try it yourself
> 1. Open `rustup doc`, navigate to `Vec`, and skim its methods — find three you haven't used.
> 2. Convert between types with `From`/`Into`: make a `String` from `&str` two different ways.
> 3. Use `Default` to create the zero value of `i32`, `bool`, `String`, and `Vec<u8>`, and print them.

Let's begin the deep dive with the two types you reach for most — a complete reference to **`Option` and `Result`**.
