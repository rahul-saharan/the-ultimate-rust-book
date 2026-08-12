<h1><span class="h1-kicker">The Standard Library, Deep</span>std::io — Reading & Writing</h1>

Almost every program reads input and writes output — from the terminal, files, network sockets, or in-memory buffers. Rust unifies all of this behind two traits in `std::io`: **`Read`** and **`Write`**. Learn them once and you can read from a file, a socket, or stdin with the *same* code. This chapter is a practical reference to `std::io`.

## The four traits, and which one you need

> [!key] `Read` and `Write` abstract over *any* byte source or sink
> **`Read`** means "bytes can be pulled from me" — a file, a TCP stream, stdin, a `&[u8]`. **`Write`** means "bytes can be pushed to me" — a file, a socket, stdout, a `Vec<u8>`. Because so many types implement these traits, a function taking `impl Read` or `impl Write` works with all of them. Write to a `Vec<u8>` in tests and a real file in production, unchanged.

Two more traits complete the picture. **`BufRead`** is `Read` *plus an internal buffer*, which is what makes line-based reading possible at all — you cannot ask a raw `Read` for "the next line," because finding the newline requires reading ahead and keeping the leftovers. **`Seek`** adds random access, and only some sources have it.

<figure class="diagram">
<svg viewBox="0 0 640 268" role="img" aria-label="Input side: many sources implement Read, and BufReader wraps a Read to add BufRead. Output side: many sinks implement Write, and BufWriter wraps a Write to batch it. Seek is separate and only some types have it.">
  <style>
    .iot-h { font: 700 11.5px var(--font-sans); }
    .iot-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .iot-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .iot-src { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.4; }
    .iot-tr { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.8; }
    .iot-wr { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.6; }
  </style>
  <text x="20" y="16" class="iot-h" fill="var(--rust-500)">input — bytes come to you</text>
  <text x="340" y="16" class="iot-h" fill="var(--blue)">output — bytes go out</text>
  <rect x="20" y="28" width="280" height="32" rx="4" class="iot-src"/><text x="30" y="48" class="iot-m">File · TcpStream · Stdin · &amp;[u8] · Cursor</text>
  <rect x="340" y="28" width="280" height="32" rx="4" class="iot-src"/><text x="350" y="48" class="iot-m">File · TcpStream · Stdout · Vec&lt;u8&gt; · Cursor</text>
  <path d="M160 62 L160 92" stroke="var(--rust-500)" stroke-width="1.5" marker-end="url(#iot-tri)"/>
  <path d="M480 62 L480 92" stroke="var(--blue)" stroke-width="1.5" marker-end="url(#iot-tri2)"/>
  <text x="168" y="82" class="iot-c">implement</text>
  <text x="488" y="82" class="iot-c">implement</text>
  <rect x="20" y="96" width="280" height="46" rx="4" class="iot-tr"/><text x="30" y="114" class="iot-m">trait Read</text><text x="30" y="132" class="iot-c">read() · read_to_end() · read_exact() · take()</text>
  <rect x="340" y="96" width="280" height="46" rx="4" class="iot-wr"/><text x="350" y="114" class="iot-m">trait Write</text><text x="350" y="132" class="iot-c">write() · write_all() · flush() · write!()</text>
  <path d="M160 142 L160 176" stroke="var(--rust-500)" stroke-width="1.5" marker-end="url(#iot-tri)"/>
  <path d="M480 142 L480 176" stroke="var(--blue)" stroke-width="1.5" marker-end="url(#iot-tri2)"/>
  <text x="168" y="164" class="iot-c">wrap for buffering</text>
  <text x="488" y="164" class="iot-c">wrap for buffering</text>
  <rect x="20" y="180" width="280" height="46" rx="4" class="iot-tr"/><text x="30" y="198" class="iot-m">BufReader&lt;R&gt;: adds BufRead</text><text x="30" y="216" class="iot-c">lines() · read_line() · read_until() · fill_buf()</text>
  <rect x="340" y="180" width="280" height="46" rx="4" class="iot-wr"/><text x="350" y="198" class="iot-m">BufWriter&lt;W&gt; / LineWriter&lt;W&gt;</text><text x="350" y="216" class="iot-c">batches many small writes; flushes on drop</text>
  <text x="20" y="248" class="iot-c"><tspan font-family="var(--font-mono)">Seek</tspan> is a separate trait — <tspan font-family="var(--font-mono)">File</tspan> and <tspan font-family="var(--font-mono)">Cursor</tspan> have it; sockets, stdin and pipes do not.</text>
  <text x="20" y="264" class="iot-c">Write functions against the <tspan font-style="italic">traits</tspan>, never the concrete type, and the same code serves files, sockets and test buffers.</text>
  <defs>
    <marker id="iot-tri" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--rust-500)"/></marker>
    <marker id="iot-tri2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--blue)"/></marker>
  </defs>
