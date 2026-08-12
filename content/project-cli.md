<h1><span class="h1-kicker">Building Real Projects</span>Project: A Command-Line Tool</h1>

Time to build something real. In this chapter we'll create **`minigrep`** — a simplified version of the classic `grep` tool that searches a file for lines matching a query. It's the perfect first project: it touches arguments, file I/O, error handling, structs, iterators, tests, and environment variables — everything from the first half of the book, woven together the way a real program does. Let's build it step by step.

## What we're building

```bash
$ minigrep "frog" poem.txt
I'm nobody! Who are you?
Are you nobody, too?
```

`minigrep <query> <file>` prints every line of `<file>` containing `<query>`. We'll grow it from a naive first cut into a well-structured, tested, idiomatic program.

## Step 1: reading arguments

Start with `cargo new minigrep`. We read the query and filename from the command line ([env::args](#/ch/std-env-process)):

```rust
fn main() {
    let args: Vec<String> = std::env::args().collect();
    // args[0] is the program name; the real arguments start at 1.
    let query = &args[1];
    let file_path = &args[2];
    println!("Searching for '{query}' in '{file_path}'");
}
```

This works but is fragile — missing arguments would panic with an ugly index error. We'll fix that with proper error handling shortly.

## Step 2: reading the file

Read the file's contents with [`fs::read_to_string`](#/ch/std-fs):

```rust,ignore
use std::fs;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let query = &args[1];
    let file_path = &args[2];

    let contents = fs::read_to_string(file_path)
        .expect("should have been able to read the file");

    println!("With text:\n{contents}");
}
```

## Step 3: extract the core logic (and test it)

The heart of the program is a pure function: given a query and some text, return the matching lines. Pulling it out makes it **testable** and independent of files and arguments. Note the [lifetime](#/ch/lifetimes) — the returned slices borrow from `contents`:

```rust
// The returned &str values borrow from `contents`, so they share its lifetime 'a.
fn search<'a>(query: &str, contents: &'a str) -> Vec<&'a str> {
    contents
        .lines()
        .filter(|line| line.contains(query))
        .collect()
}

fn main() {
    let contents = "\
Rust is blazingly fast.
Rust is memory-safe.
Go is garbage-collected.
Rust prevents data races.";

    for line in search("Rust", contents) {
        println!("{line}");
    }
}
```

Because `search` is pure, we can test it directly — this is exactly the [testing](#/ch/writing-tests) payoff of separating logic from I/O:

```rust,test
fn search<'a>(query: &str, contents: &'a str) -> Vec<&'a str> {
    contents.lines().filter(|line| line.contains(query)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_one_result() {
        let contents = "Rust:\nsafe, fast, productive.\nPick three.";
        assert_eq!(search("safe", contents), vec!["safe, fast, productive."]);
    }

    #[test]
    fn finds_nothing() {
        let contents = "a\nb\nc";
        assert!(search("z", contents).is_empty());
    }
}
```

## Step 4: proper error handling with `Result`

Now let's make it robust. Instead of panicking on bad input, we return `Result` and let `main` report errors cleanly (the [error-handling](#/ch/question-mark) approach). We group the config into a struct with a constructor that validates:

```rust
struct Config {
    query: String,
    file_path: String,
}

impl Config {
    // Build a Config from args, returning a helpful error instead of panicking:
    fn build(args: &[String]) -> Result<Config, String> {
        if args.len() < 3 {
            return Err("usage: minigrep <query> <file_path>".to_string());
        }
        Ok(Config {
            query: args[1].clone(),
            file_path: args[2].clone(),
        })
    }
}

fn main() {
    // Simulate args for this runnable demo:
    let args = vec!["minigrep".to_string(), "fast".to_string(), "poem.txt".to_string()];

    let config = Config::build(&args).unwrap_or_else(|err| {
        eprintln!("Problem parsing arguments: {err}"); // errors go to stderr
        std::process::exit(1);
    });

    println!("Searching for '{}' in '{}'", config.query, config.file_path);
}
```

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="The minigrep architecture: main parses args and reports errors; a library run function does the work; a pure search function is tested">
  <style>
    .pjm { font: 600 11px var(--font-mono); fill: var(--text); }
    .pjc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .m1 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .m2 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .m3 { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
  </style>
  <rect x="14" y="40" width="150" height="60" class="m1"/><text x="26" y="64" class="pjm">main.rs</text><text x="26" y="82" class="pjc">args, errors, exit</text>
  <rect x="200" y="40" width="150" height="60" class="m2"/><text x="212" y="64" class="pjm">run(config)</text><text x="212" y="82" class="pjc">read file, print</text>
  <rect x="386" y="40" width="150" height="60" class="m3"/><text x="398" y="64" class="pjm">search()</text><text x="398" y="82" class="pjc">pure &amp; tested ✅</text>
  <path d="M164 70 L198 70" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#apj)"/>
  <path d="M350 70 L384 70" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#apj)"/>
  <text x="14" y="130" class="pjc">Separate I/O (main, run) from pure logic (search) — the latter is easy to test and reuse.</text>
  <defs><marker id="apj" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>Good CLI structure: a thin <code>main</code>, a <code>run</code> that orchestrates I/O, and pure, tested logic.</figcaption>
</figure>

## Step 5: put it in `lib.rs`, keep `main.rs` thin

As the [packages chapter](#/ch/packages-crates) advised, move the logic into `src/lib.rs` (as a library) and keep `src/main.rs` a thin wrapper. The idiomatic shape:

```rust,ignore
// src/lib.rs
use std::error::Error;
use std::fs;

pub struct Config { pub query: String, pub file_path: String }

impl Config {
    pub fn build(args: &[String]) -> Result<Config, String> {
        if args.len() < 3 { return Err("usage: minigrep <query> <file>".into()); }
        Ok(Config { query: args[1].clone(), file_path: args[2].clone() })
    }
}

pub fn run(config: Config) -> Result<(), Box<dyn Error>> {
    let contents = fs::read_to_string(&config.file_path)?; // ? propagates I/O errors
    for line in search(&config.query, &contents) {
        println!("{line}");
    }
    Ok(())
}

pub fn search<'a>(query: &str, contents: &'a str) -> Vec<&'a str> {
    contents.lines().filter(|line| line.contains(query)).collect()
}
```

```rust,ignore
// src/main.rs — thin: parse, handle errors, delegate to the library.
use std::process;

fn main() {
    let args: Vec<String> = std::env::args().collect();

    let config = minigrep::Config::build(&args).unwrap_or_else(|err| {
        eprintln!("Problem parsing arguments: {err}");
        process::exit(1);
    });

    if let Err(e) = minigrep::run(config) {
        eprintln!("Application error: {e}"); // I/O and other errors reported here
        process::exit(1);
    }
}
```

## Step 6: a feature via an environment variable

Real tools have options. Let's add case-insensitive search, toggled by an env var (`IGNORE_CASE=1`). This shows reading config from the environment:

```rust
fn search_case_insensitive<'a>(query: &str, contents: &'a str) -> Vec<&'a str> {
    let query = query.to_lowercase();
    contents
        .lines()
        .filter(|line| line.to_lowercase().contains(&query))
        .collect()
}

fn main() {
    let contents = "Rust\nTRUST\nrusty\nGolang";
    // In a real tool: let ignore_case = std::env::var("IGNORE_CASE").is_ok();
    let matches = search_case_insensitive("rust", contents);
    println!("{matches:?}"); // ["Rust", "TRUST", "rusty"]
}
```

## Step 7: the whole thing, running

Here is every piece assembled — config parsing, both search modes, line numbers, error handling, and the exit-code convention. The file I/O is stubbed with embedded text so it runs right here; in a real build, the two marked lines become `env::args()` and `fs::read_to_string`:

```rust
use std::process::ExitCode;

struct Config {
    query: String,
    file_path: String,
    ignore_case: bool,
}

impl Config {
    fn build(args: &[String], ignore_case: bool) -> Result<Config, String> {
        if args.len() < 3 {
            return Err("usage: minigrep <query> <file_path>".to_string());
        }
        Ok(Config {
            query: args[1].clone(),
            file_path: args[2].clone(),
            ignore_case,
        })
    }
}

/// Returns (line number, line) so callers can print `12: matched text`.
fn search<'a>(query: &str, contents: &'a str, ignore_case: bool) -> Vec<(usize, &'a str)> {
    let needle = if ignore_case { query.to_lowercase() } else { query.to_string() };
    contents
        .lines()
        .enumerate()
        .filter(|(_, line)| {
            if ignore_case {
                line.to_lowercase().contains(&needle)
            } else {
                line.contains(&needle)
            }
        })
        .map(|(i, line)| (i + 1, line)) // humans count from 1
        .collect()
}

fn run(config: &Config, contents: &str) -> usize {
    let matches = search(&config.query, contents, config.ignore_case);
    for (number, line) in &matches {
        println!("{number}:{line}"); // results → stdout
    }
    matches.len()
}

fn main() -> ExitCode {
    // In a real program: std::env::args().collect()
    let args = vec!["minigrep".to_string(), "rust".to_string(), "poem.txt".to_string()];
    let ignore_case = true; // in a real program: env::var("IGNORE_CASE").is_ok()

    let config = match Config::build(&args, ignore_case) {
        Ok(c) => c,
        Err(err) => {
            eprintln!("minigrep: {err}"); // diagnostics → stderr
            return ExitCode::from(2);      // 2 = usage error, by convention
        }
    };

    // In a real program: fs::read_to_string(&config.file_path)?
    let contents = "\
Rust is blazingly fast.
Go is garbage-collected.
TRUST but verify.
Rust prevents data races.";

    eprintln!("searching {:?} for {:?}…", config.file_path, config.query);
    let found = run(&config, contents);

    // grep's convention: 0 = found something, 1 = found nothing, 2 = error.
    if found == 0 { ExitCode::from(1) } else { ExitCode::SUCCESS }
}
```

Run it and note two things the earlier steps only described. Results go to **stdout** while the "searching…" note goes to **stderr**, so `minigrep rust poem.txt > hits.txt` captures only the matches. And `main` returns an **`ExitCode`**, so shell scripts can branch on the outcome.

> [!key] CLI conventions that make a tool composable
> A program that follows these slots into pipelines; one that doesn't becomes a nuisance to script around.
> - **stdout is for data, stderr is for everything else.** Results, and only results, go to stdout — progress notes, warnings, and errors go to stderr. That's what makes `|` and `>` work.
> - **Exit codes are an API.** `0` means success, non-zero means failure. `grep` specifically uses `1` for "no matches" and `2` for "bad usage," which lets `if minigrep foo file; then …` do the right thing.
> - **Read stdin when no file is given.** `minigrep rust < poem.txt` and `cat poem.txt | minigrep rust` both become possible with `io::stdin().read_to_string(&mut buf)`.
> - **Never print diagnostics to stdout.** A single stray `println!("Loading…")` corrupts the output of every script that pipes your tool.

## Step 8: upgrade the arguments with `clap`

Hand-rolled `args[1]`/`args[2]` parsing got us here, but it has no `--help`, no flags, and no validation. [`clap`](#/ch/clap) replaces all of it with a struct and a derive:

```rust,ignore
// Cargo.toml: clap = { version = "4", features = ["derive"] }
use clap::Parser;

#[derive(Parser)]
#[command(name = "minigrep", version, about = "Search a file for lines matching a pattern")]
struct Cli {
    /// The pattern to look for
    query: String,

    /// The file to search
    file_path: std::path::PathBuf,

    /// Ignore case when matching
    #[arg(short, long, env = "IGNORE_CASE")]
    ignore_case: bool,

    /// Show line numbers
    #[arg(short = 'n', long, default_value_t = true)]
    line_numbers: bool,
}

fn main() {
    let cli = Cli::parse(); // handles --help, --version, and bad input for you
    println!("{} in {:?} (ignore_case={})", cli.query, cli.file_path, cli.ignore_case);
}
```

That single derive gives you `--help` output, `--version`, short and long flags, `PathBuf` conversion, environment-variable fallback, and a proper error message with exit code 2 when the user gets it wrong — replacing every line of `Config::build`.

## Step 9: test the binary, not just the functions

Unit tests cover `search`. But a CLI has behaviour no unit test sees: argument parsing, exit codes, and the stdout/stderr split. Those need an **integration test** that runs the real executable, in `tests/cli.rs`:

```rust,ignore
// tests/cli.rs — Cargo builds the binary first, then runs this.
use std::process::Command;

/// `env!("CARGO_BIN_EXE_<name>")` is the path to the compiled binary,
/// filled in by Cargo at compile time. No hardcoded paths.
const BIN: &str = env!("CARGO_BIN_EXE_minigrep");

#[test]
fn finds_matches_and_exits_zero() {
    let output = Command::new(BIN)
        .args(["rust", "tests/fixtures/poem.txt"])
        .output()
        .expect("failed to run minigrep");

    assert!(output.status.success());                       // exit code 0
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("Rust is blazingly fast."));
    assert_eq!(stdout.lines().count(), 2);
}

#[test]
fn no_matches_exits_one() {
    let output = Command::new(BIN)
        .args(["zebra", "tests/fixtures/poem.txt"])
        .output()
        .unwrap();

    assert_eq!(output.status.code(), Some(1));              // grep's convention
    assert!(output.stdout.is_empty());                       // nothing on stdout
}

#[test]
fn missing_args_exits_two_and_writes_to_stderr() {
    let output = Command::new(BIN).output().unwrap();

    assert_eq!(output.status.code(), Some(2));
    assert!(output.stdout.is_empty());                       // ← diagnostics must NOT
    let stderr = String::from_utf8_lossy(&output.stderr);    //   pollute stdout
    assert!(stderr.contains("usage:"));
}
```

> [!key] This is the test that would have caught your worst CLI bug
> Notice what the third test asserts: that the usage message went to **stderr** and stdout stayed **empty**. That's exactly the property that makes your tool safe in a pipeline, and no unit test can check it — it only exists at the process boundary. The same goes for exit codes: `main` returning `ExitCode::from(1)` is invisible to `cargo test` unless something actually runs the binary and inspects `status.code()`.
>
> Put fixture files under `tests/fixtures/` and commit them, so the tests don't depend on anything outside the repo.

> [!tip] `assert_cmd` and `predicates` make these tests read better
> The standard-library version above has no dependencies, which is nice. For a real project, the [`assert_cmd`](https://docs.rs/assert_cmd) crate collapses it to one fluent chain, and `predicates` gives better failure messages:
> ```rust,ignore
> use assert_cmd::Command;
> use predicates::str::contains;
>
> Command::cargo_bin("minigrep").unwrap()
>     .args(["rust", "poem.txt"])
>     .assert()
>     .success()
>     .stdout(contains("blazingly fast"));
> ```
> Pair it with [`tempfile`](https://docs.rs/tempfile) when a test needs to create input files, so nothing leaks between runs. See [Testing in Depth](#/ch/testing-advanced).

## Step 10: ship it

A binary nobody can install isn't finished. Three commands cover most of it:

```bash
cargo build --release          # optimized binary → target/release/minigrep
cargo install --path .         # install it into ~/.cargo/bin, on your PATH
cargo publish                  # share it on crates.io (see the publishing chapter)
```

The release build matters more than people expect: it's typically **10–50× faster** than the debug build you've been running, because `cargo run` and `cargo test` default to `opt-level = 0`. Never benchmark or ship a debug binary.

> [!tip] Finishing touches that make a CLI feel professional
> - **`--version` and `--help`** — free with [clap](#/ch/clap)'s derive; make sure `version` reads from `Cargo.toml` via `#[command(version)]`.
> - **Respect `NO_COLOR`** and check `std::io::IsTerminal` before emitting ANSI codes, so piped output stays clean. The `anstream` or `owo-colors` crates handle this for you.
> - **Handle a broken pipe.** `minigrep rust big.txt | head -1` makes your process receive `SIGPIPE`; the default Rust behaviour is a panic on the next write. Catch `ErrorKind::BrokenPipe` and exit quietly.
> - **Shrink the binary** if size matters — `strip = true`, `opt-level = "z"`, and `lto = true` in `[profile.release]`; see [Deployment & Binary Size](#/ch/deployment).
> - **Cross-compile** for other platforms with `cross` — covered in [Cross-Compilation](#/ch/cross-compilation).

> [!best] The anatomy of a good Rust CLI
> This project models the professional structure: (1) a **thin `main`** that only parses arguments and reports errors to **stderr**; (2) a **library crate** (`lib.rs`) holding all the real logic, so it's testable and reusable; (3) **pure functions** (`search`) separated from I/O so they're trivially unit-tested; (4) **`Result`** propagated with `?` and reported cleanly rather than panicking; (5) errors and diagnostics to **stderr**, real output to **stdout**. Follow this shape and your CLIs will be maintainable and testable from day one.

> [!tip] Level up with `clap` and iterators
> Once the basics work, upgrade argument parsing to [**clap**](#/ch/clap) for real flags, `--help`, and subcommands. And notice how [**iterators**](#/ch/iterators) made `search` a one-liner (`lines().filter().collect()`) — that's idiomatic Rust: express the *what*, let the compiler produce fast code. These two upgrades turn a toy into a tool you'd actually ship.

## Summary

- We built **`minigrep`**, a file-search CLI, incrementally — from a naive script to a structured, tested program.
- Key moves: read args with `env::args`, read files with `fs::read_to_string`, extract **pure logic** (`search`) for easy **testing**, and handle errors with **`Result`** + `?` instead of panicking.
- We used the professional layout: logic in **`lib.rs`**, a **thin `main.rs`**, output to **stdout** and errors to **stderr**, and a feature driven by an **environment variable**.
- **CLI conventions matter**: stdout for data and stderr for diagnostics, and **exit codes as an API** (`0` found, `1` nothing, `2` usage error) — returned from `main` via **`ExitCode`**.
- Iterators made the core logic concise; **clap** replaces hand-rolled parsing with a derive that supplies `--help`, `--version`, flags, and env fallback for free.

> [!exercise] Try it yourself
> 1. Build `minigrep` for real with `cargo new`, wire up `lib.rs`/`main.rs`, and search a text file.
> 2. Add the `IGNORE_CASE` environment-variable feature and its unit test.
> 3. Add a line-number prefix to each result (`enumerate` the lines), then rewrite arg parsing with `clap`.
> 4. Run the assembled program, then change the query to something absent. Check the exit code with `echo $?` — it should be `1`, not `0`.
> 5. Redirect stdout to a file (`minigrep rust poem.txt > hits.txt`). Confirm the "searching…" note still appears on your terminal and *isn't* in the file.
> 6. Make the file argument optional: when it's missing, read from **stdin** with `io::stdin().read_to_string(&mut buf)` so `cat poem.txt | minigrep rust` works.
> 7. Add an `--invert` / `-v` flag with clap that prints the lines that *don't* match.
> 8. Write an **integration test** in `tests/cli.rs` that runs the binary with `std::process::Command` and asserts on its stdout and exit status.

Next project: a JSON web service with axum, state, and a database.
