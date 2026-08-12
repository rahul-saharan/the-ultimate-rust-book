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

Two details about that program are worth more than they look. First, **index 0 is a convention, not a guarantee** — the caller supplies it, so it can be a bare name, a full path, something misleading, or (through the raw `exec` family) absent entirely. Never use `args[0]` to locate your own executable; use `env::current_exe()`. Second, `args()` yields `String`, which means it must assume the arguments are valid UTF-8 — and **it panics when they aren't**:

```rust
use std::env;
use std::ffi::OsString;
use std::os::unix::ffi::{OsStrExt, OsStringExt};
use std::process::Command;

fn main() {
    // The child branch: inspect an argument that is not valid UTF-8.
    if env::var_os("RUSTBOOK_CHILD").is_some() {
        let raw: Vec<OsString> = env::args_os().skip(1).collect();
        println!("  child: raw bytes    {:?}", raw[0].as_bytes());
        println!("  child: to_str()     {:?}", raw[0].to_str());          // None
        println!("  child: lossy        {:?}", raw[0].to_string_lossy()); // replacement char
        std::panic::set_hook(Box::new(|_| {}));                          // silence the panic message
        let died = std::panic::catch_unwind(|| env::args().nth(1)).is_err();
        println!("  child: env::args() panicked? {died}");
        return;
    }

    // The parent: hand ourselves a filename that no encoding blesses.
    let bad = OsString::from_vec(b"file\xFF.txt".to_vec());
    let me = env::current_exe().expect("current_exe");
    println!("parent: passing {:?} to a copy of myself", bad.to_string_lossy());
    let status = Command::new(me).arg(&bad).env("RUSTBOOK_CHILD", "1").status().expect("spawn");
    println!("parent: child exited with {:?}", status.code());
}
```

```text
parent: passing "file�.txt" to a copy of myself
  child: raw bytes    [102, 105, 108, 101, 255, 46, 116, 120, 116]
  child: to_str()     None
  child: lossy        "file�.txt"
  child: env::args() panicked? true
parent: child exited with Some(0)
```

That byte `0xFF` is a perfectly legal filename character on Linux, so this is not a contrived case — it's what happens when a user drags a file with a mis-encoded name onto your tool. (The `os::unix::ffi` import makes *this program* Unix-only; Windows has the same hole from the other direction, where paths are UTF-16 that may contain unpaired surrogates, reachable via `os::windows::ffi`.)

> [!key] `args_os()` never panics; `args()` can
> Use **`args_os()`** (yielding `OsString`) in anything that handles file paths, then convert deliberately: `to_str()` for `Option`, `to_string_lossy()` for display, or pass the `OsString` straight into `Path::new` and never decode at all. `args()` is the convenient choice for flags and numbers you were going to parse anyway — just know that it's a panic on hostile or unusual input. The same split runs through the whole library: `var`/`var_os`, `String`/`OsString`, `Path` being bytes rather than text.

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
>
> Concretely: the example above compiles on edition 2021, and on **edition 2024** the same line is a hard error — `call to unsafe function 'set_var' is unsafe and requires unsafe block`. If you need to configure a child process, don't touch your own environment at all: use `Command::env`, which sets variables for the child only.

### Reading env vars without assuming UTF-8

`var` mirrors `args`: it hands you a `String` and therefore has to reject bytes it can't decode. `var_os` gives you the raw `OsString` and cannot fail that way:

```rust
use std::env;

fn main() {
    println!("PATH is set:   {}", env::var("PATH").is_ok());
    println!("missing var:   {:?}", env::var("NO_SUCH_VAR_12345").unwrap_err());
    println!("missing (os):  {:?}", env::var_os("NO_SUCH_VAR_12345"));
    println!("with a default: {}", env::var("LOG_LEVEL").unwrap_or_else(|_| "info".into()));

    // Where am I, what am I, and what platform is this?
    println!("cwd absolute   {:?}", env::current_dir().map(|p| p.is_absolute()));
    println!("exe name       {:?}", env::current_exe().map(|p| p.file_name().map(|s| s.to_owned())));
    println!("temp_dir       {:?}", env::temp_dir().is_absolute());
    println!("os/arch/family {} / {} / {}", env::consts::OS, env::consts::ARCH, env::consts::FAMILY);
    println!("exe suffix {:?}, dll extension {:?}", env::consts::EXE_SUFFIX, env::consts::DLL_EXTENSION);
    println!("compile-time cfg!(unix): {}", cfg!(unix));
}
```