</svg>
<figcaption>The <code>std::io</code> map: sources implement <code>Read</code>, sinks implement <code>Write</code>, and the <code>Buf*</code> wrappers add buffering — plus <code>BufRead</code>'s line-oriented methods.</figcaption>
</figure>

| Type | `Read` | `Write` | `Seek` | `BufRead` |
|------|--------|---------|--------|-----------|
| `File` | ✅ | ✅ | ✅ | — (wrap in `BufReader`) |
| `TcpStream` | ✅ | ✅ | — | — |
| `Stdin` | ✅ | — | — | ✅ (already buffered) |
| `Stdout` / `Stderr` | — | ✅ | — | — |
| `&[u8]` | ✅ | — | — | ✅ |
| `Vec<u8>` | — | ✅ | — | — |
| `Cursor<Vec<u8>>` | ✅ | ✅ | ✅ | ✅ |
| `BufReader<R>` | ✅ | — | ✅ if `R: Seek` | ✅ |

> [!best] Take `impl Read`/`impl Write`, not `&File`
> A function written as `fn parse(src: impl BufRead) -> io::Result<Config>` can be tested against a `&[u8]` literal with no temp files, and used in production against a `BufReader<File>` or a socket. Accepting a concrete `File` throws that away for nothing.

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

### `write` returns a count — `write_all` is what you want

`Write::write` is allowed to accept *fewer* bytes than you offered. That is not an error; a socket with a full send buffer or a pipe near capacity does it routinely. `write_all` loops until everything is out (and retries `Interrupted`), which is why it, not `write`, is the method you should reach for:

```rust
use std::io::{self, Write};

/// A sink that never accepts more than 4 bytes at a time -- like a busy socket.
struct Trickle { out: Vec<u8> }

impl Write for Trickle {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let take = buf.len().min(4);
        self.out.extend_from_slice(&buf[..take]);
        Ok(take) // <-- a SHORT write: fewer bytes accepted than offered
    }
    fn flush(&mut self) -> io::Result<()> { Ok(()) }
}

fn main() -> io::Result<()> {
    let msg = b"twelve chars";

    let mut a = Trickle { out: Vec::new() };
    let accepted = a.write(msg)?;                 // one call, no retry
    println!("write():     accepted {accepted} bytes -> {:?}", String::from_utf8(a.out).unwrap());

    let mut b = Trickle { out: Vec::new() };
    b.write_all(msg)?;                            // loops until everything is written
    println!("write_all(): all {} bytes -> {:?}", msg.len(), String::from_utf8(b.out).unwrap());
    Ok(())
}
```

```text
write():     accepted 4 bytes -> "twel"
write_all(): all 12 bytes -> "twelve chars"
```

> [!mistake] Silently truncated output: calling `write` and ignoring the count
> `w.write(data)?;` looks correct and compiles, but it can write *part* of `data` and report success. Use **`write_all`** for byte slices and **`write!`/`writeln!`** for formatted output (they use `write_all` internally). The same applies on the read side: `read` may return fewer bytes than requested, so use `read_exact` or `read_to_end` when you need a specific amount.

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

For whole-input programs — the shape almost every command-line filter takes — lock stdin once and iterate:

