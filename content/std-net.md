<h1><span class="h1-kicker">The Standard Library, Deep</span>std::net — TCP & UDP</h1>

Rust's `std::net` provides **blocking** (synchronous) networking: TCP for reliable, ordered connections (HTTP, databases, SSH) and UDP for fast, connectionless datagrams (games, DNS, streaming). It's the foundation the async runtimes build on. This reference covers building clients and servers with the standard library — and because every example runs both ends inside one process over the loopback interface, using port `0` so the OS picks a free port, they all really execute.

## TCP vs. UDP

> [!jargon] TCP and UDP
> **TCP** (Transmission Control Protocol) gives you a reliable, ordered *stream* of bytes — like a phone call: a connection is established, and everything you send arrives in order or you're told it failed. **UDP** (User Datagram Protocol) sends independent *packets* with no connection and no delivery guarantee — like postcards: fast and lightweight, but some may arrive out of order or not at all. Use TCP when correctness matters (almost always); use UDP when low latency beats reliability (real-time games, live audio).

## The shape of a TCP conversation

<figure class="diagram">
<svg viewBox="0 0 640 300" role="img" aria-label="A sequence diagram of a TCP conversation: the server binds, listens and blocks in accept; the client connects; they exchange a request and a response; the client shuts down its write side and the server's read returns zero, meaning end of file">
  <style>
    .tc-h { font: 700 11px var(--font-sans); }
    .tc-m { font: 600 10px var(--font-mono); fill: var(--text); }
    .tc-c { font: 9.5px var(--font-sans); fill: var(--text-mute); }
    .tc-s { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.6; }
    .tc-cl { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.6; }
  </style>
  <rect x="34" y="22" width="180" height="26" rx="4" class="tc-s"/><text x="46" y="40" class="tc-h" fill="var(--rust-600)">server</text>
  <rect x="424" y="22" width="180" height="26" rx="4" class="tc-cl"/><text x="436" y="40" class="tc-h" fill="var(--blue)">client</text>
  <line x1="124" y1="48" x2="124" y2="278" stroke="var(--rust-400)" stroke-width="1.4" stroke-dasharray="3 3"/>
  <line x1="514" y1="48" x2="514" y2="278" stroke="var(--blue)" stroke-width="1.4" stroke-dasharray="3 3"/>
  <text x="132" y="70" class="tc-m">TcpListener::bind(addr)</text>
  <text x="132" y="86" class="tc-c">also starts listening — a queue of pending connections</text>
  <text x="132" y="106" class="tc-m">accept()  ← blocks here</text>
  <path d="M510 126 L128 126" stroke="var(--blue)" stroke-width="1.8" marker-end="url(#tc-l)"/>
  <text x="196" y="120" class="tc-c" fill="var(--blue)">TcpStream::connect(addr) — the TCP handshake</text>
  <text x="132" y="146" class="tc-c">accept() returns (TcpStream, SocketAddr of the peer)</text>
  <path d="M510 170 L128 170" stroke="var(--blue)" stroke-width="1.8" marker-end="url(#tc-l)"/>
  <text x="228" y="164" class="tc-c" fill="var(--blue)">write_all(request)</text>
  <path d="M128 198 L510 198" stroke="var(--rust-500)" stroke-width="1.8" marker-end="url(#tc-r)"/>
  <text x="228" y="192" class="tc-c" fill="var(--rust-500)">write_all(response)</text>
  <path d="M510 230 L128 230" stroke="var(--text-mute)" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#tc-g)"/>
  <text x="200" y="224" class="tc-c">shutdown(Write) or drop — closes this direction</text>
  <text x="132" y="250" class="tc-m" fill="var(--green)">read() returns Ok(0)  ← that zero is EOF</text>
  <text x="34" y="272" class="tc-c">There is no message framing anywhere in this picture: TCP delivers bytes, so where one request ends is <tspan font-style="italic">your</tspan> protocol's job.</text>
  <text x="34" y="288" class="tc-c">A <tspan font-family="var(--font-mono)">TcpStream</tspan> is just <tspan font-family="var(--font-mono)">Read</tspan> + <tspan font-family="var(--font-mono)">Write</tspan>, so every <tspan font-family="var(--font-mono)">std::io</tspan> habit — <tspan font-family="var(--font-mono)">BufReader</tspan>, <tspan font-family="var(--font-mono)">read_exact</tspan>, <tspan font-family="var(--font-mono)">write_all</tspan> — applies unchanged.</text>
  <defs>
    <marker id="tc-l" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--blue)"/></marker>
    <marker id="tc-r" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--rust-500)"/></marker>
    <marker id="tc-g" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker>
  </defs>
