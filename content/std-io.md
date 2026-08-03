<h1><span class="h1-kicker">The Standard Library, Deep</span>std::io — Reading & Writing</h1>

Almost every program reads input and writes output — from the terminal, files, network sockets, or in-memory buffers. Rust unifies all of this behind two traits in `std::io`: **`Read`** and **`Write`**. Learn them once and you can read from a file, a socket, or stdin with the *same* code. This chapter is a practical reference to `std::io`.

## The two core traits

> [!key] `Read` and `Write` abstract over *any* byte source or sink
> **`Read`** means "bytes can be pulled from me" — a file, a TCP stream, stdin, a `&[u8]`. **`Write`** means "bytes can be pushed to me" — a file, a socket, stdout, a `Vec<u8>`. Because so many types implement these traits, a function taking `impl Read` or `impl Write` works with all of them. Write to a `Vec<u8>` in tests and a real file in production, unchanged.

```rust
use std::io::Write;

fn main() -> std::io::Result<()> {
    // A Vec<u8> implements Write — great for building output in memory or tests:
    let mut buffer: Vec<u8> = Vec::new();
    write!(buffer, "Hello, {}!", "world")?; // write! macro works on any Write
    writeln!(buffer, " Line two.")?;

    println!("{}", String::from_utf8(buffer).unwrap());
    Ok(())
}
```

## Reading and writing standard streams

`std::io` gives you handles to the three standard streams: `stdin`, `stdout`, `stderr`.

```rust
use std::io::Write;

fn main() -> std::io::Result<()> {
    // stdout — println! uses this, but you can get the handle for control:
    let stdout = std::io::stdout();
    let mut handle = stdout.lock(); // lock once for many writes (faster)
    writeln!(handle, "written via a locked stdout handle")?;

    // stderr for diagnostics (eprintln! is the shortcut):
    eprintln!("this goes to stderr");
    Ok(())
}
```