```rust,ignore
use std::io::{self, BufRead, Write};

fn main() -> io::Result<()> {
    let stdin = io::stdin().lock();           // Stdin already buffers; lock() removes per-line locking
    let stdout = io::stdout().lock();
    let mut out = io::BufWriter::new(stdout); // stdout is line-buffered: batch it for bulk output

    for line in stdin.lines() {               // each item is io::Result<String>
        let line = line?;
        if !line.trim().is_empty() {
            writeln!(out, "{}", line.to_uppercase())?;
        }
    }
    out.flush()                               // never rely on drop for the last flush
}
```

> [!performance] `println!` in a loop is a common accidental bottleneck
> Every `println!` locks stdout and, when stdout is a terminal, flushes at the newline. For thousands of lines, take the lock yourself and wrap it in a `BufWriter` as above — a program that prints a million lines can get several times faster with that one change. Note the direction of the two tricks: **lock once** to avoid repeated locking, and **`BufWriter`** to avoid repeated flushing.

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

### Counting the calls, so it isn't a claim you have to trust

You can see the batching happen. Implement `Read`/`Write` for a wrapper that increments a counter and forwards to the real thing — the same trick you'd use to instrument I/O in tests:

```rust
use std::io::{self, Write, BufWriter, Read, BufReader};

/// A wrapper that counts how many times the real read()/write() is called.
struct Counting<T> { inner: T, calls: usize }

impl<W: Write> Write for Counting<W> {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.calls += 1;
        self.inner.write(buf)
    }
    fn flush(&mut self) -> io::Result<()> { self.inner.flush() }
}

impl<R: Read> Read for Counting<R> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        self.calls += 1;
        self.inner.read(buf)
    }
}

fn main() -> io::Result<()> {
    // WRITING: one write() per format fragment versus one per full buffer.
    let mut raw = Counting { inner: Vec::new(), calls: 0 };
    for i in 0..1000 { writeln!(raw, "line {i}")?; }
    println!("unbuffered writes: {} write() calls", raw.calls);

    let mut buffered = BufWriter::new(Counting { inner: Vec::new(), calls: 0 });
    for i in 0..1000 { writeln!(buffered, "line {i}")?; }
    buffered.flush()?;
    println!("buffered writes:   {} write() calls", buffered.into_inner().ok().unwrap().calls);

    // READING: byte at a time, with and without a BufReader in between.
    let data = vec![b'x'; 8000];
    let mut raw_r = Counting { inner: &data[..], calls: 0 };
    let n = raw_r.by_ref().bytes().count();
    println!("unbuffered reads:  {} read() calls for {n} bytes", raw_r.calls);

    let mut buf_r = BufReader::new(Counting { inner: &data[..], calls: 0 });
    let n = buf_r.by_ref().bytes().count();
    println!("buffered reads:    {} read() calls for {n} bytes", buf_r.into_inner().calls);
    Ok(())
}
```

```text
unbuffered writes: 3000 write() calls
buffered writes:   2 write() calls
unbuffered reads:  8001 read() calls for 8000 bytes
buffered reads:    2 read() calls for 8000 bytes
```

Three numbers deserve comment. **3000, not 1000**: `writeln!(w, "line {i}")` writes the literal, the number, and the newline as separate pieces, so an unbuffered writer takes three trips per line — formatting machinery multiplies your syscalls. **2**, because the default 8 KiB buffer filled twice over ~8.9 KB of output. And **8001** reads for 8000 bytes: `.bytes()` asks for one byte at a time, plus one final call that returns `0` for end-of-input. Against a real file each of those is a syscall; against the `BufReader` all but two are a memory copy.

### `BufWriter` flushes on drop — and throws the error away

A `BufWriter` holds unwritten bytes, so it flushes in its `Drop` impl. But `drop` returns `()`; there is nowhere for a failure to go. If the disk filled up while your last buffer was pending, you will never hear about it:

