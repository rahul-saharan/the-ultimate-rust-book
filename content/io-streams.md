<h1><span class="h1-kicker">The Standard Library, Deep</span>Files, Streams & Standard I/O</h1>

Almost everything a program does with the outside world — reading a file, printing to the terminal, talking to a socket, parsing an HTTP body — is **moving bytes through a stream**. Rust unifies all of it behind two small traits, `Read` and `Write`, so the *same* code works over a file, a network connection, standard input, or a buffer in memory. Learn this abstraction once and every I/O API in the ecosystem becomes familiar.

This is the deep, unified tour. The [std::io](#/ch/std-io) and [std::fs](#/ch/std-fs) chapters are quick references; here we build the whole mental model — the stream traits, buffering, standard streams and locking, the filesystem and paths, error handling, and how it all composes — with runnable examples throughout. (Examples that touch the real filesystem are marked `ignore`, since the in-book playground can't write files; the in-memory and path examples run live.)

## Everything is a stream of bytes

<figure class="diagram">
<svg viewBox="0 0 720 250" role="img" aria-label="The Read and Write traits sit at the center; implementors include File, TcpStream, Stdin, Stdout, byte slices, Vec, and Cursor; BufRead and Seek extend Read">
  <style>
    .st-b { font: 600 12px var(--font-mono); fill: var(--text); }
    .st-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .st-h { font: 700 12px var(--font-sans); fill: var(--text); }
    .rd { fill: var(--blue-soft);  stroke: var(--blue);   stroke-width: 1.5; }
    .wr { fill: var(--green-soft); stroke: var(--green);  stroke-width: 1.5; }
    .ex { fill: var(--amber-soft); stroke: var(--amber);  stroke-width: 1.4; }
    .xt { fill: var(--purple-soft);stroke: var(--purple); stroke-width: 1.4; }
  </style>
  <rect x="250" y="20" width="100" height="40" rx="8" class="rd"/><text x="270" y="45" class="st-b">Read</text>
  <rect x="370" y="20" width="100" height="40" rx="8" class="wr"/><text x="388" y="45" class="st-b">Write</text>
  <rect x="150" y="90" width="130" height="34" rx="8" class="xt"/><text x="162" y="112" class="st-b">BufRead : Read</text>
  <rect x="300" y="90" width="120" height="34" rx="8" class="xt"/><text x="312" y="112" class="st-b">Seek (± cursor)</text>
  <text x="20" y="160" class="st-h">Implementors — one API for all of them:</text>
  <rect x="20"  y="172" width="100" height="30" rx="6" class="ex"/><text x="32" y="192" class="st-b">File</text>
  <rect x="128" y="172" width="110" height="30" rx="6" class="ex"/><text x="140" y="192" class="st-b">TcpStream</text>
  <rect x="246" y="172" width="140" height="30" rx="6" class="ex"/><text x="258" y="192" class="st-b">Stdin/Stdout</text>
  <rect x="394" y="172" width="100" height="30" rx="6" class="ex"/><text x="406" y="192" class="st-b">&amp;[u8]</text>
  <rect x="502" y="172" width="100" height="30" rx="6" class="ex"/><text x="514" y="192" class="st-b">Vec&lt;u8&gt;</text>
  <rect x="610" y="172" width="100" height="30" rx="6" class="ex"/><text x="622" y="192" class="st-b">Cursor</text>
  <text x="20" y="228" class="st-c">If it implements Read you can read from it; if it implements Write you can write to it — regardless of what it actually is.</text>
</svg>
<figcaption>The two core traits and their implementors. <code>BufRead</code> and <code>Seek</code> add capabilities on top of <code>Read</code>.</figcaption>
</figure>

- **`Read`** — a source of bytes. Its core method `read(&mut buf)` fills a buffer and returns how many bytes it got (`0` means end-of-stream).
- **`Write`** — a sink for bytes. `write(&buf)` writes *some* bytes and returns how many; `flush()` forces buffered data out.
- **`Seek`** — for streams with random access (files, in-memory cursors): jump to a byte position.
- **`BufRead`** — a buffered reader that can hand you whole *lines* or read *until* a delimiter.

Because these are traits, generic code works over *any* implementor. Here a byte slice is a reader and a `Vec<u8>` is a writer — no file or socket in sight:

```rust
use std::io::{Read, Write};

fn main() {
    // A &[u8] implements Read — read the whole thing into a String:
    let data = b"hello, streams";
    let mut reader: &[u8] = data;
    let mut text = String::new();
    reader.read_to_string(&mut text).unwrap();
    println!("read: {text:?}");

    // A Vec<u8> implements Write — build up bytes with write! and write_all:
    let mut out: Vec<u8> = Vec::new();
    write!(out, "answer = {}", 42).unwrap();
    out.write_all(b"!").unwrap();
    println!("wrote: {:?}", String::from_utf8(out).unwrap());
}
```

> [!key] Write generic I/O with `impl Read` / `impl Write`
> When a function needs to *read* or *write*, take `impl Read` / `impl Write` (or `&mut impl Read`) instead of a concrete `File`. The same function then works with files in production and with `&[u8]`/`Cursor` in tests — no disk, no mocking framework. This is the single most useful habit for testable I/O code.

## Reading in depth

`Read` gives you a family of methods layered on the primitive `read`:

- `read(&mut buf)` — fill part of a buffer; returns the count (may be less than asked; `0` = EOF).
- `read_to_end(&mut Vec<u8>)` — drain the whole stream into bytes.
- `read_to_string(&mut String)` — the same, validated as UTF-8.
- `read_exact(&mut buf)` — fill the buffer *completely* or error (great for fixed-size records/headers).
- `bytes()` — an iterator over `io::Result<u8>`.
- `.take(n)` — adapter: a reader limited to the first `n` bytes.
- `.chain(other)` — adapter: read one stream, then seamlessly continue into another.
- `.by_ref()` — borrow the reader so adapters don't consume it.

```rust
use std::io::{Cursor, Read, Seek, SeekFrom};

fn main() {
    let mut cur = Cursor::new(vec![10u8, 20, 30, 40, 50]);

    let mut header = [0u8; 2];
    cur.read_exact(&mut header).unwrap();          // read exactly 2 bytes
    println!("header: {header:?}");                 // [10, 20]

    cur.seek(SeekFrom::Start(3)).unwrap();          // jump to index 3
    let mut rest = Vec::new();
    cur.read_to_end(&mut rest).unwrap();
    println!("from index 3: {rest:?}");             // [40, 50]
}
```

Adapters let you shape a stream without copying it:

```rust
use std::io::Read;

fn main() {
    // chain: treat two readers as one continuous stream
    let (a, b): (&[u8], &[u8]) = (b"abc", b"DEF");
    let mut joined = a.chain(b);
    let mut s = String::new();
    joined.read_to_string(&mut s).unwrap();
    println!("chained: {s}");                        // abcDEF

    // take: bound a reader to N bytes (e.g. don't read past a content-length)
    let data: &[u8] = b"first-and-rest";
    let mut limited = data.take(5);
    let mut out = Vec::new();
    limited.read_to_end(&mut out).unwrap();
    println!("take(5): {}", String::from_utf8(out).unwrap()); // first
}
```

## Writing in depth, and the flush rule

`Write`'s methods:

- `write(&buf)` — write *some* bytes; returns the count (may be partial — rarely used directly).
- `write_all(&buf)` — write the *whole* buffer or error (what you almost always want).
- `write!` / `writeln!` — formatted writing into any writer (like `print!` but to a chosen sink).
- `flush()` — push buffered bytes out to the underlying device.

```rust
use std::io::Write;

fn main() {
    let mut out: Vec<u8> = Vec::new();
    writeln!(out, "name,score").unwrap();            // formatted, into a Vec
    for (name, score) in [("alice", 10), ("bob", 7)] {
        writeln!(out, "{name},{score}").unwrap();
    }
    out.flush().unwrap();
    print!("{}", String::from_utf8(out).unwrap());
}
```

> [!warning] Buffered writers must be flushed
> A buffered writer (like `BufWriter`, or `stdout` in some contexts) may hold your bytes in memory until the buffer fills. If the program exits before a flush, that data is **lost**. Call `flush()` at the end (or let the writer's `Drop` do it — but `Drop` **ignores** flush errors, so flush explicitly when the write must not silently fail).

## Buffering: why it matters and how to add it

Each raw `read`/`write` on a file or socket is a **system call** — a round trip into the operating system, costing far more than the byte-copy itself. Reading a file one byte at a time can be *thousands* of times slower than reading it in big chunks. **`BufReader`** and **`BufWriter`** fix this: they keep an in-memory buffer and batch many small operations into a few large syscalls.

<figure class="diagram">
<svg viewBox="0 0 700 180" role="img" aria-label="Without buffering, each small read is a separate syscall; with a BufReader, many small reads are served from one large syscall's buffer">
  <style>
    .bf-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .bf-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .app { fill: var(--blue-soft);  stroke: var(--blue);  stroke-width: 1.4; }
    .buf { fill: var(--amber-soft); stroke: var(--amber); stroke-width: 1.4; }
    .os  { fill: var(--rust-100);   stroke: var(--rust-400); stroke-width: 1.4; }
  </style>
  <text x="10" y="20" class="bf-c">Unbuffered: every small read → a syscall (slow)</text>
  <rect x="10" y="30" width="90" height="30" class="app"/><text x="24" y="50" class="bf-b">app</text>
  <path d="M100 45 L200 45" stroke="var(--text-mute)" stroke-width="1.2" marker-end="url(#bfa)"/>
  <path d="M100 38 L200 38" stroke="var(--text-mute)" stroke-width="1.2" marker-end="url(#bfa)"/>
  <path d="M100 52 L200 52" stroke="var(--text-mute)" stroke-width="1.2" marker-end="url(#bfa)"/>
  <rect x="200" y="30" width="110" height="30" class="os"/><text x="214" y="50" class="bf-b">OS / disk</text>
  <text x="320" y="49" class="bf-c">many syscalls</text>
  <text x="10" y="105" class="bf-c">Buffered: one big syscall fills the buffer; small reads hit memory (fast)</text>
  <rect x="10" y="115" width="90" height="30" class="app"/><text x="24" y="135" class="bf-b">app</text>
  <path d="M100 130 L200 130" stroke="var(--text-mute)" stroke-width="1.2" marker-end="url(#bfa)"/>
  <rect x="200" y="115" width="120" height="30" class="buf"/><text x="212" y="135" class="bf-b">BufReader</text>
  <path d="M320 130 L430 130" stroke="var(--text-mute)" stroke-width="1.6" marker-end="url(#bfa)"/>
  <rect x="430" y="115" width="110" height="30" class="os"/><text x="444" y="135" class="bf-b">OS / disk</text>
  <text x="550" y="134" class="bf-c">one syscall</text>
  <defs><marker id="bfa" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>A buffer turns many tiny syscalls into a few large ones — often a 10–1000× speedup for small reads/writes.</figcaption>
</figure>

`BufReader` also unlocks the **`BufRead`** trait, whose star method is `lines()`:

```rust
use std::io::{BufRead, BufReader};

fn main() {
    // In real code the inner reader is a File or TcpStream; here it's bytes:
    let source = "alpha\nbeta\ngamma\n";
    let reader = BufReader::new(source.as_bytes());

    let mut count = 0;
    for line in reader.lines() {          // yields io::Result<String>, no trailing '\n'
        let line = line.unwrap();
        count += 1;
        println!("{count}: {line}");
    }
    println!("read {count} lines");
}
```

`BufRead` also gives `read_line` (keeps the `\n`), `read_until(delim, buf)` (read to any byte delimiter), and the low-level `fill_buf`/`consume` pair for zero-copy parsing.

> [!performance] The classic slowdown: unbuffered file/socket I/O
> `File` and `TcpStream` are **not** buffered — reading them byte-by-byte or line-by-line directly hammers the OS with syscalls. Always wrap them: `BufReader::new(file)` for input, `BufWriter::new(file)` for output. (Note: reading a whole file with `fs::read_to_string` is already a single big read, so it needs no extra buffering.)

## Standard streams: stdin, stdout, stderr

Every process has three standard streams, and `std::io` gives you a handle to each: `io::stdin()` (a `Read`), `io::stdout()` and `io::stderr()` (both `Write`).

<figure class="diagram">
<svg viewBox="0 0 640 170" role="img" aria-label="A process has three standard streams: stdin flows in, stdout and stderr flow out to the terminal or to pipes and files">
  <style>
    .ss-b { font: 600 12px var(--font-mono); fill: var(--text); }
    .ss-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .proc { fill: var(--surface-2);  stroke: var(--border-strong); stroke-width: 1.6; }
    .in  { fill: var(--blue-soft);  stroke: var(--blue);  stroke-width: 1.4; }
    .out { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.4; }
    .err { fill: var(--rust-100);   stroke: var(--rust-400); stroke-width: 1.4; }
  </style>
  <rect x="250" y="55" width="140" height="60" rx="10" class="proc"/><text x="278" y="90" class="ss-b">your process</text>
  <rect x="30" y="70" width="120" height="30" class="in"/><text x="42" y="90" class="ss-b">stdin (0)</text>
  <path d="M150 85 L248 85" stroke="var(--text-mute)" stroke-width="1.6" marker-end="url(#ssa)"/>
  <rect x="490" y="40" width="120" height="30" class="out"/><text x="502" y="60" class="ss-b">stdout (1)</text>
  <rect x="490" y="100" width="120" height="30" class="err"/><text x="502" y="120" class="ss-b">stderr (2)</text>
  <path d="M392 75 L488 55" stroke="var(--text-mute)" stroke-width="1.6" marker-end="url(#ssa)"/>
  <path d="M392 95 L488 115" stroke="var(--text-mute)" stroke-width="1.6" marker-end="url(#ssa)"/>
  <text x="30" y="135" class="ss-c">stdout carries results (pipe/redirect it); stderr carries logs &amp; errors (stays on the terminal).</text>
  <defs><marker id="ssa" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>Three streams per process. Keep <b>data</b> on stdout and <b>diagnostics</b> on stderr, so users can pipe one without the other.</figcaption>
</figure>

The `println!`/`eprintln!` macros are conveniences over these handles. For loops and precise control, get the handle and **lock** it once:

```rust
use std::io::Write;

fn main() {
    // Lock stdout ONCE, then write many times — far faster than N separate println!s,
    // and guarantees the lines aren't interleaved with other threads.
    let stdout = std::io::stdout();
    let mut out = stdout.lock();
    for i in 1..=3 {
        writeln!(out, "row {i}").unwrap();
    }
    out.flush().unwrap();
}
```

Reading a line from stdin (shown here as the pattern — it blocks for input, so it can't run in the book):

```rust,ignore
use std::io::{self, BufRead, Write};

fn main() -> io::Result<()> {
    print!("your name: ");
    io::stdout().flush()?;                    // flush so the prompt shows before we block

    let mut name = String::new();
    io::stdin().lock().read_line(&mut name)?; // read one line (includes the '\n')
    println!("hello, {}", name.trim());

    // Read ALL of stdin (e.g. piped input): for line in io::stdin().lock().lines() { ... }
    Ok(())
}
```

> [!key] stdout vs stderr — and `is_terminal`
> Convention: **stdout** is the program's *output data* (pipe it: `myprog | grep x`); **stderr** is *diagnostics* (progress, warnings, errors) so they don't pollute the piped data. `println!` writes stdout; `eprintln!` writes stderr. To adapt output when a human is watching versus a pipe, check `use std::io::IsTerminal; io::stdout().is_terminal()` — enable colors only when `true`.

> [!mistake] Forgetting to `flush()` after `print!`
> stdout is **line-buffered** when attached to a terminal: `print!` (no newline) may not appear until you print a newline or flush. Before reading input after a prompt, always `io::stdout().flush()?` — otherwise the user sees a blank line and a hang.

## Composing streams: `io::copy` and the null devices

The payoff of the trait design: **any `Read` can be piped into any `Write`** with `io::copy`, buffered efficiently for you. This one function copies a file to a socket, stdin to a file, or a buffer to stdout — the ends are interchangeable.

```rust
use std::io::{self, Cursor};

fn main() {
    let mut source = Cursor::new(b"pipe me through io::copy".to_vec()); // any Read
    let mut sink: Vec<u8> = Vec::new();                                 // any Write
    let n = io::copy(&mut source, &mut sink).unwrap();
    println!("copied {n} bytes: {}", String::from_utf8(sink).unwrap());
    // In real code: io::copy(&mut file, &mut io::stdout())  — stream a file to the terminal.
}
```

`std::io` also provides handy stand-in streams, invaluable for tests and benchmarks:

```rust
use std::io::{self, Read, Write};

fn main() {
    // repeat(byte): an endless reader of one byte — bound it with take:
    let mut dashes = io::repeat(b'-').take(10);
    let mut line = Vec::new();
    dashes.read_to_end(&mut line).unwrap();
    println!("{}", String::from_utf8(line).unwrap());   // ----------

    // sink(): a writer that discards everything (measure a producer's speed):
    let mut null = io::sink();
    let n = null.write(b"discarded").unwrap();
    println!("sink swallowed {n} bytes");

    // empty(): a reader that is always at EOF.
    let mut nothing = io::empty();
    let mut buf = Vec::new();
    nothing.read_to_end(&mut buf).unwrap();
    println!("empty gave {} bytes", buf.len());          // 0
}
```

## Handling I/O errors

Every fallible I/O operation returns `io::Result<T>` = `Result<T, io::Error>`. An `io::Error` carries an **`ErrorKind`** you can match on to react differently — the difference between crashing and gracefully handling "file not found":

```rust
use std::fs::File;
use std::io::ErrorKind;

fn main() {
    match File::open("definitely-missing.txt") {   // read-only open → safe to run
        Ok(_) => println!("opened it"),
        Err(e) => match e.kind() {
            ErrorKind::NotFound => println!("not found — we can create a default"),
            ErrorKind::PermissionDenied => println!("no permission"),
            other => println!("some other error: {other:?}"),
        },
    }
}
```

Common kinds: `NotFound`, `PermissionDenied`, `AlreadyExists`, `WouldBlock` (non-blocking I/O), `UnexpectedEof`, `Interrupted`, `TimedOut`. In application code, propagate with `?` and a custom error type; in libraries, return `io::Error` directly.

> [!warning] Retry on `Interrupted`
> A raw `read`/`write` can return `ErrorKind::Interrupted` when a signal arrives mid-syscall — it is **not** a real failure; you should retry. The convenience methods (`read_to_end`, `write_all`, `io::copy`, `BufRead::lines`) already retry internally, which is another reason to prefer them over hand-rolled `read` loops.

## The filesystem: files, `OpenOptions`, and metadata

For simple whole-file work, three one-liners cover most needs (each is a single efficient syscall-batch, already buffered internally):

```rust,ignore
use std::fs;

let text = fs::read_to_string("config.toml")?;   // whole file → String (UTF-8)
let bytes = fs::read("image.png")?;               // whole file → Vec<u8>
fs::write("out.txt", "hello\n")?;                 // create/truncate + write, in one call
```

For finer control — appending, read+write, controlling creation — open a `File` through **`OpenOptions`**, the builder that maps to the OS's open flags:

```rust,ignore
use std::fs::OpenOptions;
use std::io::{BufWriter, Write};

// Append to a log, creating it if absent, and BUFFER the writes:
let file = OpenOptions::new()
    .create(true)     // make it if it doesn't exist
    .append(true)     // add to the end (don't truncate)
    .open("app.log")?;
let mut log = BufWriter::new(file);
writeln!(log, "started at {:?}", std::time::SystemTime::now())?;
log.flush()?;          // ensure it hits disk

// create_new(true) fails if the file already exists — an atomic "don't clobber" guard.
```

Every option in one place:

| `OpenOptions` method | Effect |
|---|---|
| `.read(true)` | allow reading |
| `.write(true)` | allow writing |
| `.append(true)` | writes go to the end (implies write) |
| `.truncate(true)` | empty the file on open |
| `.create(true)` | create if missing |
| `.create_new(true)` | create, but **fail if it exists** (no clobber) |

Inspect a file or directory with `metadata`:

```rust,ignore
let meta = std::fs::metadata("app.log")?;
println!("size: {} bytes", meta.len());
println!("is dir? {}", meta.is_dir());
println!("read-only? {}", meta.permissions().readonly());
if let Ok(modified) = meta.modified() { /* SystemTime of last write */ }
```

## Paths: `Path` and `PathBuf`

File paths aren't plain strings — separators, extensions, and encodings differ across platforms. Rust models them with **`Path`** (borrowed, like `&str`) and **`PathBuf`** (owned, like `String`). Path manipulation is pure computation (no disk access), so it runs live:

```rust
use std::path::{Path, PathBuf};

fn main() {
    let mut p = PathBuf::from("/var/log");
    p.push("myapp");                    // grow the path segment by segment
    p.push("server.log");
    println!("full     : {}", p.display());        // /var/log/myapp/server.log
    println!("file     : {:?}", p.file_name());    // Some("server.log")
    println!("stem     : {:?}", p.file_stem());    // Some("server")
    println!("ext      : {:?}", p.extension());    // Some("log")
    println!("parent   : {:?}", p.parent().map(Path::to_path_buf));

    let cfg = Path::new("config").join("app.toml"); // join uses the OS separator
    println!("joined   : {}", cfg.display());
    println!("segments : {}", Path::new("a/b/c").components().count()); // 3
}
```

> [!best] Build paths with `join`/`push`, never string concatenation
> Writing `format!("{dir}/{file}")` breaks on Windows (`\` vs `/`) and mishandles trailing separators. Use `Path::join` / `PathBuf::push` — they insert the correct separator for the platform and handle edge cases. Paths also hold non-UTF-8 bytes on some systems, which is why `file_name()` returns an `OsStr`, not a `&str`.

## Directories, copying, and traversal

The `std::fs` functions for managing the tree — all `ignore` here since they mutate a real filesystem:

```rust,ignore
use std::fs;

fs::create_dir_all("data/cache")?;   // make a directory and all missing parents
fs::copy("a.txt", "b.txt")?;          // copy a file, returns bytes copied
fs::rename("b.txt", "c.txt")?;        // move/rename (atomic on the same volume)
fs::remove_file("c.txt")?;            // delete a file
fs::remove_dir_all("data")?;          // delete a directory tree (careful!)

// List a directory (one level):
for entry in fs::read_dir(".")? {
    let entry = entry?;
    let kind = if entry.file_type()?.is_dir() { "dir " } else { "file" };
    println!("{kind}  {}", entry.file_name().to_string_lossy());
}
```

To walk a tree **recursively**, either recurse over `read_dir` yourself or — in real projects — reach for the [`walkdir`](#/ch/essential-crates) crate, which handles symlinks, depth limits, and errors cleanly:

```rust,ignore
fn visit(dir: &std::path::Path) -> std::io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let path = entry?.path();
        if path.is_dir() { visit(&path)?; }     // recurse into subdirectories
        else { println!("{}", path.display()); }
    }
    Ok(())
}
```

> [!warning] Filesystem calls fail for real-world reasons
> A path may vanish between check and use (a **TOCTOU** race), permissions may deny you, a disk may fill, a name may collide. Never `.unwrap()` filesystem calls in real code — propagate with `?` and match on `ErrorKind` where you can recover. And prefer `create_new`/atomic `rename` over "check then create", which races.

## Random access with `Seek`

Files (and `Cursor`s) implement `Seek`, so you can jump around instead of reading start-to-finish — essential for binary formats, databases, and resumable downloads. We demonstrate it with an in-memory `Cursor` so it runs:

```rust
use std::io::{Cursor, Read, Seek, SeekFrom, Write};

fn main() {
    let mut file = Cursor::new(vec![0u8; 8]);   // an 8-byte "file" in memory

    file.seek(SeekFrom::Start(4)).unwrap();      // jump to byte 4
    file.write_all(&[0xAA, 0xBB]).unwrap();      // overwrite bytes 4 and 5
    println!("position now: {}", file.stream_position().unwrap()); // 6

    file.seek(SeekFrom::Start(0)).unwrap();      // rewind
    let mut all = Vec::new();
    file.read_to_end(&mut all).unwrap();
    println!("contents: {all:?}");                // [0,0,0,0,170,187,0,0]
}
```

`SeekFrom` has three modes: `Start(n)` (absolute), `Current(delta)` (relative, `delta` can be negative), and `End(delta)` (from the end).

## A note on async I/O

Everything here is **blocking**: a `read` parks the thread until data is ready. For servers handling thousands of connections, [tokio](#/ch/tokio) mirrors these exact traits with async versions — `AsyncRead`, `AsyncWrite`, `AsyncBufRead`, `tokio::fs`, `tokio::io::copy` — used with `.await`. The mental model transfers one-to-one; you add `async`/`.await` and swap `std::io`/`std::fs` for `tokio::io`/`tokio::fs`. Use blocking `std` I/O for CLIs, scripts, and simple tools; reach for async when you're multiplexing many concurrent streams.

## Summary

- All I/O flows through two traits: **`Read`** (byte source) and **`Write`** (byte sink), with **`Seek`** (random access) and **`BufRead`** (buffered, line-oriented) layered on. Files, sockets, stdin/stdout, `&[u8]`, `Vec<u8>`, and `Cursor` all implement them — so write generic code over `impl Read`/`impl Write` and it works everywhere (and is trivially testable).
- **Buffer** file/socket I/O with `BufReader`/`BufWriter` to collapse many syscalls into few; use `BufRead::lines()` for text. **Flush** buffered writers before exit.
- The three **standard streams** are `stdin`/`stdout`/`stderr`; **lock** a handle for fast, non-interleaved loops, keep data on stdout and diagnostics on stderr, and flush after a `print!` prompt.
- **`io::copy`** pipes any reader into any writer; `empty`/`sink`/`repeat` are test/benchmark stand-ins.
- Handle failures via **`io::Result`** and match on **`ErrorKind`**; prefer the retrying convenience methods.
- On the filesystem: `fs::read_to_string`/`write` for whole files, **`OpenOptions`** for control (append, `create_new`), `metadata` for info, and **`Path`/`PathBuf`** (with `join`/`push`) for portable paths. Filesystem calls fail for real reasons — handle them.
- **tokio** mirrors all of this for async; the model is identical.

See the quick references for lookups: [std::io](#/ch/std-io) and [std::fs](#/ch/std-fs); and [std::net](#/ch/std-net) for sockets, which are just more `Read`/`Write` streams.

> [!exercise] Try it yourself
> 1. Write `fn count_words(r: impl std::io::Read) -> std::io::Result<usize>` and test it by passing `b"one two three".as_slice()` — no file needed.
> 2. Use `io::copy` to stream `io::repeat(b'x').take(1000)` into `io::sink()` and print the byte count.
> 3. In a local project, append a timestamped line to a log with `OpenOptions::new().create(true).append(true)`, wrapped in a `BufWriter`, and flush it.
> 4. Build a path with `PathBuf::push`, then print its `extension()` and `parent()`.