</svg>
<figcaption>Bind, accept, exchange bytes, close — and the read that returns <code>0</code> is how you learn the other side is done.</figcaption>
</figure>

## A TCP server

**`TcpListener`** binds to an address and accepts incoming connections; each accepted connection is a **`TcpStream`** you read from and write to (using the [`Read`/`Write`](#/ch/std-io) traits you already know):

```rust,ignore
use std::io::{Read, Write};
use std::net::TcpListener;

fn main() -> std::io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:7878")?;
    println!("listening on 127.0.0.1:7878");

    // accept() blocks until a client connects; incoming() loops forever:
    for stream in listener.incoming() {
        let mut stream = stream?;
        let mut buf = [0u8; 512];
        let n = stream.read(&mut buf)?;      // read what the client sent
        stream.write_all(&buf[..n])?;         // echo it back
        println!("echoed {n} bytes");
    }
    Ok(())
}
```

## A TCP client

**`TcpStream::connect`** opens a connection to a server; then it's just reads and writes:

```rust,ignore
use std::io::{Read, Write};
use std::net::TcpStream;

fn main() -> std::io::Result<()> {
    let mut stream = TcpStream::connect("127.0.0.1:7878")?;
    stream.write_all(b"hello server")?;

    let mut response = [0u8; 512];
    let n = stream.read(&mut response)?;
    println!("server replied: {}", String::from_utf8_lossy(&response[..n]));
    Ok(())
}
```

Those two programs are the shapes you'll actually write, but they need each other to do anything. Put both ends in one process — the server on a thread, the client on `main` — and the whole exchange becomes a single runnable program:

```rust
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;

fn main() -> std::io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:0")?;   // port 0 = let the OS pick a free port
    let addr = listener.local_addr()?;                   // ...then ask which one it picked
    println!("server listening on {addr}");

    let server = thread::spawn(move || -> std::io::Result<()> {
        let (mut sock, peer) = listener.accept()?;       // blocks until someone connects
        println!("server: accepted a connection from {}", peer.ip());
        let mut buf = [0u8; 64];
        let n = sock.read(&mut buf)?;
        sock.write_all(&buf[..n])?;                      // echo it straight back
        Ok(())
    });

    let mut client = TcpStream::connect(addr)?;
    client.write_all(b"hello")?;
    let mut back = [0u8; 64];
    let n = client.read(&mut back)?;
    println!("client: server echoed {:?}", String::from_utf8_lossy(&back[..n]));

    server.join().unwrap()
}
```

```text
server listening on 127.0.0.1:36381
server: accepted a connection from 127.0.0.1
client: server echoed "hello"
```

(The port differs every run, which is the point of binding to `0`: no clashes with whatever else is on your machine, and no hard-coded number in a test.)

## TCP is a byte stream, so framing is your job

This is the single most important thing to understand about TCP, and the source of most homemade-protocol bugs: **`write` boundaries are not `read` boundaries.** Three writes can arrive as one read; one big write arrives as many reads. Nothing preserves your message edges — you have to put them back:

```rust
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::thread;
use std::time::Duration;

fn main() -> std::io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let addr = listener.local_addr()?;

    let server = thread::spawn(move || -> std::io::Result<()> {
        // (1) TCP is a byte STREAM, not a message queue.
        let (mut sock, _) = listener.accept()?;
        thread::sleep(Duration::from_millis(60));           // let all three writes arrive
        let mut buf = [0u8; 64];
        let n = sock.read(&mut buf)?;
        println!("(1) three writes arrived as ONE read of {n} bytes: {:?}",
                 String::from_utf8_lossy(&buf[..n]));
        println!("(1) next read returns {} -- that zero IS end-of-file", sock.read(&mut buf)?);

        // (2) A big write arrives in pieces: the reader must loop.
        let (mut sock, _) = listener.accept()?;
        let (mut reads, mut total) = (0, 0);
        loop {
            let n = sock.read(&mut buf)?;
            if n == 0 { break; }
            reads += 1;
            total += n;
        }
        println!("(2) 100 KB took {reads} reads of at most 64 bytes, {total} bytes total");

        // (3) Length-prefixed framing: read exactly 4 bytes, then exactly that many.
        let (mut sock, _) = listener.accept()?;
        let mut len = [0u8; 4];
        sock.read_exact(&mut len)?;
        let mut body = vec![0u8; u32::from_be_bytes(len) as usize];
        sock.read_exact(&mut body)?;
        println!("(3) framed message of {} bytes: {:?}", body.len(), String::from_utf8_lossy(&body));

        // (4) Line-delimited framing: let BufReader find the newlines.
        let (sock, _) = listener.accept()?;
        let mut reader = BufReader::new(sock);
        let mut line = String::new();
        while reader.read_line(&mut line)? > 0 {
            println!("(4) line {:?}", line.trim_end());
            line.clear();
        }
        println!("(4) read_line returned 0: the peer closed its write side");
        Ok(())
    });

    // (1) three small writes, then close
    let mut c = TcpStream::connect(addr)?;
    c.write_all(b"one")?;
    c.write_all(b"two")?;
    c.write_all(b"three")?;
    drop(c);

    // (2) one large write
    let mut c = TcpStream::connect(addr)?;
    c.write_all(&vec![b'x'; 100_000])?;
    drop(c);

    // (3) length prefix + body
    let mut c = TcpStream::connect(addr)?;
    let msg = b"a framed payload";
    c.write_all(&(msg.len() as u32).to_be_bytes())?;
    c.write_all(msg)?;
    drop(c);

    // (4) newline-delimited, closing only the write half
    let mut c = TcpStream::connect(addr)?;
    c.write_all(b"first line\nsecond line\n")?;
    c.shutdown(Shutdown::Write)?;      // half-close: peer sees EOF, we could still read

    server.join().unwrap()?;
    Ok(())
}
```

```text
(1) three writes arrived as ONE read of 11 bytes: "onetwothree"
(1) next read returns 0 -- that zero IS end-of-file
(2) 100 KB took 1563 reads of at most 64 bytes, 100000 bytes total
(3) framed message of 16 bytes: "a framed payload"
(4) line "first line"
(4) line "second line"
(4) read_line returned 0: the peer closed its write side
```

Section (1) merged three messages into one read; section (2) split one message across 1,563 reads (the buffer was 64 bytes — the count is a property of *your* buffer, not the sender). Sections (3) and (4) are the two fixes, and between them they cover nearly every real protocol.

| Framing strategy | How it works | Used by |
|---|---|---|
| **Length prefix** | fixed-size length, then exactly that many bytes (`read_exact` twice) | most binary protocols, gRPC, Postgres |
| **Delimiter** | read until `\n` (or `\r\n\r\n`) with `BufRead::read_line`/`read_until` | HTTP headers, SMTP, Redis, line protocols |
| **Fixed size** | every message is exactly N bytes | telemetry, simple embedded links |
| **Close = end** | read to EOF, the whole stream is one message | `HTTP/1.0`, `cat`-style transfers |

> [!key] `Ok(0)` from `read` means end-of-file, not "nothing right now"
> On a blocking socket, `read` waits until at least one byte is available, so a return of `0` can only mean the peer closed its write side — the connection is done. That's why every read loop is `loop { let n = read(..)?; if n == 0 { break; } … }`. The "nothing right now" case only exists on a non-blocking socket, and it shows up as `ErrorKind::WouldBlock` instead. Confusing the two produces either a busy loop that burns a core or a server that hangs forever.

> [!mistake] Assuming one `write` equals one `read`
> Code like `stream.write_all(json.as_bytes())` on one side and `let n = stream.read(&mut buf)?` on the other appears to work perfectly — on localhost, with small messages, on your laptop. It breaks in production, where a 2 KB JSON payload gets split across packets and your parser sees half an object. **Decide on framing before you send the first byte**, and use `read_exact` or `BufReader::read_line` rather than a bare `read`. Note also that `shutdown(Shutdown::Write)` is a *half* close: it sends EOF to the peer while you can still read their reply — the correct way to say "that's all my input" without losing the response.

## Timeouts, options, and splitting a socket

A blocking socket with no timeout can wait forever, which is how a "hung" service usually starts:

```rust
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;
use std::time::{Duration, Instant};

fn main() -> std::io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let addr = listener.local_addr()?;
    let keeper = thread::spawn(move || {
        let (sock, _) = listener.accept().unwrap();
        thread::sleep(Duration::from_millis(300));   // deliberately silent
        drop(sock);
    });

    let mut c = TcpStream::connect(addr)?;
    println!("local {:?} peer {:?}", c.local_addr()?.ip(), c.peer_addr()?.port() > 0);

    // A read timeout turns "wait forever" into an error you can handle.
    c.set_read_timeout(Some(Duration::from_millis(50)))?;
    let t = Instant::now();
    let mut buf = [0u8; 16];
    match c.read(&mut buf) {
        Ok(n) => println!("read {n} bytes"),
        Err(e) => println!("gave up after >= 50ms: {} | kind {:?}", t.elapsed().as_millis() >= 50, e.kind()),
    }

    // Non-blocking mode reports WouldBlock instead of waiting at all.
    c.set_nonblocking(true)?;
    println!("nonblocking read -> {:?}", c.read(&mut buf).err().map(|e| e.kind()));
    c.set_nonblocking(false)?;

    // Socket options worth knowing.
    c.set_nodelay(true)?;                 // disable Nagle: send small writes immediately
    println!("nodelay {} ttl {}", c.nodelay()?, c.ttl()? > 0);

    // try_clone gives you two independent handles to the same socket
    // (so one thread can read while another writes).
    let mut writer = c.try_clone()?;
    let w = thread::spawn(move || writer.write_all(b"from the other handle"));
    w.join().unwrap()?;
    println!("try_clone worked");

    keeper.join().unwrap();
    Ok(())
}
```

```text
local 127.0.0.1 peer true
gave up after >= 50ms: true | kind WouldBlock
nonblocking read -> Some(WouldBlock)
nodelay true ttl true
try_clone worked
```

| Call | Effect |
|---|---|
| `set_read_timeout` / `set_write_timeout` | `Some(d)` to fail after `d`, `None` for "wait forever" (the default) |
| `set_nonblocking(true)` | every call returns immediately, `WouldBlock` if it can't proceed |
| `set_nodelay(true)` | disables Nagle's algorithm — send small writes at once instead of coalescing |
| `shutdown(Shutdown::{Read, Write, Both})` | close one or both directions |
| `try_clone()` | a second handle to the same socket, for a reader thread plus a writer thread |
| `local_addr()` / `peer_addr()` | which port did I get / who am I talking to |
| `set_ttl` / `ttl` | IP time-to-live (hop limit) |
| `TcpStream::connect_timeout(&addr, d)` | the only way to bound the *connect* step — `connect` itself has no timeout |

> [!note] A timed-out read is `WouldBlock` on Unix and `TimedOut` on Windows
> That inconsistency is baked into the platforms, so portable code checks for both: `matches!(e.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut)`. Note also that a timeout of `Duration::ZERO` is an error, not "poll once" — use `set_nonblocking` for that. And with `set_nodelay(false)` (the default), many small `write_all` calls can be held back by up to ~40 ms waiting for more data; for a request/response protocol that sends a small header then waits, `set_nodelay(true)` is usually right.

## Addresses and DNS

Most APIs accept `impl ToSocketAddrs`, so a `&str`, a `(host, port)` tuple, or a `SocketAddr` all work — but a *name* has to be resolved, and that resolution is a blocking call that can return several addresses:

```rust
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};

fn main() -> std::io::Result<()> {
    // Parsing
    let ip: IpAddr = "192.168.1.1".parse().unwrap();
    let v6: IpAddr = "2001:db8::1".parse().unwrap();
    let addr: SocketAddr = "127.0.0.1:8080".parse().unwrap();
    println!("{ip} | {v6} | {addr} port {}", addr.port());
    println!("v6 socket prints with brackets: {}", "[::1]:443".parse::<SocketAddr>().unwrap());
    println!("bad input -> {:?}", "127.0.0.1".parse::<SocketAddr>().is_err());  // no port!

    // Building without strings
    let built = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 7878);
    println!("built {built} | is_ipv4 {} | loopback {}", built.is_ipv4(), built.ip().is_loopback());
    println!("classification: private {} multicast {} unspecified {}",
             Ipv4Addr::new(10, 0, 0, 1).is_private(),
             Ipv4Addr::new(224, 0, 0, 1).is_multicast(),
             Ipv4Addr::UNSPECIFIED.is_unspecified());
    println!("v6 loopback {} | mapped {:?}", Ipv6Addr::LOCALHOST.is_loopback(),
             Ipv4Addr::LOCALHOST.to_ipv6_mapped());

    // ToSocketAddrs: a name resolves to one or more addresses (this call BLOCKS on DNS).
    let resolved: Vec<SocketAddr> = ("localhost", 80).to_socket_addrs()?.collect();
    println!("localhost:80 resolved to {} address(es), all loopback: {}",
             resolved.len(), resolved.iter().all(|a| a.ip().is_loopback()));
    println!("unresolvable -> {:?}",
             ("no-such-host.invalid", 80).to_socket_addrs().err().map(|e| e.kind()));

    // 0.0.0.0 vs 127.0.0.1 when binding
    println!("0.0.0.0 means every interface: {}", Ipv4Addr::UNSPECIFIED);
    Ok(())
}
```

```text
192.168.1.1 | 2001:db8::1 | 127.0.0.1:8080 port 8080
v6 socket prints with brackets: [::1]:443
bad input -> true
built 127.0.0.1:7878 | is_ipv4 true | loopback true
classification: private true multicast true unspecified true
v6 loopback true | mapped ::ffff:127.0.0.1
localhost:80 resolved to 3 address(es), all loopback: true
unresolvable -> Some(Uncategorized)
0.0.0.0 means every interface: 0.0.0.0
```

(How many addresses `localhost` resolves to depends on your `/etc/hosts` and whether IPv6 is enabled — two or three is typical. The `ErrorKind` for a failed lookup isn't standardised either, so don't match on it.)

| Type | Is | Notes |
|---|---|---|
| `IpAddr` | `V4(Ipv4Addr)` or `V6(Ipv6Addr)` | `is_loopback`, `is_multicast`, `is_unspecified` |
| `Ipv4Addr` | four octets | `LOCALHOST` (127.0.0.1), `UNSPECIFIED` (0.0.0.0), `BROADCAST`, `is_private` |
| `Ipv6Addr` | eight groups | `LOCALHOST` (`::1`), `to_ipv6_mapped` from v4 |
| `SocketAddr` | IP + port | `SocketAddr::new(ip, port)`, `.ip()`, `.port()`, `set_port` |
| `ToSocketAddrs` | trait | implemented for `&str`, `(&str, u16)`, `SocketAddr`, `(IpAddr, u16)`, … |

> [!warning] `bind("127.0.0.1:p")` is private; `bind("0.0.0.0:p")` is public
> Binding to `127.0.0.1` (or `::1`) accepts connections **only from this machine** — right for a dev server, a local admin port, or a test. Binding to `0.0.0.0` accepts on *every* network interface, which on a cloud host means the open internet. Getting this wrong is one of the most common ways a service is accidentally exposed, so make the choice deliberately, and note that "it worked on my laptop" is exactly what a wrong choice looks like. Also remember `to_socket_addrs()` may yield several addresses: a robust client tries them in order rather than only the first, which is what `TcpStream::connect` does for you.

## Handling many clients

The server above handles one client at a time. To serve several, spawn a [thread](#/ch/threads) per connection:

```rust,ignore
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;

fn handle(mut stream: TcpStream) -> std::io::Result<()> {
    let mut buf = [0u8; 512];
    let n = stream.read(&mut buf)?;
    stream.write_all(&buf[..n])
}

fn main() -> std::io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:7878")?;
    for stream in listener.incoming() {
        let stream = stream?;
        thread::spawn(move || { let _ = handle(stream); }); // one thread per client
    }
    Ok(())
}
```

> [!warning] `std::net` is blocking — it doesn't scale to tens of thousands of connections
> Each `std::net` call **blocks** its thread until it completes, and thread-per-connection works fine up to hundreds or low thousands of clients. Beyond that (a high-traffic server), one thread per connection exhausts memory and the scheduler. That's exactly the problem [**async**](#/ch/async-intro) solves: `tokio::net` offers the same `TcpListener`/`TcpStream` API but *non-blocking*, letting a few threads juggle 100,000+ connections. Use `std::net` for simple tools and clients; reach for tokio for scalable servers.

> [!best] Give every connection a timeout and a bounded read
> A thread-per-connection server has two easy denial-of-service holes: a client that connects and says nothing occupies a thread forever, and a client that streams endlessly can grow your `Vec` until the process dies. Fix both at the top of the handler — `stream.set_read_timeout(Some(Duration::from_secs(30)))?` and read through `stream.take(MAX_REQUEST_BYTES)` so the size limit is enforced by the type system rather than by hope.

## UDP datagrams

**`UdpSocket`** sends and receives independent packets — no connection, no guaranteed delivery. The trade-offs are visible in the API:

```rust
use std::net::UdpSocket;
use std::time::Duration;

fn main() -> std::io::Result<()> {
    let a = UdpSocket::bind("127.0.0.1:0")?;   // port 0: the OS picks a free port
    let b = UdpSocket::bind("127.0.0.1:0")?;
    let (a_addr, b_addr) = (a.local_addr()?, b.local_addr()?);

    // Datagrams keep their boundaries: two sends are two receives, never merged.
    a.send_to(b"first", b_addr)?;
    a.send_to(b"second", b_addr)?;
    let mut buf = [0u8; 64];
    for _ in 0..2 {
        let (n, from) = b.recv_from(&mut buf)?;
        println!("got {:?} from our own port: {}", String::from_utf8_lossy(&buf[..n]), from == a_addr);
    }

    // A buffer that is too small SILENTLY TRUNCATES the datagram -- the rest is gone.
    a.send_to(b"0123456789", b_addr)?;
    let mut small = [0u8; 4];
    let (n, _) = b.recv_from(&mut small)?;
    println!("asked for 4 bytes of a 10-byte datagram: got {n} = {:?}",
             String::from_utf8_lossy(&small[..n]));

    // connect() on UDP just sets a default peer -- no handshake, no guarantees.
    b.connect(a_addr)?;
    b.send(b"reply")?;
    let (n, _) = a.recv_from(&mut buf)?;
    println!("connected send/recv: {:?}", String::from_utf8_lossy(&buf[..n]));

    // Nothing coming? A timeout is the only way to avoid waiting forever.
    b.set_read_timeout(Some(Duration::from_millis(50)))?;
    println!("no datagram waiting -> {:?}", b.recv(&mut buf).err().map(|e| e.kind()));

    // Unreliability is the deal: a datagram sent nowhere is simply lost, no error.
    println!("send to a dead port succeeded anyway: {}",
             a.send_to(b"into the void", "127.0.0.1:1").is_ok());
    Ok(())
}
```

```text
got "first" from our own port: true
got "second" from our own port: true
asked for 4 bytes of a 10-byte datagram: got 4 = "0123"
connected send/recv: "reply"
no datagram waiting -> Some(WouldBlock)
send to a dead port succeeded anyway: true
```

| TCP | UDP |
|---|---|
| a connection (`accept`/`connect` handshake) | no connection; `connect` only remembers a default peer |
| a byte stream — **you** frame the messages | datagrams keep their boundaries for free |
| reliable and ordered, with retransmission | may be lost, duplicated, or reordered — silently |
| `read` returning `0` means EOF | there is no EOF; only timeouts tell you nothing is coming |
| a too-small buffer just means "read again" | a too-small buffer **discards the rest of the datagram** |
| flow control included | you must pace yourself or drop packets |

> [!mistake] Sizing a UDP receive buffer by guesswork
> `recv_from` into a 4-byte buffer took 4 bytes of a 10-byte datagram and threw the other 6 away, with no error and no way to get them back. Always allocate a buffer at least as large as the biggest datagram your protocol allows — 1,472 bytes is the classic "fits in one Ethernet frame without fragmenting" figure, and 65,507 is the theoretical maximum payload. And because `send_to` succeeding tells you *nothing* about arrival (as the last line shows), any UDP protocol that cares needs its own acknowledgements, sequence numbers, and retries. At which point, consider whether you wanted TCP or QUIC.

## Where `std` stops

> [!best] For real protocols, use higher-level crates
> `std::net` gives you raw TCP/UDP — bytes in, bytes out. For actual application protocols, build on the ecosystem: **`reqwest`** for HTTP clients, **`axum`**/`actix-web` for HTTP servers, `tokio-tungstenite` for WebSockets, `quinn` for QUIC. You'll rarely hand-roll a protocol over raw `std::net`; understand it as the foundation, then use the crate that fits your protocol.

| Not in `std` | Use |
|---|---|
| TLS / HTTPS | `rustls` (pure Rust) or `native-tls` |
| HTTP client / server | `reqwest` / `axum`, `actix-web` |
| async sockets | `tokio::net`, `async-std` |
| DNS beyond `to_socket_addrs` | `hickory-resolver` |
| raw sockets, ICMP, packet capture | `socket2`, `pnet` |
| Unix domain sockets | in `std`, but platform-gated: `std::os::unix::net::{UnixStream, UnixListener}` |

## Summary

- `std::net` provides **blocking** networking: **`TcpListener`**/**`TcpStream`** for reliable ordered streams, **`UdpSocket`** for connectionless datagrams.
- A `TcpStream` implements **`Read` + `Write`**, so `BufReader`, `read_exact`, and `write_all` all apply — bind to port **`0`** and read `local_addr()` to write tests with no hard-coded ports.
- **TCP has no message boundaries.** Three writes can arrive as one read and one write as 1,563 reads (both measured above), so pick a framing scheme — **length prefix** or **delimiter** — before sending a byte.
- **`read` returning `Ok(0)` is EOF**, not "nothing yet"; "nothing yet" is `WouldBlock` on a non-blocking socket. `shutdown(Write)` sends EOF while keeping your read side open.
- Set **timeouts** (`set_read_timeout`, `connect_timeout`) on anything talking to a network you don't control, and know that a timeout surfaces as `WouldBlock` on Unix, `TimedOut` on Windows.
- Addresses are `IpAddr`/`SocketAddr`; names go through the blocking `ToSocketAddrs` resolution and may give several addresses. **`127.0.0.1` is local-only, `0.0.0.0` is every interface** — choose deliberately.
- UDP keeps datagram boundaries but **silently truncates** into a small buffer, never reports loss, and has no EOF.
- Thread-per-connection is fine into the low thousands; past that use **`tokio::net`**. For TLS, HTTP, and WebSockets, use the crates.

> [!exercise] Try it yourself
> 1. Run the in-process echo example, then change the client to send 100 KB and confirm the server needs a read loop to get it all.
> 2. Write a length-prefixed protocol both ways: `send_msg(&mut impl Write, &[u8])` and `recv_msg(&mut impl Read) -> io::Result<Vec<u8>>`, and round-trip ten messages of random sizes over a loopback socket.
> 3. Parse `"8.8.8.8:53"` into a `SocketAddr` and print its IP and port; then build the same value with `SocketAddr::new`.
> 4. Turn the echo server into a line-based one: `BufReader::new(stream.try_clone()?)`, `read_line`, respond, and stop cleanly when `read_line` returns `0`.
> 5. Add `set_read_timeout(Some(2s))` to a handler and confirm a client that connects but sends nothing is dropped instead of holding the thread forever.
> 6. Serve two clients at once with thread-per-connection, and have each client print which port it was assigned.
> 7. Build a tiny UDP ping/pong that measures round-trip time with `Instant`, then send a datagram larger than your receive buffer and observe the truncation.
> 8. Write a minimal HTTP/1.0 client over `TcpStream`: send `GET / HTTP/1.0\r\nHost: example.com\r\n\r\n`, read to EOF, and split the headers from the body on the first blank line. (Then look at how much `reqwest` was doing for you.)

The final `std` reference covers the synchronization primitives you use for concurrency, gathered in one place — **`std::sync`**.
