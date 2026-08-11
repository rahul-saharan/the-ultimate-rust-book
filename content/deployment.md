<h1><span class="h1-kicker">Performance & Production</span>Deployment & Binary Size</h1>

Rust compiles to a single self-contained executable with no runtime, no interpreter, and no virtual machine. That makes deployment genuinely simpler than most languages — but there are three things that trip people up: Docker builds that recompile the world every time, binaries that are surprisingly large, and glibc version mismatches that only appear on the production machine.

This chapter fixes all three.

## What you're actually shipping

```rust
fn main() {
    // A Rust binary carries everything it needs. There is no runtime to install.
    println!("compiled for {} on {}", std::env::consts::OS, std::env::consts::ARCH);

    // Configuration comes from the environment, per the twelve-factor convention.
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8080);

    let log_level = std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string());

    // Fail fast and loudly on missing REQUIRED config — at startup, not at
    // 3am on the first request that needs it.
    match std::env::var("DATABASE_URL") {
        Ok(url) => println!("database configured ({} chars)", url.len()),
        Err(_) => println!("DATABASE_URL not set — in a real service, exit(1) here"),
    }

    println!("would listen on 0.0.0.0:{port} at log level {log_level}");
}
```

> [!best] Validate all configuration at startup, then never again
> Parse every environment variable into a typed `Config` struct in `main`, before you bind a port or accept traffic. A service that starts successfully and then dies on the first request that needs `SMTP_HOST` is far worse than one that refuses to start — the second is caught by your deploy, the first by your users. This is the "parse, don't validate" idea from [Rust Design Patterns](#/ch/idioms-patterns) applied to deployment.

| Config source | Good for | Reach for |
|---|---|---|
| environment variables | secrets, per-environment values | `std::env::var`, `envy` |
| CLI flags | operator overrides, one-off runs | `clap` ([clap](#/ch/clap)) |
| a config file | large or structured config | `serde` + `toml`/`yaml` |
| layered (file → env → flags) | real services | `figment` or `config` |
| a secret manager | production credentials | the vendor's SDK |
| baked into the binary | version, git hash | `env!` + [build.rs](#/ch/build-scripts) |

> [!warning] Never bake a secret into the binary
> `const API_KEY: &str = "sk-live-…"` ends up in plain text inside the executable — `strings ./myapp | grep sk-` will find it, and so will anyone who gets the container image. Secrets come from the environment or a secret manager at runtime, always. The same applies to committing a `.env` file with real credentials; keep `.env.example` in git and `.env` in `.gitignore`.

## Docker: the layer-caching trick

The naive Dockerfile recompiles every dependency on every source change, because `COPY . .` invalidates the cache. The fix is to copy the manifests first and build the dependencies as their own cached layer.

```dockerfile
# ---- build stage ----
FROM rust:1.83 AS builder
WORKDIR /app

# 1. Copy ONLY the manifests. This layer changes only when dependencies change.
COPY Cargo.toml Cargo.lock ./

# 2. Build the dependencies against a dummy source file, then discard it.
#    This produces a cached layer containing all compiled dependencies.
RUN mkdir src && echo "fn main() {}" > src/main.rs \
 && cargo build --release \
 && rm -rf src

# 3. NOW copy the real source. Only your crate recompiles from here on.
COPY src ./src
# Touch is needed so cargo notices main.rs changed despite the same mtime.
RUN touch src/main.rs && cargo build --release

# ---- runtime stage ----
# A tiny base with just glibc and CA certificates. No shell, no package manager.
FROM gcr.io/distroless/cc-debian12
COPY --from=builder /app/target/release/myapp /usr/local/bin/myapp
USER 1000:1000
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/myapp"]
```

<figure class="diagram">
<svg viewBox="0 0 640 250" role="img" aria-label="A multi-stage Docker build where the dependency layer is cached separately from the application source layer, and only the final binary is copied into a tiny runtime image">
  <style>
    .dk-h { font: 700 12px var(--font-sans); }
    .dk-m { font: 600 10px var(--font-mono); fill: var(--text); }
    .dk-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .dk-cache { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .dk-rebuild { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .dk-final { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .dk-drop { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; stroke-dasharray: 4 3; }
  </style>
  <text x="20" y="18" class="dk-h" fill="var(--text-mute)">builder stage (rust:1.83 — about 1.5 GB)</text>
  <rect x="20" y="28" width="270" height="40" rx="4" class="dk-cache"/>
  <text x="32" y="46" class="dk-m">COPY Cargo.toml Cargo.lock</text>
  <text x="32" y="61" class="dk-c">cached until deps change</text>
  <rect x="20" y="74" width="270" height="40" rx="4" class="dk-cache"/>
  <text x="32" y="92" class="dk-m">cargo build (dummy main.rs)</text>
  <text x="32" y="107" class="dk-c">✅ all dependencies, CACHED</text>
  <rect x="20" y="120" width="270" height="40" rx="4" class="dk-rebuild"/>
  <text x="32" y="138" class="dk-m">COPY src ; cargo build</text>
  <text x="32" y="153" class="dk-c">only YOUR crate rebuilds</text>
  <rect x="20" y="176" width="270" height="34" rx="4" class="dk-drop"/>
  <text x="32" y="197" class="dk-m">toolchain, target/, sources — DISCARDED</text>
  <text x="350" y="18" class="dk-h" fill="var(--blue)">runtime stage (distroless — ~20 MB)</text>
  <rect x="350" y="74" width="250" height="86" rx="5" class="dk-final"/>
  <text x="362" y="98" class="dk-m">/usr/local/bin/myapp</text>
  <text x="362" y="116" class="dk-c">one binary + CA certs</text>
  <text x="362" y="132" class="dk-c">no shell, no package manager</text>
  <text x="362" y="148" class="dk-c">USER 1000, non-root</text>
  <path d="M292 140 L346 120" stroke="var(--blue)" stroke-width="2.5" marker-end="url(#arr-dk)"/>
  <text x="300" y="112" class="dk-c">COPY --from=builder</text>
  <text x="20" y="234" class="dk-c">Without the manifest-first trick, editing one line of your code recompiles every dependency — minutes instead of seconds.</text>
  <defs><marker id="arr-dk" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--blue)"/></marker></defs>
</svg>
<figcaption>Copy manifests → build dependencies → copy source → build. The dependency layer is cached, so ordinary code changes rebuild in seconds.</figcaption>
</figure>

> [!best] Use `cargo-chef` instead of the dummy-`main.rs` trick
> The manual approach breaks with workspaces (each member needs its own dummy file) and with `lib.rs` + `main.rs` crates. `cargo-chef` computes a "recipe" of your dependencies and does this properly:
> ```dockerfile
> FROM rust:1.83 AS chef
> RUN cargo install cargo-chef
> WORKDIR /app
>
> FROM chef AS planner
> COPY . .
> RUN cargo chef prepare --recipe-path recipe.json
>
> FROM chef AS builder
> COPY --from=planner /app/recipe.json .
> RUN cargo chef cook --release --recipe-path recipe.json   # ← the cached layer
> COPY . .
> RUN cargo build --release
> ```
> It's the standard solution and worth adopting from the start.

| Runtime base image | Size | Notes |
|---|---|---|
| `scratch` | ~0 MB | needs a **static** (musl) binary; no CA certs, no DNS resolver |
| `gcr.io/distroless/static` | ~2 MB | for static binaries; includes CA certs and timezone data |
| `gcr.io/distroless/cc` | ~20 MB | glibc + CA certs; the safe default for dynamic binaries |
| `alpine` | ~8 MB | has a shell; needs musl; slow allocator (see below) |
| `debian:bookworm-slim` | ~75 MB | has a shell and `apt`; easiest to debug |
| `ubuntu` | ~78 MB | familiar; larger than needed |

> [!mistake] `FROM scratch` and a missing CA bundle
> A statically linked binary in `scratch` cannot make HTTPS requests — there are no root certificates in the image, so every TLS handshake fails with a certificate error that looks like a code bug. Either use `distroless/static` (which includes them), copy `/etc/ssl/certs/ca-certificates.crt` from the builder, or use the `webpki-roots` crate to compile the roots into your binary. The same applies to timezone data and `/etc/passwd` if you use them.

## Static binaries: one file, runs anywhere

```bash
rustup target add x86_64-unknown-linux-musl
cargo build --release --target x86_64-unknown-linux-musl
ldd target/x86_64-unknown-linux-musl/release/myapp
# → "not a dynamic executable"
```

That binary has no dependencies at all — copy it onto any Linux machine, of any distribution, of any vintage, and it runs.

```rust,ignore
// musl's allocator is slow under concurrent load. If you ship a musl
// static binary for a multi-threaded service, swap the allocator.
// Cargo.toml: mimalloc = "0.1"
use mimalloc::MiMalloc;

#[global_allocator]
static GLOBAL: MiMalloc = MiMalloc;

fn main() {
    println!("statically linked, with a fast allocator");
}
```

> [!warning] The glibc version problem, and how to avoid it
> A binary built on Ubuntu 24.04 links against that glibc and **will not start** on CentOS 7 — you get `version 'GLIBC_2.34' not found`, at exec time, in production. Three fixes, in order of preference: build for **musl** (fully static, no glibc at all); use **`cargo-zigbuild`** with a pinned glibc (`--target x86_64-unknown-linux-gnu.2.17`); or build inside a container based on the *oldest* distro you must support. Forward compatibility is fine — a binary built against old glibc runs on new systems — so always build against the oldest, never the newest. See [Cross-Compilation](#/ch/cross-compilation).

## Shrinking the binary

A default release build of a hello-world with a few dependencies is often several megabytes. Here's what to do about it, in order of value.

```toml
[profile.release]
opt-level = "z"        # optimize for size (try "s" first — often faster AND small)
lto = true             # link-time optimization removes cross-crate dead code
codegen-units = 1      # more inlining opportunities, better dead-code elimination
panic = "abort"        # removes all unwinding tables and landing pads
strip = "symbols"      # drop debug symbols — usually the single biggest win
```

```bash
cargo build --release
ls -lh target/release/myapp

# Find out WHAT is big before you try to shrink it.
cargo install cargo-bloat
cargo bloat --release -n 20              # biggest functions
cargo bloat --release --crates           # biggest crates

# Generic code duplicated per type is a common cause.
cargo install cargo-llvm-lines
cargo llvm-lines --release | head -20
```

| Change | Typical saving | Cost |
|---|---|---|
| `strip = "symbols"` | 30–60% | no backtraces with names |
| `lto = true` | 5–20% | slower link |
| `panic = "abort"` | 5–15% | no `catch_unwind` or `#[should_panic]` |
| `opt-level = "z"` | 5–15% | can be slower at runtime |
| `codegen-units = 1` | 5–10% | slower build |
| dropping an unused dependency | varies, sometimes huge | none — just do it |
| `default-features = false` on deps | often large | check what you lose |
| replacing `regex` with `str` methods | ~1 MB | less flexible |
| `Box<dyn Trait>` instead of generics | varies | one indirection |
| `upx --best` on the final binary | 50–70% | slower startup, AV false positives |

> [!performance] Measure with `cargo bloat` before you tune the profile
> Profile settings give you percentages; removing the wrong dependency gives you megabytes. `cargo bloat --release --crates` regularly reveals that one crate is 40% of the binary — often `regex`, a fully-featured `tokio`, `chrono` with all features, or a `clap` build with `derive` and colours. Trimming default features on two dependencies frequently beats every `[profile]` setting combined. And note that a smaller binary is only worth chasing when it matters — embedded, WASM, or a container you pull thousands of times a day.

> [!tip] `opt-level = "s"` before `"z"`
> `"z"` disables loop vectorization entirely, which sometimes makes the binary *bigger* (unvectorized loops can need more instructions) as well as slower. `"s"` optimizes for size while keeping vectorization. Measure both; `"s"` wins more often than its reputation suggests.

## Deploying without a container

Not everything needs Docker. A single binary plus a systemd unit is a perfectly good deployment.

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My Rust service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=myapp
Group=myapp
ExecStart=/usr/local/bin/myapp
Restart=always
RestartSec=5s

# Config and secrets
Environment=RUST_LOG=info
EnvironmentFile=/etc/myapp/env      # DATABASE_URL etc, chmod 600

# Hardening — cheap and worth it
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/myapp

# Let the service finish in-flight requests before dying
KillSignal=SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now myapp
sudo systemctl status myapp
journalctl -u myapp -f              # follow the logs
```

## Graceful shutdown

An orchestrator sends `SIGTERM` and waits. If your process exits immediately, every in-flight request fails. Handling this correctly is a small amount of code and the difference between visible and invisible deploys.

```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

fn main() {
    // A flag every worker checks. In a real service you'd combine this with
    // a broadcast channel so waiting tasks wake immediately.
    let shutdown = Arc::new(AtomicBool::new(false));

    // A signal handler would set this — with the `signal-hook` crate on Unix,
    // or tokio::signal::ctrl_c() in an async service.
    let flag = Arc::clone(&shutdown);

    let worker = std::thread::spawn(move || {
        let mut handled = 0;
        // Drain work until told to stop, then finish cleanly.
        while !flag.load(Ordering::Relaxed) && handled < 5 {
            handled += 1;
            println!("  handled request {handled}");
        }
        println!("  worker draining and exiting after {handled} requests");
        handled
    });

    let total = worker.join().expect("worker panicked");
    println!("shut down cleanly after {total} requests");

    // The order that matters:
    //  1. stop accepting NEW work (close the listener)
    //  2. let in-flight work finish, with a timeout
    //  3. flush logs and metrics
    //  4. close database pools
    //  5. exit 0
}
```

```rust,ignore
// The async version, which is what you'll actually write for a server.
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let app = /* your axum Router */;
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async { tokio::signal::ctrl_c().await.expect("ctrl-c handler") };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("SIGTERM handler")
            .recv()
            .await;
    };

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("shutdown signal received, draining");
}
```

> [!key] `SIGTERM`, not just `Ctrl-C`
> Kubernetes, systemd, and Docker all send **`SIGTERM`**. `Ctrl-C` sends `SIGINT`. Handling only `SIGINT` means your graceful shutdown works perfectly in local testing and does nothing in production — the container is killed with `SIGKILL` after the grace period and drops every connection. Handle both, and make sure your termination grace period (30s by default in Kubernetes) is longer than your slowest request.

## The pre-deploy checklist

| Check | Why |
|---|---|
| built with `--release` | 10–100× faster |
| `Cargo.lock` committed and used | reproducible builds; `--locked` in CI |
| glibc target ≤ the oldest production host | otherwise it won't start |
| all config validated at startup | fail on deploy, not on first request |
| no secrets in the binary or image | `strings` finds them |
| runs as a non-root user | container escape mitigation |
| health/readiness endpoint | so the orchestrator knows when you're up |
| `SIGTERM` handled, shutdown drains | invisible deploys |
| structured logging to stdout | see [Observability](#/ch/observability) |
| version and git hash in a startup log line | "which build is this?" |
| `cargo audit` / `cargo deny` clean | known CVEs |
| resource limits set | a memory leak shouldn't take the node down |
| a rollback plan | keep the previous image tagged |

> [!note] Rust services need less memory headroom than you're used to
> No GC means no heap that grows to 2–3× the live set, and no pause-time tuning. Rust services routinely run comfortably in 32–128 MB where a JVM or Node equivalent wants 512 MB or more. Set your container limits from measurement rather than from habit — but do set them, because a genuine leak (an unbounded queue, a cache with no eviction) will still consume everything available.

## Summary

- You ship **one self-contained binary** — no runtime to install. Configuration comes from the environment, validated into a typed struct **at startup**.
- **Never bake secrets into the binary**; `strings` will find them.
- In Docker, copy **manifests first** and build dependencies as their own layer — or use **`cargo-chef`**, which handles workspaces properly.
- Use a **small runtime image**: `distroless/cc` for dynamic binaries, `distroless/static` or `scratch` for musl — and remember `scratch` has **no CA certificates**.
- Build against the **oldest glibc** you must support, or go **static with musl** (adding `mimalloc` to fix musl's allocator).
- Shrink binaries with `strip`, `lto`, `panic = "abort"`, and `opt-level = "s"` — but run **`cargo bloat`** first, because dropping a dependency or its default features usually beats all of them.
- **systemd + a binary** is a legitimate deployment; use the hardening directives, they're free.
- Handle **`SIGTERM`** (not only `SIGINT`), stop accepting new work, drain in-flight work, then flush and exit.

> [!exercise] Try it yourself
> 1. Build a hello-world in release mode and record its size. Add `strip = "symbols"`, then `lto` and `panic = "abort"`, measuring after each. Which single change helped most?
> 2. Write the naive Dockerfile (`COPY . .` then build) and the manifest-first version for the same project. Time a rebuild after changing one line of `main.rs` in each.
> 3. Build for `x86_64-unknown-linux-musl` and confirm with `ldd` that it's static. Try running it in a `FROM scratch` container.
> 4. Add an HTTPS request to that static binary and run it in `scratch`. Diagnose the certificate failure, then fix it.
> 5. Run `cargo bloat --release --crates` on a project with real dependencies. Pick the biggest crate and see whether `default-features = false` still compiles.
> 6. Write a program that catches `SIGTERM`, prints a message, sleeps two seconds, and exits. Run it in Docker and `docker stop` it — did your handler run?

Next: knowing what your deployed service is actually doing — **CI/CD for Rust**, then observability.
