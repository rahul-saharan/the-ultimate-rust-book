<h1><span class="h1-kicker">Appendices</span>B · Operators & Symbols</h1>

Rust uses a lot of symbols, and while most are familiar, a few (`?`, `'a`, `|x|`, `..=`) are distinctive. This appendix is a reference to every operator and symbol you'll encounter, so you always have a place to look up "what does `::` mean again?"

## Arithmetic & comparison

| Operator | Meaning | Example |
|----------|---------|---------|
| `+ - * / %` | add, subtract, multiply, divide, remainder | `a + b`, `a % b` |
| `== !=` | equal, not equal | `a == b` |
| `< > <= >=` | comparisons | `a < b` |
| `&& \|\|` | logical AND, OR (short-circuiting) | `a && b` |
| `!` | logical NOT (on `bool`); also the macro marker | `!flag`, `println!` |

## Bitwise

| Operator | Meaning |
|----------|---------|
| `& \| ^` | bitwise AND, OR, XOR ([bits](#/ch/dsa-bit-manipulation)) |
| `!` | bitwise NOT (on integers) |
| `<< >>` | left / right shift |
| `+= -= &= \|= ...` | compound assignment (any op + `=`) |

## References, pointers & closures

| Symbol | Meaning |
|--------|---------|
| `&` `&mut` | a shared / mutable [reference](#/ch/references-borrowing) |
| `*` | dereference a reference/pointer (`*p`); also multiply |
| `'a` | a [lifetime](#/ch/lifetimes) annotation (`&'a str`) |
| `'static` | the lifetime lasting the whole program |
| `\|x, y\|` | a [closure](#/ch/closures)'s parameter list (`\|x\| x + 1`) |
| `move` | closure/`async` taking ownership of captures |

## Paths, generics & types

| Symbol | Meaning |
|--------|---------|
| `::` | path separator (`std::collections::HashMap`); associated items (`Type::new`) |
| `::<T>` | the *turbofish* — specify a [generic](#/ch/generics) type (`"5".parse::<i32>()`) |
| `<T>` `<T, E>` | generic type parameters |
| `->` | function return type (`fn f() -> i32`); closure return |
| `=>` | a [`match`](#/ch/pattern-matching) arm; macro rule |
| `_` | wildcard pattern; ignore a binding; type placeholder (`Vec<_>`) |
| `?` | the [`?` operator](#/ch/question-mark) — propagate `Err`/`None`; also `?Sized` |
| `#[...]` `#![...]` | an attribute (`#[derive(Debug)]`) / inner attribute |
| `dyn` | a trait object type |
| `impl` | `impl Trait` in argument/return position |

## Ranges & structure

| Symbol | Meaning |
|--------|---------|
| `..` | range excluding the end (`0..5`); struct update (`..other`); rest pattern |
| `..=` | range including the end (`1..=5`) |
| `...` | inclusive range **in patterns** (older syntax; prefer `..=`) |
| `@` | bind *and* test in a pattern (`n @ 1..=5`) |
| `\|` | *or* in a pattern (`'a' \| 'e'`); closure param delimiter |
| `;` | end a statement; array-repeat (`[0; 5]`) |
| `!` | the [never type](#/ch/advanced-types) (`fn() -> !`); macro call; NOT |

## The distinctive Rust symbols, explained

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="The four most distinctive Rust symbols and their meanings">
  <style>
    .opm { font: 600 13px var(--font-mono); fill: var(--text); }
    .opc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .opb { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.2; }
  </style>
  <rect x="14" y="16" width="150" height="56" rx="8" class="opb"/><text x="60" y="42" class="opm">?</text><text x="26" y="62" class="opc">propagate errors</text>
  <rect x="174" y="16" width="150" height="56" rx="8" class="opb"/><text x="230" y="42" class="opm">::&lt;T&gt;</text><text x="186" y="62" class="opc">turbofish (pick type)</text>
  <rect x="334" y="16" width="150" height="56" rx="8" class="opb"/><text x="388" y="42" class="opm">'a</text><text x="346" y="62" class="opc">a lifetime name</text>
  <rect x="494" y="16" width="132" height="56" rx="8" class="opb"/><text x="540" y="42" class="opm">|x|</text><text x="506" y="62" class="opc">closure params</text>
  <text x="14" y="110" class="opc">These four trip up newcomers most — but each has a single, learnable meaning.</text>
  <text x="14" y="130" class="opc">?: "give me the value or return the error"  ·  ::&lt;T&gt;: "use this concrete type here"</text>
</svg>
<figcaption>The four symbols that feel most "Rust": error propagation, the turbofish, lifetimes, and closures.</figcaption>
</figure>

> [!tip] Operator overloading
> The arithmetic and comparison operators aren't magic — they're **traits** you can implement for your own types (`Add`, `Sub`, `Mul`, `PartialEq`, `PartialOrd`, `Index`, …) from `std::ops` and `std::cmp`. That's how `String + &str` concatenates and how a math library makes `vector_a + vector_b` work. See [Advanced Traits](#/ch/advanced-traits) for how to overload them responsibly.

> [!note] Macros vs. the not operator
> The `!` symbol does triple duty: **logical/bitwise NOT** (`!x`), the **never type** (`-> !`), and the **macro-call marker** (`println!`, `vec!`). Context makes it unambiguous — a `!` immediately after an identifier and before `(`/`[`/`{` is a macro call; elsewhere it's NOT or the never type.

## Summary

- Rust's operators cover the usual **arithmetic**, **comparison**, **logical**, and **bitwise** operations, plus **compound assignment** (`+=`, etc.).
- Distinctive Rust symbols: **`&`/`&mut`** (references), **`::`** (paths) and **`::<T>`** (turbofish), **`'a`** (lifetimes), **`\|x\|`** (closures), **`?`** (error propagation), **`..`/`..=`** (ranges), **`=>`** (match arms), **`_`** (wildcard), **`#[...]`** (attributes).
- Arithmetic/comparison operators are **overloadable traits** from `std::ops`/`std::cmp`.
- **`!`** means NOT, the never type, *or* a macro call depending on context.

> [!tip] When a symbol confuses you, look here
> Rust's symbol density is real, especially early on. Whenever a `?`, `::<>`, `'a`, `@`, or `..=` stops you, this table is your reference. Each symbol has exactly one job (or a small, context-clear set) — once learned, they read as naturally as words.
