<h1><span class="h1-kicker">The Crate Ecosystem</span>Publishing a Crate & Feature Flags</h1>

You've spent this whole part *using* crates from [crates.io](https://crates.io). Now let's flip it around: how do you publish your *own* crate so others can use it? It's refreshingly simple. We'll also cover **feature flags** — the mechanism that lets your crate offer optional functionality, so users only compile and depend on the parts they actually need.

## Creating a library crate

A publishable crate is usually a **library** (a `--lib` crate). Create one with:

```bash
cargo new my_crate --lib
```

You get `src/lib.rs` with a sample function and test. Whatever you mark **`pub`** there becomes your
crate's public API:

```rust
/// Adds two numbers together.
///
/// # Examples
/// ```
/// assert_eq!(my_crate::add(2, 3), 5);
/// ```
pub fn add(a: i64, b: i64) -> i64 {
    a + b
}
```

> [!tip] Document as you go — the docs are your shop window
> Good [doc comments](#/ch/comments) (`///`) are how people decide whether to use your crate, and
> crates.io automatically builds and hosts them on [docs.rs](https://docs.rs). Your doc examples are
> also run by `cargo test`, so they never fall out of date. A well-documented crate with clear
> examples gets far more use than a better-but-undocumented one.

## The manifest metadata you need to publish

crates.io requires a bit of metadata in `Cargo.toml` before it will accept your crate. The important
fields:

```toml
[package]
name = "my_crate"                    # must be unique on crates.io
version = "0.1.0"                    # follows SemVer (see below)
edition = "2021"
description = "A short, clear sentence about what this crate does."  # required
license = "MIT OR Apache-2.0"        # required (an SPDX license identifier)
repository = "https://github.com/you/my_crate"
readme = "README.md"
keywords = ["parsing", "cli"]        # up to 5, aid discovery
categories = ["command-line-utilities"]
```

**`description`** and **`license`** are mandatory — crates.io rejects a publish without them.

## Publishing, step by step

Publishing is three commands:

```bash
# 1. Log in once with an API token from https://crates.io/me
cargo login <your-api-token>

# 2. Preview what will be uploaded (a great habit — catches stray files):
cargo publish --dry-run

# 3. Publish for real:
cargo publish
```

That's it — your crate is now installable by anyone with `cargo add my_crate`.

> [!warning] A published version is permanent
> Once you publish version `1.2.0`, it is **immutable and can never be deleted** — people's builds
> depend on it existing. If a release is broken, you can **`cargo yank --version 1.2.0`**, which
> stops *new* projects from selecting it while leaving existing users unaffected; then publish a
> fixed higher version. So run `--dry-run` first, double-check the version number, and don't publish
> secrets or junk files. (Add a `.gitignore`/`exclude` so `target/` and local files aren't bundled.)

> [!jargon] Semantic Versioning (SemVer)
> Crate versions are **`MAJOR.MINOR.PATCH`**. Bump **PATCH** (`1.2.0` → `1.2.1`) for backwards-
> compatible bug fixes, **MINOR** (`1.2.0` → `1.3.0`) for backwards-compatible new features, and
> **MAJOR** (`1.2.0` → `2.0.0`) for breaking changes. Cargo relies on this: a dependency written as
> `"1.2"` will accept any `1.x` but never `2.0`. Following SemVer honestly is your contract with the
> people who depend on you.

### What actually counts as a breaking change

The surprising part of SemVer in Rust is how many "small" edits break downstream builds. These all require a **MAJOR** bump:

| Change | Why it breaks |
|---|---|
| Adding a field to a public struct | callers using literal syntax (`Config { a, b }`) no longer compile |
| Adding a variant to a public enum | exhaustive `match`es lose their exhaustiveness |
| Adding a required method to a trait | every outside implementor breaks |
| Renaming *anything* public | obvious, but easy to do by accident during a refactor |
| Narrowing a parameter type (`&str` → `String`) | existing call sites stop compiling |
| Adding a trait bound to an existing generic | callers with types lacking the bound break |

Two attributes buy back most of that freedom, and cost nothing to add **before** 1.0:

```rust,ignore
#[non_exhaustive]                 // callers must include a `_` arm / can't use literal syntax,
pub enum Error { NotFound, Io }   // so you can add variants later without a major bump

#[non_exhaustive]
pub struct Config { pub host: String }   // …and add fields later
```

> [!best] Let a tool check SemVer for you
> Judging this by eye is unreliable — the field-addition case in particular catches experienced people. **`cargo-semver-checks`** compares your working copy against the published version and reports violations:
> ```bash
> cargo install cargo-semver-checks
> cargo semver-checks check-release
> ```
> Run it in CI before every release. Pair it with a **pre-publish checklist**: `cargo publish --dry-run`, `cargo package --list` (see exactly which files ship — catches stray `.env` files and 200 MB of test fixtures), `cargo test --all-features`, and confirm the README renders. Also set `rust-version` in `Cargo.toml` to declare your MSRV, since raising it is itself a breaking change for some users.

> [!tip] docs.rs builds your documentation automatically
> Every published crate gets rendered docs at `docs.rs/<crate>` within minutes — you don't upload anything. Two consequences worth planning for: your **doc comments are your public documentation**, so write them as you go ([Comments & Documentation](#/ch/comments)); and doc examples are compiled and run by `cargo test`, so they can't rot. If your crate needs special build settings for docs (feature flags, a specific target), configure them under `[package.metadata.docs.rs]` in `Cargo.toml`.

## Feature flags: optional, opt-in functionality

A **feature flag** lets your crate include some code or dependency *only if the user asks for it*.
This keeps the default build lean — users don't compile (or download) parts they don't use.

Declare features in a `[features]` section of `Cargo.toml`:

```toml
[features]
default = ["std"]          # features enabled unless the user opts out
std = []                   # a plain feature (just a name to gate code on)
serde = ["dep:serde"]      # a feature that pulls in an OPTIONAL dependency

[dependencies]
serde = { version = "1", optional = true }   # only compiled if the feature is on
```

> [!jargon] Feature flag
> A **feature** is a named, optional piece of your crate. Users turn features on to get extra
> functionality (and its dependencies), or leave them off to keep things minimal. The `default`
> feature set is what's enabled when someone adds your crate without specifying features.

### How features "control" compilation

In your code, gate items on a feature with **`#[cfg(feature = "...")]`** — that item is compiled
**only** when the feature is enabled:

```rust,ignore
// This whole impl only exists if the user enabled the "serde" feature:
#[cfg(feature = "serde")]
impl serde::Serialize for MyType {
    // ...
}

// You can gate a function, a module, or even a single line:
#[cfg(feature = "logging")]
fn log_it(msg: &str) {
    println!("{msg}");
}
```

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="A feature flag gates optional code and dependencies: off means excluded, on means compiled in">
  <style>
    .fm { font: 600 12px var(--font-mono); fill: var(--text); }
    .fc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .off { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; stroke-dasharray: 4 3; }
    .on { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="20" y="24" class="fc">Feature "serde" OFF (default):</text>
  <rect x="30" y="34" width="180" height="34" class="on"/><text x="44" y="56" class="fm">core code</text>
  <rect x="220" y="34" width="200" height="34" class="off"/><text x="234" y="56" class="fm">serde impls — excluded</text>
  <text x="440" y="56" class="fc">smaller, fewer deps</text>
  <text x="20" y="100" class="fc">Feature "serde" ON:</text>
  <rect x="30" y="110" width="180" height="34" class="on"/><text x="44" y="132" class="fm">core code</text>
  <rect x="220" y="110" width="200" height="34" class="on"/><text x="234" y="132" class="fm">serde impls — compiled in</text>
  <text x="440" y="132" class="fc">+ serde dependency</text>
</svg>
<figcaption>A feature flag switches gated code (and its dependencies) in or out at compile time — users pay only for what they enable.</figcaption>
</figure>

### Turning features on as a *user*

When someone depends on your crate, they choose features in *their* `Cargo.toml`:

```toml
# Enable an extra feature:
my_crate = { version = "1", features = ["serde"] }

# Or opt out of the defaults for a minimal build:
my_crate = { version = "1", default-features = false }
```

> [!key] Why feature flags matter
> Feature flags let one crate serve many needs without bloating everyone's build. A serialization
> crate can offer optional `serde` support; an async crate can offer `tokio` *or* `async-std`
> backends; an embedded-friendly crate can offer a `std` feature that users disable for `no_std`
> targets. The payoff: **faster compiles, smaller binaries, and fewer dependencies** for users who
> don't need the extras — while the functionality is one flag away for those who do.

> [!best] Keep the default feature set small and sensible
> Make `default` include only what *most* users want, and put anything heavy, niche, or dependency-
> pulling behind an opt-in feature. Test your crate **with default features off** and with each
> feature on (CI can do this) so no combination is broken. And document your features in the README
> so users know what's available. Small defaults + clear optional features = a crate that's pleasant
> to depend on.

## Summary

- Publish a **library crate** (`cargo new --lib`); everything `pub` is your API. Document it well —
  crates.io hosts your docs on **docs.rs** and runs your doc examples.
- `Cargo.toml` needs metadata to publish — **`description`** and **`license`** are required, plus
  helpful `repository`, `keywords`, and `categories`.
- Publish with **`cargo login`** → **`cargo publish --dry-run`** → **`cargo publish`**. A published
  version is **permanent**; use **`cargo yank`** to retire a bad one. Version with **SemVer**.
- **Feature flags** (`[features]` + `#[cfg(feature = "...")]`) make functionality and dependencies
  **opt-in**, so users compile only what they need. Optional dependencies use `optional = true` and
  `dep:` in the feature.
- Users enable features with `features = [...]` and can opt out of defaults with
  `default-features = false`. Keep your **default** set small and test all feature combinations.

> [!exercise] Try it yourself
> 1. Run `cargo new mylib --lib`, add a documented `pub fn`, and run `cargo publish --dry-run` to see
>    exactly what would be uploaded (you don't have to publish).
> 2. Add a `verbose` feature and a function gated with `#[cfg(feature = "verbose")]`; build with and
>    without `--features verbose` and confirm the function only exists when enabled.
> 3. Make a dependency optional and wire it to a feature with `optional = true` and `dep:`.

To close the ecosystem tour, here's a curated map of the other crates every Rust developer should
know.
