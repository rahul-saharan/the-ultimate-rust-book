<h1><span class="h1-kicker">The Standard Library, Deep</span>std::net — TCP & UDP</h1>

Rust's `std::net` provides **blocking** (synchronous) networking: TCP for reliable, ordered connections (HTTP, databases, SSH) and UDP for fast, connectionless datagrams (games, DNS, streaming). It's the foundation the async runtimes build on. This reference covers building clients and servers with the standard library. (Network code can't run in the in-book playground, so examples here are illustrative — run them locally.)

## TCP vs. UDP

> [!jargon] TCP and UDP
> **TCP** (Transmission Control Protocol) gives you a reliable, ordered *stream* of bytes — like a phone call: a connection is established, and everything you send arrives in order or you're told it failed. **UDP** (User Datagram Protocol) sends independent *packets* with no connection and no delivery guarantee — like postcards: fast and lightweight, but some may arrive out of order or not at all. Use TCP when correctness matters (almost always); use UDP when low latency beats reliability (real-time games, live audio).

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

<figure class="diagram">
<svg viewBox="0 0 640 140" role="img" aria-label="A TCP server binds and accepts connections; a client connects, then both read and write over the stream">
  <style>
    .ntm { font: 600 11px var(--font-mono); fill: var(--text); }
    .ntc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .srv { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .cli { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
  </style>
  <rect x="20" y="40" width="200" height="60" rx="10" class="srv"/><text x="34" y="64" class="ntm">TcpListener::bind</text><text x="34" y="84" class="ntc">accept() → TcpStream</text>
  <rect x="420" y="40" width="200" height="60" rx="10" class="cli"/><text x="434" y="64" class="ntm">TcpStream::connect</text><text x="434" y="84" class="ntc">write / read</text>
  <path d="M420 60 L222 60" stroke="var(--blue)" stroke-width="2" marker-end="url(#ant)"/>
  <text x="255" y="52" class="ntc">connect + write →</text>
  <path d="M222 82 L418 82" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#ant2)"/>
  <text x="270" y="100" class="ntc">← response</text>
  <defs>
    <marker id="ant" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--blue)"/></marker>
    <marker id="ant2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker>
  </defs>
</svg>
<figcaption>A <code>TcpStream</code> implements <code>Read</code>+<code>Write</code>, so all your <code>std::io</code> skills apply directly to the network.</figcaption>
</figure>

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

## UDP datagrams

**`UdpSocket`** sends and receives independent packets — no connection, no guaranteed delivery:

```rust,ignore
use std::net::UdpSocket;

fn main() -> std::io::Result<()> {
    let socket = UdpSocket::bind("127.0.0.1:8080")?;
    socket.send_to(b"ping", "127.0.0.1:9090")?; // fire a packet at a target

    let mut buf = [0u8; 1024];
    let (n, from) = socket.recv_from(&mut buf)?; // receive a packet + sender addr
    println!("got {n} bytes from {from}");
    Ok(())
}
```

## Addresses

Addresses are modeled by `SocketAddr` (an IP + port) and `IpAddr` (`V4`/`V6`). Most APIs accept `impl ToSocketAddrs`, so you can pass a `&str` like `"127.0.0.1:8080"` directly (it's parsed and DNS-resolved for you):

```rust
use std::net::{IpAddr, SocketAddr};

fn main() {
    let ip: IpAddr = "192.168.1.1".parse().unwrap();
    let addr: SocketAddr = "127.0.0.1:8080".parse().unwrap();
    println!("ip = {ip}, addr = {addr}, port = {}", addr.port());
}
```

> [!best] For real protocols, use higher-level crates
> `std::net` gives you raw TCP/UDP — bytes in, bytes out. For actual application protocols, build on the ecosystem: **`reqwest`** for HTTP clients, **`axum`**/`actix-web` for HTTP servers, `tokio-tungstenite` for WebSockets, `quinn` for QUIC. You'll rarely hand-roll a protocol over raw `std::net`; understand it as the foundation, then use the crate that fits your protocol.

## Summary

- `std::net` provides **blocking** networking: **`TcpListener`**/**`TcpStream`** for reliable ordered streams, **`UdpSocket`** for fast connectionless datagrams.
- A `TcpStream` implements **`Read` + `Write`**, so all your `std::io` knowledge (and `BufReader`/`BufWriter`) applies directly.
- Serve multiple clients with a **thread per connection** — fine up to ~thousands; beyond that, use **async (`tokio::net`)**.
- Addresses are `SocketAddr`/`IpAddr`, and most APIs accept a `&str` via `ToSocketAddrs`.
- For real protocols, build on crates (**`reqwest`**, **`axum`**, …) rather than raw sockets.

> [!exercise] Try it yourself (locally)
> 1. Build the TCP echo server, then connect to it with the client (or `nc 127.0.0.1 7878`) and see your bytes echoed.
> 2. Add thread-per-connection handling and connect two clients at once.
> 3. Parse `"8.8.8.8:53"` into a `SocketAddr` and print its IP and port.

The final `std` reference covers the synchronization primitives you use for concurrency, gathered in one place — **`std::sync`**.