Reading a line from the user (compiles everywhere; on the playground there's no interactive stdin, but the pattern is the reference):

```rust,ignore
use std::io::{self, BufRead, Write};

fn main() -> io::Result<()> {
    print!("Your name: ");
    io::stdout().flush()?; // flush so the prompt shows before reading

    let mut line = String::new();
    io::stdin().read_line(&mut line)?; // reads including the trailing newline
    println!("Hello, {}!", line.trim());
    Ok(())
}
```

> [!mistake] Remember to `flush()` after `print!`
> `print!` (without the `ln`) doesn't add a newline, and stdout is **line-buffered** — so your prompt may not appear until *after* you read input, confusing the user. Call `io::stdout().flush()?` right after a `print!` prompt to force it out immediately. (`println!` flushes on the newline, so this only bites with `print!`.)

## Buffering: wrap for speed

Reading or writing one byte at a time makes a system call each time — slow. **`BufReader`** and **`BufWriter`** add a buffer so many small operations become few large ones. Always wrap file and network I/O in them:

```rust
use std::io::{BufReader, BufRead};

fn main() -> std::io::Result<()> {
    // Pretend this &[u8] is a file; BufReader works over any Read:
    let data = "line one\nline two\nline three";
    let reader = BufReader::new(data.as_bytes());

    // .lines() yields each line as an io::Result<String>:
    for line in reader.lines() {
        println!("got: {}", line?);
    }
    Ok(())
}
```

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="A BufReader batches many small reads into few large system calls">
  <style>
    .iom { font: 600 11px var(--font-mono); fill: var(--text); }
    .ioc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .app { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .buf { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .os { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
  </style>
  <rect x="20" y="55" width="130" height="40" class="app"/><text x="34" y="79" class="iom">your code</text>
  <rect x="255" y="55" width="130" height="40" class="buf"/><text x="269" y="79" class="iom">BufReader</text>
  <rect x="490" y="55" width="130" height="40" class="os"/><text x="504" y="79" class="iom">OS / disk</text>
  <path d="M152 75 L253 75" stroke="var(--rust-500)" stroke-width="1.5" marker-end="url(#aio)"/>
  <text x="158" y="66" class="ioc">many small reads</text>
  <path d="M387 75 L488 75" stroke="var(--blue)" stroke-width="2.5" marker-end="url(#aio2)"/>
  <text x="400" y="66" class="ioc">few big reads</text>
  <text x="20" y="130" class="ioc">The buffer absorbs many tiny requests and refills from the OS in bulk — often a 10×+ speedup.</text>
  <defs>
    <marker id="aio" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--rust-500)"/></marker>
    <marker id="aio2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--blue)"/></marker>
  </defs>
</svg>
<figcaption>Wrap I/O in <code>BufReader</code>/<code>BufWriter</code> to turn many small syscalls into a few large ones.</figcaption>
</figure>

> [!performance] Unbuffered file/socket I/O is a classic slowdown
> Calling `.read()`/`.write()` in a loop directly on a `File` or `TcpStream` makes a syscall per call — devastating for throughput. Wrapping in `BufReader::new(file)` / `BufWriter::new(file)` batches them and is one of the easiest performance wins in I/O code. (`stdin`/`stdout` are already buffered, but locking them once, as shown above, still helps.)

## The `io::Result` type and `?`

Every I/O operation can fail (disk full, connection reset, permission denied), so they return **`io::Result<T>`** = `Result<T, std::io::Error>`. Use `?` to propagate, and let `main` return `io::Result<()>`:

```rust
use std::io::{Read, Write};

fn copy_all(src: &mut impl Read, dst: &mut impl Write) -> std::io::Result<u64> {
    // std::io::copy efficiently streams everything from src to dst:
    std::io::copy(src, dst)
}

fn main() -> std::io::Result<()> {
    let mut source = "stream me".as_bytes();
    let mut sink: Vec<u8> = Vec::new();
    let n = copy_all(&mut source, &mut sink)?;
    println!("copied {n} bytes: {}", String::from_utf8(sink).unwrap());
    Ok(())
}
```

## Handy helpers

| Function / method | Does |
|-------------------|------|
| `read_to_string(&mut s)` | read an entire `Read` into a `String` |
| `read_to_end(&mut vec)` | read all bytes into a `Vec<u8>` |
| `BufRead::lines()` | iterate lines (each an `io::Result<String>`) |
| `BufRead::read_line(&mut s)` | read one line (keeps the `\n`) |
| `std::io::copy(r, w)` | stream everything from a reader to a writer |
| `write!` / `writeln!` | formatted write to any `Write` |
| `.flush()` | force buffered output out now |

## Summary

- `std::io` unifies all input/output behind two traits: **`Read`** (byte source) and **`Write`** (byte sink) — so one function works over files, sockets, stdin/stdout, and in-memory buffers.
- Access the terminal via **`stdin`/`stdout`/`stderr`**; `lock()` a handle for many writes, and **`flush()`** after a `print!` prompt.
- Wrap file/network I/O in **`BufReader`/`BufWriter`** to batch syscalls — a big, easy speedup.
- I/O returns **`io::Result<T>`**; propagate with `?` and let `main` return `io::Result<()>`.
- Reach for helpers: `read_to_string`, `read_to_end`, `.lines()`, `std::io::copy`, `write!`/`writeln!`.

> [!exercise] Try it yourself
> 1. Write formatted text into a `Vec<u8>` with `write!`/`writeln!`, then print it as a `String`.
> 2. Use `BufReader` over a multi-line `&[u8]` and print each line with its number via `.lines().enumerate()`.
> 3. Use `std::io::copy` to stream one `&[u8]` "reader" into a `Vec<u8>` "writer" and report the byte count.

Reading from an in-memory buffer is the same as reading from a file — so let's actually open some files with **`std::fs`**.