```rust
use std::io::{self, Write, BufWriter};

/// A sink whose flush always fails -- like a full disk.
struct Failing;

impl Write for Failing {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> { Ok(buf.len()) }
    fn flush(&mut self) -> io::Result<()> {
        Err(io::Error::new(io::ErrorKind::StorageFull, "no space left on device"))
    }
}

fn main() {
    // Dropping a BufWriter flushes -- but Drop cannot return an error, so it is LOST.
    {
        let mut w = BufWriter::new(Failing);
        write!(w, "important data").unwrap();
    }
    println!("dropped silently: the error vanished");

    // Flush explicitly and you see it.
    let mut w = BufWriter::new(Failing);
    write!(w, "important data").unwrap();
    match w.flush() {
        Ok(()) => println!("flushed"),
        Err(e) => println!("caught: {} ({:?})", e, e.kind()),
    }
}
```

```text
dropped silently: the error vanished
caught: no space left on device (StorageFull)
```

> [!warning] Always `flush()?` (or `into_inner()?`) before you finish
> This is the single most common data-loss bug in Rust I/O code: a program writes a file, returns `Ok(())`, and the tail of the output is missing because the drop-time flush failed unnoticed. End every buffered write with an explicit `writer.flush()?`, or call `writer.into_inner()?` — it flushes and hands back the inner writer, surfacing any error as a `Result`. `File::sync_all()` goes one step further and asks the OS to commit to the physical disk.

## Reading: five methods and when each is right

`lines()` is the friendly default, but it allocates a fresh `String` for every line. In a hot loop, `read_line` into a buffer you `clear()` and reuse costs one allocation total. The rest of the toolkit handles fixed-size records (`read_exact`), limiting (`take`), and concatenation (`chain`):

```rust
use std::io::{self, Read, BufRead, BufReader, Cursor};

fn main() -> io::Result<()> {
    let data = "alpha\nbeta\ngamma\n";

    // lines(): allocates a fresh String per line
    let mut n = 0;
    for line in BufReader::new(data.as_bytes()).lines() { n += line?.len(); }
    println!("lines(): {n} bytes of text");

    // read_line into a reused buffer: no allocation after the first
    let mut r = BufReader::new(data.as_bytes());
    let mut buf = String::new();
    let mut total = 0;
    loop {
        buf.clear();
        if r.read_line(&mut buf)? == 0 { break; }   // 0 == end of input
        total += buf.trim_end().len();
    }
    println!("read_line: {total} bytes of text, one String reused");

    // read_exact demands exactly N bytes; read() may return fewer
    let mut c = Cursor::new(b"abcdefgh".to_vec());
    let mut header = [0u8; 4];
    c.read_exact(&mut header)?;
    println!("header {:?}", std::str::from_utf8(&header).unwrap());
    let mut short = [0u8; 8];
    let got = c.read(&mut short)?;
    println!("read() returned {got} of 8 requested");

    // take: limit a reader.  chain: glue two readers into one stream.
    let mut s = String::new();
    data.as_bytes().take(5).read_to_string(&mut s)?;
    println!("take(5) -> {s:?}");
    let mut s2 = String::new();
    "one ".as_bytes().chain("two".as_bytes()).read_to_string(&mut s2)?;
    println!("chain -> {s2:?}");
    Ok(())
}
```

```text
lines(): 14 bytes of text
read_line: 14 bytes of text, one String reused
header "abcd"
read() returned 4 of 8 requested
take(5) -> "alpha"
chain -> "one two"
```

| Method | Gives you | Reach for it when |
|--------|-----------|-------------------|
| `lines()` | `Iterator<Item = io::Result<String>>`, newline stripped | ordinary line processing; simplest correct code |
| `read_line(&mut s)` | bytes read, **appends** and keeps the `\n` | tight loops where you reuse one buffer; returns `0` at EOF |
| `read_until(b, &mut v)` | bytes up to a delimiter, as raw bytes | non-UTF-8 input, or records separated by something other than `\n` |
| `read_exact(&mut [u8; N])` | exactly `N` bytes or `UnexpectedEof` | binary formats: magic numbers, fixed headers |
| `read_to_string` / `read_to_end` | the whole thing | small inputs you're happy to hold in memory |

