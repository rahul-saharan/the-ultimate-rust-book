<h1><span class="h1-kicker">Appendices</span>C · Derivable Traits</h1>

The `#[derive(...)]` attribute is one of Rust's greatest conveniences — it auto-generates trait implementations from your type's structure, saving mountains of boilerplate. This appendix lists the standard-library traits you can derive, what each gives you, and when to reach for it. You've used many throughout the book; here's the complete reference.

## The one you always want

```rust
#[derive(Debug)]
struct Point {
    x: i32,
    y: i32,
}

fn main() {
    let p = Point { x: 1, y: 2 };
    println!("{p:?}");   // Point { x: 1, y: 2 }
    println!("{p:#?}");  // pretty-printed
}
```

> [!best] Derive `Debug` on almost everything
> **`Debug`** costs nothing and makes debugging, logging, and testing vastly easier (`assert_eq!` prints values via `Debug` on failure). Put `#[derive(Debug)]` on essentially every struct and enum you define — it's the single most useful derive, and there's rarely a reason not to.

## The full list

| Trait | Gives you | Derive when… |
|-------|-----------|--------------|
| **`Debug`** | `{:?}` formatting | always (debugging/logging/tests) |
| **`Clone`** | `.clone()` — an explicit deep copy | the type should be duplicable |
| **`Copy`** | implicit bitwise copy on assignment | the type is small & all fields are `Copy` |
| **`PartialEq`** | `==` and `!=` | you compare values for equality |
| **`Eq`** | marks *total* equality (no extra methods) | equality is reflexive (not floats!) |
| **`PartialOrd`** | `<`, `>`, `<=`, `>=` | you compare/sort values |
| **`Ord`** | total ordering (`.cmp()`, `.sort()`, `BTreeMap` keys) | there's a total order |
| **`Hash`** | usable as a `HashMap`/`HashSet` **key** | you key collections by this type |
| **`Default`** | `T::default()` — a "zero" value | there's a sensible default |

```rust
// A type that's comparable, sortable, hashable, and clonable:
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
struct Version {
    major: u32,
    minor: u32,
    patch: u32,
}

use std::collections::HashSet;

fn main() {
    let a = Version { major: 1, minor: 2, patch: 0 };
    let b = a.clone();

    println!("{}", a == b);          // PartialEq
    println!("{}", a < Version { major: 2, ..Default::default() }); // PartialOrd + Default
    let mut set = HashSet::new();
    set.insert(a);                    // Hash + Eq → usable as a key
    println!("set size: {}", set.len());
}
```

## The trait relationships

Some derives require others, reflecting mathematical relationships:

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="Derive dependencies: Eq requires PartialEq, Ord requires PartialOrd plus Eq, Copy requires Clone">
  <style>
    .dvm { font: 600 11px var(--font-mono); fill: var(--text); }
    .dvc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .dvb { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.2; }
  </style>
  <rect x="20" y="20" width="110" height="26" rx="6" class="dvb"/><text x="34" y="38" class="dvm">PartialEq</text>
  <rect x="20" y="60" width="110" height="26" rx="6" class="dvb"/><text x="46" y="78" class="dvm">Eq</text>
  <path d="M75 46 L75 58" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#adv)"/>
  <text x="140" y="70" class="dvc">Eq requires PartialEq</text>
  <rect x="330" y="20" width="120" height="26" rx="6" class="dvb"/><text x="344" y="38" class="dvm">PartialOrd</text>
  <rect x="330" y="60" width="120" height="26" rx="6" class="dvb"/><text x="356" y="78" class="dvm">Ord</text>
  <path d="M390 46 L390 58" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#adv)"/>
  <text x="460" y="70" class="dvc">Ord requires PartialOrd + Eq</text>
  <rect x="20" y="110" width="110" height="26" rx="6" class="dvb"/><text x="42" y="128" class="dvm">Clone</text>
  <rect x="180" y="110" width="110" height="26" rx="6" class="dvb"/><text x="204" y="128" class="dvm">Copy</text>
  <path d="M130 123 L178 123" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#adv)"/>
  <text x="300" y="128" class="dvc">Copy requires Clone (and all fields Copy)</text>
  <defs><marker id="adv" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>Derive dependencies: <code>Eq</code> needs <code>PartialEq</code>, <code>Ord</code> needs <code>PartialOrd</code>+<code>Eq</code>, <code>Copy</code> needs <code>Clone</code>.</figcaption>
</figure>

> [!key] `Copy` vs `Clone`, and the float caveat
> - **`Clone`** is an *explicit* duplicate (`.clone()`), possibly expensive (deep copy). **`Copy`** means the type is duplicated *implicitly* on every assignment/pass and must be cheap — so `Copy` requires `Clone`, and *every field* must also be `Copy` (no `String`, `Vec`, `Box`). Derive `Copy` only for small, all-`Copy` types (a `Point` of integers, yes; anything owning heap data, no).
> - **`Eq`/`Ord`** require *total* equality/ordering, which **floats (`f32`/`f64`) don't have** (because `NaN != NaN`). So types containing floats can derive `PartialEq`/`PartialOrd` but **not** `Eq`/`Ord` — meaning they can't be `HashMap` keys or use `.sort()` directly.

## Deriving from other crates

Beyond `std`, crates provide their own derivable traits via [procedural macros](#/ch/macros-procedural) — you've seen several:

```rust,ignore
#[derive(Serialize, Deserialize)] // serde — JSON & more
#[derive(Error)]                   // thiserror — error types
#[derive(Parser)]                  // clap — CLI parsing
#[derive(Hash, PartialEq, Eq)]     // std — for HashMap keys
struct Config { /* ... */ }
```

> [!best] Derive first, implement by hand only when needed
> Reach for `#[derive(...)]` before writing a trait `impl` by hand — it's less code, always correct, and stays in sync as you add fields. Implement a trait manually only when you need *custom* behavior the derive can't express (e.g. a `Display` for user-facing output — which is *not* derivable — or an `Ord` that sorts by only one field). For the standard behaviors, derive is the idiomatic default.

## Summary

- **`#[derive(...)]`** auto-generates trait implementations from a type's structure — the idiomatic way to get standard behaviors.
- The common derivables: **`Debug`** (always), **`Clone`**/**`Copy`** (duplication), **`PartialEq`**/**`Eq`** (equality), **`PartialOrd`**/**`Ord`** (comparison/sorting), **`Hash`** (map keys), **`Default`** (zero value).
- Dependencies: `Eq`→`PartialEq`, `Ord`→`PartialOrd`+`Eq`, `Copy`→`Clone` (+ all fields `Copy`).
- **Floats** block `Eq`/`Ord` (NaN); so float-containing types can't be `HashMap` keys or `.sort()` directly.
- Crates add derivable traits too (**serde**, **thiserror**, **clap**); derive first, implement by hand only for custom behavior (like `Display`, which isn't derivable).

> [!exercise] Try it yourself
> 1. Derive `Debug, Clone, PartialEq` on a struct and test `==`, `.clone()`, and `{:?}`.
> 2. Try to derive `Copy` on a struct containing a `String` and read the error — then explain why it fails.
> 3. Derive `PartialOrd, Ord` on a struct of integers and `.sort()` a `Vec` of them; note the fields are compared in order (top to bottom).
