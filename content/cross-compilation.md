<h1><span class="h1-kicker">Tooling & Workflow</span>Cross-Compilation & Targets</h1>

One of Rust's quiet superpowers: the same source can produce a binary for a machine you don't own, running an operating system you're not using, on a processor you don't have. Build a Linux server binary from a Mac, an ARM binary for a Raspberry Pi from an x86 laptop, or a WebAssembly module for the browser — usually with one command.

The theory is simple. The practice has exactly one hard part, and this chapter is mostly about that part.

## Target triples

A **target** is named by a triple (which usually has four parts, because computing):

```text
x86_64 - unknown - linux - gnu
  │         │        │      │
  │         │        │      └── environment / ABI: gnu, musl, msvc, gnueabihf, ""
  │         │        └───────── operating system: linux, windows, darwin, none, wasi
  │         └────────────────── vendor: unknown, apple, pc (usually meaningless)
  └──────────────────────────── architecture: x86_64, aarch64, arm, wasm32, riscv64
```

```bash
rustc -vV                          # your host triple, on the "host:" line
rustc --print target-list          # every target rustc knows (200+)
rustup target list                 # which are installable
rustup target list --installed     # which you have
```

| Target triple | Runs on |
|---|---|
| `x86_64-unknown-linux-gnu` | ordinary 64-bit Linux (glibc) — the most common server target |
| `x86_64-unknown-linux-musl` | any Linux, **statically linked**, no glibc needed |
| `aarch64-unknown-linux-gnu` | 64-bit ARM Linux — AWS Graviton, Raspberry Pi 4/5 (64-bit OS) |
| `aarch64-unknown-linux-musl` | the same, statically linked |
| `armv7-unknown-linux-gnueabihf` | 32-bit ARM with hardware float — older Pis, many embedded boards |
| `aarch64-apple-darwin` | Apple Silicon macOS |
| `x86_64-apple-darwin` | Intel macOS |
| `x86_64-pc-windows-msvc` | Windows, Microsoft toolchain (the normal choice) |
| `x86_64-pc-windows-gnu` | Windows via MinGW — cross-compilable from Linux |
| `wasm32-unknown-unknown` | the browser, via `wasm-bindgen` |
| `wasm32-wasip1` | WebAssembly with system access (WASI) |
| `thumbv7em-none-eabihf` | Cortex-M4/M7 microcontrollers — bare metal, `no_std` |
| `riscv64gc-unknown-linux-gnu` | 64-bit RISC-V Linux |

> [!jargon] Tier 1, 2, and 3
> Rust classifies targets by how much the project guarantees. **Tier 1** targets are built and fully tested in CI — they're guaranteed to work (x86_64 Linux/macOS/Windows, aarch64 Linux/macOS). **Tier 2** targets are guaranteed to *build* but aren't test-run; you can `rustup target add` them and they're generally reliable. **Tier 3** targets aren't built by the project at all — they may need a nightly compiler and a source build. Check the tier before you commit to a platform.

## The easy case: pure Rust

If your crate and all its dependencies are pure Rust, cross-compiling is two commands.

```bash
rustup target add aarch64-unknown-linux-gnu
cargo build --release --target aarch64-unknown-linux-gnu

# The binary lands in a target-specific directory:
ls target/aarch64-unknown-linux-gnu/release/
```

```rust
fn main() {
    // A program can report the target it was compiled for. These constants
    // are baked in at compile time by the compiler itself.
    println!("os       = {}", std::env::consts::OS);
    println!("arch     = {}", std::env::consts::ARCH);
    println!("exe ext  = {:?}", std::env::consts::EXE_SUFFIX);
    println!("dll ext  = {:?}", std::env::consts::DLL_EXTENSION);
    println!("pointer  = {} bits", usize::BITS);
    println!("endian   = {}", if cfg!(target_endian = "little") { "little" } else { "big" });

    // Byte order matters the moment you write a binary format or talk to a network.
    let n: u32 = 0x1234_5678;
    println!("native   = {:02x?}", n.to_ne_bytes());
    println!("big      = {:02x?}", n.to_be_bytes());   // network byte order
    println!("little   = {:02x?}", n.to_le_bytes());
}
```