> [!mistake] `read_line` appends — clear the buffer first
> `read_line` adds to the end of the `String` you pass it. Forget the `buf.clear()` and every "line" contains all the previous ones, growing until you run out of memory. Also note that it keeps the trailing `\n` (and a `\r\n` on Windows-authored files), so `trim_end()` before comparing. `lines()` avoids both traps, which is why it's the default recommendation.

## `Seek` and `Cursor`: an in-memory file

`Cursor<Vec<u8>>` implements `Read`, `Write` *and* `Seek` — a file that never touches the disk. It is the standard way to unit-test code that parses or emits binary data:

```rust
use std::io::{self, Read, Write, Seek, SeekFrom, Cursor};

fn main() -> io::Result<()> {
    let mut file = Cursor::new(Vec::new());
    file.write_all(b"HEADERbody")?;
    file.seek(SeekFrom::Start(0))?;
    let mut tag = [0u8; 6];
    file.read_exact(&mut tag)?;
    println!("tag {:?}, position {}", std::str::from_utf8(&tag).unwrap(), file.position());

    // Seek back and overwrite in place -- writes do not insert, they replace.
    file.seek(SeekFrom::Start(0))?;
    file.write_all(b"FOOTER")?;
    println!("{:?}", String::from_utf8(file.into_inner()).unwrap());

    // The /dev/null family, useful for tests and benchmarks:
    let mut xs = vec![0u8; 5];
    io::repeat(b'x').read_exact(&mut xs)?;
    println!("repeat gave {:?}", std::str::from_utf8(&xs).unwrap());
    let n = io::copy(&mut io::repeat(b'z').take(1024), &mut io::sink())?;
    println!("copied {n} bytes into the void");
    Ok(())
}
```

```text
tag "HEADER", position 6
"FOOTERbody"
repeat gave "xxxxx"
copied 1024 bytes into the void
```

`SeekFrom` has three variants: `Start(n)` (absolute), `End(-n)` (from the end — negative to go backwards), and `Current(n)` (relative). `rewind()` is shorthand for `Start(0)`, and `stream_position()` tells you where you are.

> [!tip] `io::empty()`, `io::repeat(b)`, `io::sink()`
> These are Rust's `/dev/null` and `/dev/zero`: a reader that is immediately at EOF, a reader that yields one byte forever, and a writer that accepts everything and discards it. `io::sink()` is how you measure a serializer's speed without measuring your disk.

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

### `ErrorKind` is what you match on

An `io::Error` carries a portable **`ErrorKind`** plus, on OS failures, the raw errno. Match on the kind; never parse the message, which is platform- and locale-dependent:

```rust
use std::io::{self, ErrorKind};
use std::fs::File;

fn main() {
    match File::open("definitely-not-here.txt") {
        Ok(_) => println!("opened"),
        Err(e) => println!("kind {:?} | message: {e}", e.kind()),
    }

    // Build your own io::Error with a message...
    let custom = io::Error::new(ErrorKind::InvalidData, "expected 4-byte magic");
    println!("{:?} / {}", custom.kind(), custom);

    // ...or from a bare kind, when no extra context helps.
    let e = io::Error::from(ErrorKind::UnexpectedEof);
    let advice = match e.kind() {
        ErrorKind::NotFound => "create it",
        ErrorKind::PermissionDenied => "check permissions",
        ErrorKind::UnexpectedEof => "the input was truncated",
        ErrorKind::Interrupted => "retry the call",
        _ => "give up",
    };
    println!("{advice}");
}
```

```text
kind NotFound | message: No such file or directory (os error 2)
InvalidData / expected 4-byte magic
the input was truncated
```

| `ErrorKind` | Typical cause | Usual response |
|-------------|---------------|----------------|
| `NotFound` | path doesn't exist | create it, or report it clearly |
| `PermissionDenied` | wrong user or mode | fail with a useful message |
| `AlreadyExists` | `create_new` on an existing path | pick another name, or reuse |
| `UnexpectedEof` | `read_exact` ran out of input | the input is truncated or malformed |
| `InvalidData` | bytes weren't valid UTF-8 or your format | reject the input |
| `WouldBlock` | a non-blocking source has nothing yet | retry later — **not** a real failure |
| `Interrupted` | a signal arrived mid-syscall | retry immediately |
| `BrokenPipe` | the reader on the other end closed | usually exit quietly |

