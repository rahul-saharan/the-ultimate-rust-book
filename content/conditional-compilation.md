<h1><span class="h1-kicker">Tooling & Workflow</span>Conditional Compilation & Features</h1>

One codebase, many builds. The same crate might need to run on Linux and Windows, with or without TLS, on a 64-bit server and a microcontroller with no allocator. Rust handles this at **compile time** with `cfg` — so the code you don't need isn't merely skipped at runtime, it never exists in the binary at all.

The mechanism is small: one attribute, one macro, and a set of predicates. Getting the *design* right — especially with feature flags — is where the real skill lies.

## `#[cfg]`: compile this only if…

`#[cfg(...)]` attached to any item means "include this item only when the predicate holds". If it doesn't, the compiler removes the item before it's even type-checked.

```rust
// Exactly one of these two functions exists in any given build.
#[cfg(target_os = "windows")]
fn config_dir() -> &'static str {
    r"C:\ProgramData\myapp"
}

#[cfg(not(target_os = "windows"))]
fn config_dir() -> &'static str {
    "/etc/myapp"
}

// cfg! is the expression form — it evaluates to a bool at compile time,
// and the dead branch is optimized away entirely.
fn describe() -> String {
    let pointer_width = if cfg!(target_pointer_width = "64") { 64 } else { 32 };
    let family = if cfg!(unix) { "unix" } else { "other" };
    format!("{family}, {pointer_width}-bit, config at {}", config_dir())
}

fn main() {
    println!("{}", describe());
    println!("debug assertions on? {}", cfg!(debug_assertions));
    println!("target arch: {}", std::env::consts::ARCH);
}
```