```text
PATH is set:   true
missing var:   NotPresent
missing (os):  None
with a default: info
cwd absolute   Ok(true)
exe name       Ok(Some("playground"))
temp_dir       true
os/arch/family linux / x86_64 / unix
exe suffix "", dll extension "so"
compile-time cfg!(unix): true
```

`VarError` has exactly two shapes — `NotPresent` and `NotUnicode(OsString)` — so `unwrap_or_else(|_| default)` quietly treats "set to something undecodable" the same as "unset". That's usually what you want; when it isn't, match the two arms.

| Question | Call | Note |
|---|---|---|
| one variable, as text | `env::var("K")` → `Result<String, VarError>` | `Err` on unset *or* non-UTF-8 |
| one variable, raw | `env::var_os("K")` → `Option<OsString>` | never fails on encoding |
| all of them | `env::vars()` / `vars_os()` | order unspecified |
| set/unset for this process | `env::set_var` / `remove_var` | **`unsafe` on edition 2024** |
| set for a child only | `Command::env` / `env_remove` / `env_clear` | always safe, and scoped |
| working directory | `env::current_dir()` / `set_current_dir()` | process-global — also a hazard with threads |
| my own executable | `env::current_exe()` | not `args[0]` |
| temp directory | `env::temp_dir()` | honours `TMPDIR`, so it's user-controlled |
| platform facts at runtime | `env::consts::{OS, ARCH, FAMILY, EXE_SUFFIX, DLL_EXTENSION}` | strings, chosen at compile time |
| platform facts at compile time | `cfg!(unix)`, `#[cfg(target_os = "windows")]` | lets the other branch not exist at all |

> [!warning] `current_dir` and env vars are process-global state
> `set_current_dir` changes the working directory for *every* thread at once, so a "temporarily cd into this folder" helper is a race waiting to happen in any concurrent program — build absolute paths instead. Similarly, don't use `current_exe()` as a security boundary: on some platforms it resolves through a symlink that can be replaced, and a caller controls `argv[0]` completely. It's fine for "find my sibling data file", not for "prove who I am".

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

"Skipping destructors" is easy to nod along to and easy to forget, so here it is happening. The program spawns a copy of itself that bails out with `process::exit`, while the parent finishes normally:

```rust
use std::env;
use std::process::{Command, ExitCode};

struct Cleanup(&'static str);

impl Drop for Cleanup {
    fn drop(&mut self) { println!("  drop: {} flushed and closed", self.0); }
}

fn main() -> ExitCode {
    // The child: bail out with process::exit and watch the destructor NOT run.
    if env::var_os("RUSTBOOK_HARD_EXIT").is_some() {
        let _guard = Cleanup("child guard");
        println!("  child: calling process::exit(2)");
        std::process::exit(2);
    }

    let _guard = Cleanup("parent guard");
    let me = env::current_exe().expect("current_exe");
    let status = Command::new(me).env("RUSTBOOK_HARD_EXIT", "1").status().expect("spawn");
    println!("parent: child exit code {:?} -- and no 'child guard' line appeared", status.code());
    println!("parent: returning ExitCode::SUCCESS; the parent's guard still runs");
    ExitCode::SUCCESS
}
```

```text
  child: calling process::exit(2)
parent: child exit code Some(2) -- and no 'child guard' line appeared
parent: returning ExitCode::SUCCESS; the parent's guard still runs
  drop: parent guard flushed and closed
```

