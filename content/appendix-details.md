<h1><span class="h1-kicker">Appendices</span>G · async-trait, Feature Flags & Compiler Options</h1>

Three small details that show up constantly in real crates — an attribute you'll see everywhere and mostly no longer need, and the two knobs (features and compiler flags) that decide what gets compiled and how fast it runs.

## Why `#[async_trait]` existed

An `async fn` is really a normal function returning an anonymous `impl Future`. That's fine on a plain type, but until Rust 1.75 a **trait** couldn't declare a method returning an unnameable type — so this simply didn't compile:

```rust,ignore
trait Fetcher {
    async fn fetch(&self, url: &str) -> String;  // error, before Rust 1.75
}
```

The [`async-trait`](https://docs.rs/async-trait) crate worked around it by rewriting each method to return a **boxed, dynamically-dispatched future** — roughly:

```rust,ignore
// What #[async_trait] generates, in spirit:
trait Fetcher {
    fn fetch<'a>(&'a self, url: &'a str)
        -> Pin<Box<dyn Future<Output = String> + Send + 'a>>;
}
```

That worked, at the cost of a heap allocation per call and a `dyn` indirection the compiler can't inline through.

## Why you (usually) don't need it now

**Rust 1.75 stabilized `async fn` in traits (AFIT)**, so the first snippet compiles as written — no macro, no `Box`, no allocation. The future's concrete type is preserved, so it inlines and optimizes like any other:

```rust
trait Greeter {
    async fn greet(&self, name: &str) -> String;   // just works
}

struct English;

impl Greeter for English {
    async fn greet(&self, name: &str) -> String {
        format!("Hello, {name}!")
    }
}

fn main() {
    let fut = English.greet("Ferris");
    // A tiny executor: this future never actually pends, so one poll finishes it.
    let result = futures::executor::block_on(fut);
    println!("{result}");
}
```

This is why [axum 0.8 dropped `#[async_trait]`](#/ch/axum) from its extractor traits, and why modern crates keep removing it.

> [!warning] The one case that still needs `async-trait`: `dyn Trait`
> AFIT is **not** `dyn`-compatible. A trait with an `async fn` can't be used as a trait object, because each impl's future is a different size — so `Box<dyn Greeter>` is rejected:
> ```text
> error[E0038]: the trait `Greeter` cannot be made into an object
> ```
> If you genuinely need dynamic dispatch over async methods (a plugin registry, a heterogeneous `Vec` of handlers), `#[async_trait]` is still the pragmatic answer — its boxing is exactly what makes the trait object-safe. Otherwise prefer plain AFIT and, if you need to store mixed implementers, reach for an enum or generics instead.

| Situation | Use |
|---|---|
| Trait used with generics / `impl Trait` | plain `async fn` (AFIT) |
| Trait used as `dyn Trait` | `#[async_trait]` |
| Public trait, want `Send` futures guaranteed | AFIT + [`trait-variant`](https://docs.rs/trait-variant), or `#[async_trait]` |
| Supporting Rust < 1.75 | `#[async_trait]` |

## Feature flags, briefly

**Features** are named, opt-in slices of a crate. They're how one crate serves many use cases without compiling everything for everyone:

```toml
[features]
default = ["json"]          # on unless the user opts out
json = ["dep:serde_json"]   # enables an optional dependency
tls = []                    # a plain flag with no extra deps

[dependencies]
serde_json = { version = "1", optional = true }
```

Gate code with `#[cfg(feature = "...")]`:

```rust,ignore
#[cfg(feature = "json")]
pub fn to_json(&self) -> String { serde_json::to_string(self).unwrap() }
```

And choose them per dependency, or on the command line:

```toml
tokio = { version = "1", features = ["full"] }
axum  = { version = "0.8", default-features = false, features = ["json"] }
```

```bash
cargo build --features tls
cargo build --no-default-features
cargo check --all-features        # what CI should do
```

> [!key] Features must be *additive*
> Enabling a feature should only ever **add** capability, never remove or change existing behavior. Cargo unifies features across the whole dependency graph: if two crates depend on `foo` and one enables `foo/tls`, **everyone** gets `foo/tls`. A feature that removes an API or flips a default will break an unrelated crate that never asked for it. Mutually exclusive features are an anti-pattern for the same reason — there's no way to "un-enable" one.

## Compiler options, briefly

Most tuning happens through **profiles** in `Cargo.toml` rather than raw flags:

```toml
[profile.release]
opt-level = 3        # 0–3 for speed, "s"/"z" for size
lto = true           # link-time optimization across crates
codegen-units = 1    # slower build, better optimization
panic = "abort"      # no unwinding: smaller binary, no catch_unwind
strip = "symbols"    # drop symbols from the shipped binary
```

| Option | Effect | Reach for it when |
|---|---|---|
| `opt-level = 3` | maximum speed (release default) | CPU-bound work |
| `opt-level = "z"` | maximum size reduction | embedded, WASM |
| `lto = true` | cross-crate inlining | shipping a release build |
| `codegen-units = 1` | better codegen, slower compile | final release only |
| `panic = "abort"` | smaller binary, faster unwind-free code | you never catch panics |
| `debug = true` | debug info (free at runtime) | profiling a release build |

One-off flags go through `RUSTFLAGS` (or `.cargo/config.toml`):

```bash
RUSTFLAGS="-C target-cpu=native" cargo build --release   # tune for THIS machine only
```

> [!warning] `target-cpu=native` binaries aren't portable
> It lets the compiler emit instructions your CPU supports (AVX-512, say) — a real speedup for numeric code, and an instant `SIGILL` crash on any machine without those instructions. Use it for local benchmarks and self-hosted deploys on known hardware; never for a binary you distribute.

> [!tip] Don't tune before you measure
> `--release` alone captures most of the available performance. `lto`/`codegen-units` typically buy single-digit percentages while noticeably slowing builds, and `opt-level` interacts with your actual workload in ways no table can predict. Profile first ([Optimization](#/ch/optimization)), change one knob, measure again.

## Summary

- `#[async_trait]` existed because traits couldn't return anonymous futures; it boxes them as `Pin<Box<dyn Future>>`.
- **Rust 1.75 stabilized `async fn` in traits**, so the macro is usually unnecessary — and axum 0.8 and friends have dropped it.
- It's still needed for **`dyn Trait`**: AFIT isn't object-safe.
- **Features** are additive, opt-in compilation slices; enable with `features = [...]`, gate with `#[cfg(feature = "…")]`, and never make them mutually exclusive.
- **Profiles** (`opt-level`, `lto`, `codegen-units`, `panic`, `strip`) are the main compiler knobs; `RUSTFLAGS` handles one-offs. Measure before tuning.

Deeper coverage lives in [Conditional Compilation & Features](#/ch/conditional-compilation), [The Cargo Toolbox](#/ch/cargo-deep), and [Optimization](#/ch/optimization).
