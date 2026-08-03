<h1><span class="h1-kicker">Appendices</span>F · Crates You Can Use in the Playground</h1>

When you press **▶ Run** on a code example, your program is compiled and executed on the official **[Rust Playground](https://play.rust-lang.org)**. The Playground ships with the ~100 most popular crates from crates.io pre-loaded, so a great many `use some_crate::…;` lines *just work* — no `Cargo.toml` needed. This appendix lists the ones most useful while learning, and links each to where the book covers it. The in-book editor's autocomplete also knows these names, so `use ser…` will suggest `serde`.

> [!note] Two limits to remember
> The Playground has **no network access** (so an HTTP request with `reqwest`, or a real TCP/database connection, won't connect — the code compiles but the call fails at runtime) and a **short time/memory budget**. For anything doing real I/O — servers, databases, file writes — copy the example into a local `cargo` project instead. Examples in this book that need that are marked `ignore` (no Run button).

## Commonly used crates on the Playground

| Crate | What it's for | Learn it in |
|---|---|---|
| `serde` / `serde_json` | Serialize & deserialize (JSON and more) | [serde](#/ch/serde) |
| `rand` | Random numbers & sampling | [Essential Crates](#/ch/essential-crates) |
| `regex` | Regular expressions | [regex](#/ch/regex) |
| `itertools` | Extra iterator adapters | [Essential Crates](#/ch/essential-crates) |
| `chrono` | Dates, times & time zones | [Essential Crates](#/ch/essential-crates) · [Time & Duration](#/ch/std-time) |
| `anyhow` | Easy application error handling | [anyhow & thiserror](#/ch/anyhow-thiserror) |
| `thiserror` | Deriving library error types | [anyhow & thiserror](#/ch/anyhow-thiserror) · [Custom Errors](#/ch/custom-errors) |
| `tokio` | Async runtime (tasks, timers, channels) | [The Tokio Runtime](#/ch/tokio) |
| `futures` | Async building blocks (`Stream`, combinators) | [Futures & the Poll Model](#/ch/futures) |
| `rayon` | Data parallelism (`par_iter`) | [Rayon](#/ch/rayon) |
| `clap` | Command-line argument parsing | [clap](#/ch/clap) |
| `tracing` | Structured logging & diagnostics | [tracing](#/ch/tracing) |
| `reqwest` | HTTP client *(compiles, but network is blocked)* | [reqwest](#/ch/reqwest) |
| `once_cell` | Lazy statics & one-time init | [Essential Crates](#/ch/essential-crates) |
| `uuid` | Generate & parse UUIDs | [Essential Crates](#/ch/essential-crates) |

## Using one — no setup required

On the Playground you skip `Cargo.toml` entirely; just `use` the crate:

```rust,ignore
use itertools::Itertools; // available on the Playground out of the box

fn main() {
    let grouped = [1, 1, 2, 3, 3, 3]
        .iter()
        .dedup_with_count()          // an itertools adapter
        .map(|(count, &v)| format!("{v}×{count}"))
        .join(", ");
    println!("{grouped}");           // 1×2, 2×1, 3×3
}
```

In a **local project**, add it to `Cargo.toml` first (`cargo add itertools`) — see [Cargo](#/ch/cargo) and [How to Choose Crates](#/ch/crates-overview).

> [!tip] Finding the full, current list
> The set of bundled crates changes over time. To see exactly what today's Playground offers, open [play.rust-lang.org](https://play.rust-lang.org), click **Tools → Crates**, or browse the list its `Cargo.toml` pins. If a crate you want isn't there, the Playground can't fetch it — run that example locally.

## Crates the book teaches that need a local project

A few crates the book covers rely on things the Playground can't provide (a database, a live network, the filesystem), so their examples are `ignore` and meant for a local `cargo` project:

- [sqlx](#/ch/sqlx) and [SeaORM](#/ch/seaorm) — need a running database.
- [axum](#/ch/axum), [Actix Web](#/ch/actix), and [tonic](#/ch/tonic) — bind a socket and run a server.
- The [file & filesystem](#/ch/io-streams) examples that write to disk.

Everything else in the book — the language itself and the in-memory/CPU crates above — runs live, right here in the browser.
