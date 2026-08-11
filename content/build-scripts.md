<h1><span class="h1-kicker">Tooling & Workflow</span>Build Scripts: build.rs</h1>

Sometimes compiling your crate isn't enough. You need to generate Rust code from a schema, compile a C library and link against it, bake the current git commit into the binary, or check that a system dependency exists before anything else runs. Cargo's answer is the **build script** — a small Rust program that Cargo compiles and runs *before* it builds your crate.

It's a simple mechanism with a few sharp rules. Learn them once and a whole category of problems becomes routine.

## How a build script works

Put a file called `build.rs` in your package root — next to `Cargo.toml`, **not** inside `src/`. Cargo notices it automatically, compiles it as its own binary, and runs it before compiling your crate.

<figure class="diagram">
<svg viewBox="0 0 640 250" role="img" aria-label="Cargo compiles and runs build.rs first, which writes generated files to OUT_DIR and prints instructions back to Cargo, before the crate itself is compiled">
  <style>
    .bs-h { font: 700 12px var(--font-sans); fill: var(--text); }
    .bs-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .bs-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .bs-1 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .bs-2 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .bs-3 { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .bs-4 { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
  </style>
  <rect x="20" y="30" width="120" height="44" rx="5" class="bs-1"/>
  <text x="34" y="50" class="bs-m">build.rs</text>
  <text x="34" y="66" class="bs-c">step 1: compile</text>
  <rect x="180" y="30" width="120" height="44" rx="5" class="bs-1"/>
  <text x="194" y="50" class="bs-m">run it</text>
  <text x="194" y="66" class="bs-c">step 2: execute</text>
  <rect x="350" y="10" width="180" height="42" rx="5" class="bs-2"/>
  <text x="364" y="30" class="bs-m">$OUT_DIR/*.rs</text>
  <text x="364" y="45" class="bs-c">generated code</text>
  <rect x="350" y="62" width="180" height="42" rx="5" class="bs-3"/>
  <text x="364" y="82" class="bs-m">stdout: cargo::…</text>
  <text x="364" y="97" class="bs-c">instructions to Cargo</text>
  <rect x="180" y="150" width="200" height="50" rx="5" class="bs-4"/>
  <text x="194" y="172" class="bs-m">src/lib.rs, src/main.rs</text>
  <text x="194" y="190" class="bs-c">step 3: compile your crate</text>
  <path d="M142 52 L178 52" stroke="var(--blue)" stroke-width="2.5" marker-end="url(#arr-bs)"/>
  <path d="M302 46 L348 34" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#arr-bs2)"/>
  <path d="M302 58 L348 76" stroke="var(--green)" stroke-width="2" marker-end="url(#arr-bs3)"/>
  <path d="M440 106 C 440 140, 400 140, 382 160" stroke="var(--rust-500)" stroke-width="2" fill="none" marker-end="url(#arr-bs2)"/>
  <text x="446" y="132" class="bs-c">include!(…)</text>
  <text x="20" y="228" class="bs-c">The build script runs on the BUILD machine, in an unspecified working directory, with only OUT_DIR writable.</text>
  <text x="20" y="244" class="bs-c">Its stdout is not output — every line starting with <tspan font-family="var(--font-mono)">cargo::</tspan> is a command Cargo obeys.</text>
  <defs>
    <marker id="arr-bs" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--blue)"/></marker>
    <marker id="arr-bs2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker>
    <marker id="arr-bs3" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--green)"/></marker>
  </defs>
</svg>
<figcaption>A build script produces two things: <b>files in <code>OUT_DIR</code></b> and <b>instructions on stdout</b>. Everything else about it is incidental.</figcaption>
</figure>

```text
my-crate/
├── Cargo.toml
├── build.rs          ← here, at the package root
└── src/
    └── main.rs
```

The simplest useful build script bakes build-time information into the binary:

```rust,ignore
// build.rs
use std::process::Command;

fn main() {
    // Ask git for the current short commit hash.
    let hash = Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    // Expose it to the crate as an environment variable at compile time.
    println!("cargo::rustc-env=GIT_HASH={hash}");

    // Re-run only when the git HEAD actually moves.
    println!("cargo::rerun-if-changed=.git/HEAD");
}
```

```rust,ignore
// src/main.rs
fn main() {
    // env! reads a compile-time variable — this is now a &'static str.
    println!("version {} ({})", env!("CARGO_PKG_VERSION"), env!("GIT_HASH"));
}
```

> [!key] A build script talks to Cargo through stdout
> Anything the script prints starting with `cargo::` is an **instruction**, not output. That's the entire communication channel: set an env var, add a link flag, declare a `cfg`, or say when to re-run. Print anything else and it's just noise — visible only with `cargo build -vv`.

> [!note] `cargo::` versus `cargo:`
> The double-colon form (`cargo::rustc-env=…`) is the modern syntax, available since Rust **1.77**. Older code uses a single colon (`cargo:rustc-env=…`), which still works but is deprecated. Use `cargo::` unless you need to support pre-1.77 toolchains — and if you do, note that Cargo silently ignores *unknown* single-colon keys rather than erroring, which has hidden many typos over the years.

## The instruction set

| Instruction | Effect |
|---|---|
| `cargo::rerun-if-changed=PATH` | re-run the script only when `PATH` changes |
| `cargo::rerun-if-env-changed=VAR` | re-run when an env var changes |
| `cargo::rustc-env=KEY=VALUE` | make `env!("KEY")` work in your crate |
| `cargo::rustc-cfg=KEY` | enable `#[cfg(KEY)]` in your crate |
| `cargo::rustc-check-cfg=cfg(KEY)` | declare a cfg so the compiler doesn't warn about it |
| `cargo::rustc-link-lib=NAME` | link against a native library |
| `cargo::rustc-link-search=PATH` | add a directory to the linker search path |
| `cargo::rustc-link-arg=FLAG` | pass a raw flag to the linker |
| `cargo::rustc-cdylib-link-arg=FLAG` | same, but only for `cdylib` targets |
| `cargo::warning=MESSAGE` | print a build warning the user will see |
| `cargo::error=MESSAGE` | fail the build with a message (Rust 1.84+) |
| `cargo::metadata=KEY=VALUE` | pass a value to dependent crates' build scripts |

## Rule one: declare your inputs, or nothing caches

By default, Cargo re-runs your build script whenever **any file in the package** changes. The moment you print a single `rerun-if-changed`, that default is replaced entirely by what you declared.

```rust,ignore
// build.rs
fn main() {
    // ✅ Precise: re-run only when the schema or the script itself changes.
    println!("cargo::rerun-if-changed=schema/api.json");
    println!("cargo::rerun-if-changed=build.rs");
    println!("cargo::rerun-if-env-changed=API_BASE_URL");

    // Note that declaring a DIRECTORY watches its entries, but not
    // recursively — list subdirectories explicitly, or walk them yourself.
    println!("cargo::rerun-if-changed=proto/");
}
```

> [!mistake] The most expensive build-script bug is forgetting `rerun-if-changed`
> Without it, every edit to any source file re-runs your script — and if that script compiles a C library, you've just added thirty seconds to every single build. With a *wrong* one, your generated code goes stale and you get baffling errors from code that "should" have been regenerated. Always print `cargo::rerun-if-changed=build.rs` at minimum, plus every real input.

> [!warning] A build script that reads the network or the clock is not reproducible
> Two builds of the same commit should produce the same binary. Downloading a dependency, embedding `SystemTime::now()`, or reading an unlisted environment variable breaks that — which breaks caching, breaks CI reproducibility, and makes "works on my machine" unanswerable. Bake in a git hash (deterministic per commit); don't bake in a timestamp.

## Generating code into `OUT_DIR`

The one directory a build script may write to is `OUT_DIR`. You then pull the result into your crate with `include!`.

```rust,ignore
// build.rs — turn a list into a compile-time lookup table
use std::env;
use std::fs;
use std::path::Path;

fn main() {
    let out_dir = env::var("OUT_DIR").unwrap();
    let dest = Path::new(&out_dir).join("countries.rs");

    let rows = [("gb", "United Kingdom"), ("jp", "Japan"), ("br", "Brazil")];

    let mut code = String::from("pub static COUNTRIES: &[(&str, &str)] = &[\n");
    for (code_str, name) in rows {
        code.push_str(&format!("    ({code_str:?}, {name:?}),\n"));
    }
    code.push_str("];\n");

    fs::write(&dest, code).unwrap();
    println!("cargo::rerun-if-changed=build.rs");
}
```

```rust,ignore
// src/lib.rs
include!(concat!(env!("OUT_DIR"), "/countries.rs"));

pub fn name_of(code: &str) -> Option<&'static str> {
    COUNTRIES.iter().find(|(c, _)| *c == code).map(|(_, n)| *n)
}
```

The generated file is ordinary Rust, so this is what your crate effectively compiles — and it's fully runnable on its own:

```rust
// This is exactly what the build script above produces, inlined.
pub static COUNTRIES: &[(&str, &str)] = &[
    ("gb", "United Kingdom"),
    ("jp", "Japan"),
    ("br", "Brazil"),
];

pub fn name_of(code: &str) -> Option<&'static str> {
    COUNTRIES.iter().find(|(c, _)| *c == code).map(|(_, n)| *n)
}

fn main() {
    println!("{:?}", name_of("jp"));  // Some("Japan")
    println!("{:?}", name_of("zz"));  // None
    println!("{} countries known at compile time", COUNTRIES.len());
}
```

> [!best] `include!` at module scope, or wrap it in a module
> `include!(concat!(env!("OUT_DIR"), "/generated.rs"))` pastes the file's contents at that exact spot, so put it where you want those items to live. Wrapping it — `mod generated { include!(…); }` — keeps generated names out of your root namespace and makes it obvious in a code review which items aren't hand-written. That's worth the extra line.

> [!warning] Never write outside `OUT_DIR`
> Writing into `src/` from a build script means your repository changes when you compile, which breaks `cargo package`, confuses version control, and fails outright when the source tree is read-only (as it is in Docker builds, Nix, and most CI caches). `OUT_DIR` is per-target and per-profile, so debug and release builds don't fight. It's the only correct answer.

## Linking against C libraries

The other main job: compile and link native code. The `cc` crate handles the compiler-detection mess for you.

```toml
# Cargo.toml — build dependencies are separate from normal ones
[package]
name = "my-crate"
version = "0.1.0"
edition = "2021"

[build-dependencies]
cc = "1"

[dependencies]
```

```rust,ignore
// build.rs
fn main() {
    cc::Build::new()
        .file("csrc/fast_hash.c")
        .opt_level(3)
        .warnings(true)
        .compile("fast_hash"); // produces libfast_hash.a and links it

    println!("cargo::rerun-if-changed=csrc/fast_hash.c");
}
```

```rust,ignore
// src/lib.rs
extern "C" {
    fn fast_hash(data: *const u8, len: usize) -> u64;
}

pub fn hash(bytes: &[u8]) -> u64 {
    // Safe wrapper: the pointer and length always agree because they come
    // from the same slice, and the C function only reads.
    unsafe { fast_hash(bytes.as_ptr(), bytes.len()) }
}
```

For a library that's already installed on the system, `pkg-config` finds it and prints the right flags:

```rust,ignore
// build.rs
fn main() {
    // Emits the rustc-link-lib and rustc-link-search lines for you.
    if let Err(e) = pkg_config::Config::new().atleast_version("1.2").probe("zlib") {
        println!("cargo::warning=zlib not found: {e}");
        println!("cargo::error=install zlib development headers to build this crate");
    }
}
```

| Crate | Use for |
|---|---|
| `cc` | compiling C/C++ sources you ship |
| `pkg-config` | finding system libraries on Unix |
| `vcpkg` | the same, on Windows |
| `bindgen` | generating Rust `extern` declarations from C headers |
| `cxx` | safe, generated C++ interop (two-way) |
| `prost-build` / `tonic-build` | Protobuf → Rust |
| `built` | build metadata (version, profile, host) as constants |

See [FFI](#/ch/ffi) for what to do with those `extern` blocks once they exist.

## The environment a build script runs in

Cargo sets a long list of variables. The ones that matter:

| Variable | Meaning |
|---|---|
| `OUT_DIR` | the only writable directory — put generated files here |
| `TARGET` | the target triple being built for (e.g. `x86_64-unknown-linux-gnu`) |
| `HOST` | the triple of the machine doing the building |
| `PROFILE` | `debug` or `release` |
| `OPT_LEVEL` | `0`–`3`, `s`, or `z` |
| `NUM_JOBS` | parallelism Cargo is using — pass it to `make -j` |
| `CARGO_MANIFEST_DIR` | your package root; use this, not the working directory |
| `CARGO_PKG_VERSION` | your package's version |
| `CARGO_CFG_TARGET_OS` | `linux`, `windows`, `macos`, … |
| `CARGO_CFG_TARGET_ARCH` | `x86_64`, `aarch64`, … |
| `CARGO_CFG_TARGET_FAMILY` | `unix` or `windows` |
| `CARGO_FEATURE_<NAME>` | set when feature `<name>` is enabled |
| `DEP_<NAME>_<KEY>` | metadata published by a dependency's build script |

```rust,ignore
// build.rs — branching on the target, not the host
use std::env;

fn main() {
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap();

    match target_os.as_str() {
        "windows" => println!("cargo::rustc-link-lib=ws2_32"),
        "macos" => println!("cargo::rustc-link-lib=framework=Security"),
        _ => println!("cargo::rustc-link-lib=dl"),
    }

    // Feature flags reach the build script too:
    if env::var("CARGO_FEATURE_SIMD").is_ok() {
        println!("cargo::rustc-cfg=has_simd");
        println!("cargo::rustc-check-cfg=cfg(has_simd)");
    }
}
```

> [!mistake] `#[cfg(target_os = "…")]` inside `build.rs` describes the wrong machine
> A build script is compiled for the **host** and runs on the host, so `cfg!(target_os)` inside it tells you about the build machine — which is wrong the moment anyone cross-compiles. Read `CARGO_CFG_TARGET_OS` from the environment instead; that's the target. This bug is invisible until someone builds your crate for a Raspberry Pi, and then it's baffling. See [Cross-Compilation](#/ch/cross-compilation).

> [!tip] Use `CARGO_MANIFEST_DIR`, never a relative path
> The working directory of a build script is *technically* the package root today, but relying on it is fragile — and it definitively breaks inside workspaces and some tooling. `Path::new(&env::var("CARGO_MANIFEST_DIR").unwrap()).join("schema/api.json")` always resolves correctly.

## Costs and alternatives

Build scripts are powerful and genuinely expensive. Every crate in your dependency tree with a `build.rs` adds a compile-and-run step that cannot be parallelized away, and it defeats some caching.

| You want to… | Consider first |
|---|---|
| generate code from a Rust type | a **derive macro** — no build script needed |
| generate code from a macro-like syntax | a **proc macro** ([Procedural Macros](#/ch/macros-procedural)) |
| embed a file's contents | `include_str!` / `include_bytes!` — built in, no script |
| branch on OS or features | `#[cfg(…)]` ([Conditional Compilation](#/ch/conditional-compilation)) |
| know your own version | `env!("CARGO_PKG_VERSION")` — already available |
| pick a value at runtime | just read it at runtime; not everything must be compile-time |
| generate from a `.proto` or `.sql` schema | a build script is genuinely the right tool |
| compile C/C++ | a build script is genuinely the right tool |

> [!performance] Build scripts are a tax on every consumer of your crate
> A `build.rs` that shells out to `git`, probes for libraries, or compiles C runs for **every** downstream user, on every clean build, in every CI job. That's a real reason the ecosystem prefers proc macros and `include_str!` where they suffice. If you publish a crate, ask whether the build script is load-bearing — and if it is, make it fast and cache-friendly with precise `rerun-if-changed` lines.

> [!deep] Why build scripts can't be sandboxed
> A build script is arbitrary Rust code running with your full user privileges at `cargo build` time. That's a genuine supply-chain concern: adding a dependency means trusting its build script too. Cargo has no sandbox for this today, which is why `cargo vet`, `cargo crev`, and `cargo deny` exist, and why `cargo build --offline` and vendored dependencies matter in security-sensitive settings. Reviewing the `build.rs` of a new dependency is a habit worth having — see [The Cargo Toolbox](#/ch/cargo-deep).

## Summary

- A **`build.rs`** at the package root is compiled and run by Cargo **before** your crate. It produces two things: files in `OUT_DIR`, and `cargo::` instructions on stdout.
- **Always declare inputs** with `cargo::rerun-if-changed`. Printing one replaces the default "any file changed", so list every real input plus `build.rs` itself.
- Write generated code to **`OUT_DIR`** and pull it in with `include!(concat!(env!("OUT_DIR"), "/file.rs"))`. Never write into `src/`.
- Use **`cc`** to compile C you ship, **`pkg-config`**/`vcpkg` to find system libraries, and **`bindgen`** to generate declarations.
- Read the **target** from `CARGO_CFG_TARGET_OS`, not from `cfg!` — a build script is compiled for the *host*.
- Use `CARGO_MANIFEST_DIR` to locate your own files, never a relative path.
- Build scripts are a **tax on every downstream user**. Prefer derive macros, proc macros, `include_str!`, or `#[cfg]` when they'd do the job.

> [!exercise] Try it yourself
> 1. Create a crate with a `build.rs` that sets `cargo::rustc-env=BUILD_PROFILE=$PROFILE`, and print it from `main` with `env!`. Build in debug and release and confirm the value changes.
> 2. Write a build script that generates a `const WORD_COUNT: usize` from a text file in your repo, and `include!` it. Then edit the text file *without* a `rerun-if-changed` line and observe the stale value.
> 3. Add the `rerun-if-changed` line and confirm the value now updates.
> 4. Make a build script that prints `cargo::warning=…` and see where the message appears in `cargo build` output.
> 5. Find a crate in your `Cargo.lock` that has a `build.rs` (try `cargo tree` and check a few). Read it. Would you be comfortable running it?

Next, the compile-time switchboard that build scripts feed into: **conditional compilation** with `cfg` and feature flags.
