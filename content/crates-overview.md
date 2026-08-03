<h1><span class="h1-kicker">The Crate Ecosystem</span>How to Choose Crates</h1>

Rust's standard library is deliberately small — it gives you the essentials and leaves the rest to the ecosystem. That ecosystem, on **[crates.io](https://crates.io)**, is one of Rust's greatest strengths: over 150,000 packages covering everything from web servers to game engines. But with that abundance comes a question: *which* crate should you trust? This chapter teaches you to evaluate crates like a professional, before we tour the essential ones.

## Adding a crate

You already know the mechanics from the [Cargo chapter](#/ch/cargo): `cargo add` fetches a crate and records it in `Cargo.toml`:

```bash
cargo add serde --features derive
cargo add tokio --features full
```

The real skill isn't *adding* crates — it's *choosing* the right one from several that do similar things.

## How to evaluate a crate

> [!key] The five signals of a healthy crate
> Before depending on a crate, check:
> 1. **Downloads & reverse-dependencies** (on crates.io) — high numbers mean it's battle-tested and unlikely to vanish.
> 2. **Recent activity** — commits and releases in the last few months signal active maintenance, not abandonment.
> 3. **Documentation** — a good [docs.rs](https://docs.rs) page with examples is a sign of care (and makes *your* life easier).
> 4. **Version ≥ 1.0** — a `1.x` version signals the authors commit to a stable API; `0.x` may still be churning.
> 5. **A reputable author/org** — crates from the `rust-lang`, `tokio-rs`, `serde-rs`, or well-known maintainers are safe bets.
>
> A crate strong on all five is a dependable dependency; weak on several is a risk.

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="Checklist of signals for evaluating a crate's health">
  <style>
    .cvm { font: 600 11px var(--font-mono); fill: var(--text); }
    .cvc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .good { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
  </style>
  <text x="20" y="22" class="cvc">Before you depend on it, check:</text>
  <rect x="20" y="32" width="290" height="26" class="good"/><text x="32" y="50" class="cvm">⬇ downloads high &amp; many dependents</text>
  <rect x="20" y="62" width="290" height="26" class="good"/><text x="32" y="80" class="cvm">🕐 released/committed recently</text>
  <rect x="20" y="92" width="290" height="26" class="good"/><text x="32" y="110" class="cvm">📖 real docs + examples on docs.rs</text>
  <rect x="330" y="32" width="290" height="26" class="good"/><text x="342" y="50" class="cvm">🔖 version ≥ 1.0 (stable API)</text>
  <rect x="330" y="62" width="290" height="26" class="good"/><text x="342" y="80" class="cvm">👤 reputable author / org</text>
  <rect x="330" y="92" width="290" height="26" class="good"/><text x="342" y="110" class="cvm">⚖ compatible license (MIT/Apache)</text>
</svg>
<figcaption>A quick health check on crates.io and docs.rs before adding a dependency.</figcaption>
</figure>

## Features: pay only for what you use

Most good crates split functionality into optional **features** so you don't compile code you don't need. This keeps build times and binary sizes down:

```toml
# Only pull in serde's derive macro and tokio's runtime + net — not everything:
serde = { version = "1", features = ["derive"] }
tokio = { version = "1", features = ["rt-multi-thread", "net", "macros"] }

# `default-features = false` opts out of a crate's defaults entirely:
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }
```

> [!best] Trim features in production, use `full` while learning
> While exploring, `features = ["full"]` (for crates that offer it) gives you everything so nothing's missing. For a real project, **enable only the features you use** — it can dramatically cut compile times and binary size, and reduces the code you're trusting. Check a crate's docs for its feature list.

## Watch your dependency footprint

> [!tip] Every dependency is code you're trusting and compiling
> Each crate you add pulls in *its* dependencies too — a single `cargo add` can bring dozens of transitive crates. That's more code to compile, more to audit, and more that could break. Useful tools:
> - **`cargo tree`** — see the full dependency graph (and spot duplicates).
> - **`cargo audit`** — check dependencies against a database of known security advisories.
> - **`cargo deny`** — enforce policies on licenses, duplicates, and advisories in CI.
>
> Don't be *afraid* of dependencies — Rust's are generally high quality — but be *aware* of them. Prefer a small, well-maintained crate over a sprawling one when both fit.

## The "blessed" crates

Some crates are so dominant and well-maintained that they're effectively standard — the community converges on them, and most tutorials assume them. Knowing this shortlist saves you evaluation time. The next chapters cover the biggest ones; here's the map:

| Need | Go-to crate(s) |
|------|----------------|
| Serialization (JSON, etc.) | **serde** + serde_json |
| Async runtime | **tokio** |
| Command-line parsing | **clap** |
| Error handling | **anyhow** (apps), **thiserror** (libs) |
| HTTP client | **reqwest** |
| Web server | **axum**, actix-web |
| Databases | **sqlx**, sea-orm, diesel |
| Regular expressions | **regex** |
| Logging/diagnostics | **tracing** |
| Random numbers | rand |
| Date & time | chrono, time |
| Data parallelism | rayon |

> [!note] "There's a crate for that" — but check std first
> Rust's ecosystem is rich enough that the answer to "how do I do X?" is often "add the X crate." That's usually right — but for basics (collections, files, threads, simple formatting), **`std` already has you covered** with zero dependencies. Reach for a crate when `std` genuinely lacks something (JSON, HTTP, async runtime, regex), not for things `std` does well.

## Summary

- The **standard library is small by design**; Rust's power comes from **crates.io**'s huge ecosystem.
- Evaluate a crate by **downloads/dependents, recent activity, documentation, version (≥ 1.0), author reputation, and license**.
- Use **features** to compile only what you need (`default-features = false` + explicit features); use `full` while learning, trim for production.
- Mind your **dependency footprint** with `cargo tree`, `cargo audit`, and `cargo deny`.
- Learn the **"blessed" crates** (serde, tokio, clap, anyhow/thiserror, reqwest, axum, sqlx, regex, tracing) — the community standards covered next; but reach for **`std` first** for the basics.

> [!exercise] Try it yourself
> 1. Browse crates.io for a "csv" crate and evaluate it against the five signals.
> 2. In a project, run `cargo tree` after adding `tokio` and count how many transitive dependencies it brought.
> 3. Add `serde` with only `features = ["derive"]` and confirm your project still builds.

Let's start the tour with the crate you'll use in almost every project — **serde**, for turning data into JSON and back.
