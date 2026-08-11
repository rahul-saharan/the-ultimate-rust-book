<h1><span class="h1-kicker">Idioms & Design Patterns</span>API Design Guidelines</h1>

There's a large gap between a library that *works* and one people enjoy using. The Rust community has spent years distilling that gap into a set of conventions — naming, signatures, derives, future-proofing — and following them makes your code feel like it belongs in the ecosystem. Ignore them and every user has to learn your dialect.

This chapter is the practical subset: the rules that come up in real code review, and the reasoning behind each one.

## Naming: the conventions that carry information

Rust naming isn't just style. Several conventions communicate **cost** and **ownership**, so a reader can spot a problem without opening the docs.

| Thing | Convention | Example |
|---|---|---|
| Types, traits, enum variants | `UpperCamelCase` | `HashMap`, `Iterator`, `Ordering::Less` |
| Functions, methods, fields, modules | `snake_case` | `push_str`, `is_empty`, `std::fs` |
| Constants and statics | `SCREAMING_SNAKE_CASE` | `u32::MAX`, `DEFAULT_PORT` |
| Generic type parameters | short `UpperCamelCase` | `T`, `K`, `V`, `E`, `S` |
| Lifetimes | short lowercase | `'a`, `'de`, `'src` |
| Crates | `kebab-case` name, `snake_case` import | `serde-json` → `serde_json` |

The prefix conventions are the load-bearing ones:

| Prefix | Promise | Takes | Example |
|---|---|---|---|
| `as_` | **free** — a borrowed view, no allocation | `&self` | `String::as_str`, `Vec::as_slice` |
| `to_` | **costs something** — allocates or computes | `&self` | `str::to_uppercase`, `slice::to_vec` |
| `into_` | **consumes** `self` | `self` | `String::into_bytes` |
| `is_` / `has_` | returns `bool` | `&self` | `is_empty`, `is_some` |
| `iter` / `iter_mut` / `into_iter` | borrowed / mutable / owned iteration | all three | the universal trio |
| `new` | the primary constructor | — | `Vec::new` |
| `with_*` | a constructor taking a parameter | — | `Vec::with_capacity` |
| `from_*` | a constructor from another representation | — | `String::from_utf8`, `i32::from_str_radix` |
| `try_*` | the fallible version, returns `Result` | varies | `try_from`, `try_into`, `try_lock` |
| `_mut` suffix | the mutable variant | `&mut self` | `get_mut`, `last_mut` |
| `_unchecked` suffix | skips checks, requires `unsafe` | varies | `get_unchecked` |

> [!best] Don't use a `get_` prefix for simple accessors
> Rust convention is `config.timeout()`, not `config.get_timeout()`. The `get_` prefix is reserved for lookups that can fail or do work — `HashMap::get`, `slice::get`. For a field accessor, the noun alone is the whole name, and the mutable version is `timeout_mut()`. This is one of the most common giveaways that a library was written by someone coming from Java or Go.

> [!mistake] A misnamed `as_` is a performance bug in disguise
> If `as_bytes()` secretly clones a megabyte, a reviewer scanning a hot loop for `to_` calls will walk right past it. Conversely, naming a genuinely free view `to_view()` makes readers avoid something that costs nothing. These prefixes are a contract with your users — breaking it wastes their time in the worst possible way, by making them distrust every other name you chose.

## Accept the widest type, return the narrowest

The single highest-leverage rule in API design. Be maximally permissive about what comes in, and maximally specific about what goes out.

