<h1><span class="h1-kicker">The Crate Ecosystem</span>tonic: gRPC Services</h1>

[axum](#/ch/axum) builds HTTP/JSON APIs. But when services talk to *each other* — especially in high-throughput microservice systems — they often use **gRPC** instead: a faster, strongly-typed, streaming-capable protocol. **tonic** is the leading gRPC implementation for Rust, built on [tokio](#/ch/tokio). This chapter introduces gRPC and shows how to build a tonic service and client. (tonic needs its crates and a `.proto` compiler, so the examples are illustrative — run them in a local project.)

## What is gRPC?

> [!jargon] gRPC and Protocol Buffers
> **gRPC** is a framework for **remote procedure calls (RPC)** — calling a function on another
> server as if it were local. Instead of JSON over HTTP, it uses **Protocol Buffers** ("protobuf")
> — a compact, strongly-typed *binary* format — sent over **HTTP/2**. You define your service and
> its message types once in a `.proto` file, and a code generator produces the client and server
> types in your language. The result is faster, smaller on the wire, and type-checked end to end.

> [!key] gRPC vs. REST — when to use which
> - **REST/JSON** ([axum](#/ch/axum), [reqwest](#/ch/reqwest)) — human-readable, universally
>   supported, great for public APIs and browser clients.
> - **gRPC** (tonic) — binary and fast, with a strict contract shared by client and server, and
>   built-in **streaming**. Ideal for **service-to-service** communication inside a system where you
>   control both ends and care about performance and type safety.
>
> Rule of thumb: expose a **REST** API to the outside world; use **gRPC** between your internal
> services. Many systems use both.

## The `.proto` contract

Everything in gRPC starts with a `.proto` file — the single source of truth for your service's
methods and message shapes. Both client and server are generated from it:

```protobuf
// proto/greeter.proto
syntax = "proto3";
package greeter;

service Greeter {
  // A method: takes a HelloRequest, returns a HelloReply.
  rpc SayHello (HelloRequest) returns (HelloReply);
}

message HelloRequest {
  string name = 1;   // the "= 1" is the field's wire number, not a value
}

message HelloReply {
  string message = 1;
}
```

## Setup and code generation

tonic uses a **build script** (`build.rs`) to compile your `.proto` into Rust at build time via
`tonic-build`:

```toml
# Cargo.toml
[dependencies]
tonic = "0.12"
prost = "0.13"                       # the protobuf runtime
tokio = { version = "1", features = ["full"] }

[build-dependencies]
tonic-build = "0.12"
```

```rust,ignore
// build.rs — runs before compilation, generates Rust from the .proto
fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::compile_protos("proto/greeter.proto")?;
    Ok(())
}
```

This generates, from the contract: the message structs (`HelloRequest`, `HelloReply`), a `Greeter`
**server trait** for you to implement, and a `GreeterClient` ready to call.

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="A gRPC client and server both generated from one proto file, communicating with protobuf over HTTP/2">
  <style>
    .tnm { font: 600 12px var(--font-mono); fill: var(--text); }
    .tnc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .proto { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.5; }
    .cli { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .srv { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="245" y="12" width="150" height="30" class="proto"/><text x="259" y="32" class="tnm">greeter.proto</text>
  <rect x="30" y="80" width="160" height="42" class="cli"/><text x="44" y="104" class="tnm">GreeterClient</text><text x="44" y="118" class="tnc">generated</text>
  <rect x="450" y="80" width="160" height="42" class="srv"/><text x="464" y="104" class="tnm">Greeter server</text><text x="464" y="118" class="tnc">you implement</text>
  <path d="M290 42 L150 78" stroke="var(--purple)" stroke-width="1.5" marker-end="url(#atn)"/>
  <path d="M350 42 L500 78" stroke="var(--purple)" stroke-width="1.5" marker-end="url(#atn)"/>
  <path d="M190 95 L448 95" stroke="var(--text-mute)" stroke-width="2" marker-end="url(#atn2)"/>
  <path d="M448 108 L192 108" stroke="var(--text-mute)" stroke-width="2" marker-end="url(#atn3)"/>
  <text x="245" y="92" class="tnc">protobuf / HTTP/2 →</text>
  <text x="290" y="122" class="tnc">← reply</text>
  <defs>
    <marker id="atn" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--purple)"/></marker>
    <marker id="atn2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker>
    <marker id="atn3" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker>
  </defs>
</svg>
<figcaption>One <code>.proto</code> generates both the client and the server trait; they exchange protobuf messages over HTTP/2.</figcaption>
</figure>

## Implementing the server

You implement the generated trait — each `rpc` becomes an `async fn`. Note how the request and
response types are exactly the messages from the `.proto`:

```rust,ignore
use tonic::{transport::Server, Request, Response, Status};
use greeter::greeter_server::{Greeter, GreeterServer};
use greeter::{HelloRequest, HelloReply};

pub mod greeter {
    tonic::include_proto!("greeter"); // pulls in the generated code
}

#[derive(Default)]
struct MyGreeter;

#[tonic::async_trait]
impl Greeter for MyGreeter {
    async fn say_hello(
        &self,
        request: Request<HelloRequest>,
    ) -> Result<Response<HelloReply>, Status> {
        let name = request.into_inner().name;
        let reply = HelloReply { message: format!("Hello, {name}!") };
        Ok(Response::new(reply))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let addr = "[::1]:50051".parse()?;
    Server::builder()
        .add_service(GreeterServer::new(MyGreeter::default()))
        .serve(addr)
        .await?;
    Ok(())
}
```

## Calling it from a client

The generated client makes the remote call look almost like a local method call — fully typed:

```rust,ignore
use greeter::greeter_client::GreeterClient;
use greeter::HelloRequest;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = GreeterClient::connect("http://[::1]:50051").await?;

    let request = tonic::Request::new(HelloRequest { name: "Ferris".into() });
    let response = client.say_hello(request).await?;

    println!("server said: {}", response.into_inner().message);
    Ok(())
}
```

## Streaming

A big advantage of gRPC over plain REST is **streaming** — thanks to HTTP/2, a single call can send
or receive a *stream* of messages. gRPC supports four call types:

| Call type | Shape |
|-----------|-------|
| Unary | one request → one response (what we built) |
| Server streaming | one request → a stream of responses |
| Client streaming | a stream of requests → one response |
| Bidirectional | streams flowing both ways at once |

tonic models the streaming types with async [Streams](#/ch/async-patterns), so a chat server or a
live data feed is a natural fit.

> [!best] When tonic is the right tool
> Reach for tonic/gRPC when you're building **internal service-to-service communication** and want a
> strict, versioned contract, small fast binary messages, and streaming — microservices, data
> pipelines, and mobile backends are classic cases. For **public** or browser-facing APIs, prefer
> REST/JSON with [axum](#/ch/axum) (browsers can't speak raw gRPC without a proxy). The `.proto`
> contract is the star: it keeps client and server in lockstep across languages, since gRPC
> generates code for many languages from the same file.

## Summary

- **gRPC** is an RPC framework using **Protocol Buffers** (compact, typed, binary) over **HTTP/2**;
  **tonic** is Rust's leading gRPC library, built on tokio.
- You define the service and messages once in a **`.proto`** file; **`tonic-build`** (via `build.rs`)
  generates the message structs, a **server trait** to implement, and a ready-to-use **client**.
- Implement each `rpc` as an `async fn` on the generated trait; call it from the generated client as
  if it were local — fully typed end to end.
- gRPC supports **unary and streaming** calls (server-, client-, and bidirectional).
- Use **gRPC/tonic for internal services** (speed, strict contracts, streaming); use **REST/axum for
  public and browser-facing APIs**.

> [!exercise] Try it yourself (in a local project)
> 1. Write the `greeter.proto`, wire up `build.rs`, and run the server and client to see "Hello,
>    Ferris!" round-trip over gRPC.
> 2. Add a second method, e.g. `rpc AddNumbers(AddRequest) returns (AddReply)`, and implement it.
> 3. Explore a **server-streaming** method that sends back a sequence of messages.

Whether a service speaks REST or gRPC, it usually needs to store data — and databases speak
**SQL**. Next, a primer on SQL for MySQL and PostgreSQL.
