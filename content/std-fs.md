<h1><span class="h1-kicker">The Standard Library, Deep</span>std::fs — Files & Paths</h1>

Reading and writing files is a daily task, and `std::fs` makes the common cases one-liners while giving you fine control when you need it. Paired with `std::path` for handling file paths portably, it's everything you need to work with the filesystem. This chapter is your reference.

## The one-line helpers

For the 90% case — "read this whole file" or "write this whole string" — `std::fs` has convenience functions that handle opening, reading/writing, and closing for you:

```rust,ignore
use std::fs;

fn main() -> std::io::Result<()> {
    // Write an entire string to a file (creates or truncates it):
    fs::write("greeting.txt", "Hello, file!\n")?;

    // Read an entire file into a String:
    let contents = fs::read_to_string("greeting.txt")?;
    println!("file says: {contents}");

    // Read raw bytes (for binary files):
    let bytes = fs::read("greeting.txt")?;
    println!("{} bytes", bytes.len());

    fs::remove_file("greeting.txt")?; // clean up
    Ok(())
}
```

> [!tip] Reach for `fs::read_to_string` / `fs::write` first
> Don't manually `File::open` + `read_to_string` unless you need to. The free functions **`fs::read_to_string`**, **`fs::read`**, and **`fs::write`** cover the vast majority of file work in a single call, correctly handling open/close and errors. Drop to the `File` API only when you need streaming, appending, or custom open options.

## The `File` API for finer control

