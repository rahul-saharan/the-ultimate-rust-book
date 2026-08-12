<h1><span class="h1-kicker">The Crate Ecosystem</span>tracing: Logging & Diagnostics</h1>

When your program runs in production, you can't attach a debugger — you rely on what it *logged*. Rust's **tracing** crate is the modern standard: structured, level-based, and — crucially — **async-aware**, so you can follow a single request as it hops across tasks and threads. This chapter covers logging and instrumentation with tracing. (tracing's output goes to a configured subscriber, so examples are illustrative — run them locally.)

## Events: structured log messages

tracing's **events** are log messages, emitted at a severity **level**. Unlike plain `println!`, they carry structured key–value fields, not just text:

```rust
// Cargo.toml:
//   tracing = "0.1"
//   tracing-subscriber = "0.3"

use tracing::{info, warn, error, debug};

fn main() {
    // Install a subscriber that prints events (do this once, at startup).
    // `with_max_level` shows DEBUG too; the default would hide it.
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .with_target(false)   // drop the module path, for a tidier demo
        .init();

    let user = "ferris";
    let attempts = 3;

    info!("application started");
    debug!(user, attempts, "processing login");        // structured fields!
    warn!(user, "unusual activity detected");
    error!(code = 500, "request failed");

    // Fields can be renamed, computed, or captured with `%` (Display) / `?` (Debug):
    let ids = vec![1, 2, 3];
    info!(count = ids.len(), ?ids, "batch ready");
}
```

Run it and each line arrives with a timestamp, a level, the fields, and the message:

```text
2026-08-13T10:14:22.031Z  INFO application started
2026-08-13T10:14:22.031Z DEBUG processing login user="ferris" attempts=3
2026-08-13T10:14:22.031Z  WARN unusual activity detected user="ferris"
2026-08-13T10:14:22.031Z ERROR request failed code=500
2026-08-13T10:14:22.031Z  INFO batch ready count=3 ids=[1, 2, 3]
```

> [!tip] `%` and `?` are the two sigils to remember
> A field value must implement `Value`, which covers primitives and strings. For anything else, prefix it: **`%thing`** records it via `Display`, **`?thing`** via `Debug`. So `error!(%err, "request failed")` logs the human-readable error, while `info!(?config, "loaded")` dumps the struct. Without a sigil you'd get a type error — this is the single most common first stumble with `tracing`.

Note `debug!(user, attempts, "…")` — `user` and `attempts` are attached as **fields**, not smushed into the message string. A subscriber can render them as text *or* as JSON for machine processing.

> [!key] The two halves: producing vs. consuming
> tracing splits cleanly: your code **produces** events/spans with the `info!`/`warn!`/`span!` macros (cheap and always present), and a **subscriber** (from `tracing-subscriber`) decides what to *do* with them — print to the console, format as JSON, filter by level, ship to a log aggregator. You instrument once; you configure output separately. Swap console logs for JSON in production by changing only the subscriber setup, not your code.

## Levels and filtering

Events have five levels, from most to least verbose: **`trace`**, **`debug`**, **`info`**, **`warn`**, **`error`**. You filter which ones are emitted at runtime — usually via the `RUST_LOG` environment variable — so you can crank up detail when debugging without recompiling:

```bash
RUST_LOG=debug cargo run     # show debug and above
RUST_LOG=info cargo run       # show info and above (typical production)
RUST_LOG=myapp=trace,warn cargo run  # trace for your crate, warn for the rest
```

```rust,ignore
use tracing_subscriber::EnvFilter;

fn main() {
    // Honor the RUST_LOG env var for filtering:
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();
    // ... your app ...
}
```

| Level | Use for |
|-------|---------|
| `error!` | something failed and needs attention |
| `warn!` | something unexpected but recoverable |
| `info!` | high-level milestones (server started, request handled) |
| `debug!` | detailed flow for diagnosing issues |
| `trace!` | very fine-grained, firehose-level detail |

## Spans: the async superpower

Here's what sets tracing apart from old-style loggers. A **span** represents a *period of time* with context — "handling this request", "running this query". Events that happen *inside* a span are automatically tagged with the span's context, so you can follow one request's whole journey even across `await` points and threads:

```rust
use tracing::{info, instrument};

// The #[instrument] attribute wraps a function in a span automatically,
// recording its arguments as fields:
#[instrument]
async fn handle_request(user_id: u64) {
    info!("starting to handle request"); // tagged with user_id automatically
    fetch_data(user_id, "s3cr3t42").await;
    info!("request complete");
}

// `skip` keeps a noisy or sensitive argument out of the log.
#[instrument(skip(token))]
async fn fetch_data(user_id: u64, token: &str) {
    info!(len = token.len(), "querying database"); // still tagged with user_id
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_target(false)
        .init();

    handle_request(42).await;
}

// The span name and its fields prefix every event inside it:
//   INFO handle_request{user_id=42}: starting to handle request
//   INFO handle_request{user_id=42}:fetch_data{user_id=42}: querying database len=8
//   INFO handle_request{user_id=42}: request complete
```

Run it and look at the prefix on each line: `handle_request{user_id=42}:fetch_data{user_id=42}:`. That nesting is the whole point — the innermost event carries the full chain of context it happened inside, with no manual plumbing.

> [!warning] `#[instrument]` records *every* argument by default
> That includes passwords, tokens, and whole request bodies, which then land in your logs. Use **`skip`** (as above) or `skip_all` and re-add just what you need:
> ```rust,ignore
> #[instrument(skip_all, fields(user_id = %req.user_id))]
> async fn handle(req: Request) { /* … */ }
> ```
> Also note that arguments must implement `Debug` for `#[instrument]` to record them — add `skip` for anything that doesn't, or the function won't compile.

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="A span provides context that automatically tags all events within it, even across async calls">
  <style>
    .trm2 { font: 600 11px var(--font-mono); fill: var(--text); }
    .trc2 { font: 11px var(--font-sans); fill: var(--text-mute); }
    .span { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.5; }
    .evt { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="20" y="20" width="600" height="110" rx="10" class="span"/>
  <text x="36" y="42" class="trm2" fill="var(--purple)">span: handle_request { user_id = 42 }</text>
  <rect x="40" y="54" width="250" height="26" class="evt"/><text x="52" y="72" class="trm2">info!("starting")  ← tagged user_id=42</text>
  <rect x="40" y="88" width="560" height="30" rx="6" class="span"/>
  <text x="54" y="107" class="trm2" fill="var(--purple)">span: fetch_data { user_id = 42 } → info!("querying") ← still tagged user_id=42</text>
</svg>
<figcaption>A <b>span</b> gives every event inside it (even in nested async calls) the same contextual fields — the key to tracing one request across a whole system.</figcaption>
</figure>

> [!key] Why spans matter for async and concurrency
> In a server handling thousands of concurrent requests across many threads, plain log lines are useless soup — you can't tell which line belongs to which request. tracing's spans stamp every event with its request's context, so you can filter the logs down to *one* request's complete story, even as it bounced across tasks and `await`s. This is the single biggest reason to use tracing over a basic logger in async services.

## tracing vs. `log`

The older **`log`** crate (with `env_logger`) is simpler and fine for basic command-line tools — `log::info!("message")` with no spans or structured fields. Reach for **tracing** when you have **async code**, **concurrency**, or need **structured, filterable** diagnostics. Conveniently, tracing can consume `log`'s events too, so libraries using either integrate.

> [!best] Instrument at boundaries, log meaningfully
> Good practice: put **`#[instrument]`** on your important boundary functions (request handlers, key operations) so they get spans with their arguments for free; emit **`info!`** at meaningful milestones, **`error!`**/`warn!` on problems (with structured fields, not string-concatenated values), and reserve **`debug!`/`trace!`** for detail you toggle via `RUST_LOG`. Avoid logging in tight inner loops — it adds up. Aim for logs that tell the *story* of what happened, filterable by level and span.

## Summary

- **tracing** is the modern structured-logging framework: emit **events** at levels (`error!`→`trace!`) with **structured fields**, not just strings.
- It splits **producing** (your `info!`/`span!` macros) from **consuming** (a **subscriber** from `tracing-subscriber` that formats/filters/ships them) — change output without changing code.
- Filter at runtime with **`RUST_LOG`** (`EnvFilter`) — no recompile needed.
- **Spans** (via **`#[instrument]`**) attach context to everything inside them, letting you follow one request across async tasks and threads — the killer feature for concurrent services.
- Use the simpler **`log`** crate for basic tools; use **tracing** for async/concurrent/structured needs. Instrument boundaries; log meaningfully, not in hot loops.

> [!exercise] Try it yourself (locally)
> 1. Initialize `tracing_subscriber::fmt` and emit `info!`, `warn!`, and `error!` events with structured fields.
> 2. Add `#[instrument]` to a function and confirm its arguments appear in the log output.
> 3. Run with `RUST_LOG=debug` vs `RUST_LOG=info` and observe the difference in verbosity.

You can build, store, observe, and communicate. Once you've made something worth sharing, the next
chapters cover the utility crates you'll reach for constantly — starting with the one `std`
deliberately leaves out: **random numbers**.