<figure class="diagram">
<svg viewBox="0 0 640 220" role="img" aria-label="One source file produces different binaries depending on which cfg predicates hold, with excluded code never reaching the compiler" >
  <style>
    .cc-h { font: 700 12px var(--font-sans); }
    .cc-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .cc-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .cc-src { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
    .cc-in { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .cc-out { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.5; stroke-dasharray: 4 3; }
  </style>
  <text x="20" y="20" class="cc-h" fill="var(--text-mute)">one source file</text>
  <rect x="20" y="30" width="170" height="120" rx="5" class="cc-src"/>
  <text x="32" y="52" class="cc-m">#[cfg(unix)]</text>
  <text x="32" y="68" class="cc-m">fn dir() { "/etc" }</text>
  <text x="32" y="94" class="cc-m">#[cfg(windows)]</text>
  <text x="32" y="110" class="cc-m">fn dir() { "C:\\" }</text>
  <text x="32" y="136" class="cc-m">fn main() { … }</text>
  <text x="270" y="20" class="cc-h" fill="var(--green)">building for Linux</text>
  <rect x="270" y="30" width="160" height="52" rx="5" class="cc-in"/>
  <text x="282" y="50" class="cc-m">fn dir() { "/etc" }</text>
  <text x="282" y="68" class="cc-m">fn main() { … }</text>
  <rect x="270" y="90" width="160" height="30" rx="5" class="cc-out"/>
  <text x="282" y="110" class="cc-m" fill="var(--red)">windows fn — gone</text>
  <text x="460" y="20" class="cc-h" fill="var(--green)">building for Windows</text>
  <rect x="460" y="30" width="160" height="52" rx="5" class="cc-in"/>
  <text x="472" y="50" class="cc-m">fn dir() { "C:\\" }</text>
  <text x="472" y="68" class="cc-m">fn main() { … }</text>
  <rect x="460" y="90" width="160" height="30" rx="5" class="cc-out"/>
  <text x="472" y="110" class="cc-m" fill="var(--red)">unix fn — gone</text>
  <path d="M192 70 L268 56" stroke="var(--green)" stroke-width="2" marker-end="url(#arr-cc)"/>
  <path d="M192 90 C 330 170, 400 130, 458 100" stroke="var(--green)" stroke-width="2" fill="none" marker-end="url(#arr-cc)"/>
  <text x="20" y="182" class="cc-c">Excluded code is removed before type-checking — so it can reference APIs that don't exist on this platform.</text>
  <text x="20" y="200" class="cc-c">The flip side: excluded code is never compiled, so it can silently rot. That's why CI must build every combination.</text>
  <defs><marker id="arr-cc" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--green)"/></marker></defs>
</svg>
<figcaption>Excluded items never reach the type-checker. That's what makes cross-platform code possible — and why untested <code>cfg</code> branches break silently.</figcaption>
</figure>

> [!key] `#[cfg]` removes code; `if` skips it
> An `if` statement is a runtime branch: both sides are compiled, type-checked, and shipped. `#[cfg]` is a compile-time deletion: the excluded side is never compiled at all, so it may reference platform APIs that don't exist here. That's exactly what you want for cross-platform code — and exactly why the branch you don't build can quietly stop compiling.

## The built-in predicates

| Predicate | Values | Example |
|---|---|---|
| `target_os` | `linux`, `windows`, `macos`, `android`, `ios`, `wasi`, `none`, … | `#[cfg(target_os = "linux")]` |
| `target_family` | `unix`, `windows`, `wasm` | `#[cfg(target_family = "unix")]` |
| `unix` / `windows` | — (shorthand for the above) | `#[cfg(unix)]` |
| `target_arch` | `x86_64`, `aarch64`, `arm`, `wasm32`, `riscv64`, … | `#[cfg(target_arch = "aarch64")]` |
| `target_pointer_width` | `"16"`, `"32"`, `"64"` | `#[cfg(target_pointer_width = "64")]` |
| `target_endian` | `little`, `big` | `#[cfg(target_endian = "big")]` |
| `target_env` | `gnu`, `musl`, `msvc`, `""` | `#[cfg(target_env = "musl")]` |
| `target_feature` | `avx2`, `neon`, `crt-static`, … | `#[cfg(target_feature = "avx2")]` |
| `debug_assertions` | on in debug, off in release | `#[cfg(debug_assertions)]` |
| `test` | set when building tests | `#[cfg(test)]` |
| `doc` | set when building docs | `#[cfg(doc)]` |
| `feature = "x"` | your own Cargo features | `#[cfg(feature = "tls")]` |
| `panic` | `unwind`, `abort` | `#[cfg(panic = "abort")]` |

They combine with three operators — `all`, `any`, and `not`:

```rust
// all() = AND, any() = OR, not() = NOT. They nest freely.
#[cfg(all(unix, target_pointer_width = "64"))]
fn platform() -> &'static str {
    "64-bit unix"
}

#[cfg(all(unix, not(target_pointer_width = "64")))]
fn platform() -> &'static str {
    "32-bit unix"
}

#[cfg(not(unix))]
fn platform() -> &'static str {
    "not unix"
}

#[cfg(any(target_arch = "x86_64", target_arch = "aarch64"))]
fn modern_cpu() -> bool {
    true
}

#[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
fn modern_cpu() -> bool {
    false
}

fn main() {
    println!("{} (modern cpu: {})", platform(), modern_cpu());
}
```

> [!mistake] `#[cfg(feature = "x")]`, not `#[cfg(x)]`
> Cargo features live in their own namespace, so a feature named `tls` is tested as `#[cfg(feature = "tls")]`. Writing `#[cfg(tls)]` compiles without error and is simply **never true** — your code silently vanishes. Since Rust 1.80 the compiler warns about unexpected `cfg` names, which catches most of these; make sure you're not suppressing that lint.

## `#[cfg_attr]`: conditional attributes

Sometimes you want an *attribute* to appear conditionally, not an item. That's `cfg_attr`, and it's the standard way to make optional derives work.

```rust
// Reads as: if the "serde" feature is on, apply #[derive(Serialize)].
// #[cfg_attr(feature = "serde", derive(serde::Serialize))]
#[derive(Debug, Clone)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

// A very common real use: skip a slow test unless explicitly enabled.
#[cfg_attr(not(feature = "slow-tests"), allow(dead_code))]
fn expensive_check() -> u64 {
    (1..=1000u64).sum()
}

fn main() {
    let p = Point { x: 1.0, y: 2.0 };
    println!("{p:?}");
    println!("{}", expensive_check());
}
```

| Pattern | Meaning |
|---|---|
| `#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]` | optional serde support |
| `#[cfg_attr(test, derive(PartialEq))]` | derive only for tests |
| `#[cfg_attr(docsrs, doc(cfg(feature = "tls")))]` | show feature requirements on docs.rs |
| `#[cfg_attr(windows, path = "win.rs")]` | pick a different file for a module |
| `#[cfg_attr(not(feature = "std"), no_std)]` | opt out of `std` conditionally |

## Cargo features: optional functionality

A **feature** is a named flag consumers can turn on. Declare them in `Cargo.toml`; each one can enable optional dependencies and other features.

```toml
[package]
name = "myapp"
version = "0.1.0"
edition = "2021"

[dependencies]
# `optional = true` means this is only pulled in when a feature needs it.
serde = { version = "1", features = ["derive"], optional = true }
rustls = { version = "0.23", optional = true }
tracing = { version = "0.1", optional = true }

[features]
# The default set — active unless the user passes --no-default-features.
default = ["json"]

# A feature that only enables cfg flags, no dependencies.
metrics = []

# `dep:name` enables an optional dependency without creating a feature
# with the same name. This is the modern, precise syntax.
json = ["dep:serde"]
tls = ["dep:rustls"]
logging = ["dep:tracing"]

# A feature that turns on several others — a convenience bundle.
full = ["json", "tls", "logging", "metrics"]
```

```bash
cargo build                                  # default features (json)
cargo build --no-default-features            # bare minimum
cargo build --features tls,logging           # defaults plus these
cargo build --no-default-features -F tls     # only tls
cargo build --all-features                   # everything
cargo tree -f "{p} {f}"                      # show which features resolved
```

Then guard the code:

```rust
pub struct Client {
    endpoint: String,
}

impl Client {
    pub fn new(endpoint: impl Into<String>) -> Self {
        Client { endpoint: endpoint.into() }
    }

    // Always available.
    pub fn endpoint(&self) -> &str {
        &self.endpoint
    }

    // Only exists when the `tls` feature is on.
    #[cfg(feature = "tls")]
    pub fn is_secure(&self) -> bool {
        self.endpoint.starts_with("https://")
    }
}

fn main() {
    let c = Client::new("https://api.example.com");
    println!("{}", c.endpoint());

    // Feature-gated code paths are usually written like this:
    #[cfg(feature = "tls")]
    println!("secure: {}", c.is_secure());

    #[cfg(not(feature = "tls"))]
    println!("built without tls support");
}
```

## Feature rules that will bite you

<figure class="diagram">
<svg viewBox="0 0 640 200" role="img" aria-label="Two dependents requesting different features of the same crate result in one build with the union of both feature sets">
  <style>
    .fu-h { font: 700 12px var(--font-sans); fill: var(--text); }
    .fu-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .fu-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .fu-a { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .fu-b { fill: var(--teal-soft); stroke: var(--teal); stroke-width: 1.5; }
    .fu-u { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="20" y="26" width="180" height="46" rx="5" class="fu-a"/>
  <text x="34" y="46" class="fu-m">crate-a</text>
  <text x="34" y="63" class="fu-c">wants serde/derive</text>
  <rect x="20" y="110" width="180" height="46" rx="5" class="fu-b"/>
  <text x="34" y="130" class="fu-m">crate-b</text>
  <text x="34" y="147" class="fu-c">wants serde/rc</text>
  <rect x="330" y="62" width="250" height="60" rx="5" class="fu-u"/>
  <text x="344" y="84" class="fu-m">serde compiled ONCE with</text>
  <text x="344" y="102" class="fu-m">features = ["derive", "rc"]</text>
  <path d="M202 52 L328 82" stroke="var(--blue)" stroke-width="2" marker-end="url(#arr-fu)"/>
  <path d="M202 132 L328 104" stroke="var(--teal)" stroke-width="2" marker-end="url(#arr-fu)"/>
  <text x="20" y="184" class="fu-c">Features are UNIONED across the whole dependency graph — you cannot get a build with only your own set.</text>
  <defs><marker id="arr-fu" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker></defs>
</svg>
<figcaption><b>Feature unification</b>: if anything in your tree enables a feature, it's on for everyone. This is the rule behind most feature surprises.</figcaption>
</figure>

> [!key] Features must be additive
> Turning a feature *on* may only **add** functionality — never change or remove it. Because features are unioned across the whole dependency graph, if crate A enables `fast-math` and crate B doesn't, B still gets it. There is no way to opt out of someone else's feature. So a feature that changes behaviour (different rounding, a different serialization format) silently breaks unrelated crates. Mutually exclusive features are an anti-pattern; use a runtime option or separate crates instead.

> [!mistake] `--no-default-features` is what breaks in CI
> `default = ["std", "json"]` means almost nobody builds without them — so the no-default path rots. When someone finally needs your crate in a `no_std` environment, it doesn't compile. Add a CI job that builds `--no-default-features`, and one that builds `--all-features`, and ideally check the powerset of features with `cargo hack --feature-powerset check`.

| Rule | Why |
|---|---|
| features are **additive only** | they're unioned across the graph; you can't opt out |
| avoid mutually exclusive features | two dependents will eventually request both |
| don't make `default` large | consumers pay for it; `--no-default-features` should be usable |
| use `dep:serde`, not bare `serde` | avoids an implicit feature with the same name |
| use `pkg?/feat` for conditional propagation | only enables `feat` if `pkg` is already on |
| test `--no-default-features` **and** `--all-features` | both paths rot otherwise |
| document what each feature does | consumers can't guess from the name |

> [!tip] Show feature requirements in your docs
> Add this to `lib.rs` and docs.rs will label feature-gated items with the feature they need:
> ```rust,ignore
> #![cfg_attr(docsrs, feature(doc_cfg))]
> ```
> plus, in `Cargo.toml`:
> ```toml
> [package.metadata.docs.rs]
> all-features = true
> rustdoc-args = ["--cfg", "docsrs"]
> ```
> Without it, readers see a function documented and then get "no method named …" because they didn't enable the right feature. It's a two-minute change that removes a whole class of confused issue reports.

## `#[cfg(test)]`: the one everyone uses

```rust
pub fn normalize(input: &str) -> String {
    input.trim().to_lowercase()
}

// This entire module — and any dev-only helpers in it — is compiled
// only by `cargo test`. It adds nothing to your release binary.
#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> &'static str {
        "  MiXeD Case  "
    }

    #[test]
    fn trims_and_lowercases() {
        assert_eq!(normalize(sample()), "mixed case");
    }

    #[test]
    #[ignore = "slow; run with --ignored"]
    fn expensive() {
        assert_eq!((1..=1_000u64).sum::<u64>(), 500_500);
    }
}

fn main() {
    println!("{}", normalize("  Hello  "));
}
```

> [!note] `#[cfg(test)]` only applies to unit tests in the same crate
> Files in `tests/` are separate crates that link your library as an external dependency, so they can't see `#[cfg(test)]` items at all — and don't need the attribute themselves. That's the whole distinction between unit and integration tests in Rust. See [Test Organization](#/ch/test-organization).

## `debug_assertions`: cheap checks that vanish in release

```rust
fn transfer(balances: &mut Vec<i64>, from: usize, to: usize, amount: i64) {
    // This block costs nothing in a release build.
    #[cfg(debug_assertions)]
    {
        assert!(from < balances.len() && to < balances.len(), "index out of range");
        assert!(amount > 0, "amount must be positive, got {amount}");
    }

    // debug_assert! is the same idea, more concisely:
    debug_assert_ne!(from, to, "cannot transfer to the same account");

    balances[from] -= amount;
    balances[to] += amount;
}

fn main() {
    let mut balances = vec![100, 50];
    transfer(&mut balances, 0, 1, 30);
    println!("{balances:?}"); // [70, 80]

    println!("checks active? {}", cfg!(debug_assertions));
}
```

> [!performance] `debug_assert!` lets you validate invariants for free
> An expensive invariant check — "this list is still sorted", "these two indexes are consistent" — would be unacceptable in a hot release path but is invaluable during development. `debug_assert!` compiles to nothing when `debug_assertions` is off (the default in `--release`), so you can afford checks that would otherwise be too slow. Note that `debug_assertions` is tied to the *profile*, not to `cfg(test)`, and you can enable it in release with `debug-assertions = true` under `[profile.release]`.

## Platform-specific modules

For anything more than a couple of functions, split by file rather than sprinkling attributes:

```rust,ignore
// src/platform/mod.rs
#[cfg(unix)]
mod unix;
#[cfg(unix)]
pub use unix::*;

#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub use windows::*;

// Both files define the same public functions, so the rest of the crate
// calls platform::home_dir() without ever mentioning an OS.
```

> [!best] Keep `cfg` at the edges, behind a common interface
> The maintainable shape is a thin platform layer exposing one identical API per OS, with all the `#[cfg]` confined to it. Scattering `#[cfg(windows)]` through your business logic means every function has two versions, only one of which ever gets compiled and tested on any given machine. One module, one interface, one place to look — and the rest of your crate stays portable by construction.

## Summary

- **`#[cfg(...)]`** deletes items at compile time; **`cfg!(...)`** is the boolean expression form. Excluded code is never type-checked, which is what makes cross-platform code possible — and what lets it rot.
- Predicates cover OS, family, arch, pointer width, endianness, env, target features, `test`, `doc`, `debug_assertions`, and your own `feature = "…"`. Combine with **`all`**, **`any`**, **`not`**.
- **`#[cfg_attr]`** applies an *attribute* conditionally — the standard way to make derives like `Serialize` optional.
- Cargo **features** declare optional functionality; use **`dep:name`** for optional dependencies and keep `default` small.
- Features are **unioned across the dependency graph** and must therefore be **purely additive**. Mutually exclusive features are an anti-pattern.
- Test **`--no-default-features`** and **`--all-features`** in CI, or both paths break.
- **`#[cfg(test)]`** excludes test modules from release builds; **`debug_assert!`** gives you invariant checks that cost nothing in release.
- Confine `#[cfg]` to a **thin platform module** with one common interface.

> [!exercise] Try it yourself
> 1. Write a function with three `#[cfg]` variants — one for `unix`, one for `windows`, one fallback — and confirm it compiles and runs on your machine.
> 2. Add a `metrics` feature to a small crate that gates a `fn report()`. Build with and without it, and check the binary size difference with `ls -l`.
> 3. Deliberately write `#[cfg(metrics)]` instead of `#[cfg(feature = "metrics")]`. Does the compiler warn? What happens to the function?
> 4. Add a `debug_assert!` that a vector is sorted before a binary search. Verify it fires in `cargo run` and not in `cargo run --release`.
> 5. Write a feature `fast` that would change a rounding mode. Explain, in one paragraph, why that's a bug waiting for a second dependent.

Next: when a build succeeds but behaves wrongly, you need to see inside it — **debugging Rust**.