When you need to *append*, stream large data, or set specific open options, use `File` with `OpenOptions` — and wrap it in a `BufReader`/`BufWriter` as the [io chapter](#/ch/std-io) advised:

```rust,ignore
use std::fs::{File, OpenOptions};
use std::io::{BufWriter, Write, BufReader, BufRead};

fn main() -> std::io::Result<()> {
    // Create/overwrite and stream writes through a buffer:
    let file = File::create("log.txt")?;
    let mut writer = BufWriter::new(file);
    for i in 1..=3 {
        writeln!(writer, "event {i}")?;
    }
    writer.flush()?; // ensure the buffer hits disk

    // Append instead of overwrite:
    let mut appender = OpenOptions::new().append(true).open("log.txt")?;
    writeln!(appender, "one more line")?;

    // Read it back, line by line:
    let reader = BufReader::new(File::open("log.txt")?);
    for line in reader.lines() {
        println!("{}", line?);
    }
    Ok(())
}
```

`OpenOptions` is a builder for exactly how a file is opened:

| Option | Effect |
|--------|--------|
| `.read(true)` | open for reading |
| `.write(true)` | open for writing |
| `.append(true)` | writes go to the end |
| `.create(true)` | create if missing |
| `.create_new(true)` | create, but **fail** if it already exists |
| `.truncate(true)` | empty the file on open |

## Paths: `Path` and `PathBuf`

File paths are more than strings — they differ across operating systems (`/` vs `\`) and aren't always valid UTF-8. `std::path` models them properly, mirroring the [`str`/`String` split](#/ch/std-string-str): **`&Path`** is a borrowed path, **`PathBuf`** is an owned, growable one.

```rust
use std::path::{Path, PathBuf};

fn main() {
    let path = Path::new("/home/user/report.txt");

    println!("file name:  {:?}", path.file_name());  // Some("report.txt")
    println!("extension:  {:?}", path.extension());   // Some("txt")
    println!("parent:     {:?}", path.parent());      // Some("/home/user")
    println!("stem:       {:?}", path.file_stem());    // Some("report")

    // Build paths portably with .join() — never hardcode "/" or "\":
    let mut p = PathBuf::from("/var");
    p.push("log");
    p.push("app.log");
    println!("built:      {}", p.display()); // /var/log/app.log
}
```

> [!best] Build paths with `join`/`push`, never string concatenation
> Writing `format!("{dir}/{file}")` breaks on Windows and mishandles trailing slashes. Use **`Path::join`** or **`PathBuf::push`** — they insert the correct separator for the OS and handle edge cases. Accept **`impl AsRef<Path>`** in your function signatures so callers can pass a `&str`, `String`, `&Path`, or `PathBuf` interchangeably.

## Directories and metadata

```rust,ignore
use std::fs;

fn main() -> std::io::Result<()> {
    fs::create_dir_all("data/nested")?;   // make dirs, including parents

    // Walk a directory's entries:
    for entry in fs::read_dir(".")? {
        let entry = entry?;
        let path = entry.path();
        let kind = if path.is_dir() { "dir " } else { "file" };
        println!("{kind}: {}", path.display());
    }

    // Metadata: size, timestamps, permissions:
    let meta = fs::metadata("Cargo.toml")?;
    println!("size = {} bytes, is_file = {}", meta.len(), meta.is_file());
    Ok(())
}
```

| Function | Does |
|----------|------|
| `fs::create_dir` / `create_dir_all` | make a directory (and parents) |
| `fs::read_dir(path)` | iterate directory entries |
| `fs::metadata(path)` | size, timestamps, type, permissions |
| `fs::rename(from, to)` | move/rename |
| `fs::copy(from, to)` | copy a file |
| `fs::remove_file` / `remove_dir_all` | delete a file / a directory tree |
| `path.exists()` / `is_file()` / `is_dir()` | quick checks |

<figure class="diagram">
<svg viewBox="0 0 640 120" role="img" aria-label="Path is borrowed and PathBuf is owned, mirroring str and String">
  <style>
    .fsm { font: 600 12px var(--font-mono); fill: var(--text); }
    .fsc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .own { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .bor { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
  </style>
  <rect x="40" y="30" width="240" height="50" rx="8" class="own"/><text x="56" y="52" class="fsm">PathBuf — owned</text><text x="56" y="72" class="fsc">like String; build with push/join</text>
  <rect x="360" y="30" width="240" height="50" rx="8" class="bor"/><text x="376" y="52" class="fsm">&amp;Path — borrowed</text><text x="376" y="72" class="fsc">like &amp;str; inspect with methods</text>
  <path d="M282 55 L358 55" stroke="var(--text-mute)" stroke-width="1.5" stroke-dasharray="4 3"/>
  <text x="285" y="48" class="fsc">&amp;</text>
</svg>
<figcaption><code>PathBuf</code>/<code>&amp;Path</code> mirror <code>String</code>/<code>&amp;str</code> — own to build, borrow to inspect.</figcaption>
</figure>

> [!warning] Filesystem calls fail for real-world reasons
> Files get deleted between checking and opening; permissions deny access; disks fill up. Every `fs` call returns a `Result` for good reason — handle it (with `?` and a helpful message via [`anyhow`'s `.context`](#/ch/custom-errors), for instance). Avoid the "check then act" race: prefer *trying* the operation and handling the error over `if path.exists()` followed by an open (the file could vanish in between).

## Summary

- Use the one-liners **`fs::read_to_string`**, **`fs::read`** (bytes), and **`fs::write`** for the common "whole file" cases.
- For appending, streaming, or custom open modes, use **`File`** + **`OpenOptions`**, wrapped in **`BufReader`/`BufWriter`**.
- Handle paths with **`&Path`** (borrowed) and **`PathBuf`** (owned) — build them with **`join`/`push`**, never string concatenation; accept `impl AsRef<Path>`.
- Directory & metadata tools: `create_dir_all`, `read_dir`, `metadata`, `rename`, `copy`, `remove_*`, and `path.exists()`/`is_file()`.
- Every `fs` call returns a `Result` — handle failures and avoid check-then-act races.

> [!exercise] Try it yourself (in a local project)
> 1. Write a `String` to `notes.txt` with `fs::write`, read it back with `fs::read_to_string`, then delete it.
> 2. Use `OpenOptions::new().append(true)` to add lines to a log file across two runs.
> 3. Use `Path` methods to print the file name, stem, and extension of `/tmp/data.tar.gz`, then build a sibling path with `join`.

Next in the reference: a decision guide and cheat-sheet for every collection in **`std::collections`**.