> [!note] `Interrupted` is retried for you by the helpers
> `read_exact`, `write_all`, `read_to_end` and `io::copy` all retry `ErrorKind::Interrupted` internally, because a signal interrupting a syscall is not a real error. If you write your own `read`/`write` loop, you must handle it yourself — one more reason to prefer the helpers. And `BrokenPipe` is worth special-casing in CLI tools: it's what you get when a user pipes your output into `head`.

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
| `Read::take(n)` / `Read::chain(r)` | limit a reader / concatenate two readers |
| `Read::bytes()` | iterate bytes as `io::Result<u8>` (buffer first!) |
| `BufRead::read_until(b, &mut v)` | read to a delimiter, as raw bytes |
| `BufRead::fill_buf()` / `consume(n)` | peek at buffered bytes without copying |
| `Seek::rewind()` / `stream_position()` | back to the start / where am I |
| `io::empty()` / `io::repeat(b)` / `io::sink()` | EOF source / infinite source / discard sink |
| `BufWriter::into_inner()` | flush **and** surface the error, unwrapping the writer |

## Summary

- `std::io` unifies all input/output behind two traits: **`Read`** (byte source) and **`Write`** (byte sink) — so one function works over files, sockets, stdin/stdout, and in-memory buffers. **`BufRead`** adds line-oriented reading, **`Seek`** adds random access.
- **`write` and `read` may be partial.** Use `write_all`, `write!`, `read_exact`, or `read_to_end` — they loop, and they retry `Interrupted` for you.
- Access the terminal via **`stdin`/`stdout`/`stderr`**; `lock()` once for many operations, and **`flush()`** after a `print!` prompt.
- Wrap file/network I/O in **`BufReader`/`BufWriter`**: a measured 3000 → 2 write calls and 8001 → 2 read calls in this chapter's instrumented example.
- **`BufWriter` flushes on drop but discards the error.** Always finish with `flush()?` or `into_inner()?`.
- `lines()` allocates per line; `read_line` into a cleared buffer allocates once. `read_until` handles non-UTF-8 and custom delimiters.
- **`Cursor<Vec<u8>>`** is a `Read + Write + Seek` in-memory file — the way to test binary parsers without touching disk.
- I/O returns **`io::Result<T>`**; propagate with `?`, and branch on **`e.kind()`** (`NotFound`, `UnexpectedEof`, `WouldBlock`, `BrokenPipe`, …), never on the message text.

> [!exercise] Try it yourself
> 1. Write formatted text into a `Vec<u8>` with `write!`/`writeln!`, then print it as a `String`.
> 2. Use `BufReader` over a multi-line `&[u8]` and print each line with its number via `.lines().enumerate()`.
> 3. Use `std::io::copy` to stream one `&[u8]` "reader" into a `Vec<u8>` "writer" and report the byte count.
> 4. Extend the `Counting` wrapper to also total the bytes per call, and find the buffer size at which `BufWriter` stops helping.
> 5. Write `fn parse_records(src: impl BufRead) -> io::Result<Vec<(String, u32)>>` for `name,score` lines, and test it against a `&[u8]` literal — no files.
> 6. Use `Cursor` and `read_exact` to parse a tiny binary format: a 4-byte magic `b"RUST"`, then a `u32` length (`u32::from_le_bytes`), then that many bytes of payload. Return `InvalidData` if the magic is wrong.
> 7. Write a copy loop with bare `read`/`write` that handles short writes and `Interrupted` correctly, then replace the whole thing with `io::copy` and compare the line counts.
> 8. Prove the drop-flush trap to yourself: write to a `BufWriter<Failing>`, return `Ok(())` from a function, and confirm the caller sees success.

Reading from an in-memory buffer is the same as reading from a file — so let's actually open some files with **`std::fs`**.