The child never printed its drop line. Substitute a `BufWriter` for that guard and you have silently truncated output — the same failure the [io chapter](#/ch/std-io) covered from the other side.

| To exit with | Write |
|---|---|
| success | fall off the end of `main`, or return `ExitCode::SUCCESS` |
| failure, generic | `fn main() -> Result<(), E>` and return `Err` (prints the `Debug` of `E`, exits `1`) |
| a specific code, cleanly | `fn main() -> ExitCode` and return `ExitCode::from(3)` |
| a specific code, immediately | `process::exit(3)` — **no destructors**, no unwinding |
| "this is a bug" | `panic!` — unwinds, runs destructors, exits with `101` |
| unrecoverable, no unwind | `std::process::abort()` — `SIGABRT`, for double-fault situations |

> [!note] `main` returning `Err` prints `Debug`, not `Display`
> `fn main() -> Result<(), Box<dyn Error>>` reports failures as `Error: <the Debug form>`, which for a hand-rolled error type can look like `Error: MyError { code: 2 }` instead of a sentence. That's why CLI tools usually wrap up with `anyhow` (whose `Debug` is deliberately a readable report with context) or catch the error in `main` themselves and print it before returning an `ExitCode`. The exit code for `Err` is always `1`, so returning `ExitCode` is the only way to distinguish failure *kinds* to a calling script.

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

### Wiring up the child's streams

Each of the child's three streams is independently either **inherited** (shares your terminal), **piped** (you read or write it), or **null** (discarded) — and a pipe from one child can become the stdin of the next, which is how you build a pipeline without a shell:

<figure class="diagram">
<svg viewBox="0 0 640 248" role="img" aria-label="A parent process connected to a child: each of stdin, stdout and stderr can be inherited, piped or null; and one child's piped stdout can be connected directly to another child's stdin to form a pipeline">
  <style>
    .st-h { font: 700 11px var(--font-sans); }
    .st-m { font: 600 10px var(--font-mono); fill: var(--text); }
    .st-c { font: 9.5px var(--font-sans); fill: var(--text-mute); }
    .st-par { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.7; }
    .st-ch { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.6; }
    .st-null { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
  </style>
  <text x="20" y="16" class="st-h" fill="var(--text-mute)">one child, three streams</text>
  <rect x="20" y="28" width="120" height="86" rx="5" class="st-par"/><text x="34" y="52" class="st-m">your process</text><text x="34" y="70" class="st-c">Command::new(..)</text><text x="34" y="86" class="st-c">.stdin(Stdio::piped())</text><text x="34" y="102" class="st-c">.stderr(Stdio::null())</text>
  <rect x="330" y="28" width="120" height="86" rx="5" class="st-ch"/><text x="344" y="52" class="st-m">child</text><text x="344" y="74" class="st-c">wc -l</text>
  <path d="M142 46 L328 46" stroke="var(--green)" stroke-width="1.7" marker-end="url(#st-a)"/>
  <text x="170" y="40" class="st-c" fill="var(--green)">stdin — piped: you write, drop = EOF</text>
  <path d="M328 76 L142 76" stroke="var(--blue)" stroke-width="1.7" marker-end="url(#st-b)"/>
  <text x="170" y="70" class="st-c" fill="var(--blue)">stdout — piped: you read it</text>
  <rect x="470" y="88" width="150" height="26" rx="4" class="st-null"/><text x="484" y="105" class="st-m">/dev/null</text>
  <path d="M452 101 L468 101" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#st-c)"/>
  <text x="470" y="82" class="st-c">stderr — null: discarded</text>
  <text x="20" y="152" class="st-h" fill="var(--text-mute)">two children, one pipeline — no shell involved</text>
  <rect x="20" y="164" width="150" height="42" rx="5" class="st-ch"/><text x="34" y="182" class="st-m">printf "b\na\nc\n"</text><text x="34" y="198" class="st-c">.stdout(Stdio::piped())</text>
  <rect x="300" y="164" width="150" height="42" rx="5" class="st-ch"/><text x="314" y="182" class="st-m">sort</text><text x="314" y="198" class="st-c">.stdin(Stdio::from(..))</text>
  <path d="M172 185 L298 185" stroke="var(--blue)" stroke-width="2" marker-end="url(#st-b)"/>
  <text x="186" y="178" class="st-c" fill="var(--blue)">child.stdout.unwrap()</text>
  <rect x="480" y="164" width="140" height="42" rx="5" class="st-par"/><text x="494" y="182" class="st-m">.output()</text><text x="494" y="198" class="st-c">"a b c"</text>
  <path d="M452 185 L478 185" stroke="var(--blue)" stroke-width="2" marker-end="url(#st-b)"/>
  <text x="20" y="230" class="st-c">Default: <tspan font-family="var(--font-mono)">status()</tspan> and <tspan font-family="var(--font-mono)">spawn()</tspan> inherit all three; <tspan font-family="var(--font-mono)">output()</tspan> pipes stdout and stderr and gives the child an empty stdin.</text>
  <text x="20" y="244" class="st-c">Deadlock warning: writing a lot to a piped stdin while never reading the piped stdout can fill the OS buffer and stall both processes.</text>
  <defs>
    <marker id="st-a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--green)"/></marker>
    <marker id="st-b" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--blue)"/></marker>
    <marker id="st-c" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker>
  </defs>
</svg>
<figcaption>Each stream is inherited, piped, or discarded — and piping one child's stdout into another's stdin builds a pipeline in pure <code>std</code>.</figcaption>
</figure>

Everything in that figure, in one runnable program:

```rust
use std::process::{Command, Stdio};
use std::io::Write;

fn main() -> std::io::Result<()> {
    // output(): run to completion, capture stdout and stderr into memory.
    let out = Command::new("echo").arg("hello").arg("world").output()?;
    println!("status {:?} success {} stdout {:?}",
             out.status.code(), out.status.success(), String::from_utf8_lossy(&out.stdout).trim());

    // Exit codes come back intact, and stderr is captured separately.
    let out = Command::new("sh").arg("-c").arg("echo to-stderr >&2; exit 3").output()?;
    println!("code {:?} stderr {:?}", out.status.code(), String::from_utf8_lossy(&out.stderr).trim());

    // A missing program is an io::Error, NOT a non-zero exit status.
    println!("missing program -> {:?}",
             Command::new("definitely-not-a-program").output().err().map(|e| e.kind()));

    // Feeding stdin: pipe it, write, then wait_with_output.
    let mut child = Command::new("wc").arg("-l")
        .stdin(Stdio::piped()).stdout(Stdio::piped()).spawn()?;
    child.stdin.take().unwrap().write_all(b"one\ntwo\nthree\n")?;   // drop closes the pipe = EOF
    let out = child.wait_with_output()?;
    println!("wc -l said {:?}", String::from_utf8_lossy(&out.stdout).trim());

    // A two-stage pipeline: the first child's stdout becomes the second's stdin.
    let first = Command::new("printf").arg("b\\na\\nc\\n").stdout(Stdio::piped()).spawn()?;
    let second = Command::new("sort").stdin(Stdio::from(first.stdout.unwrap())).output()?;
    println!("sorted {:?}", String::from_utf8_lossy(&second.stdout).replace('\n', " ").trim());

    // Controlling the child's environment and working directory.
    let out = Command::new("sh").arg("-c").arg("echo $GREETING in $PWD")
        .env_clear().env("GREETING", "hi").env("PATH", "/usr/bin:/bin")
        .current_dir("/tmp").output()?;
    println!("child env {:?}", String::from_utf8_lossy(&out.stdout).trim());

    // No shell is involved: this is a literal argument, not a redirection.
    let out = Command::new("echo").arg("a > not-a-file.txt").output()?;
    println!("no shell  {:?}", String::from_utf8_lossy(&out.stdout).trim());
    println!("file created? {}", std::path::Path::new("not-a-file.txt").exists());

    // spawn + try_wait + kill: managing a long-running child.
    let mut sleeper = Command::new("sleep").arg("30").spawn()?;
    println!("still running? {:?}", sleeper.try_wait()?.is_none());
    sleeper.kill()?;
    let status = sleeper.wait()?;
    println!("after kill: code {:?} success {}", status.code(), status.success());
    Ok(())
}
```

```text
status Some(0) success true stdout "hello world"
code Some(3) stderr "to-stderr"
missing program -> Some(NotFound)
wc -l said "3"
sorted "a b c"
child env "hi in /tmp"
no shell  "a > not-a-file.txt"
file created? false
still running? true
after kill: code None success false
```

Read the last line carefully: a killed process has **no exit code** (`None`) because it was terminated by a signal, not by returning a number. On Unix, `std::os::unix::process::ExitStatusExt::signal()` tells you which one.

| Concern | API |
|---|---|
| build the invocation | `Command::new(prog)`, `.arg(a)`, `.args([..])` |
| child's environment | `.env(k, v)`, `.envs(map)`, `.env_remove(k)`, `.env_clear()` |
| child's directory | `.current_dir(p)` |
| stream wiring | `.stdin/.stdout/.stderr(Stdio::piped() \| inherit() \| null() \| from(file))` |
| run and capture | `.output()` → `Output { status, stdout, stderr }` |
| run and inherit the terminal | `.status()` → `ExitStatus` |
| run in the background | `.spawn()` → `Child` |
| talk to a spawned child | `child.stdin/.stdout/.stderr` (`Option`, use `.take()`) |
| wait for it | `child.wait()`, `child.wait_with_output()`, `child.try_wait()` (non-blocking) |
| stop it | `child.kill()`, then `wait()` to reap it |
| did it work? | `status.success()`, `status.code()` → `Option<i32>` |

> [!key] `Command` runs a program, not a shell command
> `Command::new("echo").arg("a > f")` prints the literal text `a > f`; it does not redirect, glob, expand `$HOME`, or split on spaces. That means **there is no shell-injection hole** — a filename containing `; rm -rf /` is just a filename, because arguments are passed as a list, never re-parsed. It also means `Command::new("ls -la")` fails (it looks for a program literally named `ls -la`); use `.arg("-la")`. When you genuinely need shell features, be explicit: `Command::new("sh").arg("-c").arg(script)` — and remember you have just re-opened the injection hole, so never interpolate untrusted text into that script.

> [!mistake] Two `Command` traps that look like hangs
> **One:** `output()` waits for the child to finish *and* reads both pipes; if you instead `spawn()` with piped output and call `child.wait()` without reading, a child that produces more than a pipe-buffer's worth of output (typically 64 KiB) blocks forever writing while you block forever waiting. Use `wait_with_output()`, or read the pipes on separate threads. **Two:** a piped stdin only sees end-of-input when the write handle is *dropped* — `child.stdin.take().unwrap()` above exists precisely so the handle drops at the end of the statement. Hold onto it and `wc` will wait for input that never ends.

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

- **`env::args()`** gives command-line arguments; index 0 is a *convention* the caller controls, so use `env::current_exe()` to find yourself. Use **`clap`** for anything non-trivial.
- `args()`/`var()` yield `String` and therefore **panic or `Err` on non-UTF-8**; `args_os()`/`var_os()` hand you `OsString` and can't. Prefer the `_os` forms wherever paths are involved.
- **`env::var("KEY")`** returns `Result<String, VarError>` (`NotPresent` or `NotUnicode`); read config once at startup. **Setting** env vars is `unsafe` on edition 2024 — configure children with `Command::env` instead.
- `env::consts::{OS, ARCH, FAMILY, EXE_SUFFIX, DLL_EXTENSION}` for runtime platform facts, `cfg!`/`#[cfg]` for compile-time ones. `set_current_dir` is process-global — build absolute paths instead.
- Control exit status by **returning `Result`/`ExitCode` from `main`** rather than `process::exit`, which skips destructors — demonstrated above by a child whose `Drop` never ran. `Err` from `main` always exits `1` and prints `Debug`.
- Launch programs with **`process::Command`**: `.output()` captures, `.status()` inherits the terminal, `.spawn()` gives a `Child` you can `try_wait`, `kill`, and `wait_with_output`.
- Wire streams with `Stdio::piped()/inherit()/null()/from(..)`; pipe one child's stdout into the next child's stdin to build pipelines. A missing program is `ErrorKind::NotFound`, not a non-zero status; a killed child has `code() == None`.
- **No shell is involved**, so there is no injection risk — and no redirection, globbing, or `$VAR` expansion either, unless you explicitly run `sh -c`.

> [!exercise] Try it yourself
> 1. Print every command-line argument your program receives, numbered, skipping the program name.
> 2. Read a `PORT` env var with a default of `"8080"` if unset — then make it fail loudly with a good message when the value isn't a valid `u16`.
> 3. Use `Command` to run `echo` with two arguments and print its captured stdout.
> 4. Rewrite exercise 1 with `args_os()` so a non-UTF-8 argument is displayed lossily instead of panicking, and test it by spawning yourself with a bad byte.
> 5. Write `fn run(prog: &str, args: &[&str]) -> io::Result<String>` that returns stdout on success and an `io::Error` containing stderr on a non-zero exit — distinguishing `NotFound` from "ran and failed".
> 6. Build a three-stage pipeline (`printf` → `grep` → `sort`) with `Stdio::piped()` and no shell, and compare the code to the equivalent `sh -c` one-liner.
> 7. Spawn a `sleep 10`, poll it with `try_wait` every 100 ms up to a one-second deadline, then `kill` it and report `status.code()` and (on Unix) `signal()`.
> 8. Make a tiny `env`-like tool: print all `vars_os()` sorted by key, then re-run it under `Command::new(me).env_clear().env("ONLY", "1")` and confirm the child sees exactly one variable.

Next: talking over the network with TCP and UDP — **`std::net`**.
