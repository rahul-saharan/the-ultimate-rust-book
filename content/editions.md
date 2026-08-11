<h1><span class="h1-kicker">Advanced Rust</span>Editions: 2015 to 2024</h1>

Rust promises backwards compatibility: code that compiled in 2015 still compiles today. But that promise conflicts with wanting to fix mistakes — you can't add a keyword, or change what a piece of syntax means, without breaking somebody. **Editions** are how Rust escapes that trap, and they're one of the language's most quietly impressive design decisions.

Understanding them takes about ten minutes and saves you from a lot of confusion about why some code you found online doesn't compile.

## What an edition is (and isn't)

An edition is an **opt-in bundle of changes to syntax and idioms**, chosen per crate in `Cargo.toml`:

```toml
[package]
name = "my-crate"
version = "0.1.0"
edition = "2021"        # 2015, 2018, 2021, or 2024
```

That's the whole mechanism. The compiler reads it and applies that edition's rules to your crate.

<figure class="diagram">
<svg viewBox="0 0 640 230" role="img" aria-label="Crates using different editions all compile with the same compiler and link together into one binary" >
  <style>
    .ed-h { font: 700 12px var(--font-sans); }
    .ed-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .ed-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .ed-a { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .ed-b { fill: var(--teal-soft); stroke: var(--teal); stroke-width: 1.5; }
    .ed-d { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.5; }
    .ed-c2 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="20" y="18" class="ed-h" fill="var(--text-mute)">your dependency tree — mixed editions are completely normal</text>
  <rect x="20" y="30" width="150" height="42" rx="5" class="ed-a"/>
  <text x="32" y="48" class="ed-m">my-app</text>
  <text x="32" y="64" class="ed-c">edition 2024</text>
  <rect x="20" y="84" width="150" height="42" rx="5" class="ed-b"/>
  <text x="32" y="102" class="ed-m">some-lib</text>
  <text x="32" y="118" class="ed-c">edition 2021</text>
  <rect x="20" y="138" width="150" height="42" rx="5" class="ed-d"/>
  <text x="32" y="156" class="ed-m">ancient-lib</text>
  <text x="32" y="172" class="ed-c">edition 2015</text>
  <rect x="240" y="78" width="150" height="54" rx="5" class="ed-c2"/>
  <text x="252" y="100" class="ed-m">one rustc</text>
  <text x="252" y="118" class="ed-c">all editions at once</text>
  <rect x="450" y="78" width="160" height="54" rx="5" class="ed-c2"/>
  <text x="462" y="100" class="ed-m">one binary</text>
  <text x="462" y="118" class="ed-c">links together fine</text>
  <path d="M172 51 L238 90" stroke="var(--blue)" stroke-width="1.8" marker-end="url(#arr-ed)"/>
  <path d="M172 105 L238 105" stroke="var(--teal)" stroke-width="1.8" marker-end="url(#arr-ed)"/>
  <path d="M172 159 L238 120" stroke="var(--purple)" stroke-width="1.8" marker-end="url(#arr-ed)"/>
  <path d="M392 105 L446 105" stroke="var(--rust-500)" stroke-width="2.5" marker-end="url(#arr-ed2)"/>
  <text x="20" y="208" class="ed-c">Editions are per-CRATE, never per-project. Upgrading yours does not affect your dependencies, or theirs.</text>
  <text x="20" y="224" class="ed-c">There is no runtime cost, no ABI difference, and no ecosystem split. This is why editions work at all.</text>
  <defs>
    <marker id="arr-ed" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker>
    <marker id="arr-ed2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker>
  </defs>
</svg>
<figcaption>Every edition compiles with the <b>same</b> compiler, and crates on different editions interoperate freely. That's the whole trick.</figcaption>
</figure>

> [!key] Editions are per-crate and fully interoperable
> This is the property that makes the whole scheme work. Your `edition = "2024"` crate can depend on an `edition = "2015"` crate and vice versa, with no wrappers and no cost. There is no "Rust 2" and no Python-2-to-3 split — because nobody is ever forced to migrate. A crate can stay on edition 2015 forever and keep working with the newest compiler.

> [!note] An edition is not a compiler version
> `edition = "2021"` doesn't mean "use the 2021 compiler". You always use the *current* compiler, which supports every edition. So a 2015-edition crate still gets today's optimizations, today's error messages, and every library feature stabilized since — it just uses the older syntax rules. Most new features (new methods, new traits, `async fn`) are **not** edition-gated and are available everywhere.

## What changed in each edition

### 2015 → 2018

The largest change, mostly to the module system.

| Change | Before (2015) | After (2018) |
|---|---|---|
| importing crates | `extern crate serde;` required | just `use serde::…` |
| module paths | `use ::foo::Bar;` ambiguous rules | `crate::`, `self::`, `super::` prefixes |
| module files | `mod.rs` per directory | `foo.rs` + `foo/` both work |
| trait objects | `Box<Trait>` allowed | `dyn` required: `Box<dyn Trait>` |
| `async`/`await` | ordinary identifiers | reserved keywords |
| `try` | an identifier | reserved keyword |
| lifetime elision in `impl` | more verbose | `'_` anonymous lifetime |

### 2018 → 2021

Smaller and more targeted.

| Change | Effect |
|---|---|
| **disjoint closure captures** | a closure captures `s.field`, not all of `s` — far fewer borrow errors |
| **`IntoIterator` for arrays** | `for x in [1, 2, 3]` yields values, not references |
| **panic macro consistency** | `panic!("{}", x)` required; `panic!(x)` with a non-literal is an error |
| **new prelude items** | `TryFrom`, `TryInto`, `FromIterator` available without `use` |
| **reserved prefixes** | `ident"string"` and `ident#foo` reserved for future syntax |
| **`Or` patterns in macros** | `$x:pat` now matches `A | B` |

```rust
// The disjoint-capture change is the one you feel day to day.
struct Config {
    name: String,
    retries: u32,
}

fn main() {
    let mut config = Config { name: String::from("prod"), retries: 3 };

    // In edition 2021 this closure captures ONLY config.retries.
    let mut bump = || config.retries += 1;
    bump();
    bump();

    // …so we can still read config.name afterwards. In edition 2018 the
    // closure captured all of `config`, and this line was a borrow error.
    println!("{} has {} retries", config.name, config.retries);

    // Arrays iterate BY VALUE in 2021, which is what you'd expect.
    for s in [String::from("a"), String::from("b")] {
        // `s` is an owned String here, not a &String.
        println!("owned: {}", s.to_uppercase());
    }
}
```

### 2021 → 2024

Stabilized with Rust 1.85. Mostly tightening `unsafe` and cleaning up temporaries.

| Change | Effect |
|---|---|
| **`unsafe extern` blocks** | `extern "C" { … }` must be written `unsafe extern "C" { … }` |
| **unsafe attributes** | `#[no_mangle]` → `#[unsafe(no_mangle)]`, same for `export_name`, `link_section` |
| **`unsafe_op_in_unsafe_fn`** | an `unsafe fn` body is no longer implicitly an `unsafe` block — warns by default |
| **`static mut` references** | taking `&mut SOME_STATIC` is now an error, not a lint |
| **RPIT lifetime capture** | `-> impl Trait` now captures all in-scope lifetimes by default |
| **tail-expression temporaries** | temporaries in a tail expression drop *before* local variables |
| **`if let` temporary scope** | the scrutinee's temporaries drop before the `else` block runs |
| **`gen` reserved** | reserved for generator blocks |
| **prelude additions** | `Future` and `IntoFuture` |
| **`macro_rules!` `expr`** | the `expr` fragment now also matches `const { … }` and `_` |
| **Cargo resolver v3** | MSRV-aware dependency resolution becomes the default |

```rust,ignore
// Edition 2021:
extern "C" {
    fn getpid() -> i32;
}

#[no_mangle]
pub extern "C" fn callback() {}

unsafe fn dangerous(p: *const u8) -> u8 {
    *p  // implicitly unsafe — no block needed
}

// Edition 2024: the unsafety is explicit at every level.
unsafe extern "C" {
    fn getpid() -> i32;
}

#[unsafe(no_mangle)]
pub extern "C" fn callback() {}

unsafe fn dangerous(p: *const u8) -> u8 {
    unsafe { *p }  // the block is now required
}
```

> [!best] The 2024 `unsafe` changes are worth understanding, not just accepting
> `unsafe_op_in_unsafe_fn` is the significant one. Previously, marking a function `unsafe` made its *entire body* implicitly unsafe — so a 200-line `unsafe fn` gave you no indication which three lines were actually doing something dangerous. Requiring explicit `unsafe` blocks inside means the audit surface shrinks to what really needs auditing. It's more typing and genuinely better. See [Unsafe Rust](#/ch/unsafe).

> [!warning] `static mut` references are now an error
> `static mut COUNTER: u32 = 0;` followed by `unsafe { COUNTER += 1 }` was always undefined behaviour waiting to happen — two threads doing it is a data race with no synchronization at all. Edition 2024 makes taking a reference to a `static mut` a hard error. The replacements are better anyway: `AtomicU32` for counters, `Mutex`/`RwLock` for structured data, `OnceLock`/`LazyLock` for one-time initialization, or `thread_local!` for per-thread state.

## Migrating

Cargo automates most of it.

```bash
# 1. Make sure you're clean and the current edition builds.
cargo build --all-targets
git commit -am "checkpoint before edition migration"

# 2. Fix any idiom lints for your CURRENT edition first.
cargo fix --edition-idioms

# 3. Apply the automatic migration to the next edition.
cargo fix --edition

# 4. NOW bump the edition in Cargo.toml (cargo fix does not do this).
#    edition = "2024"

# 5. Build and test. Fix whatever remains by hand.
cargo build --all-targets
cargo test
cargo clippy --all-targets
```

| Step | Why it matters |
|---|---|
| commit first | `cargo fix` rewrites your source in place |
| `--edition-idioms` **before** `--edition` | resolves ambiguities while the old rules still apply |
| migrate **one** edition at a time | 2015 → 2018 → 2021 → 2024, not a single jump |
| `--all-targets` | tests, benches, and examples migrate too, and are easy to forget |
| review the diff | `cargo fix` is conservative but it does make choices |
| bump the edition yourself | `cargo fix --edition` prepares the code; it doesn't edit the manifest |

> [!mistake] Running `cargo fix --edition` on a dirty working tree
> It rewrites your files in place, so an uncommitted change and a migration edit become indistinguishable. Cargo will refuse if it detects a dirty tree (pass `--allow-dirty` to override, which you shouldn't). Commit first; the migration then shows up as one reviewable diff you can inspect or revert wholesale.

> [!note] Migration is optional, and there's no deadline
> Nothing breaks if you stay on edition 2021 indefinitely — a great many widely-used crates do. Migrate when you want a specific edition's improvements or when starting something new. `cargo new` uses the latest edition by default, which handles the common case for you. The one consideration: bumping an edition raises the minimum compiler version your crate needs, which for a published library is an **MSRV** change — see [The Cargo Toolbox](#/ch/cargo-deep).

## Which edition should I use?

| Situation | Edition |
|---|---|
| a new project | the latest (2024) — `cargo new` picks it |
| a published library with a conservative MSRV | whatever your MSRV supports |
| an existing project that works fine | leave it; migrate deliberately |
| learning Rust from a book or tutorial | match what it uses; 2021 and 2024 are nearly identical for learning |
| code that must compile on an old toolchain | 2021 (needs 1.56+) or 2018 (needs 1.31+) |

> [!tip] Check the edition before you debug tutorial code
> A `Box<Trait>` without `dyn`, an `extern crate` line, or a `for x in [1,2,3]` that yields references — these are edition signals, not errors. If code from a blog post doesn't compile, look at when it was written and which edition it assumed before assuming it's wrong. The reverse also happens: an example using `let`-chains needs edition **2024**, and will fail on 2021 with a baffling parse error.

## The rustfmt style edition

Formatting has its own versioning, so upgrading your edition doesn't reformat your whole codebase unexpectedly:

```toml
# rustfmt.toml
style_edition = "2024"      # independent of the Cargo edition
```

Edition 2024's style rules change how imports are sorted (version-sorting, so `v2` comes before `v10`) and a few other details. You can adopt the code edition and the style edition separately, which is useful when you want the language changes without a formatting churn commit.

## Summary

- An **edition** is a per-crate, opt-in bundle of syntax and idiom changes, set with `edition = "…"` in `Cargo.toml`.
- Crates on **different editions interoperate freely** with zero cost — that's why editions avoid a Python-2-style split.
- An edition is **not** a compiler version: you always use the current compiler, and most new features aren't edition-gated at all.
- **2018** overhauled the module system and required `dyn Trait`. **2021** brought disjoint closure captures and by-value array iteration. **2024** tightened `unsafe` (`unsafe extern`, `unsafe` attributes, `unsafe_op_in_unsafe_fn`), banned `static mut` references, and cleaned up temporary lifetimes.
- Migrate with **`cargo fix --edition-idioms`**, then **`cargo fix --edition`**, then bump the manifest yourself — one edition at a time, on a clean tree, with `--all-targets`.
- Migration is **optional and undated**. Bumping an edition raises your MSRV, which matters for published libraries.
- `style_edition` in `rustfmt.toml` is versioned separately, so formatting changes don't ride along.

> [!exercise] Try it yourself
> 1. Check the `edition` of a project you have locally. Then look at three dependencies in your `Cargo.lock` and find their editions — are they all the same?
> 2. Write the closure-capture example from this chapter and compile it. Then set `edition = "2018"` and compile again. Read the error.
> 3. Write `for s in [String::from("a")]` and print `s.to_uppercase()`. Switch to edition 2018 — why does it break?
> 4. Take a small crate on edition 2021 and run `cargo fix --edition` (on a clean tree). What did it change? Now bump the manifest and build.
> 5. Find a Rust code sample online that doesn't compile for you. Determine whether it's an edition difference, and identify which edition it was written for.

Next, a feature that lets types be parameterized by *values* rather than just other types — **const generics**.
