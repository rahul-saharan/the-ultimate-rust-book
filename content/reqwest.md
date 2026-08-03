<h1><span class="h1-kicker">The Crate Ecosystem</span>reqwest: HTTP Clients</h1>

When your program needs to *talk* to the web — call a REST API, download a file, scrape a page — **reqwest** is the go-to HTTP client. It's built on [tokio](#/ch/tokio) and [serde](#/ch/serde), so making a request, getting JSON back, and deserializing it into a struct is just a few lines. This chapter covers the essentials. (Network calls can't run in the in-book playground, so examples are illustrative — run them locally.)

## A simple GET request

reqwest has an **async** API (the default, for real apps) and a **blocking** one (for scripts and simple tools). Here's an async GET fetching text:

```rust,ignore
// Cargo.toml:  reqwest = { version = "0.12", features = ["json"] }
//              tokio = { version = "1", features = ["full"] }

#[tokio::main]
async fn main() -> Result<(), reqwest::Error> {
    let body = reqwest::get("https://httpbin.org/ip")
        .await?            // await the response
        .text()            // read the body as text
        .await?;
    println!("{body}");
    Ok(())
}
```

For a quick script without setting up async, use the blocking client (enable the `blocking` feature):

```rust,ignore
// features = ["blocking", "json"]
fn main() -> Result<(), reqwest::Error> {
    let body = reqwest::blocking::get("https://httpbin.org/ip")?.text()?;
    println!("{body}");
    Ok(())
}
```

> [!key] Async client for apps, blocking for scripts
> Use the **async** API (`reqwest::get`, `.await`) inside async applications — it lets one thread juggle many in-flight requests. Use the **blocking** API (`reqwest::blocking`) for simple command-line tools and scripts where you just want a result and don't have (or want) a runtime. Don't call the blocking API *inside* an async task — it would stall the executor (use the async one there).

## JSON in and out — the serde superpower

reqwest and serde together make JSON APIs delightful. Deserialize a response straight into your struct with `.json()`:

```rust,ignore
use serde::Deserialize;

#[derive(Deserialize, Debug)]
struct Repo {
    name: String,
    stargazers_count: u32,
}

#[tokio::main]
async fn main() -> Result<(), reqwest::Error> {
    let repo: Repo = reqwest::Client::new()
        .get("https://api.github.com/repos/rust-lang/rust")
        .header("User-Agent", "my-app") // GitHub requires a User-Agent
        .send()
        .await?
        .json()           // parse the JSON body directly into Repo!
        .await?;

    println!("{} has {} stars ⭐", repo.name, repo.stargazers_count);
    Ok(())
}
```

Sending JSON in a POST is just as clean with `.json(&value)`:

```rust,ignore
use serde::Serialize;

#[derive(Serialize)]
struct NewUser { name: String, email: String }

#[tokio::main]
async fn main() -> Result<(), reqwest::Error> {
    let user = NewUser { name: "Ferris".into(), email: "ferris@crab.dev".into() };

    let response = reqwest::Client::new()
        .post("https://httpbin.org/post")
        .json(&user)      // serializes the struct to a JSON request body
        .send()
        .await?;

    println!("status: {}", response.status());
    Ok(())
}
```

## The `Client` — reuse it

For more than one request, create a **`Client`** once and reuse it. It holds a connection pool, so reusing it makes subsequent requests to the same host much faster:

```rust,ignore
#[tokio::main]
async fn main() -> Result<(), reqwest::Error> {
    let client = reqwest::Client::new(); // build ONCE, reuse everywhere

    for id in 1..=3 {
        let url = format!("https://httpbin.org/anything/{id}");
        let status = client.get(&url).send().await?.status();
        println!("request {id}: {status}");
    }
    Ok(())
}
```

> [!performance] Reuse the `Client`; don't make one per request
> `reqwest::Client::new()` sets up a connection pool and TLS configuration — creating a fresh one for every request throws that away and forces a new connection each time. Build **one** `Client` (or a few) at startup and clone/share it (`Client` is cheap to clone — it's internally reference-counted). This is one of the most common reqwest performance mistakes.

<figure class="diagram">
<svg viewBox="0 0 640 130" role="img" aria-label="reqwest builds a request, sends it, and deserializes the JSON response into a struct">
  <style>
    .rqm { font: 600 11px var(--font-mono); fill: var(--text); }
    .rqc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .step { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="14" y="40" width="130" height="40" class="step"/><text x="26" y="64" class="rqm">client.get(url)</text>
  <rect x="164" y="40" width="120" height="40" class="step"/><text x="176" y="64" class="rqm">.json(&amp;body)?</text>
  <rect x="304" y="40" width="110" height="40" class="step"/><text x="316" y="64" class="rqm">.send().await</text>
  <rect x="434" y="40" width="180" height="40" class="step"/><text x="446" y="64" class="rqm">.json::&lt;T&gt;().await → T</text>
  <path d="M144 60 L162 60" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#arq)"/>
  <path d="M284 60 L302 60" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#arq)"/>
  <path d="M414 60 L432 60" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#arq)"/>
  <text x="20" y="110" class="rqc">Build → send → deserialize. serde turns the JSON body straight into your Rust struct.</text>
  <defs><marker id="arq" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>The reqwest flow: build a request, send it, and deserialize the response — serde does the JSON.</figcaption>
</figure>

## Handling responses properly

A request succeeding at the network level doesn't mean the *server* was happy (it might return 404 or 500). Check the status, and use `error_for_status()` to turn HTTP error codes into `Err`:

```rust,ignore
#[tokio::main]
async fn main() -> Result<(), reqwest::Error> {
    let resp = reqwest::get("https://httpbin.org/status/404").await?;

    println!("status: {}", resp.status()); // 404 Not Found
    println!("is success? {}", resp.status().is_success()); // false

    // Turn a non-2xx status into an Err so ? propagates it:
    // let resp = resp.error_for_status()?;
    Ok(())
}
```

> [!best] Don't forget timeouts and error handling
> Network calls fail and hang. In real code: set a **timeout** on the client (`Client::builder().timeout(Duration::from_secs(10)).build()?`) so a slow server can't hang your program forever; call **`error_for_status()`** to treat 4xx/5xx as errors; and wrap it all with [anyhow's `.context()`](#/ch/anyhow-thiserror) so failures are debuggable. A GET with no timeout and unchecked status is a common source of production hangs and silent failures.

## Summary

- **reqwest** is the standard HTTP client, built on **tokio** + **serde**; use the **async** API for apps, the **blocking** API for scripts.
- Deserialize responses straight into structs with **`.json::<T>()`**, and send JSON bodies with **`.json(&value)`** — serde does the heavy lifting.
- Build a **`Client` once and reuse it** (it pools connections; cloning is cheap) — never one per request.
- Check the response **status** (`error_for_status()` converts 4xx/5xx to `Err`), set a **timeout**, and add context to errors.

> [!exercise] Try it yourself (locally)
> 1. GET `https://httpbin.org/uuid` and print the response text.
> 2. Define a struct matching `https://httpbin.org/json` and deserialize the response with `.json()`.
> 3. Build a `Client` with a 5-second timeout and make three requests reusing it.

Fetching data is half the story; serving it is the other. Next: building a web server with **axum**.