> [!key] `to_be_bytes` / `from_be_bytes` for anything that leaves the machine
> Endianness is where cross-platform code silently corrupts data. A struct written to disk with native byte order on x86 (little-endian) reads back as garbage on a big-endian machine. Always pick an explicit order for **file formats, network protocols, and checksums** — `to_be_bytes` (big-endian, the network convention) or `to_le_bytes`. Never `to_ne_bytes` for data that crosses a boundary.

## The hard part: linking

Compiling Rust for another target is easy — `rustc` is a cross-compiler by nature. The problem is the **linker**, which must produce a binary in the target platform's format and resolve any C libraries for that platform.

<figure class="diagram">
<svg viewBox="0 0 640 240" role="img" aria-label="Rust compilation cross-compiles easily, but the linking step needs a target-specific linker and C libraries" >
  <style>
    .xc-h { font: 700 12px var(--font-sans); }
    .xc-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .xc-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .xc-ok { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .xc-hard { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.5; }
    .xc-out { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="20" y="60" width="130" height="50" rx="5" class="xc-ok"/>
  <text x="32" y="82" class="xc-m">your .rs files</text>
  <text x="32" y="99" class="xc-c">any target</text>
  <rect x="180" y="60" width="150" height="50" rx="5" class="xc-ok"/>
  <text x="192" y="82" class="xc-m">rustc --target …</text>
  <text x="192" y="99" class="xc-c">✅ easy: just add it</text>
  <rect x="360" y="45" width="150" height="80" rx="5" class="xc-hard"/>
  <text x="372" y="67" class="xc-m">the LINKER</text>
  <text x="372" y="85" class="xc-c">❌ needs a target</text>
  <text x="372" y="100" class="xc-c">toolchain + libc</text>
  <text x="372" y="115" class="xc-c">for that platform</text>
  <rect x="360" y="150" width="240" height="44" rx="5" class="xc-out"/>
  <text x="372" y="170" class="xc-m">target/&lt;triple&gt;/release/app</text>
  <text x="372" y="186" class="xc-c">a binary for the other machine</text>
  <path d="M152 85 L178 85" stroke="var(--green)" stroke-width="2.5" marker-end="url(#arr-xc)"/>
  <path d="M332 85 L358 85" stroke="var(--red)" stroke-width="2.5" marker-end="url(#arr-xc2)"/>
  <path d="M435 127 L435 148" stroke="var(--rust-500)" stroke-width="2.5" marker-end="url(#arr-xc3)"/>
  <text x="20" y="150" class="xc-h" fill="var(--text-mute)">Three ways past the linker:</text>
  <text x="20" y="170" class="xc-c">1. <tspan font-family="var(--font-mono)">cargo zigbuild</tspan> — zig as the linker</text>
  <text x="20" y="188" class="xc-c">2. <tspan font-family="var(--font-mono)">cross</tspan> — Docker per target</text>
  <text x="20" y="206" class="xc-c">3. install a GCC cross-toolchain</text>
  <text x="20" y="230" class="xc-c">Or sidestep it: <tspan font-family="var(--font-mono)">musl</tspan> + pure-Rust dependencies needs no C linker at all.</text>
  <defs>
    <marker id="arr-xc" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--green)"/></marker>
    <marker id="arr-xc2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--red)"/></marker>
    <marker id="arr-xc3" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker>
  </defs>
</svg>
<figcaption>Rust cross-compiles trivially; the <b>linker</b> is the obstacle. Every solution below is a different way of supplying one.</figcaption>
</figure>

If you see `error: linker 'cc' not found` or `cannot find -lgcc`, this is what's happening.

### Option 1: `cross` — Docker does the work

The lowest-effort route. `cross` runs the build inside a container that already has the right toolchain.

```bash
cargo install cross --git https://github.com/cross-rs/cross

# Identical to cargo, but containerized. Needs Docker or Podman running.
cross build --release --target aarch64-unknown-linux-gnu
cross test --target armv7-unknown-linux-gnueabihf
```

```toml
# Cross.toml — extra setup for a target, if you need system packages
[target.aarch64-unknown-linux-gnu]
pre-build = ["dpkg --add-architecture arm64", "apt-get update && apt-get install -y libssl-dev:arm64"]
```

### Option 2: `cargo-zigbuild` — Zig as a universal linker

Zig ships a complete cross-linker with bundled libc headers. It's fast, needs no Docker, and even lets you target a specific older glibc.

```bash
pip install ziglang            # or install zig however you prefer
cargo install cargo-zigbuild

cargo zigbuild --release --target aarch64-unknown-linux-gnu

# The killer feature: pin the glibc version so the binary runs on older distros.
cargo zigbuild --release --target x86_64-unknown-linux-gnu.2.17
```

### Option 3: a native cross-toolchain

Most control, most setup. Install the cross-compiler and point Cargo at it.

```bash
# Debian/Ubuntu: the GCC cross-toolchain for 64-bit ARM
sudo apt install gcc-aarch64-linux-gnu
rustup target add aarch64-unknown-linux-gnu
```

```toml
# .cargo/config.toml
[target.aarch64-unknown-linux-gnu]
linker = "aarch64-linux-gnu-gcc"

[target.armv7-unknown-linux-gnueabihf]
linker = "arm-linux-gnueabihf-gcc"

[target.x86_64-unknown-linux-musl]
linker = "x86_64-linux-musl-gcc"

# For C dependencies, the cc crate reads these:
[env]
CC_aarch64_unknown_linux_gnu = "aarch64-linux-gnu-gcc"
AR_aarch64_unknown_linux_gnu = "aarch64-linux-gnu-ar"
```

| Approach | Setup | Speed | Handles C deps |
|---|---|---|---|
| plain `cargo --target` | trivial | fastest | only if no linking needed |
| **`cargo-zigbuild`** | one install | fast | yes, well |
| **`cross`** | Docker required | slower (container) | yes, best coverage |
| native cross-toolchain | per-target apt/brew | fast | yes, with configuration |
| build on the target itself | none | slow on small devices | trivially |
| GitHub Actions matrix | CI config | parallel | yes, natively per-runner |

> [!best] Try `cargo-zigbuild` first, fall back to `cross`
> `zigbuild` handles the overwhelming majority of Linux cross-compiles with a single install and no container overhead, and the glibc-version pinning solves the "built on Ubuntu 24.04, won't run on CentOS 7" problem that nothing else fixes cleanly. Reach for `cross` when a dependency needs real system packages for the target, since its images already have them.

## Static binaries with musl

A binary linked against glibc needs a compatible glibc wherever it runs. Link against **musl** instead and you get a single static file with no runtime dependencies at all — ideal for containers and for shipping one binary to unknown machines.

```bash
rustup target add x86_64-unknown-linux-musl
cargo build --release --target x86_64-unknown-linux-musl

file target/x86_64-unknown-linux-musl/release/myapp
# → ELF 64-bit LSB executable, statically linked
```

That binary runs in a `FROM scratch` Docker image — no distro, no libc, nothing:

```dockerfile
FROM rust:1.83-alpine AS builder
RUN apk add --no-cache musl-dev
WORKDIR /build
COPY . .
RUN cargo build --release --target x86_64-unknown-linux-musl

FROM scratch
COPY --from=builder /build/target/x86_64-unknown-linux-musl/release/myapp /myapp
ENTRYPOINT ["/myapp"]
```

> [!warning] musl's allocator is slow under multi-threaded load
> This is the one real gotcha. musl's `malloc` performs poorly with many threads allocating concurrently — reports of 5–10× slowdowns on allocation-heavy concurrent workloads are common. The fix is to bring your own allocator: add `jemallocator` or `mimalloc` and set it as the global allocator. If you're shipping a musl-static server, benchmark it against the glibc build before assuming static linking was free.

> [!tip] Use `rustls` instead of `native-tls` to avoid the OpenSSL problem
> The single most common cross-compilation failure is OpenSSL: it's a C library, so it needs headers and a build for the *target*, which is exactly the hard case. `rustls` is a pure-Rust TLS implementation, so it cross-compiles with no C toolchain at all. Most crates support it via a feature — `reqwest = { version = "0.12", default-features = false, features = ["rustls-tls"] }`. Switching removes the problem rather than solving it.

## Writing code that actually is portable

Cross-compiling successfully is not the same as working correctly.

| Assumption | Breaks on | Do instead |
|---|---|---|
| paths use `/` | Windows | `Path::join`, never string concatenation |
| `usize` is 64 bits | wasm32, 32-bit ARM | `u64` explicitly when you mean 64 bits |
| little-endian | some MIPS/PowerPC | `to_be_bytes` / `from_be_bytes` |
| line endings are `\n` | Windows | `.lines()` handles `\r\n` already |
| `std::env::var("HOME")` | Windows | the `dirs` or `directories` crate |
| a case-sensitive filesystem | macOS, Windows | don't rely on case to distinguish files |
| `char` is one byte | everywhere | it's a 4-byte Unicode scalar value |
| threads exist | `wasm32-unknown-unknown` | feature-gate the threaded path |
| a clock exists | bare-metal `no_std` | inject time as a dependency |
| `f64` is exactly reproducible | different arches | don't compare float bit patterns across platforms |

```rust
use std::path::{Path, PathBuf};

fn main() {
    // ✅ Portable: Path::join uses the platform separator.
    let base = Path::new("data");
    let file: PathBuf = base.join("logs").join("app.log");
    println!("{}", file.display());

    // ❌ Not portable: "data/logs/app.log" is wrong on Windows.

    // Extensions and stems work the same everywhere:
    println!("stem = {:?}, ext = {:?}", file.file_stem(), file.extension());

    // Sizes that must be stable across targets should be explicit:
    println!("usize is {} bits here, but u64 is always 64", usize::BITS);

    // Writing a portable binary header:
    let magic: u32 = 0xCAFE_BABE;
    let version: u16 = 3;
    let mut header = Vec::new();
    header.extend_from_slice(&magic.to_be_bytes());   // explicit big-endian
    header.extend_from_slice(&version.to_be_bytes());
    println!("header = {header:02x?}");

    // …and reading it back the same way.
    let read_magic = u32::from_be_bytes(header[0..4].try_into().unwrap());
    println!("round-trip ok: {}", read_magic == magic);
}
```

## A taste of `no_std`

For a microcontroller — or a WebAssembly module that should stay tiny — there's no operating system, so there's no `std`. You opt out and use `core` (always available) plus optionally `alloc` (if you provide an allocator).

```rust,ignore
#![no_std]
#![no_main]

use core::panic::PanicInfo;

// With no OS, nobody catches a panic — you must define what happens.
#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}

// No runtime means no `fn main` — the entry point is defined by the target.
#[no_mangle]
pub extern "C" fn _start() -> ! {
    let mut sum: u32 = 0;
    for i in 1..=10 {
        sum += i;
    }
    let _ = sum;
    loop {}
}
```

| Available in | `core` | `alloc` | `std` |
|---|---|---|---|
| `Option`, `Result`, iterators, `Ord` | ✅ | ✅ | ✅ |
| integer/float maths, `fmt::Write` | ✅ | ✅ | ✅ |
| `Vec`, `String`, `Box`, `BTreeMap` | ❌ | ✅ | ✅ |
| `HashMap` (needs a random seed) | ❌ | ❌ | ✅ |
| files, sockets, threads, time, env | ❌ | ❌ | ✅ |
| `println!` | ❌ | ❌ | ✅ |

> [!best] Make your library `no_std`-compatible with a feature flag
> The convention costs two lines and dramatically widens who can use your crate:
> ```rust,ignore
> #![cfg_attr(not(feature = "std"), no_std)]
> #[cfg(feature = "alloc")]
> extern crate alloc;
> ```
> with `default = ["std"]` in `Cargo.toml`. Then embedded users build `--no-default-features` and everyone else notices nothing. Test the no-default path in CI or it will rot — see [Conditional Compilation](#/ch/conditional-compilation). For the full embedded story, see [A Taste of Embedded Rust](#/ch/project-embedded).

## Building every target in CI

GitHub Actions can build natively on each platform in parallel, which sidesteps cross-compilation entirely for the common cases:

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - { os: ubuntu-latest,  target: x86_64-unknown-linux-gnu,   cross: false }
          - { os: ubuntu-latest,  target: x86_64-unknown-linux-musl,  cross: true }
          - { os: ubuntu-latest,  target: aarch64-unknown-linux-gnu,  cross: true }
          - { os: macos-latest,   target: aarch64-apple-darwin,       cross: false }
          - { os: macos-latest,   target: x86_64-apple-darwin,        cross: false }
          - { os: windows-latest, target: x86_64-pc-windows-msvc,     cross: false }
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}
      - uses: Swatinem/rust-cache@v2
        with:
          key: ${{ matrix.target }}
      - if: matrix.cross
        run: cargo install cross --git https://github.com/cross-rs/cross
      - run: ${{ matrix.cross && 'cross' || 'cargo' }} build --release --target ${{ matrix.target }}
      - uses: actions/upload-artifact@v4
        with:
          name: myapp-${{ matrix.target }}
          path: target/${{ matrix.target }}/release/myapp*
```

> [!tip] `fail-fast: false` on a release matrix
> By default one failing target cancels the rest, so you learn about a single broken platform and nothing about the other five. Setting `fail-fast: false` gets you the complete picture in one run — which matters when the fix for each platform is different. Also cache per target (`key: ${{ matrix.target }}`); a shared cache key across targets thrashes and helps nobody. More on this in [CI/CD for Rust](#/ch/ci-cd).

## Summary

- Targets are named by **triple**: `arch-vendor-os-env`. `rustup target list` shows what's installable; check the **tier** before committing to a platform.
- For pure Rust, cross-compiling is `rustup target add X` then `cargo build --target X`. The **linker** is the only hard part.
- Three ways past it: **`cargo-zigbuild`** (try first — one install, and it can pin a glibc version), **`cross`** (Docker, best C-dependency coverage), or a native cross-toolchain configured in `.cargo/config.toml`.
- **musl** gives a fully static binary that runs anywhere and fits a `FROM scratch` image — but its allocator is slow under concurrency, so bring `mimalloc` or `jemallocator`.
- **Use `rustls` instead of OpenSSL** to remove the most common cross-compilation failure entirely.
- Portable *code* is a separate discipline: `Path::join` not `/`, explicit `to_be_bytes` for anything leaving the machine, don't assume `usize` is 64 bits, don't assume threads or a clock exist.
- **`no_std`** drops to `core` (+ `alloc` with an allocator). Support it behind a feature flag and test that path in CI.
- A **CI matrix** with `fail-fast: false` and per-target caching builds every platform natively in parallel.

> [!exercise] Try it yourself
> 1. Run `rustc -vV` and identify your host triple. Then `rustup target list --installed`.
> 2. Add the `wasm32-unknown-unknown` target and build a small pure-Rust library for it. What happens if the crate uses `std::fs`?
> 3. Build a hello-world for `x86_64-unknown-linux-musl` and confirm with `file` that it's statically linked. Compare its size to the glibc build.
> 4. Write a function that serializes a `u32` and a `u16` into a byte vector with explicit big-endian order, then parses it back. Now write the `to_ne_bytes` version and explain what would go wrong.
> 5. Take a project that depends on `reqwest` with default features and switch it to `rustls-tls`. Then try cross-compiling to `aarch64-unknown-linux-musl` both ways.

That completes the tooling part. Next we turn to making the code itself fast — starting with **optimization: how to find out what's actually slow**.
