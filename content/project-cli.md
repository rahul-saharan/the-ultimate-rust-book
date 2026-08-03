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

> [!best] The anatomy of a good Rust CLI
> This project models the professional structure: (1) a **thin `main`** that only parses arguments and reports errors to **stderr**; (2) a **library crate** (`lib.rs`) holding all the real logic, so it's testable and reusable; (3) **pure functions** (`search`) separated from I/O so they're trivially unit-tested; (4) **`Result`** propagated with `?` and reported cleanly rather than panicking; (5) errors and diagnostics to **stderr**, real output to **stdout**. Follow this shape and your CLIs will be maintainable and testable from day one.

> [!tip] Level up with `clap` and iterators
> Once the basics work, upgrade argument parsing to [**clap**](#/ch/clap) for real flags, `--help`, and subcommands. And notice how [**iterators**](#/ch/iterators) made `search` a one-liner (`lines().filter().collect()`) — that's idiomatic Rust: express the *what*, let the compiler produce fast code. These two upgrades turn a toy into a tool you'd actually ship.

## Summary

- We built **`minigrep`**, a file-search CLI, incrementally — from a naive script to a structured, tested program.
- Key moves: read args with `env::args`, read files with `fs::read_to_string`, extract **pure logic** (`search`) for easy **testing**, and handle errors with **`Result`** + `?` instead of panicking.
- We used the professional layout: logic in **`lib.rs`**, a **thin `main.rs`**, output to **stdout** and errors to **stderr**, and a feature driven by an **environment variable**.
- Iterators made the core logic concise; **clap** is the natural next upgrade for arguments.

> [!exercise] Try it yourself
> 1. Build `minigrep` for real with `cargo new`, wire up `lib.rs`/`main.rs`, and search a text file.
> 2. Add the `IGNORE_CASE` environment-variable feature and its unit test.
> 3. Add a line-number prefix to each result (`enumerate` the lines), then rewrite arg parsing with `clap`.

Next project: a JSON web service with axum, state, and a database.
