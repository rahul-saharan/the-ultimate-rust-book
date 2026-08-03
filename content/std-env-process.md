<h1><span class="h1-kicker">The Standard Library, Deep</span>Environment, Args & Processes</h1>

Programs don't run in a vacuum — they receive command-line arguments, read environment variables, and often launch other programs. `std::env` and `std::process` are your interface to the surrounding operating system. This reference covers reading args and env vars, exit codes, and spawning child processes.

## Command-line arguments

**`std::env::args`** yields the arguments your program was invoked with. The first element is conventionally the program's own name, so real arguments start at index 1:

```rust
fn main() {
    let args: Vec<String> = std::env::args().collect();

    println!("program: {}", args[0]);       // e.g. target/debug/myapp
    println!("got {} argument(s)", args.len() - 1);
    for (i, arg) in args.iter().skip(1).enumerate() {
        println!("  arg {}: {arg}", i + 1);
    }
}
```

> [!best] For anything beyond trivial, use `clap`
> `env::args` is fine for a quick script. But the moment you want flags (`--verbose`), options (`--output file`), subcommands, validation, or `--help`, hand-parsing becomes painful and buggy. The **`clap`** crate ([its own chapter](#/ch/clap)) turns a struct definition into a full-featured, self-documenting CLI parser. Use `env::args` to learn what's underneath; reach for `clap` for real tools.

## Environment variables

**`std::env::var`** reads an environment variable, returning a `Result` (it may be unset). Use it for configuration, secrets, and feature flags:

```rust
fn main() {
    // Read a variable, with a default if it's not set:
    let log_level = std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string());
    println!("log level: {log_level}");

    // Set and read one within the process:
    std::env::set_var("APP_MODE", "demo");
    println!("mode: {:?}", std::env::var("APP_MODE"));

    // List a few environment variables:
    let count = std::env::vars().count();
    println!("this process has {count} environment variables");
}
```

| Function | Does |
|----------|------|
| `env::var("KEY")` | read a variable → `Result<String, VarError>` |
| `env::vars()` | iterate all `(key, value)` pairs |
| `env::set_var` / `remove_var` | modify this process's environment |
| `env::current_dir()` / `set_current_dir()` | get/set the working directory |
| `env::args()` | the command-line arguments |

> [!warning] Env vars are `unsafe` to mutate in multithreaded programs (recent Rust)
> Reading env vars is always fine. **Setting** them (`set_var`/`remove_var`) mutates process-global state that other threads may read concurrently — a data race. Newer Rust editions mark `set_var`/`remove_var` as `unsafe` for this reason. Prefer to read configuration once at startup (single-threaded) into your own config struct, rather than mutating the environment while threads run.

## Exiting with a status code

By convention, a program returns **0 for success** and **non-zero for failure**. Three ways to control this:

```rust
fn main() {
    let ok = true;
    if !ok {
        // Exit immediately with a specific code (skips remaining cleanup/drops!):
        std::process::exit(1);
    }
    println!("all good");
    // Falling off the end of main returns 0.
}
```

> [!tip] Prefer returning `Result` from `main` over `process::exit`
> `std::process::exit(code)` terminates *right now*, skipping destructors (`Drop`) of values still in scope — so buffers may not flush and files may not close cleanly. Better: have `main` return `Result<(), E>` (it sets a non-zero exit code automatically on `Err`), or return a `std::process::ExitCode`. Reserve `process::exit` for cases where you truly must bail instantly.

## Running other programs

**`std::process::Command`** builds and launches child processes — a builder for "run this program with these arguments." You can capture its output or let it inherit your terminal:

```rust,ignore
use std::process::Command;

fn main() -> std::io::Result<()> {
    // Run `echo hello world` and capture its output:
    let output = Command::new("echo")
        .arg("hello")
        .arg("world")
        .output()?; // runs to completion, captures stdout/stderr

    if output.status.success() {
        let text = String::from_utf8_lossy(&output.stdout);
        println!("child said: {}", text.trim());
    }

    // Or `status()` to run and inherit the terminal (stream output live):
    let status = Command::new("ls").arg("-la").status()?;
    println!("ls exited with: {status}");
    Ok(())
}
```

<figure class="diagram">
<svg viewBox="0 0 640 120" role="img" aria-label="Command builds a child process specification then runs it via output, status, or spawn">
  <style>
    .epm { font: 600 11px var(--font-mono); fill: var(--text); }
    .epc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .cmd { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .run { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
  </style>
  <rect x="20" y="40" width="230" height="40" class="cmd"/><text x="34" y="58" class="epm">Command::new("git")</text><text x="34" y="74" class="epc">.arg("status").env(...)</text>
  <rect x="330" y="14" width="150" height="26" class="run"/><text x="344" y="32" class="epm">.output() → captured</text>
  <rect x="330" y="46" width="150" height="26" class="run"/><text x="344" y="64" class="epm">.status() → inherited</text>
  <rect x="330" y="78" width="150" height="26" class="run"/><text x="344" y="96" class="epm">.spawn() → async child</text>
  <path d="M252 60 L328 27" stroke="var(--text-mute)" stroke-width="1.2"/>
  <path d="M252 60 L328 59" stroke="var(--text-mute)" stroke-width="1.2"/>
  <path d="M252 60 L328 91" stroke="var(--text-mute)" stroke-width="1.2"/>
</svg>
<figcaption>Build a <code>Command</code>, then run it: <code>output()</code> captures, <code>status()</code> inherits the terminal, <code>spawn()</code> runs it as a handle.</figcaption>
</figure>

| Method | Runs the child and… |
|--------|---------------------|
| `.output()` | waits, **captures** stdout/stderr into memory |
| `.status()` | waits, child **inherits** your terminal (streams live) |
| `.spawn()` | returns a `Child` handle immediately (you manage it) |

## Summary

- **`env::args()`** gives command-line arguments (index 0 is the program name); use **`clap`** for anything non-trivial.
- **`env::var("KEY")`** reads environment variables (returns `Result`); prefer reading config once at startup, and note that **setting** env vars is `unsafe` in multithreaded contexts.
- Control exit status by **returning `Result`/`ExitCode` from `main`** (recommended) rather than `process::exit`, which skips destructors.
- Launch programs with **`process::Command`**: `.output()` captures, `.status()` inherits the terminal, `.spawn()` gives a handle.

> [!exercise] Try it yourself
> 1. Print every command-line argument your program receives, numbered, skipping the program name.
> 2. Read a `PORT` env var with a default of `"8080"` if unset.
> 3. (Locally) Use `Command` to run `echo` with two arguments and print its captured stdout.

Next: talking over the network with TCP and UDP — **`std::net`**.
