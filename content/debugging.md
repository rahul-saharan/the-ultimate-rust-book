<h1><span class="h1-kicker">Tooling & Workflow</span>Debugging Rust</h1>

Rust's compiler catches an unusual share of bugs before your program runs. The ones that survive are therefore *logic* bugs — wrong output, an unexpected panic, a deadlock, a number that drifts — and for those you need to see inside a running program. This chapter covers the whole toolkit, from the humble `dbg!` to a real debugger, roughly in the order you should reach for them.

## The debugging ladder

Start at the top and go down only as far as you need to. Most bugs die on the first two rungs.

<figure class="diagram">
<svg viewBox="0 0 640 250" role="img" aria-label="A ladder of debugging techniques from cheapest to most powerful, from dbg macro to a full debugger" >
  <style>
    .db-h { font: 700 12px var(--font-sans); fill: var(--text); }
    .db-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .db-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .db-1 { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .db-2 { fill: var(--teal-soft); stroke: var(--teal); stroke-width: 1.5; }
    .db-3 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .db-4 { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.5; }
  </style>
  <text x="20" y="18" class="db-c">cheapest / fastest ↓</text>
  <rect x="20" y="28" width="420" height="34" rx="4" class="db-1"/>
  <text x="34" y="50" class="db-m">dbg!(x)  ·  println!("{x:?}")</text>
  <text x="452" y="50" class="db-c">seconds; no setup</text>
  <rect x="20" y="68" width="420" height="34" rx="4" class="db-1"/>
  <text x="34" y="90" class="db-m">RUST_BACKTRACE=1  ·  read the panic</text>
  <text x="452" y="90" class="db-c">tells you WHERE</text>
  <rect x="20" y="108" width="420" height="34" rx="4" class="db-2"/>
  <text x="34" y="130" class="db-m">tracing / log  ·  structured, leave it in</text>
  <text x="452" y="130" class="db-c">for production</text>
  <rect x="20" y="148" width="420" height="34" rx="4" class="db-3"/>
  <text x="34" y="170" class="db-m">a failing #[test] that reproduces it</text>
  <text x="452" y="170" class="db-c">stops regressions</text>
  <rect x="20" y="188" width="420" height="34" rx="4" class="db-4"/>
  <text x="34" y="210" class="db-m">rust-gdb / rust-lldb / IDE debugger</text>
  <text x="452" y="210" class="db-c">step, inspect, watch</text>
  <text x="20" y="242" class="db-c">most powerful / slowest ↑ — and if it's memory corruption, jump straight to Miri or sanitizers.</text>
</svg>
<figcaption>Work down the ladder. Reaching for a debugger first is a common way to spend twenty minutes on a bug a <code>dbg!</code> would have shown instantly.</figcaption>
</figure>

## `dbg!` — print with context

`println!("{x:?}")` works, but `dbg!` is strictly better for temporary debugging: it prints the **file, line, expression text, and value**, and returns the value so you can wrap it around an expression without restructuring the code.

```rust
fn main() {
    let width = 4;
    let height = 7;

    // dbg! prints to STDERR and returns its argument, so you can wrap
    // an expression in place without changing what the code does.
    let area = dbg!(width) * dbg!(height);
    println!("area = {area}");

    // It works mid-chain, which is where it really earns its place:
    let total: i32 = (1..=5)
        .map(|n| n * n)
        .filter(|n| dbg!(n % 2 == 1))
        .sum();
    println!("total = {total}");

    // On a struct it pretty-prints:
    #[derive(Debug)]
    struct Config { retries: u32, verbose: bool }
    dbg!(Config { retries: 3, verbose: true });
}
```

Running that prints lines like `[src/main.rs:8:16] width = 4` — the location is what makes it usable when you've scattered five of them.

| Tool | Prints to | Shows | Best for |
|---|---|---|---|
| `dbg!(expr)` | stderr | file, line, expression, value | temporary poking; returns the value |
| `println!("{x:?}")` | stdout | just the value | output you intend to keep |
| `eprintln!("{x:?}")` | stderr | just the value | diagnostics that shouldn't pollute piped output |
| `{:#?}` | — | pretty-printed, multi-line | nested structs |
| `{x:p}` | — | the pointer address | checking whether two references alias |
| `tracing::debug!` | configurable | structured fields, spans | anything you'll want in production |

> [!best] `dbg!` goes to stderr on purpose
> That means `cargo run > output.txt` captures your program's real output while the debug lines still appear on your terminal. `println!` would corrupt the file. The same reasoning applies to any diagnostic in a CLI tool — use `eprintln!` so you never break someone's pipe. See [std::io](#/ch/std-io).

> [!mistake] `dbg!` takes ownership
> `dbg!(my_string)` **moves** the value (then gives it back), so `dbg!(config); use_config(config);` fails to compile. Pass a reference instead — `dbg!(&config)` — which is what you almost always want anyway. This catches everyone once.

> [!warning] Don't ship `dbg!`
> It's unconditional: it prints in release builds too, straight to stderr, forever. Add a `grep -rn 'dbg!' src/` check to CI, or rely on Clippy — `clippy::dbg_macro` catches it. Real diagnostics belong in `tracing`, which you can filter by level at runtime.

## Reading panics properly

A panic tells you three things. Most people read only the first.

```text
thread 'main' panicked at src/main.rs:12:23:
index out of bounds: the len is 3 but the index is 7
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

- **`src/main.rs:12:23`** — the exact location. Go there first.
- **the message** — for standard-library panics this is unusually informative; "the len is 3 but the index is 7" tells you the bug is in how the index was computed.
- **the backtrace hint** — take it.

```bash
RUST_BACKTRACE=1 cargo run          # a readable backtrace
RUST_BACKTRACE=full cargo run       # every frame, including std internals
RUST_BACKTRACE=1 cargo test         # works for tests too
```

You can also install a hook to capture panics yourself — useful for logging them in a server, or for turning them into a structured crash report:

```rust
fn main() {
    // Replace the default panic handler. Runs for every panic in the process.
    std::panic::set_hook(Box::new(|info| {
        let location = info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "unknown".to_string());
        eprintln!("!! caught a panic at {location}: {}", info);
    }));

    // catch_unwind turns a panic into a Result, so the process survives.
    let result = std::panic::catch_unwind(|| {
        let v: Vec<i32> = vec![1, 2, 3];
        v[7] // boom
    });

    println!("survived; got an error? {}", result.is_err());
    println!("still running");
}
```

> [!warning] `catch_unwind` is not a `try`/`catch`
> It exists for a narrow purpose: stopping a panic from crossing an FFI boundary, or isolating a worker thread in a server. It does **not** work if the binary is built with `panic = "abort"`, it can't catch every panic (a double panic aborts), and a caught panic may have left your data in a half-updated state. Use `Result` for expected failures — see [Error Handling Strategy](#/ch/error-strategy). Reach for `catch_unwind` only at a real isolation boundary.

## Debugging tests

Tests capture output by default, which is the single most confusing thing about debugging them.

```bash
cargo test                          # output from passing tests is HIDDEN
cargo test -- --nocapture           # show println!/dbg! from every test
cargo test my_function              # only tests whose name contains this
cargo test -- --exact my::test_name # precisely one test
cargo test -- --test-threads=1      # run serially; output stops interleaving
cargo test -- --ignored             # run only the #[ignore]d ones
cargo test -- --show-output         # show output of passing tests (stable alias)
RUST_BACKTRACE=1 cargo test         # backtrace on assertion failure
```

The assertion macros carry more information than most people use:

```rust
fn parse_pair(s: &str) -> Option<(i32, i32)> {
    let (a, b) = s.split_once(',')?;
    Some((a.trim().parse().ok()?, b.trim().parse().ok()?))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_pair() {
        // assert_eq! prints BOTH values on failure — always prefer it to assert!(a == b)
        assert_eq!(parse_pair("3, 4"), Some((3, 4)));

        // The third argument adds context, with format! syntax:
        let input = "bad";
        assert_eq!(parse_pair(input), None, "input {input:?} should not parse");

        // matches! is ideal for "the right shape, don't care about details":
        assert!(matches!(parse_pair("1,2"), Some((1, _))));
    }
}

fn main() {
    println!("{:?}", parse_pair(" 10 , 20 "));
}
```

> [!tip] `assert_eq!` over `assert!(a == b)`, every time
> `assert!(x == y)` fails with `assertion failed: x == y` — which you already knew. `assert_eq!(x, y)` prints both actual values, which is usually the whole answer. Same for `assert_ne!`. And when comparing large structures, `pretty_assertions` (a dev-dependency, one `use` line) gives you a coloured line-by-line diff that turns a wall of `Debug` output into an obvious one-field difference.

## Real debuggers

Rust ships wrappers around GDB and LLDB that load pretty-printers, so a `Vec` displays as its elements rather than raw pointers.

```bash
cargo build                                 # debug profile — keep the symbols
rust-gdb target/debug/myapp                 # Linux
rust-lldb target/debug/myapp                # macOS

# Debugging a test binary: get its path first
cargo test --no-run 2>&1 | grep Executable
rust-gdb target/debug/deps/myapp-<hash>
```

The commands you actually need:

| GDB | LLDB | Does |
|---|---|---|
| `break main.rs:42` | `b main.rs:42` | breakpoint at a line |
| `break my_crate::my_fn` | `b my_crate::my_fn` | breakpoint at a function |
| `run` / `r` | `run` / `r` | start (args: `run --flag x`) |
| `continue` / `c` | `c` | resume |
| `next` / `n` | `n` | step over |
| `step` / `s` | `s` | step into |
| `finish` | `finish` | run to end of frame |
| `print x` / `p x` | `p x` | show a value |
| `print *ptr` | `p *ptr` | follow a pointer |
| `backtrace` / `bt` | `bt` | the call stack |
| `frame 2` / `f 2` | `f 2` | switch stack frame |
| `info locals` | `frame variable` | all locals |
| `watch x` | `watch set var x` | break when `x` changes |
| `break … if i == 5` | `b … -c 'i == 5'` | conditional breakpoint |

> [!key] Debug in the debug profile, or you'll see nothing
> `--release` inlines functions, merges variables, and reorders code, so the debugger reports variables as `<optimized out>` and steps jump around unpredictably. Debug builds keep full symbols. If you must debug a release-only bug (a timing issue, or something that only reproduces at speed), add `debug = true` under `[profile.release]` to keep symbols *and* optimizations — the stepping will still be strange, but backtraces become readable.

> [!tip] Conditional breakpoints beat stepping 10,000 times
> "It breaks on the 4,000th record" is not a stepping problem. `break parser.rs:88 if index == 4000` runs at full speed and stops exactly there. The same idea in code: `if index == 4000 { dbg!(&record); }`. Learning this one trick is worth more than every other debugger command combined.

### VS Code

Install the **CodeLLDB** extension (or the Microsoft C++ extension on Windows) and add `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "lldb",
      "request": "launch",
      "name": "Debug myapp",
      "cargo": {
        "args": ["build", "--bin=myapp"],
        "filter": { "name": "myapp", "kind": "bin" }
      },
      "args": ["--verbose", "input.txt"],
      "cwd": "${workspaceFolder}",
      "env": { "RUST_BACKTRACE": "1", "RUST_LOG": "debug" }
    },
    {
      "type": "lldb",
      "request": "launch",
      "name": "Debug unit tests",
      "cargo": {
        "args": ["test", "--no-run", "--lib"],
        "filter": { "kind": "lib" }
      },
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

The `cargo` block is the important part — it builds and locates the binary for you, so the path never goes stale.

## When the bug is memory or undefined behaviour

If you've written `unsafe`, the normal tools aren't enough. These are.

```bash
# Miri: an interpreter that detects UB — out-of-bounds, use-after-free,
# invalid aliasing, uninitialized reads, misaligned access.
rustup +nightly component add miri
cargo +nightly miri test

# AddressSanitizer: catches memory errors in the real compiled program.
RUSTFLAGS="-Zsanitizer=address" cargo +nightly test --target x86_64-unknown-linux-gnu

# ThreadSanitizer: catches data races.
RUSTFLAGS="-Zsanitizer=thread" cargo +nightly test --target x86_64-unknown-linux-gnu
```

| Tool | Finds | Cost |
|---|---|---|
| **Miri** | undefined behaviour, invalid aliasing, leaks | very slow, but no false positives |
| **AddressSanitizer** | buffer overflows, use-after-free | ~2× slower |
| **ThreadSanitizer** | data races | ~10× slower |
| **`valgrind`** | leaks, invalid reads in FFI'd C | slow; less Rust-aware than Miri |
| **`cargo careful`** | extra runtime checks in std | moderate |

> [!best] Run Miri in CI if your crate contains any `unsafe`
> Miri catches the class of bug that is otherwise invisible: code that works today, on your machine, with this optimizer, and breaks after an innocuous refactor. It's slow, so run it on the unit tests rather than the full suite — but if you have `unsafe` and no Miri job, you are relying on luck. See [Unsafe Rust](#/ch/unsafe).

## Debugging async and concurrent code

Concurrency bugs are the hardest, because printing changes the timing.

| Symptom | Reach for |
|---|---|
| a deadlock | `tokio-console` (live task view), or `gdb` + `thread apply all bt` |
| a task that never completes | `tokio::time::timeout` to convert a hang into an error |
| a data race | ThreadSanitizer; or `Mutex` where you had none |
| output interleaving unreadably | `tracing` with span IDs, or `--test-threads=1` |
| "works with one thread, fails with eight" | a shared-state bug; audit every `Arc<Mutex>` critical section |
| a panic in a spawned task disappearing | `JoinHandle` returns a `Result` — **check it** |

```bash
# tokio-console: a live, top-like view of every task, its state and wakeups.
# In Cargo.toml: console-subscriber = "0.4", and tokio with "tracing" feature.
RUSTFLAGS="--cfg tokio_unstable" cargo run
tokio-console
```

> [!mistake] A panic in a spawned task doesn't crash your program
> `tokio::spawn(async { panic!() })` fails silently — the panic is captured into the `JoinHandle`, and if nobody `.await`s it, nobody ever finds out. The task simply stops. Always handle the join result, or install a hook that logs it. The same applies to `std::thread::spawn`: its `JoinHandle::join()` returns a `Result` whose `Err` is the panic payload. See [Threads](#/ch/threads) and [The Tokio Runtime](#/ch/tokio).

## Making the compiler help more

Half of "debugging" is getting better information out of the compiler.

```bash
cargo build --verbose               # the exact rustc invocations
cargo rustc -- -Z macro-backtrace   # trace an error through macro expansion (nightly)
cargo expand                        # see what a macro or derive generated
cargo tree -d                       # find duplicate versions of a dependency
cargo clippy -- -W clippy::pedantic # a great many real bugs, not just style
RUST_LOG=debug cargo run            # if the crate uses env_logger/tracing
```

```rust
fn main() {
    // Ask the compiler what a type is: give it a deliberate mismatch and
    // read the error. Nothing is faster for a tangled iterator chain.
    let items = vec![1, 2, 3];
    let chain = items.iter().map(|x| x * 2).filter(|x| x % 3 != 0);

    // let _: () = chain;  ← uncomment: the error names the exact type

    println!("{:?}", chain.collect::<Vec<_>>());

    // std::any::type_name is the runtime version:
    fn type_of<T>(_: &T) -> &'static str {
        std::any::type_name::<T>()
    }
    let v = vec![1u8];
    println!("{}", type_of(&v));
    println!("{}", type_of(&v.iter().map(|x| x + 1)));
}
```

> [!tip] The `let _: () = x;` trick names any type instantly
> Assigning a value to `()` produces an error message containing the value's full type — including the unpronounceable closure types inside iterator chains. It's faster than reasoning it out and faster than reading docs. `cargo expand` does the same job for macros: when a `#[derive]` or `macro_rules!` misbehaves, seeing the generated code usually ends the investigation immediately.

## Summary

- Work **down the ladder**: `dbg!` → backtrace → `tracing` → a failing test → a debugger. Most bugs die on the first two rungs.
- **`dbg!`** prints file, line, expression, and value to **stderr**, and returns its argument — but it *moves*, so pass `&x`, and never ship it.
- Read all three parts of a panic: **location**, **message**, and then `RUST_BACKTRACE=1`.
- Tests hide output — **`cargo test -- --nocapture`**. Use `assert_eq!` (it prints both values) and `--test-threads=1` when output interleaves.
- Use **`rust-gdb`/`rust-lldb`** (they load Rust pretty-printers) on **debug** builds, and lean on **conditional breakpoints** instead of stepping.
- For `unsafe` code, `dbg!` is not enough: **Miri** finds undefined behaviour, and the sanitizers find memory errors and data races. Put Miri in CI if you have `unsafe`.
- For async, remember a **panic in a spawned task is silent** unless you check the `JoinHandle`; `tokio-console` shows live task state.
- Make the compiler help: `cargo expand`, `cargo clippy`, and the `let _: () = x;` trick to name any type.

> [!exercise] Try it yourself
> 1. Write a function with an off-by-one indexing bug, run it, and fix it using only the panic message and location. Then run it again with `RUST_BACKTRACE=1` and compare how much you learn.
> 2. Put a `dbg!` inside a `.filter()` closure in an iterator chain and watch the evaluation order. Does it match what you expected?
> 3. Try `dbg!(some_string)` followed by using `some_string`. Read the error, then fix it with `&`.
> 4. Write a test that fails an `assert_eq!` on two structs, and run it with and without `RUST_BACKTRACE=1`.
> 5. Set a conditional breakpoint in `rust-gdb` that stops on the 500th iteration of a loop, and print the loop variable there.
> 6. Use the `let _: () = x;` trick to discover the full type of `vec![1,2,3].iter().zip("abc".chars()).enumerate()`.

Next: the rest of the Cargo toolbox — profiles, the subcommands worth installing, and how to pin a toolchain — in **the Cargo toolbox**.
