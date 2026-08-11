<h1><span class="h1-kicker">Tooling & Workflow</span>The Cargo Toolbox</h1>

You met Cargo early on — `cargo new`, `cargo build`, `cargo test`. That's maybe a fifth of what it does. This chapter is the rest: build profiles you can tune, the dozen subcommands worth installing, per-project configuration, dependency auditing, and how to pin a toolchain so your whole team compiles the same way.

None of it is glamorous. All of it saves hours.

## Build profiles: the dials that matter

A **profile** is a named set of compiler settings. Cargo has four built in, and you can tune any of them in `Cargo.toml`.

| Profile | Used by | Default optimization | Debug info |
|---|---|---|---|
| `dev` | `cargo build`, `cargo run` | `0` (none) | full |
| `release` | `--release` | `3` (aggressive) | none |
| `test` | `cargo test` | inherits `dev` | full |
| `bench` | `cargo bench` | inherits `release` | none |

```toml
[profile.release]
opt-level = 3          # 0-3, or "s"/"z" to optimize for SIZE
lto = "thin"           # link-time optimization: false | "thin" | "fat"
codegen-units = 1      # fewer units = better optimization, slower compile
panic = "abort"        # smaller binary, no unwinding (breaks catch_unwind)
strip = "symbols"      # drop symbols — big size win
debug = false          # set to true to keep symbols for profiling

[profile.dev]
opt-level = 0          # keep compiles fast
debug = true

# Optimize DEPENDENCIES even in dev builds. This is the single best
# quality-of-life setting for anything graphical or compute-heavy:
# your code stays fast to compile, your dependencies run at full speed.
[profile.dev.package."*"]
opt-level = 3

# A custom profile that inherits from another — for profiling builds
# that need both speed and symbols.
[profile.profiling]
inherits = "release"
debug = true
strip = "none"
```

```bash
cargo build --profile profiling    # use a custom profile
cargo build --release              # shorthand for --profile release
```

Every one of those settings trades along the same three axes, and you can only ever favour two:

<figure class="diagram">
<svg viewBox="0 0 640 250" role="img" aria-label="A triangle of trade-offs between compile time, runtime speed and binary size, with common profile settings placed near the corner they favour">
  <style>
    .pf-h { font: 700 12px var(--font-sans); }
    .pf-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .pf-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .pf-tri { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
    .pf-tag { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.2; }
  </style>
  <polygon points="320,30 590,215 50,215" class="pf-tri"/>
  <text x="252" y="24" class="pf-h" fill="var(--blue)">fast COMPILES</text>
  <rect x="240" y="34" width="160" height="20" rx="3" class="pf-tag"/>
  <text x="248" y="49" class="pf-m">opt-level = 0</text>
  <rect x="240" y="56" width="160" height="20" rx="3" class="pf-tag"/>
  <text x="248" y="71" class="pf-m">codegen-units = 16</text>
  <rect x="240" y="78" width="160" height="20" rx="3" class="pf-tag"/>
  <text x="248" y="93" class="pf-m">incremental = true</text>
  <text x="470" y="238" class="pf-h" fill="var(--green)">fast RUNTIME</text>
  <rect x="410" y="150" width="165" height="20" rx="3" class="pf-tag"/>
  <text x="418" y="165" class="pf-m">opt-level = 3</text>
  <rect x="410" y="172" width="165" height="20" rx="3" class="pf-tag"/>
  <text x="418" y="187" class="pf-m">lto = "fat"</text>
  <rect x="410" y="194" width="165" height="20" rx="3" class="pf-tag"/>
  <text x="418" y="209" class="pf-m">codegen-units = 1</text>
  <text x="40" y="238" class="pf-h" fill="var(--purple)">small BINARY</text>
  <rect x="52" y="150" width="150" height="20" rx="3" class="pf-tag"/>
  <text x="60" y="165" class="pf-m">opt-level = "z"</text>
  <rect x="52" y="172" width="150" height="20" rx="3" class="pf-tag"/>
  <text x="60" y="187" class="pf-m">strip = "symbols"</text>
  <rect x="52" y="194" width="150" height="20" rx="3" class="pf-tag"/>
  <text x="60" y="209" class="pf-m">panic = "abort"</text>
  <text x="266" y="130" class="pf-c">pick two</text>
  <text x="256" y="146" class="pf-c">dev → top corner</text>
  <text x="248" y="162" class="pf-c">release → right corner</text>
  <text x="248" y="178" class="pf-c">embedded → left corner</text>
</svg>
<figcaption>Compile time, runtime speed, and binary size pull against each other. The <code>dev</code> and <code>release</code> defaults are just two useful points in this space — you can pick your own.</figcaption>
</figure>

Your program can see which profile built it, which is occasionally useful for banners and diagnostics:

```rust
fn main() {
    // debug_assertions is on in `dev` and off in `release` by default,
    // which makes it the standard way to detect the profile at compile time.
    let profile = if cfg!(debug_assertions) { "debug" } else { "release" };
    println!("built in {profile} mode");

    // option_env! reads a compile-time variable that may not exist,
    // returning Option<&str> instead of failing to compile.
    match option_env!("CARGO_PKG_VERSION") {
        Some(v) => println!("cargo says version {v}"),
        None => println!("not built by cargo"),
    }

    // Overflow checks follow debug_assertions unless you override them.
    let big: u8 = 250;
    match big.checked_add(10) {
        Some(n) => println!("250 + 10 = {n}"),
        None => println!("250 + 10 overflows a u8 — checked_add caught it"),
    }
}
```

| Setting | Trade-off |
|---|---|
| `opt-level = 0` → `3` | runtime speed up, compile time up |
| `opt-level = "s"` / `"z"` | smaller binary, sometimes slower; `z` also disables loop vectorization |
| `lto = "thin"` | ~10–20% faster runtime, moderate link time — a good default |
| `lto = "fat"` | best runtime, much slower link |
| `codegen-units = 1` | better optimization, loses build parallelism |
| `panic = "abort"` | smaller and slightly faster; **disables `catch_unwind`** and unwinding tests |
| `strip = "symbols"` | large size reduction, unreadable backtraces |
| `debug = true` in release | readable profiles and backtraces, much larger binary |
| `incremental = true` | faster rebuilds, slightly worse codegen (on by default in dev) |

> [!performance] `[profile.dev.package."*"] opt-level = 3` is the setting nobody tells you about
> Debug builds are slow largely because your *dependencies* are unoptimized — image decoding, cryptography, physics, parsing. This one stanza compiles all dependencies with full optimization while keeping *your* crate at `opt-level = 0`, so it still compiles fast and debugs cleanly. Dependencies are rebuilt once and then cached. For anything doing real computation in development, it can be a 10× difference in runtime with no cost to your iteration speed.

> [!warning] `panic = "abort"` has consequences beyond size
> It disables unwinding entirely, which means `std::panic::catch_unwind` stops working, `#[should_panic]` tests can't run, and any library relying on unwinding for isolation (some thread pools and FFI boundaries) breaks. It genuinely does shrink binaries and remove landing pads — just make the decision knowingly, and don't set it on a library others will consume.

## The subcommands worth installing

Cargo is extensible: any binary named `cargo-foo` on your `PATH` becomes `cargo foo`.

```bash
cargo install cargo-edit        # add/rm/upgrade dependencies from the CLI
cargo install cargo-watch       # re-run a command on file change
cargo install cargo-expand      # show macro- and derive-expanded code
cargo install cargo-nextest     # a much better test runner
cargo install cargo-audit      # check dependencies against the advisory DB
cargo install cargo-deny        # policy checks: licences, bans, advisories
cargo install cargo-outdated    # what could be upgraded
cargo install cargo-udeps       # find unused dependencies (nightly)
cargo install cargo-machete     # same idea, works on stable, much faster
cargo install cargo-bloat       # what's taking up space in your binary
cargo install cargo-llvm-lines  # which generics are causing code bloat
cargo install cargo-hack        # build/test across feature combinations
cargo install cargo-semver-checks # detect accidental breaking changes
cargo install flamegraph        # profile and render a flame graph
```

| Command | Solves |
|---|---|
| `cargo add serde --features derive` | editing `Cargo.toml` by hand (built in since 1.62) |
| `cargo remove serde` | the same, in reverse (built in) |
| `cargo watch -x test` | re-running tests manually after every save |
| `cargo expand` | "what does this derive actually generate?" |
| `cargo nextest run` | slow, serial tests with poor output |
| `cargo tree -d` | two versions of the same crate bloating your build |
| `cargo audit` | shipping a dependency with a known CVE |
| `cargo deny check` | a GPL dependency sneaking into a proprietary product |
| `cargo machete` | dependencies you stopped using two refactors ago |
| `cargo bloat --release -n 20` | "why is my binary 40 MB?" |
| `cargo hack --feature-powerset check` | a feature combination nobody ever built |
| `cargo semver-checks` | publishing a breaking change as a patch release |
| `cargo flamegraph` | guessing at what's slow |

> [!best] `cargo nextest` is a straight upgrade over `cargo test`
> It runs each test in its own process (so one crash doesn't take down the run), gives you clean per-test output without `--nocapture`, is meaningfully faster through better parallelism, and has real retry and partitioning support for CI. The one thing it doesn't do is run doc tests, so a full CI job is `cargo nextest run && cargo test --doc`. It's a drop-in change for most projects.

## Inspecting the dependency graph

```bash
cargo tree                          # the whole graph
cargo tree -d                       # ONLY duplicates — start here
cargo tree -i serde                 # INVERTED: who depends on serde?
cargo tree -e features              # show which features each dep resolved with
cargo tree -p my-crate --depth 1    # direct dependencies of one package
cargo tree --target x86_64-pc-windows-msvc  # per-target graph
```

`cargo tree -d` and `cargo tree -i` are the two you'll use most. The first finds wasted compile time; the second answers "why on earth is this in my build?"

```text
$ cargo tree -i rand_core
rand_core v0.6.4
└── rand_chacha v0.3.1
    └── rand v0.8.5
        ├── my-app v0.1.0
        └── some-dependency v2.1.0
```

> [!tip] Duplicate versions are compile time you're paying for nothing
> `cargo tree -d` showing `rand v0.7` and `rand v0.8` means both are compiled, both are linked, and their types are **mutually incompatible** — a `rand 0.7` `Rng` cannot be passed to a `rand 0.8` function, which produces some of the most confusing type errors in Rust ("expected `Rng`, found `Rng`"). Fix it by upgrading whichever dependency pins the old version, or `cargo update -p rand` to unify.

## Per-project configuration

`.cargo/config.toml` in your project root configures Cargo itself — aliases, flags, linkers, registries.

```toml
# .cargo/config.toml

[alias]
b = "build"
t = "test"
c = "check"
lint = "clippy --all-targets --all-features -- -D warnings"
ci = "hack --feature-powerset check"
cov = "llvm-cov --html"

[build]
# Applies to every build in this project.
rustflags = ["-D", "warnings"]
target-dir = "target"           # or a shared dir to reuse artifacts across projects

[target.x86_64-unknown-linux-gnu]
# A dramatically faster linker. `mold` is the current best on Linux.
rustflags = ["-C", "link-arg=-fuse-ld=mold"]

[net]
git-fetch-with-cli = true       # fixes private-git-dependency auth issues

[registries.my-company]
index = "sparse+https://cargo.mycompany.com/index/"
```

Then `cargo lint` runs your whole lint command, and everyone on the team gets the same one.

> [!performance] Switching linkers is the cheapest build-time win available
> Linking is a large share of an incremental Rust build, and the default system linker is slow. `mold` on Linux or `lld` cross-platform can cut incremental link times by 2–5×, and it's a three-line config change with no effect on the produced binary's behaviour. If your edit-compile-test loop feels sluggish, try this before anything else.

> [!warning] `rustflags` in config is not additive with `RUSTFLAGS`
> If the `RUSTFLAGS` environment variable is set, it **replaces** the `[build] rustflags` from your config file rather than adding to it. That surprises people in CI, where a workflow sets `RUSTFLAGS` for coverage and silently loses the project's `-D warnings`. Also note that changing `rustflags` invalidates the whole build cache — so a CI job that sets it differently from local dev will always do a full rebuild.

## Pinning the toolchain

A `rust-toolchain.toml` file makes `rustup` switch automatically for anyone in the directory. This is how you stop "works on my machine, fails in CI".

```toml
# rust-toolchain.toml — committed to the repository
[toolchain]
channel = "1.83.0"          # or "stable", "beta", "nightly-2025-01-15"
components = ["rustfmt", "clippy", "rust-src"]
targets = ["wasm32-unknown-unknown", "x86_64-unknown-linux-musl"]
profile = "minimal"
```

Related: **MSRV** (minimum supported Rust version) is the *oldest* toolchain your crate compiles with, and it's a promise to your users.

```toml
# Cargo.toml
[package]
rust-version = "1.74"       # Cargo refuses to build on older toolchains
```

```bash
cargo install cargo-msrv
cargo msrv find             # discover the actual minimum by bisecting
cargo msrv verify           # check the declared value is still true
```

> [!key] `rust-toolchain.toml` pins; `rust-version` promises
> They solve opposite problems. `rust-toolchain.toml` says *"build this project with exactly this toolchain"* — right for applications and CI reproducibility. `rust-version` says *"this crate works on 1.74 and newer"* — right for libraries, where you must not force a toolchain on consumers. A published library should have `rust-version` and usually **not** a pinned `rust-toolchain.toml`; an application deployment should have both.

> [!note] Raising your MSRV is a social change, not a technical one
> Bumping `rust-version` can break consumers stuck on an older toolchain — common in enterprise and distro packaging. Convention is to treat it as at least a minor version bump, mention it in the changelog, and not do it casually for a small convenience. Some crates hold an MSRV six months to a year behind stable deliberately.

## Auditing dependencies

Every dependency is code you run and a `build.rs` you trust. Two tools make that manageable.

```bash
cargo audit                     # any dependency with a known advisory?
cargo audit fix                 # bump what it can
cargo deny check                # advisories + licences + bans + sources
```

```toml
# deny.toml
[advisories]
# Fail the build on any known vulnerability.
yanked = "deny"

[licenses]
# Only these licences may appear anywhere in the tree.
allow = ["MIT", "Apache-2.0", "BSD-3-Clause", "ISC", "Unicode-3.0"]
confidence-threshold = 0.9

[bans]
# Catch duplicate versions early.
multiple-versions = "warn"
# Refuse specific crates outright.
deny = [{ name = "openssl", reason = "use rustls instead" }]

[sources]
# Nothing may come from a registry we didn't approve.
unknown-registry = "deny"
unknown-git = "deny"
```

| Tool | Checks |
|---|---|
| `cargo audit` | the RustSec advisory database |
| `cargo deny` | advisories, licences, banned crates, allowed sources, duplicates |
| `cargo vet` | whether a human has reviewed each dependency (shared audits) |
| `cargo crev` | community code reviews of crates |
| `cargo supply-chain` | who the publishers of your dependencies are |

> [!best] `cargo deny check` in CI, on a schedule as well as on push
> New advisories are published against code you already shipped, so a push-triggered job isn't enough — a weekly scheduled run catches vulnerabilities that appear after your last commit. The licence check is equally valuable and much less obvious: a transitive dependency can quietly introduce a copyleft licence into a proprietary product, and nobody notices until legal review. Ten minutes of setup.

## Documentation and publishing

```bash
cargo doc --open                    # build and view your docs
cargo doc --no-deps                 # just your crate, much faster
cargo doc --document-private-items  # include private items — great while developing
cargo test --doc                    # run the examples in doc comments

cargo package --list                # exactly what would be published
cargo publish --dry-run             # full rehearsal, no upload
cargo publish                       # for real
cargo yank --version 0.2.1          # stop new projects using a bad release
```

```toml
# Cargo.toml — keep the published package small and the metadata complete
[package]
name = "my-crate"
version = "0.1.0"
edition = "2021"
rust-version = "1.74"
description = "One clear sentence — this is what people see when searching."
license = "MIT OR Apache-2.0"
repository = "https://github.com/me/my-crate"
documentation = "https://docs.rs/my-crate"
keywords = ["cli", "parsing"]      # max 5
categories = ["command-line-utilities"]
readme = "README.md"
# Ship only what's needed — a smaller package downloads and builds faster.
include = ["src/**/*", "Cargo.toml", "README.md", "LICENSE-*"]
```

> [!mistake] `cargo package --list` before your first publish
> Without an `include` or `exclude`, Cargo packages your whole directory — which routinely means test fixtures, screenshots, benchmark data, and design documents get uploaded to crates.io permanently. Published versions **cannot be deleted**, only yanked. Run `cargo package --list`, look at every line, and add an `include` list.

## The commands, in one table

| Command | Does |
|---|---|
| `cargo check` | type-check without codegen — **much** faster than `build` |
| `cargo build` / `-r` | compile (debug / release) |
| `cargo run -- args` | build and run; everything after `--` goes to your program |
| `cargo test` | run unit, integration, and doc tests |
| `cargo bench` | run benchmarks |
| `cargo clippy` | 700+ lints — run this before every commit |
| `cargo fmt` | format; `--check` to verify without changing |
| `cargo fix` | apply compiler and Clippy suggestions automatically |
| `cargo fix --edition` | migrate to a newer edition |
| `cargo update` | update `Cargo.lock` within your declared ranges |
| `cargo update -p serde --precise 1.0.200` | pin one dependency exactly |
| `cargo clean` | delete `target/`; `-p crate` for just one package |
| `cargo tree` | the dependency graph |
| `cargo metadata --format-version 1` | machine-readable project info, for tooling |
| `cargo install --path .` | install your own binary locally |
| `cargo install --locked <crate>` | install using the crate's own `Cargo.lock` |
| `cargo search <term>` | search crates.io from the terminal |
| `cargo vendor` | copy all dependencies into `vendor/` for offline builds |
| `cargo build --offline` | build with no network access at all |
| `cargo build --timings` | an HTML report of what took so long |

> [!tip] `cargo check` in your editor, `cargo build` when you mean it
> `check` skips code generation and linking, which is most of the work — it's often 3–5× faster. That's what `rust-analyzer` runs on every keystroke. In a watch loop, `cargo watch -x check -x test` gives you fast type feedback and then tests. Save `build` for when you actually intend to run the thing.

> [!performance] `cargo build --timings` before you optimize your build
> It produces an HTML chart showing every crate's compile time and where parallelism stalled. The answer is usually surprising: one proc-macro-heavy dependency serializing the whole graph, or a crate you could put behind a feature flag. Measuring beats guessing here exactly as it does in runtime performance — see [Optimization](#/ch/optimization).

## Summary

- **Profiles** are your build dials. `[profile.dev.package."*"] opt-level = 3` speeds up dependencies without slowing your own compiles — the best-value setting there is.
- Know the trade-offs: `lto`, `codegen-units`, `strip`, `opt-level = "z"`, and `panic = "abort"` (which disables `catch_unwind` and `#[should_panic]`).
- Install the ecosystem: **`nextest`** (better tests), **`expand`** (see macros), **`watch`**, **`audit`**/**`deny`** (security and licences), **`machete`** (unused deps), **`bloat`**, **`hack`** (feature combinations), **`semver-checks`**.
- **`cargo tree -d`** finds duplicate versions costing you compile time; **`cargo tree -i <crate>`** answers "why is this here?"
- **`.cargo/config.toml`** gives the team shared aliases and flags. Switching to the **mold/lld linker** is the cheapest build-speed win available.
- **`rust-toolchain.toml` pins** a toolchain (applications); **`rust-version` promises** an MSRV (libraries). Don't raise MSRV casually.
- Run **`cargo deny check`** in CI *and* on a schedule — new advisories land against code you already shipped.
- **`cargo package --list`** before publishing; releases can be yanked but never deleted.
- Use **`cargo check`** for feedback and **`cargo build --timings`** before trying to make builds faster.

> [!exercise] Try it yourself
> 1. Add `[profile.dev.package."*"] opt-level = 3` to a project with real dependencies. Time a debug run before and after.
> 2. Run `cargo tree -d` on your largest project. If there are duplicates, use `cargo tree -i <crate>` to find who's pinning the old version.
> 3. Add an `[alias]` for `lint = "clippy --all-targets -- -D warnings"` and run `cargo lint`. Fix one warning it finds.
> 4. Install `cargo-bloat` and run `cargo bloat --release -n 20`. Is the biggest contributor what you expected?
> 5. Add a `rust-toolchain.toml` pinning a specific version, then run `rustc --version` inside and outside the directory.
> 6. Write a `deny.toml` with an `allow` list of licences and run `cargo deny check licenses`. Did anything in your tree surprise you?

Next: building for machines that aren't the one you're sitting at — **cross-compilation**.