<figure class="diagram">
<svg viewBox="0 0 640 240" role="img" aria-label="A wide input aperture narrowing through a function to a specific concrete output type">
  <style>
    .ad-h { font: 700 12px var(--font-sans); fill: var(--text); }
    .ad-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .ad-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .ad-in { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .ad-fn { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .ad-out { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
  </style>
  <text x="20" y="20" class="ad-h" fill="var(--blue)">Accept many shapes…</text>
  <rect x="20" y="32" width="130" height="26" rx="4" class="ad-in"/><text x="32" y="50" class="ad-m">&amp;str</text>
  <rect x="20" y="62" width="130" height="26" rx="4" class="ad-in"/><text x="32" y="80" class="ad-m">String</text>
  <rect x="20" y="92" width="130" height="26" rx="4" class="ad-in"/><text x="32" y="110" class="ad-m">&amp;Path</text>
  <rect x="20" y="122" width="130" height="26" rx="4" class="ad-in"/><text x="32" y="140" class="ad-m">PathBuf</text>
  <rect x="20" y="152" width="130" height="26" rx="4" class="ad-in"/><text x="32" y="170" class="ad-m">Cow&lt;'_, str&gt;</text>
  <rect x="230" y="76" width="190" height="60" rx="5" class="ad-fn"/>
  <text x="244" y="100" class="ad-m">fn read(</text>
  <text x="244" y="118" class="ad-m">  p: impl AsRef&lt;Path&gt;)</text>
  <path d="M152 45 L228 96" stroke="var(--blue)" stroke-width="1.6"/>
  <path d="M152 75 L228 102" stroke="var(--blue)" stroke-width="1.6"/>
  <path d="M152 105 L228 108" stroke="var(--blue)" stroke-width="1.6"/>
  <path d="M152 135 L228 114" stroke="var(--blue)" stroke-width="1.6"/>
  <path d="M152 165 L228 120" stroke="var(--blue)" stroke-width="1.6"/>
  <text x="470" y="20" class="ad-h" fill="var(--green)">…return one thing.</text>
  <rect x="470" y="90" width="150" height="32" rx="4" class="ad-out"/>
  <text x="482" y="111" class="ad-m">io::Result&lt;String&gt;</text>
  <path d="M422 106 L466 106" stroke="var(--green)" stroke-width="2.5" marker-end="url(#arr-ad)"/>
  <text x="20" y="206" class="ad-c">Wide input = fewer conversions at every call site. Narrow output = callers know exactly what they have.</text>
  <text x="20" y="224" class="ad-c">Returning <tspan font-family="var(--font-mono)">impl Trait</tspan> is the exception: it hides your type so you can change it later.</text>
  <defs><marker id="arr-ad" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--green)"/></marker></defs>
</svg>
<figcaption>Widen the aperture on the way in, narrow it on the way out. Every conversion you absorb is one your users don't write.</figcaption>
</figure>

| Instead of | Take | Because |
|---|---|---|
| `&Vec<T>` | `&[T]` | arrays and slices work too, same machine code |
| `&String` | `&str` | literals work, no allocation |
| `String` (read-only) | `&str` | callers with a borrow don't have to clone |
| `String` (you keep it) | `impl Into<String>` | literals *and* owned values both work |
| `&str` (a file path) | `impl AsRef<Path>` | `PathBuf` users don't convert |
| `Vec<T>` (parameter) | `impl IntoIterator<Item = T>` | any collection, any iterator |
| `&HashMap<K, V>` | `&BTreeMap` or a trait | only if callers genuinely differ |

```rust
use std::collections::HashSet;

// ❌ Narrow: only a Vec will do.
fn total_bad(items: &Vec<i64>) -> i64 {
    items.iter().sum()
}

// ✅ Wide: Vec, array, slice, and VecDeque slices all work.
fn total(items: &[i64]) -> i64 {
    items.iter().sum()
}

// ✅ Wider still: any iterable.
fn total_any(items: impl IntoIterator<Item = i64>) -> i64 {
    items.into_iter().sum()
}

fn main() {
    let v = vec![1i64, 2, 3];
    let arr = [10i64, 20];
    let set: HashSet<i64> = HashSet::from([100, 200]);

    println!("{}", total(&v));
    println!("{}", total(&arr));       // ← total_bad could not do this
    println!("{}", total_any(v.clone()));
    println!("{}", total_any(set));    // ← nor this
    println!("{}", total_any(1..=10)); // ← nor this
}
```

> [!warning] Returning `impl Trait` is a promise about *behaviour*, not *type*
> `fn names(&self) -> impl Iterator<Item = &str>` lets you swap the implementation later without breaking anyone — a real win. But it also means callers can't name the type, can't store it in a struct field easily, and lose access to concrete methods. For an iterator, `impl Iterator` is almost always right. For a collection, return the real `Vec<T>` — hiding it buys you nothing and costs your users flexibility.

## Make illegal states unrepresentable

The type system is your best documentation, because it's the only kind that's checked.

```rust
// ❌ Three bools = eight states, only three of which are valid.
#[derive(Debug)]
struct BadJob {
    is_pending: bool,
    is_running: bool,
    is_done: bool,
}

// ✅ An enum = exactly the states that exist, and the data each one carries.
#[derive(Debug)]
enum Job {
    Pending { queued_at: u64 },
    Running { started_at: u64, worker: String },
    Done { exit_code: i32 },
}

impl Job {
    fn describe(&self) -> String {
        match self {
            Job::Pending { queued_at } => format!("queued at {queued_at}"),
            Job::Running { worker, .. } => format!("running on {worker}"),
            Job::Done { exit_code: 0 } => "succeeded".to_string(),
            Job::Done { exit_code } => format!("failed with {exit_code}"),
        }
    }
}

fn main() {
    let jobs = [
        Job::Pending { queued_at: 100 },
        Job::Running { started_at: 120, worker: "w-3".into() },
        Job::Done { exit_code: 0 },
        Job::Done { exit_code: 137 },
    ];

    for j in &jobs {
        println!("{}", j.describe());
    }

    // The bool version can't stop this. The enum version can't express it.
    let impossible = BadJob { is_pending: true, is_running: true, is_done: true };
    println!("{impossible:?} ← nonsense, yet perfectly legal");
}
```

| Smell | Replace with |
|---|---|
| several `bool` fields describing one thing | an `enum` |
| a `bool` parameter (`send(true)`) | a two-variant enum (`send(Mode::Async)`) |
| `Option<T>` fields that must agree | an enum carrying both together |
| a `String` field with only valid values | an enum or a newtype with `parse` |
| `-1` / `0` / empty string as "absent" | `Option<T>` |
| separate `value` + `unit` fields | a newtype per unit (`Meters`, `Seconds`) |

> [!best] Never take a bare `bool` parameter
> `window.set_visible(true)` reads fine. `parse(input, true, false)` is a puzzle. A two-variant enum makes the call site self-documenting — `parse(input, Strict::Yes, Trailing::Allow)` — and lets you add a third case later without breaking anyone. The standard library does this everywhere: `Ordering`, `Bound`, `SeekFrom`.

## Derive generously

Every trait you don't derive is a limit you impose on your users. If your type can support it, derive it.

| Trait | Enables | Derive it unless |
|---|---|---|
| `Debug` | `{:?}`, `assert_eq!` failure output, logging | it holds a secret (then implement it by hand, redacted) |
| `Clone` | callers duplicating the value | copying is genuinely wrong (a file handle, a unique ID) |
| `Copy` | implicit copies for small values | it owns heap data, or copying should be visible |
| `PartialEq` / `Eq` | `==`, use as a `HashMap` key | equality is ill-defined (floats → only `PartialEq`) |
| `Hash` | use as a `HashMap`/`HashSet` key | it isn't `Eq` |
| `PartialOrd` / `Ord` | sorting, `BTreeMap` keys | there's no sensible order |
| `Default` | `..Default::default()`, `or_default()` | there is no sensible zero value |
| `serde::Serialize` / `Deserialize` | JSON, config, wire formats | put it behind a feature flag |

> [!key] `#[derive(Debug)]` on every public type, without exception
> A public type without `Debug` cannot appear in an `assert_eq!` failure message, a `dbg!`, a log line, or a `#[derive(Debug)]` struct that contains it — which means it silently infects everything downstream. It is the single most common omission in first libraries, and the easiest to fix. If the contents are sensitive, implement `Debug` manually and print `Token(***)`; don't omit it.

> [!tip] Mark important return values `#[must_use]`
> `#[must_use]` makes the compiler warn when a return value is discarded. It's how `Result` catches ignored errors — and you should apply it to your own types with the same property: a builder (`.port(443);` on its own line does nothing), a guard, or any method whose whole purpose is its return value. One attribute, a whole class of silent bug gone.

## Future-proofing: leave yourself room

Public API is a promise. These tools let you keep it while still evolving.

```rust
// Callers cannot construct this with a struct literal, so adding a field later
// is not a breaking change.
#[derive(Debug, Default)]
#[non_exhaustive]
pub struct Options {
    pub verbose: bool,
    pub retries: u32,
}

// Callers must include a `_ =>` arm, so adding a variant later is not breaking.
#[derive(Debug)]
#[non_exhaustive]
pub enum Kind {
    Text,
    Binary,
}

fn main() {
    // Inside the defining crate, everything still works normally.
    let opts = Options { verbose: true, retries: 5 };
    println!("{opts:?}");

    // Downstream crates would have to write:
    let mut opts2 = Options::default();
    opts2.verbose = true;
    println!("{opts2:?}");

    let k = Kind::Text;
    match k {
        Kind::Text => println!("text"),
        Kind::Binary => println!("binary"),
        _ => println!("something added in a later version"),
    }
}
```

| Technique | Protects you when you later want to… |
|---|---|
| `#[non_exhaustive]` on a struct | add a public field |
| `#[non_exhaustive]` on an enum | add a variant |
| private fields + accessor methods | change the representation entirely |
| a sealed trait (private supertrait) | add a required method |
| `#[doc(hidden)]` on internals | rename or delete them |
| a builder instead of a big `new()` | add another option |
| returning `impl Trait` | swap the concrete type |
| a feature flag for heavy deps | make them optional |

> [!deep] Sealing a trait
> If a public trait can be implemented by anyone, adding a required method to it breaks every implementor — so it's a **major** version bump forever. The *sealed trait* pattern prevents outside implementations: give your public trait a private supertrait that only you can implement.
> ```rust,ignore
> mod private { pub trait Sealed {} }
>
> pub trait Backend: private::Sealed {
>     fn name(&self) -> &str;
> }
>
> pub struct Postgres;
> impl private::Sealed for Postgres {}
> impl Backend for Postgres { fn name(&self) -> &str { "postgres" } }
> ```
> Now `Backend` can be *used* by anyone and *implemented* only by you, so you're free to extend it. Use it for traits that model a closed set — supported database backends, wire protocol versions — and not for traits meant as extension points.

## What actually breaks semver

Rust's semver rules are more subtle than "don't delete things". A quick reference for `1.x` → `1.y`:

| Change | Breaking? |
|---|---|
| adding a public function, type, or module | no |
| adding a field to a struct with private fields | no |
| adding a field to a fully-public struct | **yes** (breaks literals) — unless `#[non_exhaustive]` |
| adding an enum variant | **yes** (breaks matches) — unless `#[non_exhaustive]` |
| adding a method to a trait **with** a default body | usually no (can collide with inherent methods) |
| adding a *required* method to a trait | **yes** |
| adding a blanket `impl` | **yes** (can conflict downstream) |
| adding a trait bound to an existing generic | **yes** |
| loosening a bound / widening a parameter type | no |
| tightening a return type (`impl Iterator` → `Vec`) | **yes** |
| renaming anything public | **yes** |
| raising your minimum supported Rust version | not technically, but treat it as notable |

> [!warning] Adding a derive can be a breaking change
> Adding `#[derive(Clone)]` is fine. Adding `#[derive(PartialEq)]` to a type someone already wrote their own `PartialEq` for is a conflict. Adding `Copy` changes move semantics in ways that can alter behaviour downstream. And adding a blanket `impl<T: MyTrait> OtherTrait for T` can collide with an impl in a user's own crate. Run [`cargo-semver-checks`](#/ch/cargo-deep) before you publish — it catches most of this automatically.

## Document what the compiler can't say

Doc comments are compiled and tested, which makes them the most reliable documentation you can write.

```rust
/// Splits a `key=value` pair.
///
/// # Examples
///
/// ```
/// # fn split_pair(s: &str) -> Option<(&str, &str)> { s.split_once('=') }
/// assert_eq!(split_pair("mode=fast"), Some(("mode", "fast")));
/// assert_eq!(split_pair("no-equals"), None);
/// ```
///
/// # Errors
///
/// Returns `None` if the input contains no `=`.
///
/// # Panics
///
/// Never panics.
pub fn split_pair(s: &str) -> Option<(&str, &str)> {
    s.split_once('=')
}

fn main() {
    println!("{:?}", split_pair("a=b"));
}
```

The conventional sections, in order: `# Examples`, `# Errors`, `# Panics`, `# Safety` (mandatory for `unsafe fn`).

> [!best] Every public item gets an example, and `#![warn(missing_docs)]` enforces it
> Examples in doc comments run as tests under `cargo test`, so they can never drift out of date — an enormous advantage over prose. Add `#![warn(missing_docs)]` at the top of your `lib.rs` and the compiler will nag you about undocumented public items. Between those two habits, your docs stay both complete and correct with almost no discipline required.

## The review checklist

Before you publish, walk this list:

- [ ] Types are `UpperCamelCase`, functions `snake_case`, constants `SCREAMING_SNAKE_CASE`.
- [ ] `as_` is free, `to_` allocates, `into_` consumes — and no `get_` prefixes on plain accessors.
- [ ] Parameters take `&str`, `&[T]`, `impl AsRef<Path>`, or `impl Into<T>` rather than concrete owned types.
- [ ] No bare `bool` parameters; enums instead.
- [ ] Every public type derives at least `Debug`, and `Clone` where sensible.
- [ ] Public structs have private fields or `#[non_exhaustive]`; public enums are `#[non_exhaustive]` if they may grow.
- [ ] Errors implement `std::error::Error` and are your own type, not `Box<dyn Error>` or `String`.
- [ ] Important return values are `#[must_use]`.
- [ ] Every public item has a doc comment with an `# Examples` block.
- [ ] `cargo clippy -- -W clippy::pedantic` is quiet, or the exceptions are justified.

## Summary

- Naming carries meaning: **`as_`** is free, **`to_`** costs, **`into_`** consumes; skip `get_` on accessors.
- **Accept the widest type, return the narrowest** — `&[T]`, `&str`, `impl AsRef<Path>`, `impl Into<String>` on the way in; a concrete type on the way out (except `impl Trait` for iterators).
- **Make illegal states unrepresentable**: enums instead of bool soup, newtypes instead of raw primitives, `Option` instead of sentinel values.
- **Derive generously** — always `Debug`; `Clone`, `PartialEq`, `Hash`, `Default` wherever they make sense.
- **Future-proof** with `#[non_exhaustive]`, private fields, sealed traits, builders, and feature flags.
- Know what breaks **semver** — adding an enum variant or a required trait method does; adding a function doesn't.
- Document with **doc tests**, use the standard `# Examples` / `# Errors` / `# Panics` sections, and turn on `missing_docs`.

> [!exercise] Try it yourself
> 1. Take `fn load(path: &String, verbose: bool) -> Vec<String>` and rewrite the signature following every rule in this chapter. How many things changed?
> 2. Find a struct with three `bool` fields (in your own code or an example above) and replace it with an enum. Count the states you eliminated.
> 3. Add `#[non_exhaustive]` to a public struct in a small crate and try to construct it with a struct literal from a test in `tests/`. Read the error.
> 4. Write a public function with a doc comment containing an `# Examples` block, then run `cargo test` and confirm the example actually executed.
> 5. Implement the sealed-trait pattern for a `Backend` trait with two implementors, then try to implement it from outside the module.

Next: the flip side of good design — the **anti-patterns** that make Rust code painful, and what to do instead.
